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
import Project from '../editor/ui/Project.js';
import Palette from '../editor/ui/Palette.js';
import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML, gn } from '../utils/lib.js';

const HEARTBEAT_MS = 20000;
const DEVICE_ID_KEY = 'scratchjr_teacher_device_id';
const TEACHER_PREVIEW_INTERVAL_MS = 500; // igual ao LiveWatch.js do lado do aluno
const PREVIEW_SIZE = { w: 384, h: 288 }; // só usado no fallback (palco sozinho)
const FULL_PREVIEW_MAX_WIDTH = 960; // captura de #frame inteiro (paleta+scripts+palco), não só o palco

let apiBase;
let turmaId;
let roster = [];
let onlineIds = new Set();
let presenceChannel = null;
let sessionChannel = null;
let currentSession = null; // { sessionId, studentId, realtimeChannel, expiresAt }
let heartbeatTimer = null;
let previewTimer = null; // broadcast do que o PROFESSOR está fazendo, pro aluno ver
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

    sessionChannel = connectChannel(data.realtimeChannel);
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
 * Pinta um nó (e sua subárvore) no canvas de saída, na mesma ordem em que o
 * navegador pintaria na tela: fundo do próprio elemento primeiro, depois
 * cada filho, em ordem de documento. Sem isso, um <div> com background-color
 * (os painéis lilás da paleta/área de scripts, o fundo da página antes de
 * ter cenário — CSS puro, não <img>/<canvas>) simplesmente não aparecia:
 * a primeira versão só copiava pixels de <canvas>/<img>, ignorando qualquer
 * contêiner só-CSS por baixo deles.
 *
 * <canvas>/<img> são tratados como folha (o conteúdo interno já está
 * "assado" no bitmap, não tem filho relevante pra descer). Blocos em
 * ScratchJr são <canvas> (Block.js: shadow/shine/blockshape/blockicon via
 * getContext('2d')); sprites e fundo de página são <img> (Sprite.js/Page.js:
 * document.createElement('img') com o costume/cenário em img.src).
 *
 * Fora do escopo aqui, de propósito: bordas, sombras, cantos arredondados e
 * gradientes — pra fidelidade 100% pixel-perfect disso precisaria de algo
 * tipo html2canvas (nova dependência, custo por frame bem maior). O editor
 * de pintura (Paint.js) também fica de fora — é SVG, não canvas/img/CSS
 * simples.
 *
 * background-image (logo QUBIT_JR, botão "+" de adicionar sprite, ícones de
 * categoria/botões da barra) É tratado — via cache de <img> resolvido de
 * forma assíncrona (ver _resolveBgImage), só pro caso simples de imagem
 * única sem repetição (background-repeat: no-repeat). Fundos em ladrilho
 * (ex.: a textura "papercut" da faixa de categoria) ficam de fora — replicar
 * tiling certinho é mais trabalho pra um ganho visual pequeno.
 */
const _bgImageCache = new Map();

