/**
 * src/app/src/editor/LiveWatch.js
 *
 * Integração de observação ao vivo (professor assistindo/controlando o
 * editor do aluno). Isolado do motor do editor de propósito — não altera
 * Stage.js/Sprite.js/ScratchJr.js. Se o token do aluno não trouxer turma_id
 * (a maioria dos usuários, fora do contexto HelloYotta), o backend responde
 * 400 no primeiro fetch e este módulo não faz mais nada.
 *
 * Modelo de dados: o canal Realtime nunca transmite imagem — enquanto o
 * ALUNO está no controle, ele manda uma prévia leve (imagem, via
 * Project.getThumbnailPNG) pro professor ver; enquanto o PROFESSOR está no
 * controle, ele manda os DADOS do palco (posição/costume/scripts de cada
 * sprite, cenário, página atual — ver teacher.js:_broadcastTeacherPreview),
 * e este módulo aplica isso direto nos objetos Sprite/Page já vivos na tela
 * do aluno (applyStageState), usando as mesmas funções internas que
 * undo/redo e carregamento de projeto já usam — nunca monta um segundo
 * motor, nunca fotografa a tela do professor.
 *
 * O reload completo do backend (IO.getObject + Project.dataRecieved) fica
 * reservado pros instantes pontuais de troca de controle e pro caso raro de
 * PÁGINA nova aparecer no meio da sessão (applyStageState detecta e cai pra
 * recarga completa só nesse caso) — nunca roda em loop. Sprite/ator novo em
 * página já conhecida NÃO cai mais pra recarga completa: é criado
 * cirurgicamente via Project.recreateObject (mesmo caminho que
 * Undo.copySprite já usa em produção pra recriar um sprite ao vivo sem
 * gravar undo nem marcar o projeto como alterado) — antes disso, todo ator
 * novo do professor piscava a tela inteira do aluno (Stage.clear() +
 * reload) só pra aparecer um sprite.
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
 *  - Aluno→professor ainda é imagem periódica (broadcastPreview, não
 *    op-sync), com alguns segundos de atraso. Professor→aluno (o caminho
 *    mais usado, quando o professor está editando) já é aplicação de
 *    estado real, não imagem.
 *  - O handoff troca o estado local (hasControl), mostra o aviso na tela E
 *    bloqueia fisicamente a interação do aluno (showLockOverlay/
 *    hideLockOverlay — um "vidro" transparente cobrindo a tela, sem
 *    instrumentar Stage/Sprite/ScriptsPane) enquanto o professor está no
 *    controle. Isso deixou de ser só UX: como applyStageState pilota o
 *    motor de verdade do aluno, deixar o aluno mexer ao mesmo tempo
 *    puxaria os objetos Sprite/Page pra dois lados — risco real de
 *    corromper o estado, não só uma sobreposição visual incômoda.
 */

import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML, gn } from '../utils/lib.js';
import ScratchJr from './ScratchJr.js';
import Project from './ui/Project.js';
import ScriptsPane from './ui/ScriptsPane.js';
import Thumbs from './ui/Thumbs.js';
import IO from '../iPad/IO.js';

const SESSION_HEARTBEAT_MS = 20000;
const PREVIEW_INTERVAL_MS = 500;
const PREVIEW_SIZE = { w: 384, h: 288 };

let presenceChannel = null;
let sessionChannel = null;
let currentSessionId = null;
let previewTimer = null;
let bannerEl = null;
let lockOverlayEl = null;
let hasControl = false; // true quando o ALUNO está no controle (estado normal)

