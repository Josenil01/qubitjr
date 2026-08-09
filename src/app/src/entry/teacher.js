/**
 * src/app/src/entry/teacher.js
 *
 * Lobby do professor: lista os alunos de uma turma (online primeiro),
 * permite observar um aluno ao vivo (prévia de imagem via canal Realtime) e,
 * opcionalmente, assumir o controle do editor daquele aluno.
 *
 * turma_id vem de ?turmaId= na URL (redirect vindo da HelloYotta).
 *
 * ⚠️ Não testado contra Supabase/HelloYotta reais neste ambiente — ver
 * ressalvas na conversa de arquitetura. "Assumir controle" é a parte de
 * maior risco: monta o motor completo do ScratchJr (mesma abordagem do
 * player.js) contra os endpoints de bypass em backend/src/routes/teacher.js
 * (GET/PUT /api/teacher/session/:id/project), que existem só enquanto a
 * live_session estiver ativa.
 */

import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import IO from '../iPad/IO.js';
import Palette from '../editor/ui/Palette.js';
import Library from '../editor/ui/Library.js';
import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML, gn } from '../utils/lib.js';

const HEARTBEAT_MS = 20000;
const DEVICE_ID_KEY = 'scratchjr_teacher_device_id';
// Payload agora é dado (JSON, ~1KB típico), não mais imagem — sobra muita
// margem de banda comparado ao limite de payload do Realtime (que rejeitava
// só a partir de ~330KB). 200ms deixa o movimento no palco do aluno mais
// próximo de tempo real sem custo relevante de mensagens extras.
const TEACHER_PREVIEW_INTERVAL_MS = 200;

let apiBase;
let turmaId;
let roster = [];
let onlineIds = new Set();
let presenceChannel = null;
let sessionChannel = null;
let currentSession = null; // { sessionId, studentId, realtimeChannel, expiresAt }
let heartbeatTimer = null;
let previewTimer = null; // broadcast do que o PROFESSOR está fazendo, pro aluno ver
let _monitorLastSpriteIds = new Set(); // só pra log — diff de sprites/páginas entre um tick e outro
let _monitorLastPageIds = new Set();
let _monitorLastMd5;
let _hoverTarget = null; // { kind: 'library'|'sprite'|'page', id } | null — ver _updateHoverTarget
let hasControl = false; // true quando o PROFESSOR está no controle

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
            _renderLobby();
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

function _openOffline(student) {
    // Aluno offline: fora do escopo desta tela — abrir o projeto no modo
    // editor normal (assíncrono) é a mesma UI de edição já existente, não a
    // de observação ao vivo. Aqui só sinalizamos onde isso deveria acontecer.
    window.alert(`Abrir "${student.project ? student.project.name : 'projeto'}" de ${student.name} no modo editor normal (fora do escopo desta tela de observação ao vivo).`);
}

