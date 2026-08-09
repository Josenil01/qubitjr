/**
 * src/app/src/editor/LiveWatch.js
 *
 * Integração de observação ao vivo (professor assistindo/controlando o
 * editor do aluno). Isolado do motor do editor de propósito — não altera
 * Stage.js/Sprite.js/ScratchJr.js. Se o token do aluno não trouxer turma_id
 * (a maioria dos usuários, fora do contexto HelloYotta), o backend responde
 * 400 no primeiro fetch e este módulo não faz mais nada.
 *
 * Modelo de dados (importante): o canal Realtime NUNCA carrega o projeto em
 * si — só sinalização (pedido/entrega de controle) e uma prévia visual leve
 * (imagem, via Project.getThumbnailPNG, gerada localmente, sem rede). O dado
 * de verdade sempre vem do backend, através do mesmo caminho que o app já
 * usa pra abrir/recarregar um projeto (IO.getObject + Project.dataRecieved).
 * Project.recreate() (por baixo de dataRecieved) só roda nos instantes
 * pontuais de troca de controle — nunca em loop.
 *
 * Protocolo de handoff (professor → aluno é a única direção com aprovação —
 * aluno pedindo de volta é sempre aceito na hora, ele é o dono da conta):
 *  1. Professor manda 'control_request'. Aluno vê um aviso com
 *     Aceitar/Recusar — nada acontece até ele decidir.
 *  2a. Aceitar: força um save (ScratchJr.saveProject) e só depois de
 *      confirmado emite 'control_ready'.
 *  2b. Recusar: emite 'control_denied', aluno continua no controle.
 *  3. Quem VAI GANHAR o controle, ao ver 'control_ready', recarrega o
 *     projeto do backend (IO.getObject) — pega os dados já salvos no passo 2a.
 *
 * ⚠️ Escopo desta primeira versão:
 *  - A prévia pro lado passivo é uma imagem periódica (não op-sync), com
 *    alguns segundos de atraso — não é um espelho pixel-perfect instantâneo.
 *  - O handoff troca o estado local (hasControl) e o aviso na tela, mas NÃO
 *    bloqueia fisicamente a interação do aluno com os blocos enquanto o
 *    professor está no controle — isso exigiria instrumentar Stage/Sprite/
 *    ScriptsPane, fora do escopo desta passada. Ver aviso ao usuário.
 */

import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML } from '../utils/lib.js';
import ScratchJr from './ScratchJr.js';
import Project from './ui/Project.js';
import IO from '../iPad/IO.js';

const SESSION_HEARTBEAT_MS = 20000;
const PREVIEW_INTERVAL_MS = 500;
const PREVIEW_SIZE = { w: 384, h: 288 };

let presenceChannel = null;
let sessionChannel = null;
let currentSessionId = null;
let previewTimer = null;
let bannerEl = null;
let previewEl = null;
let hasControl = false; // true quando o ALUNO está no controle (estado normal)

function authHeader() {
    const token = window.__AUTH_TOKEN__;
    return token ? { Authorization: `Bearer ${token}` } : null;
}