// Estado de aplicação incremental de preview_frame (ver applyStageState
// mais abaixo) — o professor manda o estado do palco inteiro a cada tick,
// mas só vale a pena tocar no motor (principalmente Scripts.recreateStrip,
// que reconstrói DOM) no que realmente mudou desde a última aplicação.
let _reloadInFlight = false; // true enquanto uma recarga completa está em curso
let _reloadResetTimer = null; // timeout que rearma _reloadInFlight
let _lastAppliedStage = null; // último stageData já aplicado (pra comparar o que mudou)
let _lastSpriteIds = new Set(); // ids de sprite do broadcast anterior (detectar sumidos)
// Project.dataRecieved não expõe callback de conclusão utilizável daqui.
// Confirmado em produção: criar 2 sprites novos numa página nova levou ~4
// ciclos (12s) pra estabilizar com 3000ms — a recarga em si é bem mais
// rápida que isso na prática, 1200ms dá folga suficiente sem esticar tanto
// o "flash" visual.
const RELOAD_SETTLE_MS = 1200;

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
 * "Vidro" transparente cobrindo a tela inteira enquanto o professor está no
 * controle — intercepta clique/toque antes de chegar no editor por baixo,
 * sem precisar instrumentar Stage/Sprite/ScriptsPane (que era o motivo do
 * bloqueio nunca ter sido feito antes). Isso deixou de ser só UX: agora que
 * applyStageState pilota o motor de verdade do aluno, deixar o aluno mexer
 * ao mesmo tempo puxaria os objetos Sprite/Page pra dois lados diferentes
 * (o clique dele e o broadcast do professor) — risco real de corromper o
 * estado, não só uma sobreposição visual incômoda.
 *
 * z-index abaixo do banner (5000) — o aviso e os botões "Aceitar"/"Recusar"/
 * "Pedir controle" continuam clicáveis por cima do vidro.
 */
function showLockOverlay() {
    if (lockOverlayEl) return;
    lockOverlayEl = newHTML('div', 'liveWatchLockOverlay', document.body);
    Object.assign(lockOverlayEl.style, {
        position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
        zIndex: '4000', background: 'rgba(0, 0, 0, 0.02)', cursor: 'not-allowed',
    });
}