function _extractBgImageUrl(backgroundImageValue) {
    if (!backgroundImageValue || backgroundImageValue === 'none') return null;
    const match = /url\((['"]?)(.*?)\1\)/.exec(backgroundImageValue);
    return match ? match[2] : null;
}

function _resolveBgImage(url) {
    let img = _bgImageCache.get(url);
    if (!img) {
        // Primeira vez que essa URL aparece: começa a carregar agora (o
        // navegador já deve ter isso em cache HTTP, já que está sendo
        // exibido como background em algum lugar da tela) e devolve null
        // pra este tick — o próximo broadcastTeacherPreview (500ms depois)
        // já encontra pronto no cache.
        img = new Image();
        img.src = url;
        _bgImageCache.set(url, img);
    }
    return (img.complete && img.naturalWidth) ? img : null;
}
function _paintNodeIntoCanvas(el, ctx, frameRect, scale) {
    if (!el || el.nodeType !== 1) return;
    const style = window.getComputedStyle(el);
    const opacity = parseFloat(style.opacity);
    if (style.display === 'none' || style.visibility === 'hidden' || !(opacity > 0)) return;

    const rect = el.getBoundingClientRect();
    const hasBox = rect.width > 0 && rect.height > 0;

    const x = (rect.left - frameRect.left) * scale;
    const y = (rect.top - frameRect.top) * scale;
    const w = rect.width * scale;
    const h = rect.height * scale;

    // Opacidade fracionária (ex.: .pagethumb.caret — indicador de posição
    // ao arrastar página, opacity:0.25, quase invisível de propósito) só
    // era tratada como "0 = pula" ou "qualquer coisa > 0 = pinta 100%
    // opaco". Isso transformava elementos sutis em retângulos sólidos no
    // meio da tela. ctx.globalAlpha resolve isso — e ctx.save()/restore()
    // (já usado pro recorte de overflow) garante que a opacidade do pai
    // não vaza pra fora da sua própria subárvore, e some corretamente
    // (multiplicativo) se um filho também tiver a sua própria opacidade.
    const needsAlphaScope = opacity < 1;
    const prevAlpha = ctx.globalAlpha;
    if (needsAlphaScope) ctx.globalAlpha = prevAlpha * opacity;

    try {
        if (el.tagName === 'CANVAS' || el.tagName === 'IMG') {
            if (!hasBox) return; // folha sem área própria não tem o que desenhar
            const ready = el.tagName === 'CANVAS'
                ? (el.width && el.height)
                : (el.complete && el.naturalWidth && el.naturalHeight);
            if (!ready) return;
            try {
                ctx.drawImage(el, x, y, w, h);
            } catch (err) {
                // Elemento "sujo" (cross-origin, ex.: img sem CORS) travaria
                // toDataURL() lá na frente — não deveria acontecer aqui
                // (tudo é gerado/servido localmente), mas um elemento ruim
                // não pode derrubar o frame inteiro.
            }
            return;
        }

        // Contêiner com caixa própria de tamanho zero (ex.: #library — o
        // painel esquerdo com o logo e a lista de sprites: seu único filho
        // em fluxo normal é .spritethumbs, mas o logo .flipme e os cards de
        // sprite são position:absolute e não contribuem pra altura do pai,
        // então #library acaba com height:0 mesmo com filhos bem visíveis
        // na tela) NÃO pode cortar a recursão aqui — os filhos
        // absolutamente posicionados têm caixa própria, independente da
        // caixa (vazia) do pai. Só pula a pintura do PRÓPRIO fundo (não tem
        // o que preencher) e o recorte (recortar por uma caixa vazia
        // esconderia tudo dentro, errado).
        const clips = hasBox && (style.overflow === 'hidden' || style.overflow === 'clip'
            || style.overflowX === 'hidden' || style.overflowY === 'hidden');
        if (clips) {
            // Contêineres com overflow:hidden (ex.: .categoryselector da
            // paleta, que recorta .catbkg — uma faixa de fundo declarada
            // MAIOR que a área visível) precisam recortar o que é pintado
            // dentro deles, senão o filho "vaza" pra fora da caixa do pai —
            // foi assim que .catbkg (background: #f0e8f5) virou um
            // retângulo lilás cobrindo boa parte da tela em vez da faixa
            // fina que deveria ser.
            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, w, h);
            ctx.clip();
        }

        try {
            if (hasBox) {
                const bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                    ctx.fillStyle = bg;
                    ctx.fillRect(x, y, w, h);
                }

                // Ícones/logo definidos via CSS background-image (.flipme =
                // logo QUBIT_JR, botão "+" de adicionar sprite, molduras
                // .pagethumb.on/.off, vários botões de categoria/barra) —
                // desenha também quando background-size cobre a caixa
                // inteira (ex.: "100% 100%" ou "cover"), já que aí o
                // repeat declarado (ou o padrão "repeat" do shorthand
                // `background: url(...)` sem mais nada, caso do
                // .pagethumb) não tem efeito visual nenhum mesmo — só pula
                // ladrilhos de verdade (ex.: a textura "papercut").
                if (style.backgroundRepeat === 'no-repeat' || /^(100%\s+100%|cover)$/.test(style.backgroundSize)) {
                    const bgUrl = _extractBgImageUrl(style.backgroundImage);
                    if (bgUrl) {
                        const bgImg = _resolveBgImage(bgUrl);
                        if (bgImg) {
                            try {
                                ctx.drawImage(bgImg, x, y, w, h);
                            } catch (err) {
                                // mesmo tratamento de sempre — um recurso
                                // ruim não pode derrubar o frame inteiro.
                            }
                        }
                    }
                }
            }

            for (const child of el.children) {
                _paintNodeIntoCanvas(child, ctx, frameRect, scale);
            }
        } finally {
            if (clips) ctx.restore();
        }
    } finally {
        if (needsAlphaScope) ctx.globalAlpha = prevAlpha;
    }
}

function _captureFrameSnapshot(maxW) {
    const frameEl = document.getElementById('frame');
    if (!frameEl) return null;
    const frameRect = frameEl.getBoundingClientRect();
    if (!frameRect.width || !frameRect.height) return null;

    // #stage existe assim que appinit monta a UI, mas o carregamento do
    // projeto (buscar do backend, decodificar SVG do sprite, gerar
    // watermark colorido — tudo assíncrono, ver Sprite.doRender/
    // SVGTools.getWatermark/doneProjectLoad) só termina um pouco depois.
    // Confirmado via log real: o primeiro tick do preview timer (500ms
    // após montar) disparava ANTES desse carregamento acabar, e a prévia
    // saía com o palco genuinamente vazio (0 imgs/canvas dentro de #stage)
    // — não um bug de composição, só um frame cedo demais. Pular esse tick
    // (em vez de mandar um frame em branco pro aluno) resolve sozinho: o
    // próximo tick, 500ms depois, já encontra o sprite renderizado.
    const stageEl = document.getElementById('stage');
    if (stageEl && stageEl.querySelectorAll('img, canvas').length === 0) return null;

    const scale = Math.min(1, maxW / frameRect.width);
    const outW = Math.max(1, Math.round(frameRect.width * scale));
    const outH = Math.max(1, Math.round(frameRect.height * scale));

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    _paintNodeIntoCanvas(frameEl, ctx, frameRect, scale);

    return out.toDataURL('image/png');
}

function _broadcastTeacherPreview() {
    if (!sessionChannel || !hasControl) return;
    try {
        const dataUrl = _captureFrameSnapshot(FULL_PREVIEW_MAX_WIDTH);
        if (dataUrl) {
            sessionChannel.send({ type: 'broadcast', event: 'preview_frame', payload: { dataUrl } });
            return;
        }
        // Fallback: se #frame ainda não tiver nenhum canvas (ex.: logo após
        // o appinit), manda ao menos o palco sozinho em vez de deixar o
        // aluno sem prévia nenhuma neste tick.
        if (!ScratchJr.stage || !ScratchJr.stage.pages || !ScratchJr.stage.pages[0]) return;
        Project.getThumbnailPNG(ScratchJr.stage.pages[0], PREVIEW_SIZE.w, PREVIEW_SIZE.h, function (thumbUrl) {
            if (sessionChannel) {
                sessionChannel.send({ type: 'broadcast', event: 'preview_frame', payload: { dataUrl: thumbUrl } });
            }
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
        if (res.status === 410) {
            window.alert('Sessão de observação expirou (50min).');
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
