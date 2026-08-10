/**
 * src/app/src/editor/LiveWatch.js
 *
 * Integração de observação ao vivo (professor assistindo/controlando o
 * editor do aluno), lado do ALUNO. Isolado do motor do editor de
 * propósito — não altera Stage.js/Sprite.js/ScratchJr.js. Se o token do
 * aluno não trouxer turma_id (a maioria dos usuários, fora do contexto
 * HelloYotta), o backend responde 400 no primeiro fetch e este módulo não
 * faz mais nada.
 *
 * Modelo de dados: o canal Realtime nunca transmite imagem — os dois
 * sentidos (aluno→professor observando, professor→aluno controlando)
 * mandam os DADOS do palco (posição/costume/scripts de cada sprite,
 * cenário, página atual, "chrome" de UI) via LiveMirror.buildMirrorPayload,
 * e quem recebe aplica isso direto nos objetos Sprite/Page já vivos no
 * motor local (LiveMirror.applyStageState/applyUiState/applyPageList),
 * usando as mesmas funções internas que undo/redo e carregamento de
 * projeto já usam — nunca monta um segundo motor, nunca fotografa a tela
 * do outro lado. Toda essa lógica de aplicação/montagem de payload é
 * compartilhada com teacher.js — ver LiveMirror.js pro porquê de cada
 * função ser segura de chamar (auditoria feita e testada em produção ao
 * longo de várias rodadas, só neste arquivo antes de ser extraída).
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
 * O handoff troca o estado local (hasControl), mostra o aviso na tela E
 * bloqueia fisicamente a interação do aluno (LiveMirror.showLockOverlay/
 * hideLockOverlay — um "vidro" transparente cobrindo a tela, sem
 * instrumentar Stage/Sprite/ScriptsPane) enquanto o professor está no
 * controle. Isso deixou de ser só UX: como applyStageState pilota o motor
 * de verdade do aluno, deixar o aluno mexer ao mesmo tempo puxaria os
 * objetos Sprite/Page pra dois lados — risco real de corromper o estado,
 * não só uma sobreposição visual incômoda.
 *
 * Vigia de professor inativo (ver _checkTeacherWatchdog mais abaixo) —
 * devolve o controle sozinho se o professor sumir (fechou o notebook,
 * perdeu a rede) em vez de deixar o aluno esperando até os 50min de
 * expiração da sessão.
 */

import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML } from '../utils/lib.js';
import ScratchJr from './ScratchJr.js';
import {
    applyStageState, applyUiState, applyPageList, buildMirrorPayload,
    showLockOverlay, hideLockOverlay, resetMirroredUi, reloadProjectFromBackend,
    resetMirrorState, ABOVE_LOCK_OVERLAY_Z_INDEX,
} from './LiveMirror.js';

const SESSION_HEARTBEAT_MS = 20000;
// Payload agora é dado (JSON, ~1KB típico), não mais imagem — mesma
// cadência que teacher.js já usa no sentido contrário (200ms), consistente
// nos dois sentidos agora que os dois mandam a mesma classe de payload leve.
const PREVIEW_INTERVAL_MS = 200;

// Vigia de professor inativo — duas camadas: TEACHER_INACTIVITY_MS sem
// nenhum preview_frame chegando -> pede o controle de volta (o mesmo
// caminho que já existia pro aluno clicar manualmente); se isso também não
// resolver em mais CONTROL_READY_TIMEOUT_MS, recupera à força a partir do
// backend. Valores confirmados com o usuário: ~45s cada camada.
const TEACHER_INACTIVITY_MS = 45000;
const CONTROL_READY_TIMEOUT_MS = 45000;
const WATCHDOG_CHECK_INTERVAL_MS = 10000;

let presenceChannel = null;
let sessionChannel = null;
let currentSessionId = null;
let previewTimer = null;
let bannerEl = null;
let hasControl = false; // true quando o ALUNO está no controle (estado normal)
let _watchdogTimer = null;
let _lastPreviewReceivedAt = null; // timestamp do último preview_frame aplicado enquanto o professor está no controle
let _autoRequestSentAt = null; // timestamp de quando a camada 1 do vigia pediu o controle de volta sozinha

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
            // zIndex acima do vidro de bloqueio e da biblioteca espelhada —
            // ver LiveMirror.ABOVE_LOCK_OVERLAY_Z_INDEX.
            position: 'fixed', top: '0', left: '0', right: '0', zIndex: String(ABOVE_LOCK_OVERLAY_Z_INDEX),
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

