/**
 * src/app/src/entry/teacher.js
 *
 * Lobby do professor: lista os alunos de uma turma (online primeiro),
 * permite observar um aluno ao vivo — o motor real do editor é montado
 * IMEDIATAMENTE em modo só-visualização (bloqueado, LiveMirror.
 * showLockOverlay), pilotado pelos dados que o aluno já transmite o tempo
 * todo (o aluno sempre broadcasta seu próprio estado enquanto uma sessão
 * está ativa, não só quando o professor pede) — nada de foto/imagem.
 * Clicando na barra "Assumir controle", o professor pede aprovação do
 * aluno e passa a editar de verdade.
 *
 * Também permite abrir o último projeto de um aluno OFFLINE — mesmo
 * mecanismo de bypass de sessão, mas sem handshake nenhum (não tem
 * ninguém do outro lado pra aprovar): entra direto editando.
 *
 * turma_id vem de ?turmaId= na URL (redirect vindo da HelloYotta).
 *
 * "Assumir controle"/edição offline são a parte de maior risco: montam o
 * motor completo do ScratchJr contra os endpoints de bypass em
 * backend/src/routes/teacher.js (GET/PUT /api/teacher/session/:id/project),
 * que existem só enquanto a live_session estiver ativa.
 */

import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import IO from '../iPad/IO.js';
import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML, gn } from '../utils/lib.js';
import {
    applyStageState, applyUiState, applyPageList, buildMirrorPayload,
    showLockOverlay, hideLockOverlay, resetMirroredUi, reloadProjectFromBackend,
    resetMirrorState, ABOVE_LOCK_OVERLAY_Z_INDEX,
} from '../editor/LiveMirror.js';

const HEARTBEAT_MS = 20000;
const DEVICE_ID_KEY = 'scratchjr_teacher_device_id';
// Payload é dado (JSON, ~1KB típico), não imagem — sobra muita margem de
// banda comparado ao limite de payload do Realtime (que rejeitava só a
// partir de ~330KB). 200ms deixa o movimento no palco do outro lado mais
// próximo de tempo real sem custo relevante de mensagens extras.
const TEACHER_PREVIEW_INTERVAL_MS = 200;

let apiBase;
let turmaId;
let roster = [];
let onlineIds = new Set();
let presenceChannel = null;
let sessionChannel = null;
let currentSession = null; // { sessionId, studentId, studentName, realtimeChannel, expiresAt, offline? }
let heartbeatTimer = null;
let previewTimer = null; // broadcast do que o PROFESSOR está fazendo, pro aluno ver (só ativo quando hasControl)
let _observeTimeoutTimer = null; // ver OBSERVE_TIMEOUT_MS abaixo
const OBSERVE_TIMEOUT_MS = 3 * 60 * 1000; // 3min só observando sem assumir controle -> volta sozinho pra turma
let _monitorLastSpriteIds = new Set(); // só pra log — diff de sprites/páginas entre um tick e outro
let _monitorLastPageIds = new Set();
let _monitorLastMd5;
let hasControl = false; // true quando o PROFESSOR está editando de verdade (não só observando)
let engineMounted = false; // true assim que o motor é montado (observando OU editando) — diferente de hasControl
let _observeWrapEl = null; // wrapper flutuante: barra de voltar + barra grande de assumir controle
let _controlBarEl = null;
let _onlineWarningEl = null;
let _onlineWarningShown = false;

function authHeader() {
    const token = window.__AUTH_TOKEN__;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {}) },
    });
    return res;
}