// ── Observar (prévia de imagem) ─────────────────────────────────────────

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
        .on('broadcast', { event: 'preview_frame' }, (msg) => _updatePreview(msg.payload?.dataUrl))
        .on('broadcast', { event: 'control_ready' }, () => {
            if (hasControl) _mountControllingEngine();
        })
        .on('broadcast', { event: 'control_denied' }, () => {
            hasControl = false;
            const btn = document.querySelector('.teacherControlBtn');
            if (btn) { btn.disabled = false; btn.textContent = 'Assumir controle'; }
            window.alert('O aluno recusou o pedido de controle.');
        })
        .on('broadcast', { event: 'control_request' }, (msg) => {
            // Aluno pedindo o controle de volta — diferente do pedido do
            // professor, este NUNCA precisa de aprovação (o aluno é o dono
            // da conta, ver LiveWatch.js). Faltava esse listener inteiro:
            // o aluno mandava o broadcast e nada acontecia do lado do
            // professor — "pedido não aparecia na tela".
            if (msg.payload?.from === 'student' && hasControl) {
                window.alert('O aluno pediu para retomar o controle. Salvando e devolvendo agora...');
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

    _renderObserving();
    _startHeartbeat();
}

function _renderObserving() {
    const root = gn('teacher-root');
    root.innerHTML = '';

    const bar = newHTML('div', 'teacherObserveBar', root);
    const back = newHTML('button', 'teacherBackBtn', bar);
    back.textContent = '← Voltar pra turma';
    back.onclick = _endSession;

    const title = newHTML('span', 'teacherObserveTitle', bar);
    title.textContent = `Observando: ${currentSession.studentName}`;

    const controlBtn = newHTML('button', 'teacherControlBtn', bar);
    controlBtn.textContent = 'Assumir controle';
    controlBtn.onclick = _requestControl;

    newHTML('div', 'teacherPreviewWrap', root).id = 'teacher-preview-wrap';
    const img = newHTML('img', 'teacherPreviewImg', gn('teacher-preview-wrap'));
    img.id = 'teacher-preview-img';
    img.alt = 'Prévia ao vivo';
}

function _updatePreview(dataUrl) {
    const img = gn('teacher-preview-img');
    if (img && dataUrl) img.src = dataUrl;
}

function _requestControl() {
    if (!sessionChannel) return;
    hasControl = true;
    sessionChannel.send({ type: 'broadcast', event: 'control_request', payload: { from: 'teacher' } });
    const btn = document.querySelector('.teacherControlBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Aguardando o aluno salvar...'; }
}

// ── Assumir controle (monta o motor completo — maior risco, não testado) ──

function _mountControllingEngine() {
    const sessionId = currentSession.sessionId;

    // Patch estreito de IO, só neste módulo/sessão: lê e grava o projeto do
    // aluno via os endpoints de bypass (backend/src/routes/teacher.js),
    // nunca pelo /api/db normal (que filtraria por owner e bloquearia).
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

    // Library/Record/Undo precisam rodar de verdade aqui — diferente do
    // player.js (que é só leitura), o professor no controle precisa poder
    // adicionar atores/cenários (Library) e desfazer (Undo). Estavam
    // stubados como no-op copiando o padrão do player.js sem pensar que
    // "assumir controle" É edição de verdade — por isso os botões de
    // adicionar ator/cenário não faziam nada.

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
    const topbar = gn('teacher-topbar');
    if (topbar) topbar.style.display = 'none';

    iOS.getsettings(function (str) {
        const list = str.split(',');
        iOS.path = list[1] === '0' ? list[0] + '/' : undefined;
        ScratchJr.currentProject = currentSession.projectId;
        ScratchJr.appinit(window.Settings.scratchJrVersion);
    });

    // O botão "Soltar controle" de _renderObserving() vive dentro de
    // #teacher-root, que acabamos de esconder — ficava inacessível assim
    // que o motor montava. Um botão flutuante fixo, fora de #teacher-root,
    // resolve isso e também não interfere no offsetTop de #frame (position:
    // fixed é removido do fluxo normal do documento).
    _addReleaseButton();

    // Espelha LiveWatch.js do lado do aluno: sem isso, o aluno via a tela
    // "Seu professor está no controle agora" e nada mais — não tinha como
    // ver o que estava sendo editado.
    previewTimer = setInterval(_broadcastTeacherPreview, TEACHER_PREVIEW_INTERVAL_MS);
}

/**
 * Broadcast do estado do palco pro aluno — não mais uma foto (canvas/
 * imagem), e sim os DADOS do projeto (posição/costume/scripts de cada
 * sprite, cenário, página atual). O aluno (LiveWatch.js:applyStageState)
 * aplica isso direto nos objetos Sprite/Page que já estão vivos na tela
 * dele, usando as mesmas funções internas que undo/redo e carregamento de
 * projeto já usam — o motor de verdade desenha, não uma imagem comprimida.
 *
 * Motivo da mudança (era canvas→JPEG antes): ~13.000 mensagens Realtime
 * numa única sessão de teste (custo real de escala), e o payload de imagem
 * precisava reduzir resolução/usar JPEG com perdas pra caber no limite de
 * ~330KB do broadcast do Supabase (qualidade ruim). JSON de projeto (típico
 * poucos KB) resolve os dois problemas de uma vez — ver
 * declarative-wobbling-penguin.md pro desenho completo e a tabela de
 * funções confirmadas seguras de chamar do lado do aluno.
 *
 * `ui` (adicionado depois, junto no mesmo tick pra não criar outro canal):
 * biblioteca aberta (e de que tipo, e a rolagem dela), tela cheia, categoria
 * de bloco selecionada — lidos via getters que já existiam ou foram
 * adicionados pra isso (ScratchJr.inFullscreen, Palette.numcat,
 * Library.isOpen/currentType), sem duplicar estado nenhum.
 */
function _libraryScrollFraction() {
    const area = gn('scrollarea');
    if (!area) return null;
    const max = area.scrollHeight - area.clientHeight;
    return max > 0 ? area.scrollTop / max : 0;
}

/**
 * Rastreia sobre qual miniatura identificável (biblioteca, tira de atores,
 * tira de páginas) o mouse do professor está passando — NÃO coordenadas de
 * pixel. Guardamos só um {kind, id} pequeno em _hoverTarget, lido a cada
 * tick de _broadcastTeacherPreview. Rodar por delegação num único listener
 * de 'mouseover' (dispara só ao ENTRAR num elemento novo, bem mais barato
 * que 'mousemove') é seguro chamar sempre, mesmo fora de controle — só
 * escreve uma variável local, o broadcast em si já é condicionado a
 * hasControl.
 *
 * .assetbox tem o DOM id = o próprio md5 do asset (Library.js:
 * addAssetThumbChoose/addLocalThumbChoose) — dá pra usar direto. Já
 * .spritethumb/.pagethumb têm um DOM id gerado descartável; o id de
 * verdade do sprite/página fica em `.owner` (propriedade JS, não atributo
 * — Sprite.js:189-191/Page.js:228-229), por isso o aluno também precisa
 * procurar por `.owner`, não por gn(id) direto (ver applyHoverState).
 */
function _updateHoverTarget(e) {
    const el = e.target;
    if (!el || !el.closest) return;
    const assetbox = el.closest('.assetbox');
    if (assetbox && assetbox.id) {
        _hoverTarget = { kind: 'library', id: assetbox.id };
        return;
    }
    const spriteThumb = el.closest('.spritethumb');
    if (spriteThumb && spriteThumb.owner) {
        _hoverTarget = { kind: 'sprite', id: spriteThumb.owner };
        return;
    }
    const pageThumb = el.closest('.pagethumb');
    if (pageThumb && pageThumb.owner) {
        _hoverTarget = { kind: 'page', id: pageThumb.owner };
        return;
    }
    _hoverTarget = null;
}
document.addEventListener('mouseover', _updateHoverTarget);

/**
 * Log temporário de monitoramento — compara o sprites/pageIds/md5 desse
 * tick contra o tick anterior e só imprime quando algo REALMENTE muda
 * (entrou ou saiu um id, ou o cenário trocou), em vez de logar a cada
 * 200ms. Objetivo: correlacionar com os logs [monitor][aluno] de
 * LiveWatch.js pra achar exatamente onde a adição de ator/página diverge
 * entre professor e aluno.
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

function _broadcastTeacherPreview() {
    if (!sessionChannel || !hasControl) return;
    if (!ScratchJr.stage || !ScratchJr.stage.currentPage) return; // projeto ainda não carregou de verdade
    try {
        const page = ScratchJr.stage.currentPage;
        const stage = page.encodePage();
        stage.id = page.id; // encodePage() não inclui isso — o aluno precisa pra achar a página certa
        // Lista de ids de TODAS as páginas do projeto (não só a atual) — sem
        // isso, o aluno nunca fica sabendo que uma página que NÃO é a atual
        // do professor foi apagada (o payload só carrega a página atual, ver
        // encodePage() acima). Barato: só ids, não os dados completos de
        // cada página. LiveWatch.applyStageState usa isso pra detectar e
        // remover páginas apagadas fora da que está sendo espelhada agora.
        const pageIds = ScratchJr.stage.pages.map((p) => p.id);
        _logMonitorDiff(stage.sprites || [], pageIds, stage.md5);
        const libraryOpen = Library.isOpen;
        const ui = {
            library: libraryOpen ? Library.currentType : null,
            libraryScroll: libraryOpen ? _libraryScrollFraction() : null,
            fullscreen: ScratchJr.inFullscreen,
            category: Palette.numcat,
            hover: _hoverTarget,
        };
        sessionChannel.send({ type: 'broadcast', event: 'preview_frame', payload: { stage, ui, pageIds } })
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
        // do editor em memória. O aluno volta a ser a fonte da prévia.
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
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = null;
    _removeReleaseButton();

    const wasControlling = hasControl;

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

    if (wasControlling) {
        // Sessão encerrada (ex.: estourou os 50min) enquanto o motor do
        // editor já estava montado em memória — só re-renderizar
        // #teacher-root não desfaz isso (#frame/#libframe/#paintframe
        // continuariam visíveis por cima, com o motor ainda rodando).
        // Recarregar é o mesmo caminho seguro já usado por _releaseControl().
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