function requestControlBack() {
    if (!sessionChannel) return;
    sessionChannel.send({ type: 'broadcast', event: 'control_request', payload: { from: 'student' } });
}

function _startWatchdog() {
    _stopWatchdog();
    _lastPreviewReceivedAt = Date.now(); // começa a contar de agora, não de um preview que talvez nunca tenha chegado ainda
    _autoRequestSentAt = null;
    _watchdogTimer = setInterval(_checkTeacherWatchdog, WATCHDOG_CHECK_INTERVAL_MS);
}

function _stopWatchdog() {
    if (_watchdogTimer) clearInterval(_watchdogTimer);
    _watchdogTimer = null;
    _lastPreviewReceivedAt = null;
    _autoRequestSentAt = null;
}

/**
 * Vigia de professor inativo — roda a cada WATCHDOG_CHECK_INTERVAL_MS
 * enquanto o professor está no controle (ver _startWatchdog, chamado em
 * acceptControlRequest). Sem isso, se a aba do professor travar/fechar
 * (notebook fechado, rede caiu) sem passar por _releaseControl, o aluno
 * fica esperando até os 50min de expiração da sessão inteira — mesmo já
 * podendo clicar "Pedir controle" a qualquer momento, isso só resolve se a
 * aba do professor ainda estiver viva pra processar o pedido.
 *
 * Duas camadas:
 *  1. TEACHER_INACTIVITY_MS sem nenhum preview_frame chegando -> tenta o
 *     caminho normal (requestControlBack(), o mesmo botão que o aluno já
 *     tem) sozinho, sem precisar que a criança perceba e clique.
 *  2. Se isso também não resolver (control_ready nunca chega) depois de
 *     mais CONTROL_READY_TIMEOUT_MS, a aba do professor provavelmente
 *     está morta de verdade (não só ele longe do aparelho) —
 *     _forceRecoverControl() destrava o aluno sem depender mais dela.
 */
function _checkTeacherWatchdog() {
    if (hasControl || !currentSessionId) return; // aluno já está no controle, ou sem sessão — nada a vigiar
    const now = Date.now();
    if (_autoRequestSentAt) {
        if (now - _autoRequestSentAt > CONTROL_READY_TIMEOUT_MS) {
            _forceRecoverControl();
        }
        return;
    }
    if (_lastPreviewReceivedAt && (now - _lastPreviewReceivedAt > TEACHER_INACTIVITY_MS)) {
        console.warn('[LiveWatch] professor inativo há', Math.round((now - _lastPreviewReceivedAt) / 1000), 's — pedindo controle de volta automaticamente');
        showBanner('Seu professor parece estar inativo. Tentando devolver o controle...');
        requestControlBack();
        _autoRequestSentAt = now;
    }
}

/**
 * Camada 2 do vigia: nem o pedido automático de volta resolveu
 * (control_ready nunca chegou) — a aba do professor provavelmente travou
 * ou fechou de verdade, não só ele saiu de perto por um instante. Recupera
 * localmente a partir do último estado salvo no backend em vez de deixar
 * o aluno preso esperando os 50min de expiração da sessão.
 *
 * ⚠️ Trade-off aceito (confirmado com o usuário antes de implementar):
 * qualquer edição que o professor tenha feito depois de assumir o
 * controle mas não chegou a salvar (só salva de verdade em
 * saveThenSignalReady/_releaseControl, do lado dele) se perde — melhor o
 * aluno voltar a conseguir trabalhar do que ficar travado.
 *
 * POST .../session/:id/end com reason 'teacher_unresponsive' — avisa o
 * backend que essa sessão específica não faz mais sentido continuar.
 *
 * ⚠️ Reaproveita endLocalSession() pra derrubar heartbeat/canal — não dá
 * pra só setar hasControl=true e deixar o resto rodando: o heartbeat já
 * tinha um tick agendado (setTimeout), e assim que o POST .../end abaixo
 * marcar a sessão como encerrada no backend, esse tick pendente ia receber
 * 404 e chamar endLocalSession() sozinho — que zera hasControl de volta
 * pra false, desfazendo a recuperação. Derrubar tudo AQUI (via
 * endLocalSession) e só depois setar hasControl=true evita essa corrida.
 */
