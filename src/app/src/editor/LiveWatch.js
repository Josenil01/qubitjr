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
 * Além do palco em si, o "chrome" da UI do professor também é espelhado
 * (applyUiState, no mesmo tick de preview_frame): biblioteca de atores/
 * cenários aberta (+ rolagem), tela cheia, categoria de bloco selecionada
 * na paleta, e qual miniatura (biblioteca/tira de atores/tira de páginas)
 * o mouse do professor está sobrevoando (applyHoverTarget) — destacada com
 * um box-shadow simples na miniatura correspondente do aluno, não um
 * cursor/ponteiro seguindo coordenadas de pixel (isso reintroduziria o
 * problema de viewport que já descartamos lá no desenho original do
 * "robô"). A biblioteca espelhada é a MESMA UI clicável do professor — só
 * é segura de mostrar porque showLockOverlay() (abaixo) tem zIndex acima
 * dela também, não só do palco.
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
import Page from './engine/Page.js';
import Project from './ui/Project.js';
import Thumbs from './ui/Thumbs.js';
import Palette from './ui/Palette.js';
import Library from './ui/Library.js';
import IO from '../iPad/IO.js';

const SESSION_HEARTBEAT_MS = 20000;
const PREVIEW_INTERVAL_MS = 500;
const PREVIEW_SIZE = { w: 384, h: 288 };

// Vigia de professor inativo (ver _checkTeacherWatchdog mais abaixo) —
// devolve o controle sozinho se o professor sumir (fechou o notebook,
// perdeu a rede) em vez de deixar o aluno esperando até os 50min de
// expiração da sessão. Duas camadas: TEACHER_INACTIVITY_MS sem nenhum
// preview_frame chegando -> pede o controle de volta (o mesmo caminho que
// já existia pro aluno clicar manualmente); se isso também não resolver em
// mais CONTROL_READY_TIMEOUT_MS, recupera à força a partir do backend.
// Valores confirmados com o usuário: ~45s cada camada.
const TEACHER_INACTIVITY_MS = 45000;
const CONTROL_READY_TIMEOUT_MS = 45000;
const WATCHDOG_CHECK_INTERVAL_MS = 10000;

let presenceChannel = null;
let sessionChannel = null;
let currentSessionId = null;
let previewTimer = null;
let bannerEl = null;
let lockOverlayEl = null;
let hasControl = false; // true quando o ALUNO está no controle (estado normal)
let _hoverEl = null; // elemento atualmente destacado por applyHoverState (ver mais abaixo)
let _watchdogTimer = null;
let _lastPreviewReceivedAt = null; // timestamp do último preview_frame aplicado enquanto o professor está no controle
let _autoRequestSentAt = null; // timestamp de quando a camada 1 do vigia pediu o controle de volta sozinha

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
            // zIndex acima do vidro (10500) e da biblioteca espelhada
            // (.libframe, z-index 10000 no CSS) — ver showLockOverlay abaixo.
            position: 'fixed', top: '0', left: '0', right: '0', zIndex: '11000',
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
 * z-index abaixo do banner (11000) — o aviso e os botões "Aceitar"/
 * "Recusar"/"Pedir controle" continuam clicáveis por cima do vidro.
 *
 * zIndex 10500, ACIMA de .libframe (biblioteca de atores/cenários,
 * z-index:10000 no CSS — librarymodal.css). Motivo: o espelhamento de UI
 * (applyUiState, ver mais abaixo) pode abrir a biblioteca de verdade na
 * tela do aluno pra ele ver o que o professor está escolhendo — mas os
 * cliques dentro dela continuam com os handlers reais e vivos
 * (Library.selectAsset → ...→ Page.addSprite de verdade). Sem o vidro por
 * cima também da biblioteca, o aluno "bloqueado" ainda conseguiria clicar
 * num personagem e adicionar de verdade no projeto dele — o mesmo risco de
 * corromper o estado que o vidro inteiro existe pra evitar.
 */