function hideLockOverlay() {
    if (lockOverlayEl && lockOverlayEl.parentNode) lockOverlayEl.parentNode.removeChild(lockOverlayEl);
    lockOverlayEl = null;
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
 * Aplica o estado de palco recebido do professor (payload.stage de
 * preview_frame) diretamente nos objetos Sprite/Page JÁ VIVOS na tela do
 * aluno — sem fotografar nada, sem recriar o motor. Só usa os caminhos
 * confirmados seguros (ver declarative-wobbling-penguin.md pra
 * justificativa/linhas de origem de cada um):
 *   - Sprite.setPos(x, y) — recebe posição ABSOLUTA apesar do nome dos
 *     parâmetros no código-fonte (dx, dy) sugerir delta.
 *   - sprite.scale/angle/flip setados direto + sprite.render().
 *   - sprite.shown + sprite.div.style.opacity — linha própria, render()
 *     não mexe em opacidade.
 *   - Page.setBackground(md5, fcn) com fcn vazio — NUNCA
 *     Page.prototype.updateBkg (grava undo/marca o projeto como alterado).
 *   - Stage.setPage(page, false) — NUNCA true (dispararia de verdade os
 *     scripts de bandeira verde/toque da página nova).
 *   - Limpar blocos + Scripts.recreateStrip, no mesmo padrão de
 *     Undo.redoScripts.
 *   - ScriptsPane.setActiveScript(spriteId) — NÃO Page.setCurrentSprite
 *     direto: setActiveScript já chama setCurrentSprite por dentro E
 *     também ativa a <div> de scripts do sprite (Scripts.prototype.activate,
 *     função diferente de Sprite.prototype.activate) e reconecta o
 *     onmousedown/ontouchstart do painel pro sprite certo — sem isso,
 *     clicar/arrastar no painel de scripts quebrava com "Cannot read
 *     properties of null" (confirmado em produção).
 * NUNCA Page.modifySprite (grava undo e rouba a seleção do aluno) — troca
 * de costume é feita chamando sprite.getAsset/setCostume direto.
 */
function applyStageState(stageData) {
    if (!stageData || !ScratchJr.stage) return;
    if (_reloadInFlight) return; // recarga completa já em curso, ignora este tick

    // --- Detectar página nunca vista → só isso ainda cai pra recarga completa
    // Sprite novo em página já conhecida NÃO cai mais aqui — ver passo 3
    // abaixo (criação cirúrgica via Project.recreateObject). Página nova
    // continua caindo pra recarga completa: criar uma Page inteira do zero
    // é um caso mais raro e maior (fora do escopo desta rodada — ver
    // declarative-wobbling-penguin.md, seção "Fora de escopo").
    // ⚠️ stageData.sprites é um array de STRINGS (ids), não de objetos —
    // exatamente como Page.encodePage() (Page.js:350-377) devolve: os dados
    // de cada sprite ficam em chaves separadas no próprio stageData
    // (stageData[spriteId]), não aninhados dentro de "sprites". Confirmado
    // em produção via log: tratar stageData.sprites[i].id retornava
    // sempre undefined, fazendo TODO sprite parecer "nunca visto" pra
    // sempre, mesmo depois de recarregar (a recarga nunca resolvia porque
    // o problema não era o aluno não ter o sprite — era essa leitura errada).
    const pageKnown = ScratchJr.stage.pages.some((p) => p.id === stageData.id);
    if (!pageKnown) {
        _reloadInFlight = true;
        if (_reloadResetTimer) clearTimeout(_reloadResetTimer);
        _reloadResetTimer = setTimeout(() => {
            _reloadInFlight = false;
            _reloadResetTimer = null;
        }, RELOAD_SETTLE_MS);
        _lastAppliedStage = null;
        _lastSpriteIds = new Set();
        reloadProjectFromBackend();
        return; // não aplicar updates parciais em cima de algo que ainda não existe
    }

    // --- 1. Página ativa (resolver ANTES de mexer em sprites) -------------
    const page = ScratchJr.stage.getPage(stageData.id);
    if (!page) return; // defensivo; pageKnown já garantiu isso acima
    const pageChanged = !ScratchJr.stage.currentPage || ScratchJr.stage.currentPage.id !== stageData.id;
    if (pageChanged) {
        ScratchJr.stage.setPage(page, false); // NUNCA true — ver comentário do topo
    }

    // --- 2. Cenário ---------------------------------------------------------
    // Page.encodePage() só grava stageData.md5 quando a página TEM cenário
    // (Page.js:356-358: `if (md5) data.md5 = md5;`) — se o professor remove
    // o cenário, stageData.md5 simplesmente não existe no payload (não vira
    // null, some). A checagem antiga (`stageData.md5 && ...`) exigia
    // stageData.md5 verdadeiro, então nunca disparava pra REMOVER um
    // cenário, só pra trocar por outro. Comparar sempre, e mandar 'none'
    // quando o cenário some — Page.setBackground já trata 'none' como caso
    // especial (Page.js:117-121, só limpa e sai, sem asset pra buscar).
    if (stageData.md5 !== page.md5) {
        page.setBackground(stageData.md5 || 'none', () => {}); // callback vazio de propósito — nunca updateBkg
    }

    // --- 3. Sprites novos: criar cirurgicamente, sem recarregar a página ---
    // Mesmo caminho que Undo.copySprite (Undo.js:283-299) já usa em
    // produção pra recriar um sprite ao vivo: Project.recreateObject()
    // (Project.js:389-426) monta via `new Sprite(data, fcn)` — confirmado
    // lendo o construtor de Sprite e o próprio recreateObject que nenhum
    // dos dois grava Undo nem marca ScratchJr.changed. Ele já recria os
    // scripts (sc.recreateStrip) e já aplica shown/opacidade sozinho — só
    // falta a visibilidade do <div> do sprite no palco, que o padrão do
    // Undo.copySprite restaura no callback (só quando a página é a atual,
    // sempre verdade aqui — a página já foi resolvida no passo 1 acima).
    // Passa uma cópia rasa de sData porque recreateObject muta `data.page =
    // page` — sem a cópia, isso poluiria o stageData original (guardado em
    // _lastAppliedStage pra diff do próximo tick) com uma referência viva
    // à Page (não serializável, ciclo de DOM).
    const incomingSpriteIds = stageData.sprites || [];
    const createdThisTick = new Set();
    incomingSpriteIds.forEach((spriteId) => {
        if (gn(spriteId)) return; // já existe no DOM, passo 5 cuida de atualizar
        const sData = stageData[spriteId];
        if (!sData) return; // defensivo — sem dados, nada a criar (tenta de novo no próximo tick)
        createdThisTick.add(spriteId);
        Project.recreateObject(page, spriteId, Object.assign({}, sData), (spr) => {
            if (page.id === ScratchJr.stage.currentPage.id) {
                spr.div.style.visibility = 'visible'; // mesmo padrão de Undo.copySprite
            }
            Thumbs.updateSprites(); // sem isso o ícone do ator novo não aparece na tira de sprites
        }, spriteId === stageData.lastSprite);
    });

    // --- 4. Sprites que existiam e sumiram desde a última aplicação --------
    const incomingIds = new Set(incomingSpriteIds);
    _lastSpriteIds.forEach((id) => {
        if (!incomingIds.has(id)) {
            const el = gn(id);
            if (el && el.owner) {
                const goneSprite = el.owner;
                goneSprite.shown = false;
                goneSprite.div.style.opacity = 0;
            }
        }
    });

    // --- 5. Sprites presentes: aplicar só o que mudou -----------------------
    incomingSpriteIds.forEach((spriteId) => {
        if (createdThisTick.has(spriteId)) return; // acabou de ser criado, já está em sincronia com sData
        const sData = stageData[spriteId]; // dados reais do sprite ficam aqui, não dentro de "sprites"
        if (!sData) return; // defensivo
        const el = gn(spriteId);
        if (!el || !el.owner) return; // defensivo; passo 3 acima já criou quem faltava
        const sprite = el.owner;

        const posChanged = sprite.xcoor !== sData.xcoor || sprite.ycoor !== sData.ycoor;
        const transformChanged = sprite.scale !== sData.scale
            || sprite.angle !== sData.angle || sprite.flip !== sData.flip;
        const shownChanged = sprite.shown !== sData.shown;
        const costumeChanged = !!sData.md5 && sprite.md5 !== sData.md5;
        const prevSData = _lastAppliedStage && _lastAppliedStage[spriteId];
        const scriptsChanged = !prevSData
            || JSON.stringify(prevSData.scripts) !== JSON.stringify(sData.scripts);

        if (posChanged) {
            sprite.setPos(sData.xcoor, sData.ycoor); // ABSOLUTO — nunca subtrair/calcular delta
        }

        if (transformChanged) {
            sprite.scale = sData.scale;
            sprite.angle = sData.angle;
            sprite.flip = sData.flip;
            sprite.render();
        }

        if (shownChanged) {
            sprite.shown = sData.shown;
            sprite.div.style.opacity = sprite.shown ? 1 : 0; // render() não mexe em opacidade
        }

        if (costumeChanged) {
            sprite.md5 = sData.md5;
            sprite.getAsset((dataurl) => {
                sprite.setCostume(dataurl, () => {}); // callback vazio — bypassa Page.modifySprite de propósito
            });
        }

        if (scriptsChanged) {
            const scriptsDiv = gn(spriteId + '_scripts');
            if (scriptsDiv) {
                const sc = scriptsDiv.owner;
                while (scriptsDiv.childElementCount > 0) scriptsDiv.removeChild(scriptsDiv.childNodes[0]);
                (sData.scripts || []).forEach((scr) => sc.recreateStrip(scr));
            }
        }
    });

    // --- 6. Sprite selecionado (mostrar os blocos certos na área de scripts)
    // ScriptsPane.setActiveScript() (não Page.setCurrentSprite direto) —
    // ela faz tudo que setCurrentSprite faz E MAIS: torna a <div> de scripts
    // do sprite visível (Scripts.prototype.activate(), diferente do
    // Sprite.prototype.activate() que setCurrentSprite já chama) e
    // reconecta onmousedown/ontouchstart do painel pro sprite certo. Sem
    // isso, ScratchJr.getActiveScript() (que lê currentSpriteName) ficava
    // desincronizado do handler de clique de verdade, e clicar/arrastar no
    // painel de scripts quebrava com "Cannot read properties of null" em
    // Scripts.scriptsMouseDown/Scroll.bounceBack — confirmado em produção.
    if (stageData.lastSprite && page.currentSpriteName !== stageData.lastSprite) {
        ScriptsPane.setActiveScript(stageData.lastSprite);
    }

    _lastAppliedStage = stageData;
    _lastSpriteIds = incomingIds;
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
            // Só faz sentido aplicar enquanto o PROFESSOR está no controle
            // (hasControl aqui é do lado do aluno). Quando o aluno está no
            // controle, esse mesmo evento é o que ELE envia em
            // broadcastPreview() (formato {dataUrl}, não {stage}) — ignorar
            // pra não reaplicar o próprio estado nele mesmo.
            if (!hasControl && msg.payload?.stage) {
                applyStageState(msg.payload.stage);
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