function _forceRecoverControl() {
    console.warn('[LiveWatch] professor sem resposta — recuperando controle à força a partir do backend');
    const sessionIdToClose = currentSessionId;
    endLocalSession(); // para heartbeat/canal/vigia, esconde overlay/banner — mas zera hasControl pra false
    hasControl = true; // ...então corrige aqui: isso é uma recuperação, não um "fim de sessão" qualquer
    showBanner('Não conseguimos falar com seu professor — recuperando seu projeto...');
    reloadProjectFromBackend();
    if (sessionIdToClose) {
        apiPost(`/teacher/session/${sessionIdToClose}/end`, { reason: 'teacher_unresponsive' });
    }
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
    showLockOverlay();
    showBanner('Seu professor está no controle agora', [
        { label: 'Pedir controle', onClick: requestControlBack },
    ]);
    saveThenSignalReady();
    _startWatchdog(); // devolve sozinho se o professor sumir — ver _checkTeacherWatchdog
}

function denyControlRequest() {
    if (sessionChannel) {
        sessionChannel.send({ type: 'broadcast', event: 'control_denied', payload: {} });
    }
    showBanner('Seu professor está vendo 👀');
}

function grantControlToStudent() {
    hasControl = true;
    hideLockOverlay();
    resetMirroredUi(); // biblioteca/tela cheia espelhadas não podem ficar presas depois que o controle volta
    resetMirrorState(); // sessão de espelhamento nova começa — não comparar contra sobras da anterior
    _stopWatchdog(); // controle voltou pelo caminho normal — não tem mais o que vigiar
    showBanner('Seu professor está vendo 👀');
    reloadProjectFromBackend();
}

function broadcastPreview() {
    if (!sessionChannel || !hasControl) return;
    try {
        const payload = buildMirrorPayload();
        if (!payload) return; // motor ainda não carregou de verdade
        sessionChannel.send({ type: 'broadcast', event: 'preview_frame', payload })
            .catch((err) => {
                console.error('[LiveWatch] preview send falhou:', err);
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
            // Só faz sentido aplicar enquanto o PROFESSOR está no controle
            // (hasControl aqui é do lado do aluno). Quando o aluno está no
            // controle, esse mesmo evento é o que ELE envia em
            // broadcastPreview() pro professor observar — ignorar pra não
            // reaplicar o próprio estado nele mesmo.
            if (!hasControl && msg.payload?.stage) {
                // Sinal de que o professor está ativo — reseta o vigia de
                // inatividade (ver _checkTeacherWatchdog). Se ele já tinha
                // pedido o controle de volta sozinho (camada 1) mas essa
                // mensagem chegou antes do control_ready, cancela a contagem
                // da camada 2 — o professor claramente ainda está vivo.
                _lastPreviewReceivedAt = Date.now();
                _autoRequestSentAt = null;
                applyPageList(msg.payload.pageIds); // limpa página apagada ANTES de aplicar a atual
                applyStageState(msg.payload.stage);
                applyUiState(msg.payload.ui);
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
        // 410 = sessão expirou (50min); 404 = sessão não existe mais (ex.: aba
        // antiga sobrevivendo depois da sessão real já ter terminado/sido
        // trocada). Os dois são terminais — sem isso, um 404 ficava tentando
        // de novo pra sempre a cada 20s (visto em produção: uma aba velha
        // martelando /heartbeat com 404 sem parar).
        if (!res || res.status === 410 || res.status === 404) {
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
    hideLockOverlay(); // rede de segurança — sessão pode terminar sem passar por grantControlToStudent()
    resetMirroredUi(); // idem — biblioteca/tela cheia espelhadas não podem ficar presas
    resetMirrorState();
    _stopWatchdog(); // idem — sem sessão, não tem mais professor pra vigiar
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