function showLockOverlay() {
    if (lockOverlayEl) return;
    lockOverlayEl = newHTML('div', 'liveWatchLockOverlay', document.body);
    Object.assign(lockOverlayEl.style, {
        position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
        zIndex: '10500', background: 'rgba(0, 0, 0, 0.02)', cursor: 'not-allowed',
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
 * Cópia rasa de um stageData (topo + cada sub-objeto de sprite) antes de
 * passar pra `new Page(id, data)` — Page.loadPageData chama
 * Project.recreateObject por baixo pra cada sprite, e recreateObject muta
 * `data.page = page` (Project.js:393). Sem copiar, isso poluiria o
 * stageData ORIGINAL — o mesmo objeto guardado em _lastAppliedStage pro
 * diff do próximo tick — com uma referência viva à Page (não serializável,
 * ciclo de DOM). Mesmo cuidado que já existe no passo 3 de applyStageState
 * pra sprite novo em página já conhecida, agora reaproveitado pra página
 * nova inteira.
 */
function _shallowCopyStageData(stageData) {
    const copy = Object.assign({}, stageData);
    (stageData.sprites || []).forEach((id) => {
        if (copy[id]) copy[id] = Object.assign({}, copy[id]);
    });
    return copy;
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
 *   - Thumbs.selectThisSprite(sprite) — NÃO Page.setCurrentSprite nem
 *     ScriptsPane.setActiveScript sozinhos: selectThisSprite percorre TODA
 *     a tira de miniaturas e, além de ativar a <div> de scripts do sprite
 *     novo (via ScriptsPane.setActiveScript por baixo), desativa a de TODOS
 *     os outros (Thumbs.unhighlighSprite → Scripts.prototype.deactivate).
 *     setActiveScript sozinho só ativa a nova — nunca desativa a anterior —
 *     e sem isso, trocar de sprite não trocava pro aluno e os blocos de
 *     vários atores ficavam acumulados visíveis ao mesmo tempo (confirmado
 *     em produção). Antes disso, setActiveScript sozinho já tinha resolvido
 *     um crash "Cannot read properties of null" ao clicar/arrastar no
 *     painel — esse cuidado (reconectar onmousedown/ontouchstart do painel)
 *     continua garantido porque selectThisSprite chama setActiveScript.
 * NUNCA Page.modifySprite (grava undo e rouba a seleção do aluno) — troca
 * de costume é feita chamando sprite.getAsset/setCostume direto.
 */
function applyStageState(stageData) {
    if (!stageData || !ScratchJr.stage) return;
    if (_reloadInFlight) return; // recarga completa já em curso, ignora este tick

    // --- 0. Página nunca vista → criar cirurgicamente, sem recarga completa
    // Mesmo caminho que Project.recreatePage() (Project.js:376-379) já usa
    // pra CADA página durante um load normal (Project.recreate, chamado de
    // Project.dataRecieved): new Page(id, data, fcn) monta a <div>, o
    // cenário (this.setBackground) e cada sprite (Project.recreateObject —
    // o mesmo já auditado/usado no passo 3 abaixo) tudo de uma vez, sem
    // gravar Undo em nenhum ponto (confirmado lendo o construtor de Page e
    // loadPageData por completo). Fica invisível (visibility:hidden) até o
    // Stage.setPage do passo 1 revelar — igual Project.recreatePage faz
    // manualmente (`page.div.style.visibility = 'hidden';`) logo após criar.
    // ⚠️ stageData.sprites é um array de STRINGS (ids), não de objetos —
    // exatamente como Page.encodePage() (Page.js:350-377) devolve: os dados
    // de cada sprite ficam em chaves separadas no próprio stageData
    // (stageData[spriteId]), não aninhados dentro de "sprites". Confirmado
    // em produção via log: tratar stageData.sprites[i].id retornava
    // sempre undefined, fazendo TODO sprite parecer "nunca visto" pra
    // sempre, mesmo depois de recarregar (a recarga nunca resolvia porque
    // o problema não era o aluno não ter o sprite — era essa leitura errada).
    //
    // Bug real confirmado em produção (antes desta correção): página nova
    // sempre caía na recarga completa (Stage.clear() + reload do backend),
    // e o timer de settle (RELOAD_SETTLE_MS) reativava _reloadInFlight
    // antes do reload de verdade terminar, disparando reload de novo — 8+
    // vezes seguidas no log, cada uma piscando a tela inteira. Isso
    // acontecia toda vez que o professor adicionava um cenário/página nova,
    // e ficou mais visível depois que a criação de ATOR novo parou de usar
    // esse mesmo caminho (correção anterior) — sobrou só página nova usando
    // a recarga, então o problema que já existia ficou mais evidente.
    const incomingSpriteIds = stageData.sprites || [];
    const createdThisTick = new Set();
    let page;
    // ⚠️ Capturar ANTES de new Page() — o construtor de Page seta
    // ScratchJr.stage.currentPage = this SEM PASSAR por Stage.setPage()
    // (Page.js:26), então depois de criar a página nova, comparar contra
    // ScratchJr.stage.currentPage já daria "sem mudança nenhuma" (o
    // construtor já trocou por baixo) — Stage.setPage nunca seria chamado,
    // e a página nova ficaria visível por padrão (.stagepage não tem
    // `visibility` no CSS) por cima da que deveria estar escondida, ou
    // escondida pra sempre se o CSS default fosse o contrário. Guardar o
    // valor de ANTES resolve isso.
    const pageWasCurrentBefore = ScratchJr.stage.currentPage;
    const pageKnown = ScratchJr.stage.pages.some((p) => p.id === stageData.id);
    const isNewPage = !pageKnown; // usado lá embaixo no passo 6 (ver comentário lá)
    if (!pageKnown) {
        try {
            // 3º argumento (fcn): loadPageData (Page.js:42-70) só chama isso
            // depois que o CENÁRIO e TODOS os atores da página terminam de
            // carregar de verdade (checkBkgDone/checkCount, gatilhados por
            // Project.mediaCount chegar a 0) — sem passar nada aqui,
            // `if (!fcn) return;` faz esse aviso não ir pra lugar nenhum, e
            // Thumbs.updatePages() nunca é chamado de novo depois da criação.
            // Resultado (confirmado em produção): a miniatura da página nova
            // ficava em branco pra sempre, só sendo redesenhada por
            // coincidência quando QUALQUER outra coisa não relacionada (como
            // apagar uma página, que chama Thumbs.updatePages() por conta
            // própria) rodava depois — nesse ponto os assets já tinham
            // carregado silenciosamente havia tempo, só faltava avisar quem
            // desenha a miniatura.
            page = new Page(stageData.id, _shallowCopyStageData(stageData), () => {
                Thumbs.updateSprites();
                Thumbs.updatePages();
                console.log('[monitor][aluno] PÁGINA — cenário+atores carregados, miniaturas redesenhadas', stageData.id);
            });
            // Project.recreatePage() (Project.js:376-379) faz esse mesmo
            // passo manualmente logo após `new Page(...)` — o construtor
            // sozinho não esconde a própria <div> (nenhum `visibility` no
            // CSS .stagepage também), então sem isso a página nova ficaria
            // visível por cima da atual até o Stage.setPage abaixo assumir.
            page.div.style.visibility = 'hidden';
            // Esconder a página ANTERIOR manualmente aqui: Stage.setPage
            // (passo 1 abaixo) normalmente faz isso sozinho lendo
            // `this.currentPage` — mas como o construtor de Page já trocou
            // esse ponteiro pra página NOVA (comentário acima), Stage.setPage
            // não tem mais como saber qual era a de verdade e nunca a
            // esconderia — as duas ficariam visíveis sobrepostas no palco.
            if (pageWasCurrentBefore && pageWasCurrentBefore !== page) {
                pageWasCurrentBefore.div.style.visibility = 'hidden';
                pageWasCurrentBefore.setPageSprites('hidden');
            }
            incomingSpriteIds.forEach((id) => createdThisTick.add(id));
            console.log('[monitor][aluno] PÁGINA CRIADA', stageData.id, 'sprites:', incomingSpriteIds);
        } catch (err) {
            console.error('[applyStageState] falha ao criar página nova cirurgicamente, caindo pra recarga completa:', err);
            page = null;
        }
        if (!page) {
            console.log('[monitor][aluno] RELOAD COMPLETO disparado (falha ao criar página cirurgicamente)', stageData.id);
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
    } else {
        page = ScratchJr.stage.getPage(stageData.id);
        if (!page) return; // defensivo
    }

    // --- 1. Página ativa (resolver ANTES de mexer em sprites) -------------
    const pageChanged = !pageWasCurrentBefore || pageWasCurrentBefore.id !== stageData.id;
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
    // Pra página recém-criada no passo 0, isso já bate (setBackground já
    // rodou dentro de new Page()) e vira um no-op aqui, como esperado.
    if (stageData.md5 !== page.md5) {
        console.log('[monitor][aluno] CENÁRIO mudando', { pagina: stageData.id, de: page.md5, para: stageData.md5 || 'none' });
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
    // Sprites de uma página recém-criada no passo 0 (createdThisTick já
    // populado lá em cima) caem no `return` logo abaixo — já foram criados
    // via new Page()/loadPageData(), que usa o mesmo Project.recreateObject.
    incomingSpriteIds.forEach((spriteId) => {
        if (createdThisTick.has(spriteId)) return; // já criado no passo 0 (página nova) ou nesta própria iteração
        if (gn(spriteId)) return; // já existe no DOM, passo 5 cuida de atualizar
        const sData = stageData[spriteId];
        if (!sData) return; // defensivo — sem dados, nada a criar (tenta de novo no próximo tick)
        createdThisTick.add(spriteId);
        console.log('[monitor][aluno] ATOR CRIANDO (cirúrgico)', { spriteId, pagina: stageData.id, nome: sData.name, tipo: sData.type });
        Project.recreateObject(page, spriteId, Object.assign({}, sData), (spr) => {
            if (page.id === ScratchJr.stage.currentPage.id) {
                spr.div.style.visibility = 'visible'; // mesmo padrão de Undo.copySprite
            }
            Thumbs.updateSprites(); // sem isso o ícone do ator novo não aparece na tira de sprites
            // Page.prototype.drawSpriteImage (Page.js:302-332, chamado por
            // setPageThumb → pageThumbnail → Thumbs.updatePages) usa
            // spr.originalImg pra desenhar o ator na miniatura da página — e
            // simplesmente pula ("if (!img) return", Page.js:306-308) se essa
            // imagem ainda não carregou. Como esse callback SÓ roda depois do
            // asset carregar de verdade (Sprite/getAsset), chamar
            // Thumbs.updatePages() aqui garante que a miniatura da página seja
            // redesenhada COM o ator novo. Sem isso, a primeira chamada de
            // Thumbs.updatePages() (dentro de Stage.setPage, passo 1, que roda
            // ANTES do asset terminar de carregar) desenhava a miniatura sem o
            // ator, e nada nunca mandava redesenhar de novo — miniatura da
            // página ficava em branco pra sempre (confirmado em produção).
            Thumbs.updatePages();
            console.log('[monitor][aluno] ATOR CRIADO (asset carregado)', spriteId);
        }, spriteId === stageData.lastSprite);
    });

    // --- 4. Sprites que existiam e sumiram desde a última aplicação --------
    // ScratchJr.stage.removeFromPage(spr) (Stage.js:622-645) — NÃO
    // Stage.prototype.removeCharacter (grava Undo por baixo). removeFromPage
    // é o passo interno que removeCharacter chama antes de gravar o undo:
    // tira o id de page.sprites, remove a <div> do sprite, a <div> de
    // scripts e a MINIATURA da tira de atores — tudo de uma vez, sem Undo.
    // Antes disso só marcávamos shown=false/opacity=0 (só escondia no
    // palco); a miniatura na tira de atores continuava lá pra sempre —
    // Thumbs.updateSprites() nem filtra por `shown`, só por pertencer a
    // page.sprites, então a miniatura do ator apagado pelo professor nunca
    // sumia pro aluno (confirmado em produção). Segura mesmo se `id`
    // pertencer a OUTRA página (não a atual): removeFromPage usa
    // this.currentPage e retorna sem fazer nada se o id não estiver na
    // lista dela (Stage.js:627-630) — não precisa checar isso aqui.
    const incomingIds = new Set(incomingSpriteIds);
    _lastSpriteIds.forEach((id) => {
        if (!incomingIds.has(id)) {
            const el = gn(id);
            if (el && el.owner) {
                console.log('[monitor][aluno] ATOR REMOVENDO', { spriteId: id, pagina: stageData.id, nome: el.owner.name });
                ScratchJr.stage.removeFromPage(el.owner);
            } else {
                console.log('[monitor][aluno] ATOR "sumiu" mas não achei no DOM (id de outra página ou já removido)', id);
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
    // Thumbs.selectThisSprite() (NÃO ScriptsPane.setActiveScript direto) —
    // setActiveScript só ATIVA a <div> de scripts do sprite novo
    // (Scripts.prototype.activate(), diferente do Sprite.prototype.activate()
    // que Page.setCurrentSprite já chama por baixo) e reconecta
    // onmousedown/ontouchstart do painel — mas NUNCA desativa a <div> de
    // scripts do sprite que estava ativo antes. Quem faz essa desativação de
    // verdade é Thumbs.selectThisSprite(), que percorre TODAS as miniaturas
    // da tira e chama Thumbs.unhighlighSprite() (→ Scripts.deactivate()) em
    // cada uma que não é a selecionada — chamar setActiveScript sozinho
    // pulava esse passo inteiro. Bug real confirmado em produção: trocar de
    // ator na tira lateral do professor não trocava pro aluno, e os blocos
    // de vários atores diferentes iam se acumulando visíveis ao mesmo tempo
    // (cada Scripts ativado por um setActiveScript anterior nunca era
    // desativado de novo). Thumbs.selectThisSprite já chama
    // ScriptsPane.setActiveScript por baixo (via Thumbs.highlighSprite),
    // então isso substitui a chamada antiga por completo, não só complementa.
    //
    // isNewPage força a chamada mesmo se page.currentSpriteName já bater
    // com stageData.lastSprite: pra página recém-criada no passo 0,
    // loadPageData já seta currentSpriteName = lastSprite ANTES do
    // Stage.setPage do passo 1 rodar — e o próprio Stage.setPage desativa
    // (Scripts.prototype.deactivate) a <div> de scripts de
    // currentPage.currentSpriteName logo no início dele (Stage.js:118-120),
    // podendo desfazer a ativação que Project.recreateObject já tinha
    // feito pro sprite certo. Sem forçar aqui, a checagem de "mudou?"
    // achava que não tinha nada a fazer (currentSpriteName já era o
    // esperado) e nunca reativava.
    if (stageData.lastSprite && (isNewPage || page.currentSpriteName !== stageData.lastSprite)) {
        const selEl = gn(stageData.lastSprite);
        if (selEl && selEl.owner) Thumbs.selectThisSprite(selEl.owner);
    }

    _lastAppliedStage = stageData;
    _lastSpriteIds = incomingIds;
}

/**
 * Remove páginas que o professor apagou mas que NÃO são a página atual
 * dele — applyStageState/encodePage só transmitem a página ATUAL a cada
 * tick, então uma página apagada que o professor não estivesse vendo no
 * momento nunca teria como o aluno saber (nenhum evento cobria esse caso).
 * teacher.js manda `pageIds` (só os ids, leve) com TODAS as páginas do
 * projeto em todo tick — qualquer página que o aluno conhece e não está
 * mais nessa lista foi apagada em algum outro momento.
 *
 * ScratchJr.stage.deletePage(id, true) — NÃO Thumbs.pageMouseDown nem
 * chamar sem o segundo argumento: deletePage(str, data) só grava
 * Undo.record e toca o som de corte quando `!data` (Stage.js:229-248) —
 * passar qualquer valor truthy pula os dois. O resto (tirar do array
 * ScratchJr.stage.pages, remover a <div> da página e de cada sprite dela,
 * trocar de página se a apagada era a atual, atualizar as tiras de
 * miniatura) roda igual, sem Undo.
 */
function applyPageList(pageIds) {
    if (!pageIds || !ScratchJr.stage) return;
    if (_reloadInFlight) return; // recarga completa já em curso, não mexer no meio dela
    const known = new Set(pageIds);
    // Cópia do array porque deletePage muta ScratchJr.stage.pages durante o loop.
    ScratchJr.stage.pages.slice().forEach((p) => {
        if (!known.has(p.id)) {
            console.log('[monitor][aluno] PÁGINA REMOVENDO', p.id, 'pageIds do professor:', pageIds);
            ScratchJr.stage.deletePage(p.id, true);
        }
    });
}

/**
 * Algumas funções do motor (ScratchJr.enterFullScreen/quitFullScreen,
 * Library.close) só chamam e.preventDefault()/e.stopPropagation() no evento
 * que as disparou (e, por baixo, ScratchJr.unfocus(e) só lê e.target, de
 * forma opcional) — como aqui não existe clique/toque real nenhum (é o
 * broadcast do professor pilotando à distância), um Event genérico e
 * cancelable cobre tudo isso.
 *
 * ⚠️ NÃO usar document.createEvent('TouchEvent') + e.initTouchEvent() (o
 * padrão legado usado em ScratchJr.fullScreen/Library.open pro botão físico
 * "voltar" do Android) — essa API é instável/ausente em navegador desktop
 * moderno, e como esses dois pontos só são exercitados pelo hardware de
 * back do Android, nunca em desktop, o bug nunca tinha aparecido antes.
 * Confirmado em produção: era exatamente essa a causa da tela cheia não
 * entrar/sair pro aluno via espelhamento (a chamada de fakeTouchEvent()
 * lançava exceção antes mesmo de chegar em enterFullScreen/quitFullScreen).
 */
function fakeTouchEvent() {
    return new Event('touchstart', { bubbles: true, cancelable: true });
}

/**
 * Aplica o "chrome" da UI do professor — biblioteca aberta, tela cheia,
 * categoria de bloco selecionada — no motor do aluno, além do palco em si
 * (applyStageState). Ao contrário de applyStageState, aqui não guarda
 * snapshot nenhum: cada tick compara direto contra o estado ATUAL do motor
 * (Library.isOpen/currentType, ScratchJr.inFullscreen, Palette.numcat) —
 * mais simples e autocorretivo, sem risco da classe de bug de "leitura de
 * formato errado" que já pegou applyStageState (ver comentário lá em cima).
 *
 * ⚠️ Biblioteca: abrir de verdade (Library.open) monta a MESMA UI
 * clicável que o professor usa — os thumbnails têm onmousedown ligado a
 * funções reais (Library.selectAsset → ... → Page.addSprite/setBackground).
 * Só é seguro espelhar isso porque showLockOverlay() agora fica com
 * zIndex ACIMA de .libframe (10500 > 10000) — o "vidro" cobre a biblioteca
 * espelhada também, não só o palco. Ver comentário de showLockOverlay.
 */
function applyUiState(ui) {
    if (!ui || !ScratchJr.stage) return;

    if (!!ui.fullscreen !== ScratchJr.inFullscreen) {
        if (ui.fullscreen) {
            ScratchJr.enterFullScreen(fakeTouchEvent());
        } else {
            ScratchJr.quitFullScreen(fakeTouchEvent());
        }
    }

    if (typeof ui.category === 'number' && ui.category !== Palette.numcat) {
        Palette.selectCategory(ui.category);
    }

    const wantOpen = !!ui.library;
    if (wantOpen) {
        if (!Library.isOpen || Library.currentType !== ui.library) {
            if (Library.isOpen) Library.close(fakeTouchEvent()); // troca de tipo: fecha e reabre com o tipo certo
            Library.open(ui.library);
        }
        // Rolagem da biblioteca — fração (0..1) de scrollTop/scrollHeight, não
        // pixel absoluto: telas de tamanhos diferentes têm scrollHeight
        // diferente (mesmo conteúdo, wrap de grid diferente), então um valor
        // absoluto ia parar num ponto errado do lado do aluno. Reaplicado a
        // cada tick (como o resto de applyUiState) — nos primeiros ticks
        // depois de abrir, os thumbnails ainda estão carregando (addThumbnails
        // é assíncrono, via IO.query) e scrollHeight ainda não é o final, mas
        // os próximos ticks se autocorrigem assim que o conteúdo estabiliza.
        if (typeof ui.libraryScroll === 'number') {
            const area = gn('scrollarea');
            if (area) {
                const max = area.scrollHeight - area.clientHeight;
                area.scrollTop = max > 0 ? ui.libraryScroll * max : 0;
            }
        }
    } else if (Library.isOpen) {
        Library.close(fakeTouchEvent());
    }

    applyHoverTarget(ui.hover);
}

/**
 * Acha a miniatura (DOM) correspondente a um {kind, id} de _hoverTarget
 * (teacher.js). Biblioteca: id = md5, e o próprio DOM id do .assetbox já É
 * o md5 (Library.addAssetThumbChoose/addLocalThumbChoose) — gn() direto
 * serve. Sprite/página: o DOM id da miniatura é gerado descartável
 * (getIdFor('spritethumb'/'pagethumb')) — o id de verdade fica na
 * propriedade JS `.owner` (Sprite.js:189-191/Page.js:228-229), por isso
 * precisa percorrer os filhos do container em vez de usar gn().
 */
function _findHoverElement(hover) {
    if (!hover) return null;
    if (hover.kind === 'library') {
        return gn(hover.id) || null;
    }
    const containerId = hover.kind === 'sprite' ? 'spritecc' : hover.kind === 'page' ? 'pagecc' : null;
    const container = containerId && gn(containerId);
    if (!container) return null;
    for (let i = 0; i < container.childElementCount; i++) {
        if (container.childNodes[i].owner === hover.id) return container.childNodes[i];
    }
    return null;
}

/**
 * Reflete onde o mouse do professor está passando (biblioteca, tira de
 * atores, tira de páginas) — NÃO como um cursor/ponteiro flutuante seguindo
 * pixel a pixel (isso reintroduziria o problema de coordenadas dependentes
 * de viewport já descartado lá no desenho original), e sim reaproveitando
 * as próprias miniaturas identificáveis que já existem dos dois lados:
 * destaca a que corresponde ao {kind, id} recebido com um box-shadow
 * simples (estilo inline, sem precisar de classe CSS nova) e limpa a
 * anterior. Autocorretivo por natureza — se o elemento de antes já não
 * existir mais (ex.: biblioteca fechou, tira foi reconstruída), o pior caso
 * é escrever num nó órfão, inofensivo.
 */
function applyHoverTarget(hover) {
    if (_hoverEl) {
        _hoverEl.style.boxShadow = '';
        _hoverEl.style.borderRadius = '';
        _hoverEl = null;
    }
    const el = _findHoverElement(hover);
    if (el) {
        el.style.boxShadow = '0 0 0 4px #ffcc00, 0 0 12px 4px rgba(255, 204, 0, 0.85)';
        el.style.borderRadius = '8px';
        _hoverEl = el;
    }
}

/**
 * Rede de segurança: se a sessão terminar (ou o controle voltar pro aluno)
 * enquanto a biblioteca espelhada ou a tela cheia do professor estavam
 * ativas na tela do aluno, elas ficariam presas assim pra sempre — nada
 * mais chama applyUiState depois disso pra fechar. Mesmo espírito do
 * hideLockOverlay() já chamado como rede de segurança em endLocalSession().
 */
function resetMirroredUi() {
    if (Library.isOpen) Library.close(fakeTouchEvent());
    if (ScratchJr.inFullscreen) ScratchJr.quitFullScreen(fakeTouchEvent());
    applyHoverTarget(null); // limpa o destaque de hover, se algum ainda estiver aceso
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
 * backend que essa sessão específica não faz mais sentido continuar
 * (evita o professor aparecer como "observando" pra sempre no painel dele,
 * e evita uma resposta tardia da aba zumbi confundir o estado depois).
 * Precisa da checagem de dono aceitar aluno também, não só professor (ver
 * backend/src/routes/teacher.js — mesmo ajuste já feito pro heartbeat).
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
    _stopWatchdog(); // controle voltou pelo caminho normal — não tem mais o que vigiar
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