async function apiPost(path, body) {
    const headers = authHeader();
    if (!headers) return null;
    try {
        return await fetch(`${window.API_URL || ''}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body || {}),
        });
    } catch (err) {
        console.error('[LiveWatch] fetch error:', err);
        return null;
    }
}

/**
 * @param {string} text
 * @param {Array<{label: string, onClick: Function}>} [buttons]
 */
function showBanner(text, buttons = []) {
    if (!bannerEl) {
        bannerEl = newHTML('div', 'liveWatchBanner', document.body);
        Object.assign(bannerEl.style, {
            position: 'fixed', top: '0', left: '0', right: '0', zIndex: '5000',
            background: '#4a90d9', color: 'white', textAlign: 'center',
            padding: '6px 12px', fontSize: '14px', fontFamily: 'Verdana, sans-serif',
        });
    }
    bannerEl.innerHTML = '';
    bannerEl.appendChild(document.createTextNode(text + '  '));
    buttons.forEach(({ label, onClick }) => {
        const btn = newHTML('button', 'liveWatchBannerBtn', bannerEl);
        btn.textContent = label;
        btn.style.marginLeft = '6px';
        btn.onclick = onClick;
    });
}

function hideBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
}

/**
 * Espelho do que o teacher.js faz em _renderObserving()/_updatePreview() —
 * antes não existia nenhuma UI do lado do aluno pra mostrar a prévia que o
 * professor passa a transmitir (teacher.js:_broadcastTeacherPreview) assim
 * que ele assume o controle; o aluno só via o aviso de texto e não tinha
 * como ver o que estava sendo editado no projeto dele.
 *
 * Desde que _broadcastTeacherPreview passou a mandar #frame inteiro (paleta
 * + scripts + palco, não só o palco), 220px de largura fica pequeno demais
 * pra ler texto de bloco — por isso o tamanho maior e o clique-pra-ampliar
 * (só troca o CSS do <img>, sem nenhuma interação real com o projeto).
 */
function showPreview() {
    if (previewEl) return;
    previewEl = newHTML('img', 'liveWatchPreview', document.body);
    let expanded = false;
    Object.assign(previewEl.style, {
        position: 'fixed', top: '36px', right: '8px', width: '340px',
        border: '2px solid #4a90d9', borderRadius: '6px', zIndex: '4999',
        background: '#000', cursor: 'zoom-in', transition: 'width 0.15s ease',
    });
    previewEl.title = 'Clique para ampliar';
    previewEl.onclick = () => {
        expanded = !expanded;
        previewEl.style.width = expanded ? 'min(900px, 90vw)' : '340px';
        previewEl.style.cursor = expanded ? 'zoom-out' : 'zoom-in';
    };
}

function hidePreview() {
    if (previewEl && previewEl.parentNode) previewEl.parentNode.removeChild(previewEl);
    previewEl = null;
}

function requestControlBack() {
    if (!sessionChannel) return;
    sessionChannel.send({ type: 'broadcast', event: 'control_request', payload: { from: 'student' } });
}

/**
 * Reload do projeto a partir do backend — chamado só nos instantes de troca
 * de controle (nunca em loop). Reaproveita o mesmo caminho que o resto do
 * app usa pra abrir/recarregar um projeto.
 *
 * Project.recreate() (por baixo de dataRecieved) só zera o array
 * ScratchJr.stage.pages em JS — não remove os elementos DOM dos sprites/
 * páginas antigas. Sem Stage.clear() antes, os sprites do professor ficam
 * duplicados na tela (órfãos antigos + os recriados). Ver Stage.js:685
 * (clear) vs Project.js:364 (recreate).
 */
function reloadProjectFromBackend() {
    if (!ScratchJr.currentProject) return;
    if (ScratchJr.stage) ScratchJr.stage.clear();
    IO.getObject(ScratchJr.currentProject, Project.dataRecieved);
}

/**
 * Salva o estado atual antes de soltar o controle, então avisa o outro lado
 * que já pode recarregar. Usa o save forçado que o próprio ScratchJr expõe.
 */
function saveThenSignalReady() {
    ScratchJr.saveProject(null, function () {
        if (sessionChannel) {
            sessionChannel.send({ type: 'broadcast', event: 'control_ready', payload: {} });
        }
    }, true);
}

function promptControlRequest() {
    showBanner('Seu professor quer assumir o controle da tela', [
        { label: 'Aceitar', onClick: acceptControlRequest },
        { label: 'Recusar', onClick: denyControlRequest },
    ]);
}

function acceptControlRequest() {
    hasControl = false;
    showBanner('Seu professor está no controle agora', [
        { label: 'Pedir controle', onClick: requestControlBack },
    ]);
    saveThenSignalReady();
}

function denyControlRequest() {
    if (sessionChannel) {
        sessionChannel.send({ type: 'broadcast', event: 'control_denied', payload: {} });
    }
    showBanner('Seu professor está vendo 👀');
}

function grantControlToStudent() {
    hasControl = true;
    hidePreview();
    showBanner('Seu professor está vendo 👀');
    reloadProjectFromBackend();
}

function broadcastPreview() {
    if (!sessionChannel || !hasControl) return;
    try {
        if (!ScratchJr.stage || !ScratchJr.stage.pages || !ScratchJr.stage.pages[0]) return;
        const page = ScratchJr.stage.pages[0];
        Project.getThumbnailPNG(page, PREVIEW_SIZE.w, PREVIEW_SIZE.h, function (dataUrl) {
            if (sessionChannel) {
                sessionChannel.send({ type: 'broadcast', event: 'preview_frame', payload: { dataUrl } });
            }
        });
    } catch (err) {
        console.error('[LiveWatch] preview error:', err);
    }
}

async function joinSession(sessionId) {
    currentSessionId = sessionId;
    const res = await apiPost(`/teacher/session/${sessionId}/join`, {});
    if (!res || !res.ok) return;
    const data = await res.json();

    sessionChannel = connectChannel(data.realtimeChannel);
    if (!sessionChannel) return;

    hasControl = true;
    sessionChannel
        .on('broadcast', { event: 'control_request' }, (msg) => {
            if (msg.payload?.from === 'teacher' && hasControl) promptControlRequest();
        })
        .on('broadcast', { event: 'control_ready' }, () => {
            // O professor salvou e está liberando de volta pro aluno.
            if (!hasControl) grantControlToStudent();
        })
        .on('broadcast', { event: 'preview_frame' }, (msg) => {
            // DEBUG TEMPORÁRIO — o log do lado do professor mostra a
            // composição certa sendo gerada e enviada, mas a tela do aluno
            // não atualiza. Duas hipóteses: (a) a mensagem nem chega até
            // aqui (Realtime derrubando/atrasando), ou (b) chega mas
            // `hasControl` (do ALUNO) está com o valor errado e o guard
            // abaixo descarta o frame silenciosamente. Esse log distingue
            // as duas. Remover depois.
            console.log('[LiveWatch preview_frame]', 'recebido, bytes', msg.payload?.dataUrl ? msg.payload.dataUrl.length : 'sem dataUrl', 'hasControl(aluno)', hasControl, 'vai aplicar?', !hasControl && !!msg.payload?.dataUrl);
            // Só faz sentido mostrar enquanto o PROFESSOR está no controle
            // (hasControl aqui é do lado do aluno). Quando o aluno está no
            // controle, esse mesmo evento é o que o aluno ENVIA lá embaixo
            // em broadcastPreview() — ignorar pra não mostrar a própria
            // prévia de volta pra ele mesmo.
            if (!hasControl && msg.payload?.dataUrl) {
                showPreview();
                previewEl.src = msg.payload.dataUrl;
            }
        })
        .on('broadcast', { event: 'session_ended' }, () => {
            // Professor saiu da tela (botão "voltar" ou fechou/navegou pra
            // outro lugar) — sem isso o aviso "professor vendo" fica preso
            // na tela do aluno pra sempre (só sumiria no timeout de 50min).
            endLocalSession();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') showBanner('Seu professor está vendo 👀');
        });

    previewTimer = setInterval(broadcastPreview, PREVIEW_INTERVAL_MS);
    startHeartbeat();
}

function startHeartbeat() {
    const tick = async () => {
        if (!currentSessionId) return;
        const res = await apiPost(`/teacher/session/${currentSessionId}/heartbeat`, {});
        if (!res || res.status === 410) {
            endLocalSession();
            return;
        }
        setTimeout(tick, SESSION_HEARTBEAT_MS);
    };
    setTimeout(tick, SESSION_HEARTBEAT_MS);
}

function endLocalSession() {
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = null;
    if (sessionChannel) sessionChannel.unsubscribe();
    sessionChannel = null;
    currentSessionId = null;
    hasControl = false;
    hideBanner();
    hidePreview();
}

/**
 * Ponto de entrada — chamar uma vez no boot do editor (entry/editor.js).
 * No-op silencioso se o backend não reconhecer turma_id no token do aluno
 * (usuário fora do contexto HelloYotta — a maioria).
 */
async function initLiveWatch() {
    const res = await apiPost('/realtime/presence-token', {});
    if (!res || res.status === 400 || !res.ok) return;

    const data = await res.json();
    presenceChannel = connectChannel(data.channel);
    if (!presenceChannel) return;

    const ownId = window.__AUTH_CONTEXT__?.studentId;

    presenceChannel
        .on('broadcast', { event: 'session_started' }, (msg) => {
            const { studentId, sessionId } = msg.payload || {};
            // Filtro só de UX (evita reagir a sessões de outros alunos da mesma
            // turma) — a autorização de verdade é revalidada no backend em
            // POST /session/:id/join contra o req.userId real.
            if (sessionId && studentId && ownId && studentId === ownId) {
                joinSession(sessionId);
            }
        })
        .subscribe((status) => {
            // Anuncia presença pro professor ver a lista "quem está online"
            // na tela de turma. studentId vem do parâmetro de URL (classId
            // context) — só usado pra exibição, não é fronteira de segurança.
            if (status === 'SUBSCRIBED' && ownId) {
                presenceChannel.track({ studentId: ownId, onlineAt: new Date().toISOString() });
            }
        });
}

export { initLiveWatch };