function getDeviceId() {
    let id = sessionStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random()}`);
        sessionStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

// ── Boot ─────────────────────────────────────────────────────────────────

export async function teacherMain() {
    apiBase = window.API_URL || (location.origin + '/api');
    const params = new URLSearchParams(location.search);
    turmaId = params.get('turmaId');

    if (!turmaId) {
        _fatal('Link inválido. Nenhuma turma informada na URL.');
        return;
    }

    await _loadRoster();
    await _connectPresence();
    _renderLobby();
}

function _fatal(msg) {
    const root = gn('teacher-root');
    root.innerHTML = '';
    const div = newHTML('div', 'teacherFatal', root);
    div.textContent = msg;
}

// ── Dados ────────────────────────────────────────────────────────────────

async function _loadRoster() {
    const res = await apiFetch(`/teacher/classroom/${encodeURIComponent(turmaId)}/students`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        _fatal(body.error || 'Não foi possível carregar a turma.');
        return;
    }
    const data = await res.json();
    roster = data.students || [];
    gn('teacher-turma-name').textContent = data.turmaName || turmaId;
}

async function _connectPresence() {
    const res = await apiFetch('/realtime/presence-token', { method: 'POST' });
    if (!res.ok) return; // sem turma_id no token do professor — segue só com o snapshot inicial
    const data = await res.json();
    presenceChannel = connectChannel(data.channel);
    if (!presenceChannel) return;

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            onlineIds = new Set(Object.values(state).flat().map((p) => p.studentId));
            // Editando offline e o aluno específico dessa sessão acabou de
            // ficar online — os dois podem editar ao mesmo tempo sem
            // coordenação nenhuma e um sobrescrever o trabalho do outro.
            // Decisão (confirmada com o usuário): só avisar, não bloquear
            // automaticamente — o professor decide o que fazer.
            if (currentSession && currentSession.offline && onlineIds.has(currentSession.studentId)) {
                _warnStudentCameOnline();
            }
            if (!engineMounted) _renderLobby(); // só recompõe a lista se ainda estivermos nela
        })
        .subscribe();
}

// ── Lobby (grid de alunos, online primeiro) ─────────────────────────────

function _renderLobby() {
    const root = gn('teacher-root');
    root.innerHTML = '';

    const grid = newHTML('div', 'teacherGrid', root);
    const sorted = [...roster].sort((a, b) => {
        const aOnline = onlineIds.has(a.id) ? 1 : 0;
        const bOnline = onlineIds.has(b.id) ? 1 : 0;
        return bOnline - aOnline;
    });

    sorted.forEach((student) => {
        const online = onlineIds.has(student.id);
        const card = newHTML('div', 'teacherCard' + (online ? ' online' : ' offline'), grid);

        const status = newHTML('div', 'teacherCardStatus', card);
        status.textContent = online ? '🟢 online' : '⚪ offline';

        if (student.project && student.project.thumbnail) {
            const img = newHTML('img', 'teacherCardThumb', card);
            img.src = student.project.thumbnail;
            img.alt = student.project.name || '';
        } else {
            newHTML('div', 'teacherCardThumb teacherCardThumbEmpty', card);
        }

        const name = newHTML('div', 'teacherCardName', card);
        name.textContent = student.name;

        const btn = newHTML('button', 'teacherCardBtn', card);
        btn.textContent = online ? 'Observar' : 'Abrir';
        btn.onclick = () => (online ? _startObserving(student) : _openOffline(student));
    });
}

// ── Editar projeto de aluno OFFLINE (sem sessão ao vivo do outro lado) ──

/**
 * Abre o último projeto salvo de um aluno que não está online agora — sem
 * handshake de aprovação nenhum (não tem ninguém do outro lado pra
 * aprovar): entra direto no modo de edição. Reaproveita o MESMO mecanismo
 * de bypass de sessão que "assumir controle" já usa — confirmado lendo
 * POST /session/start (backend/src/routes/teacher.js) que não exige o
 * aluno estar online em nenhum ponto, só verifica se o professor tem
 * permissão pra turma+aluno.
 *
 * ⚠️ Risco de colisão: se o aluno ficar online NO MEIO dessa edição, ele
 * pode abrir o próprio projeto e editar ao mesmo tempo sem coordenação —
 * um pode sobrescrever o trabalho do outro. Decisão (confirmada com o
 * usuário): só avisar visualmente (_warnStudentCameOnline), não bloquear
 * automaticamente.
 */
async function _openOffline(student) {
    const res = await apiFetch('/teacher/session/start', {
        method: 'POST',
        body: JSON.stringify({
            turmaId,
            studentId: student.id,
            deviceId: getDeviceId(),
            projectId: student.project ? student.project.id : null,
        }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.error || 'Não foi possível abrir o projeto.');
        return;
    }

    const data = await res.json();
    currentSession = { ...data, studentId: student.id, studentName: student.name, offline: true };
    _onlineWarningShown = false;

    // Canal Realtime conectado mesmo sem ninguém do outro lado agora — não
    // pra sincronizar nada, só pra saber se o aluno ficar online no meio
    // da edição (ver _connectPresence) e, nesse caso raro, ainda reagir a
    // um control_request dele (o aluno sempre pode pedir de volta o que é
    // dele, mesmo estando "offline" quando a sessão começou).
    sessionChannel = connectChannel(data.realtimeChannel, { ack: true });
    if (sessionChannel) {
        sessionChannel
            .on('broadcast', { event: 'control_request' }, (msg) => {
                if (msg.payload?.from === 'student' && hasControl) _releaseControl();
            })
            .subscribe();
    }

    _mountEngine(() => {
        // Sem handoff nenhum acontecendo (ninguém do outro lado) — pula
        // direto pra edição, sem passar pelo estado "bloqueado observando".
        _enableEditingMode({ reloadFirst: false });
    });
    _startHeartbeat();
}

function _warnStudentCameOnline() {
    if (_onlineWarningShown) return;
    _onlineWarningShown = true;
    _onlineWarningEl = newHTML('div', 'teacherOnlineWarning', document.body);
    _onlineWarningEl.textContent = `⚠️ ${currentSession.studentName} ficou online — cuidado pra não sobrescrever o trabalho um do outro.`;
    Object.assign(_onlineWarningEl.style, {
        position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: String(ABOVE_LOCK_OVERLAY_Z_INDEX),
        background: '#ffb020', color: '#3a2a00', textAlign: 'center', padding: '8px 12px',
        fontSize: '14px', fontWeight: '700', fontFamily: 'Helvetica Neue, Arial, sans-serif',
    });
}

function _hideOnlineWarning() {
    if (_onlineWarningEl && _onlineWarningEl.parentNode) _onlineWarningEl.parentNode.removeChild(_onlineWarningEl);
    _onlineWarningEl = null;
}

// ── Observar (motor real, ao vivo, bloqueado até assumir controle) ──────

async function _startObserving(student) {
    const res = await apiFetch('/teacher/session/start', {
        method: 'POST',
        body: JSON.stringify({
            turmaId,
            studentId: student.id,
            deviceId: getDeviceId(),
            projectId: student.project ? student.project.id : null,
        }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.error || 'Não foi possível iniciar a observação.');
        return;
    }

    const data = await res.json();
    currentSession = { ...data, studentId: student.id, studentName: student.name };
    hasControl = false;

    sessionChannel = connectChannel(data.realtimeChannel, { ack: true });
    if (!sessionChannel) {
        window.alert('Canal Realtime não configurado (VITE_SUPABASE_URL/ANON_KEY ausentes).');
        return;
    }

    sessionChannel
        .on('broadcast', { event: 'preview_frame' }, (msg) => {
            // O aluno manda o próprio estado o tempo todo enquanto tem
            // controle (o padrão dele, não só quando o professor assumiu)
            // — aplicar direto no motor já montado, mesmo caminho que
            // LiveWatch.js usa no sentido contrário. Só ignora enquanto o
            // PRÓPRIO professor está editando (hasControl aqui é do lado
            // dele) — nesse caso quem manda preview_frame é o professor
            // mesmo, pro aluno, não teria sentido reaplicar em si mesmo.
            if (!hasControl && msg.payload?.stage) {
                applyPageList(msg.payload.pageIds);
                applyStageState(msg.payload.stage);
                applyUiState(msg.payload.ui);
            }
        })
        .on('broadcast', { event: 'control_ready' }, () => {
            if (hasControl) _enableEditingMode({ reloadFirst: true });
        })
        .on('broadcast', { event: 'control_denied' }, () => {
            hasControl = false;
            if (_controlBarEl) {
                _controlBarEl.textContent = '🖐️ Assumir controle';
                _controlBarEl.style.cursor = 'pointer';
                _controlBarEl.onclick = _requestControl;
            }
            window.alert('O aluno recusou o pedido de controle.');
        })
        .on('broadcast', { event: 'control_request' }, (msg) => {
            // Aluno pedindo o controle de volta — diferente do pedido do
            // professor, este NUNCA precisa de aprovação (o aluno é o dono
            // da conta, ver LiveMirror/LiveWatch.js).
            if (msg.payload?.from === 'student' && hasControl) {
                _releaseControl();
            }
        })
        .subscribe();

    // Avisa o aluno (via canal de presença da turma) que uma sessão começou.
    if (presenceChannel) {
        presenceChannel.send({
            type: 'broadcast',
            event: 'session_started',
            payload: { studentId: student.id, sessionId: data.sessionId },
        });
    }

    _mountEngine(() => {
        showLockOverlay();
        _showObserveBar();
    });
    _startHeartbeat();
    // Economiza conexão do Realtime: se o professor ficar só observando
    // (sem nunca assumir controle) por mais de OBSERVE_TIMEOUT_MS, volta
    // sozinho pra tela da turma — cancelado em _requestControl() (deixou de
    // ser "só observando") e em _endSession() (limpeza geral).
    _observeTimeoutTimer = setTimeout(() => {
        _endSession('observe_timeout');
    }, OBSERVE_TIMEOUT_MS);
}

/**
 * Barra flutuante substituindo #teacher-topbar (escondido enquanto o motor
 * está montado — ver comentário de calibração de coordenadas em
 * _mountEngine): uma faixa pequena com "← Voltar pra turma" + o nome de
 * quem está sendo observado, e logo abaixo uma faixa GRANDE (a barra
 * inteira é o botão, não um botãozinho — pedido do usuário) pra assumir
 * controle. As duas ficam num wrapper fixo só pra empilhar em fluxo normal
 * sem precisar calcular offset em pixel manualmente.
 *
 * Como o wrapper é position:fixed (fora do fluxo do documento), ele NÃO
 * empurra o conteúdo de #frame pra baixo sozinho — fica sobrepondo por
 * cima. Isso escondia a própria barra de ferramentas do ScratchJr (logo,
 * tela cheia, grade, desfazer, bandeira — dentro de #frame, começa em
 * top:0 igual o wrapper) atrás da nossa barra (confirmado em produção:
 * "senti falta da barra superior"). Empurrado manualmente aqui via
 * margin-top = altura do wrapper, e desfeito em _hideObserveBar/
 * _enableEditingMode — só existe durante a observação BLOQUEADA, quando
 * nenhuma interação/arrasto é possível, então não corre o risco de
 * desalinhar globalx()/globaly() (usados pra calcular onde um bloco foi
 * solto) igual aconteceria se isso ficasse deslocado durante edição de
 * verdade.
 */
function _showObserveBar() {
    _hideObserveBar();
    const wrap = newHTML('div', 'teacherFloatingObserveWrap', document.body);
    Object.assign(wrap.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: String(ABOVE_LOCK_OVERLAY_Z_INDEX),
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
    });
    _observeWrapEl = wrap;

    const backBar = newHTML('div', 'teacherFloatingBackBar', wrap);
    Object.assign(backBar.style, {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px',
        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', fontSize: '13px',
    });
    const back = newHTML('button', 'teacherBackBtn', backBar);
    back.textContent = '← Voltar pra turma';
    back.onclick = _endSession;
    const title = newHTML('span', 'teacherObserveTitle', backBar);
    title.textContent = `Observando: ${currentSession.studentName}`;

    _controlBarEl = newHTML('div', 'teacherControlBar', wrap);
    _controlBarEl.setAttribute('role', 'button');
    _controlBarEl.tabIndex = 0;
    Object.assign(_controlBarEl.style, {
        background: 'linear-gradient(90deg, #6c63ff, #48c9b0)', color: '#fff',
        textAlign: 'center', padding: '14px', fontSize: '17px', fontWeight: '700', cursor: 'pointer',
    });
    _controlBarEl.textContent = '🖐️ Assumir controle';
    _controlBarEl.onclick = _requestControl;

    const frame = document.getElementById('frame');
    if (frame) frame.style.marginTop = wrap.offsetHeight + 'px';
}

function _hideObserveBar() {
    if (_observeWrapEl && _observeWrapEl.parentNode) _observeWrapEl.parentNode.removeChild(_observeWrapEl);
    _observeWrapEl = null;
    _controlBarEl = null;
    const frame = document.getElementById('frame');
    if (frame) frame.style.marginTop = ''; // volta pro top:0 exato que a edição de verdade precisa
}

function _requestControl() {
    if (!sessionChannel) return;
    if (_observeTimeoutTimer) { clearTimeout(_observeTimeoutTimer); _observeTimeoutTimer = null; } // deixou de ser "só observando"
    hasControl = true;
    sessionChannel.send({ type: 'broadcast', event: 'control_request', payload: { from: 'teacher' } });
    if (_controlBarEl) {
        _controlBarEl.textContent = 'Aguardando o aluno salvar...';
        _controlBarEl.style.cursor = 'default';
        _controlBarEl.onclick = null;
    }
}

// ── Montagem do motor real (observação ou edição) ───────────────────────

/**
 * Patch estreito de IO, só neste módulo/sessão: lê e grava o projeto do
 * aluno via os endpoints de bypass (backend/src/routes/teacher.js), nunca
 * pelo /api/db normal (que filtraria por owner e bloquearia).
 */
function _patchIOBypass(sessionId) {
    const _origGetObjectinDB = IO.getObjectinDB;
    IO.getObjectinDB = function (db, md5, fcn) {
        if (db === 'projects') {
            apiFetch(`/teacher/session/${sessionId}/project`)
                .then((r) => (r.ok ? r.json() : null))
                .then((project) => fcn(JSON.stringify(project ? [project] : [])))
                .catch(() => fcn('[]'));
            return;
        }
        _origGetObjectinDB.call(IO, db, md5, fcn);
    };

    IO.saveProject = function (obj, fcn) {
        apiFetch(`/teacher/session/${sessionId}/project`, {
            method: 'PUT',
            body: JSON.stringify({ json: JSON.stringify(obj.json) }),
        })
            .then((r) => (fcn ? fcn({ success: r.ok }) : null))
            .catch(() => (fcn ? fcn({ success: false }) : null));
    };
}

/**
 * Monta o motor completo do ScratchJr contra o bypass de sessão — usado
 * tanto pra OBSERVAR (motor montado, mas bloqueado por LiveMirror.
 * showLockOverlay até o professor assumir controle) quanto pra EDITAR
 * offline (direto, sem bloqueio). `onReady` roda depois que
 * ScratchJr.appinit() já rodou.
 *
 * Library/Record/Undo precisam rodar de verdade aqui — diferente do
 * player.js (que é só leitura), o professor no controle precisa poder
 * adicionar atores/cenários (Library) e desfazer (Undo).
 */
function _mountEngine(onReady) {
    const sessionId = currentSession.sessionId;
    _patchIOBypass(sessionId);

    document.body.classList.add('teacherControlling');
    window.currentProjectMd5 = currentSession.projectId;

    // #frame/#libframe/#paintframe ficam com display:none enquanto é só o
    // lobby (div.frame tem position:relative + min-height:745px no CSS —
    // sem escondê-los, sobrariam 745px de espaço em branco na tela da
    // turma). Precisam ficar visíveis ANTES do appinit, senão o motor
    // calcula tamanho/posição do palco em cima de um elemento com
    // display:none (getBoundingClientRect() zerado) e o editor não aparece.
    ['frame', 'libframe', 'paintframe'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
    const lobbyRoot = gn('teacher-root');
    if (lobbyRoot) lobbyRoot.style.display = 'none';

    // #teacher-topbar (44px) precisa sumir também, não só o #teacher-root.
    // editor.html (onde todo o código de coordenadas foi calibrado) tem
    // #frame como PRIMEIRO filho do <body>, sem nada antes. Em teacher.html
    // o topbar fica antes de #frame no fluxo normal do documento, então
    // globalx()/globaly() (utils/lib.js) — que somam offsetTop subindo por
    // cada parentNode — contavam esses 44px extras que não existem em
    // editor.html. Isso desalinha TODA conta relativa a #frame: arrastar
    // bloco até um bloco de evento (ScriptsPane.js:95-96, usa
    // Events.dragmousex/y menos globalx/globaly(Events.dragDiv)) calculava
    // o ponto de solta 44px abaixo de onde o bloco realmente estava,
    // fazendo o encaixe falhar. Mesma classe de bug documentada em
    // Stage.js:421 pro clique no palco — aqui pega o editor inteiro.
    // As barras flutuantes de observação/edição (_showObserveBar,
    // _addReleaseButton) são position:fixed — fora do fluxo normal do
    // documento, então não reintroduzem esse mesmo problema.
    const topbar = gn('teacher-topbar');
    if (topbar) topbar.style.display = 'none';

    engineMounted = true;

    iOS.getsettings(function (str) {
        const list = str.split(',');
        iOS.path = list[1] === '0' ? list[0] + '/' : undefined;
        ScratchJr.currentProject = currentSession.projectId;
        ScratchJr.appinit(window.Settings.scratchJrVersion);
        if (onReady) onReady();
    });
}

/**
 * Liga a edição de verdade — sai do modo "só observando bloqueado" (ou,
 * pra edição offline, é chamado direto sem nunca ter passado por lá).
 * reloadFirst=true (transição observar→controlar): recarrega do backend
 * pra garantir que o motor reflete o que o aluno acabou de salvar
 * (saveThenSignalReady, do lado dele) — o espelho ao vivo pode ter ficado
 * levemente atrás até esse instante. reloadFirst=false (edição offline):
 * o motor acabou de carregar fresco via bypass, recarregar de novo seria
 * redundante.
 */
function _enableEditingMode({ reloadFirst } = {}) {
    hasControl = true;
    hideLockOverlay();
    resetMirroredUi();
    resetMirrorState();
    _hideObserveBar();
    if (reloadFirst) {
        reloadProjectFromBackend();
    }
    _addReleaseButton();
    // Espelha LiveWatch.js do lado do aluno: manda o estado ao vivo pro
    // aluno ver o que está sendo editado enquanto o professor está no
    // controle. Em edição offline isso ainda roda (ninguém escutando no
    // canal agora, broadcast vira só um envio sem efeito), mas não custa
    // nada manter simétrico — se o aluno entrar online no meio, já
    // encontra o canal recebendo normalmente.
    previewTimer = setInterval(_broadcastTeacherPreview, TEACHER_PREVIEW_INTERVAL_MS);
}

/**
 * Log temporário de monitoramento — compara sprites/pageIds/md5 desse tick
 * contra o tick anterior e só imprime quando algo REALMENTE muda, em vez
 * de logar a cada 200ms.
 */
function _logMonitorDiff(spriteIds, pageIds, md5) {
    const sSet = new Set(spriteIds);
    const pSet = new Set(pageIds);
    const spritesAdded = spriteIds.filter((id) => !_monitorLastSpriteIds.has(id));
    const spritesRemoved = [..._monitorLastSpriteIds].filter((id) => !sSet.has(id));
    const pagesAdded = pageIds.filter((id) => !_monitorLastPageIds.has(id));
    const pagesRemoved = [..._monitorLastPageIds].filter((id) => !pSet.has(id));
    if (spritesAdded.length) console.log('[monitor][professor] ATOR ADICIONADO', spritesAdded);
    if (spritesRemoved.length) console.log('[monitor][professor] ATOR REMOVIDO', spritesRemoved);
    if (pagesAdded.length) console.log('[monitor][professor] PÁGINA ADICIONADA', pagesAdded);
    if (pagesRemoved.length) console.log('[monitor][professor] PÁGINA REMOVIDA', pagesRemoved);
    if (md5 !== _monitorLastMd5) console.log('[monitor][professor] CENÁRIO mudou', { de: _monitorLastMd5, para: md5 });
    _monitorLastSpriteIds = sSet;
    _monitorLastPageIds = pSet;
    _monitorLastMd5 = md5;
}

/**
 * Broadcast do estado do palco pro aluno enquanto o PROFESSOR está
 * editando — mesmo payload leve (dados, não imagem) que LiveMirror.
 * buildMirrorPayload já monta pro sentido contrário (aluno→professor
 * observando). Só ativo enquanto hasControl (ver _enableEditingMode).
 */
function _broadcastTeacherPreview() {
    if (!sessionChannel || !hasControl) return;
    try {
        const payload = buildMirrorPayload();
        if (!payload) return; // projeto ainda não carregou de verdade
        _logMonitorDiff(payload.stage.sprites || [], payload.pageIds, payload.stage.md5);
        sessionChannel.send({ type: 'broadcast', event: 'preview_frame', payload })
            .catch((err) => {
                console.error('[teacher preview send] falhou:', err);
            });
    } catch (err) {
        console.error('[teacher] preview error:', err);
    }
}

function _addReleaseButton() {
    _removeReleaseButton();
    const btn = newHTML('button', 'teacherFloatingRelease', document.body);
    btn.id = 'teacher-floating-release';
    btn.textContent = 'Soltar controle';
    Object.assign(btn.style, {
        position: 'fixed', top: '8px', right: '8px', zIndex: '99999',
        padding: '8px 14px', border: 'none', borderRadius: '8px',
        background: '#6c63ff', color: '#fff', fontWeight: '700', cursor: 'pointer',
    });
    btn.onclick = _releaseControl;
}

function _removeReleaseButton() {
    const btn = gn('teacher-floating-release');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
}

function _releaseControl() {
    if (previewTimer) { clearInterval(previewTimer); previewTimer = null; }
    _removeReleaseButton();
    ScratchJr.saveProject(null, function () {
        if (sessionChannel) sessionChannel.send({ type: 'broadcast', event: 'control_ready', payload: {} });
        hasControl = false;
        // Recarrega a visão de prévia — mais simples que desmontar o motor
        // do editor em memória. O aluno volta a ser a fonte da prévia (ou,
        // em edição offline, a sessão simplesmente encerra).
        location.reload();
    }, true);
}

// ── Ciclo de vida da sessão ─────────────────────────────────────────────

function _startHeartbeat() {
    heartbeatTimer = setInterval(async () => {
        if (!currentSession) return;
        const res = await apiFetch(`/teacher/session/${currentSession.sessionId}/heartbeat`, { method: 'POST' });
        // 410 = sessão expirou (50min); 404 = sessão não existe mais — os
        // dois são terminais. Sem checar 404 aqui, uma aba com sessão morta
        // (ex.: reaberta depois de já ter terminado do outro lado) ficaria
        // batendo em /heartbeat pra sempre, a cada 20s, sem nunca sair
        // desse estado (visto em produção nos logs do aluno).
        if (res.status === 410) {
            window.alert('Sessão de observação expirou (50min).');
            _endSession();
        } else if (res.status === 404) {
            _endSession();
        }
    }, HEARTBEAT_MS);
}

async function _endSession(reason) {
    if (_observeTimeoutTimer) clearTimeout(_observeTimeoutTimer);
    _observeTimeoutTimer = null;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = null;
    _removeReleaseButton();
    _hideObserveBar();
    _hideOnlineWarning();

    const wasEngineMounted = engineMounted;
    engineMounted = false;

    // Avisa o aluno PRIMEIRO (broadcast sobre um websocket já aberto sai
    // quase na hora) — sem isso o aviso "professor vendo" fica preso na tela
    // dele pra sempre se o professor só fechar a aba/navegar embora em vez
    // de clicar em "voltar pra turma".
    if (sessionChannel) {
        sessionChannel.send({ type: 'broadcast', event: 'session_ended', payload: {} });
    }

    if (currentSession) {
        await apiFetch(`/teacher/session/${currentSession.sessionId}/end`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'teacher_left' }),
        }).catch(() => {});
    }
    if (sessionChannel) sessionChannel.unsubscribe();
    sessionChannel = null;
    currentSession = null;
    hasControl = false;

    if (wasEngineMounted) {
        // Sessão encerrada (ex.: estourou os 50min) enquanto o motor do
        // editor já estava montado em memória (observando OU editando) —
        // só re-renderizar #teacher-root não desfaz isso (#frame/#libframe/
        // #paintframe continuariam visíveis por cima, com o motor ainda
        // rodando). Recarregar é o mesmo caminho seguro já usado por
        // _releaseControl() — e também reseta de graça todo o estado
        // incremental de LiveMirror (não precisa chamar resetMirrorState
        // aqui, o reload já limpa tudo).
        location.reload();
        return;
    }

    _renderLobby();
}

// Fechar a aba / navegar pra outro lugar sem clicar em "voltar" não deveria
// deixar a sessão pendurada (nem o aviso preso na tela do aluno) até o
// timeout de 50min. pagehide é mais confiável que beforeunload pra isso.
window.addEventListener('pagehide', () => {
    if (currentSession) _endSession('teacher_left');
});
