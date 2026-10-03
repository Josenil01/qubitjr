/**
 * src/app/src/editor/ui/AssignmentBadge.js
 *
 * Selo flutuante de progresso da missão (lado do ALUNO). Chamado de
 * entry/editor.js (editorMain), só no ramo NORMAL (não professor-autor),
 * depois de ScratchJr.appinit().
 *
 * Fluxo:
 *  1. init() consulta GET /api/assignments/active. Sem turma_id no token
 *     (a maioria dos alunos, fora do contexto HelloYotta) o backend
 *     devolve { assignment: null } (ou nem 200) - no-op silencioso, mesma
 *     filosofia de initLiveWatch() (ver comentário em entry/editor.js e em
 *     LiveWatch.js).
 *  2. Se a missão existe mas ainda não foi iniciada (existingProjectId
 *     null) e o projeto aberto agora não é o dela, mostra um banner
 *     dispensável ("Nova missão: X - Iniciar?"), NÃO bloqueante. Ao clicar
 *     "Iniciar", cria um projeto novo já vinculado à missão via
 *     Project.createNewProject({name, assignmentId}, ...) - ver Part 3/
 *     IO.js (createProject grava assignment_id quando presente).
 *  3. Se o projeto aberto agora já é o da missão (ou o aluno acabou de
 *     iniciar no passo 2), mostra o selo colapsado: 🎯 metCount/3, contando
 *     quantos dos 3 grupos de requisito de topo (scenes/characters/blocks)
 *     têm met:true - as 6 notas de pensamento computacional (ctScores)
 *     ficam de fora da visão do aluno neste primeiro momento (mais úteis
 *     pro professor do que pra uma criança de 6 anos decifrar).
 *  4. O lado ATUAL do checklist (quantas cenas/atores/blocos o projeto TEM
 *     agora) é recalculado EM TEMPO REAL, direto da memória do navegador -
 *     computeProjectManifest(Project.getProject(...)) roda a cada poucos
 *     segundos (ACTUAL_REFRESH_MS) usando o mesmo snapshot que Project.save()
 *     usaria pra salvar, sem esperar o autosave nem ida-e-volta ao servidor.
 *     Isso é só um retorno visual otimista pro aluno em pleno trabalho - o
 *     lado REQUISITADO (o que o professor pediu) ainda vem do servidor via
 *     GET /api/assignments/active, recarregado a cada REQUIREMENTS_REFRESH_MS
 *     (bem mais raro) só pra pegar o caso do professor reautorar a missão
 *     no meio da sessão do aluno. A fonte de verdade pra correção/nota
 *     continua sendo o servidor lendo o projeto SALVO (GET /api/public/
 *     students/:id/assignment-score, consultado pela HelloYotta) - o que
 *     está aqui é só feedback ao vivo, nunca usado pra decisão de avaliação.
 *     Ver services/assignmentScoring.js (cópia client-side, ver seu docblock).
 *  5. Clicar no selo expande um popover com o detalhamento (cenas/atores/
 *     blocos, requerido vs atual). Clicar fora fecha.
 *  6. Na transição de "ainda não" pra "completou" (scenes+characters+blocks
 *     todos met - campo `completed` de compareManifests, ctScores NÃO
 *     entram nessa conta) mostra um modal central de parabéns, uma vez só
 *     por sessão de aba. Reabrir uma missão já concluída em sessões
 *     anteriores não reexibe o modal (wasComplete começa null - só dispara
 *     numa transição observada AO VIVO, não no primeiro cálculo).
 *  7. Enquanto a missão NÃO está completa, o mesmo componente visual do
 *     modal de parabéns é reaproveitado (_showCoachModal, generalizado a
 *     partir do antigo _showCompleteModal) pra mostrar "dicas de coach"
 *     (assignment.hints, geradas pelo professor - ver AssignmentAuthorBar.js
 *     e POST /assignments/:id/generate-hints) quando a condição de alguma
 *     delas está batendo AGORA no projeto do aluno. A avaliação roda dentro
 *     do mesmo tick de _recomputeLocal(), usando computeDetailedManifest
 *     (detailedManifest.js) sobre o mesmíssimo projectJson já lido pra
 *     computeProjectManifest - sem round-trip extra ao servidor. Cada dica
 *     já mostrada+fechada nesta sessão de aba nunca reaparece sozinha (mesma
 *     filosofia não-chata de dismissedThisSession pro banner de início), e
 *     nenhuma dica aparece depois que a missão já completou de vez.
 *
 *     Cadência (achado em teste real - dica demorando/aparecendo em bloco;
 *     mecanismo inteiro mora em PollScheduler.js desde a refatoração Fase 3):
 *     o poll roda mais rápido (800ms) enquanto houver dica pendente, volta
 *     pro ritmo normal (2s) quando não; um recheck imediato dispara em
 *     visibilitychange (o poll PARA por completo com a aba oculta - sem
 *     isso, todo progresso feito nesse meio-tempo só aparecia no próximo
 *     tick); e uma dica só aparece sozinha depois que o aluno fica PARADO
 *     (sem clicar/arrastar/digitar, ver PollScheduler.idleFor()/
 *     IDLE_BEFORE_HINT_MS aqui) por um tempo - achado em teste
 *     real (2ª rodada, "cadência desordenada"): um cooldown de tempo FIXO
 *     desde a última dica fechada (a versão anterior deste mecanismo) não
 *     tinha relação nenhuma com o que o aluno estava fazendo - podia
 *     interromper ele no meio de um arrasto, ou várias condições satisfeitas
 *     ao mesmo tempo (ex.: progresso feito com a aba oculta) apareciam em
 *     sequência rígida de X em X segundos independente de estar mexendo ou
 *     não. Esperar o aluno ficar ocioso garante que a próxima dica só
 *     interrompe numa pausa natural, nunca no meio de uma ação.
 *     O botão flutuante de dica (hintButtonEl, _createHintButton) NÃO
 *     depende desse timing - clique abre um painel navegável
 *     (hintsPanelEl, _openHintsPanel/_renderHintsPanel) com TODAS as dicas
 *     da missão, Anterior/Próxima, cada uma com seu status (✅ já resolvida
 *     / 💡 ainda vale) recalculado na hora. Existe em paralelo ao modal
 *     automático (mantido de propósito, ver feedback de teste real) - os
 *     dois se excluem mutuamente (_evaluateHints não interrompe com o
 *     automático enquanto o painel está aberto; abrir o painel fecha o
 *     automático primeiro) pra nunca ter dois overlays empilhados.
 */

import ScratchJr from '../ScratchJr.js';
import Project from './Project.js';
import {newHTML} from '../../utils/lib.js';
import {computeProjectManifest, compareManifests} from '../../../../../shared/assignmentScoring.mjs';
import {computeDetailedManifest} from '../../../../../shared/detailedManifest.mjs';
import MediaLib from '../../iPad/MediaLib.js';
import Palette from './Palette.js';
import {registerGalleryRestrictionProvider, registerZeroBlockDefaultsProvider, allCharactersAtLimit} from './GalleryRestriction.js';
import {
    hintConditionHolds,
    mistakeInfo as computeMistakeInfo,
    orderInfo as computeOrderInfo,
    actorLabelFor,
} from './HintEngine.js';
import PollScheduler from './PollScheduler.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));
const IDLE_BEFORE_HINT_MS = 3000; // aluno precisa ficar esse tempo sem clicar/arrastar/digitar em
// lugar NENHUM da página antes da próxima dica poder aparecer sozinha - achado em teste real
// ("cadência desordenada"): um tempo fixo desde o fechamento da dica anterior (mecanismo
// antigo) não tinha relação com o que o aluno estava fazendo, podendo interromper ele no meio
// de uma ação. Ver PollScheduler.idleFor()/PollScheduler.js. Só vale pro caminho automático
// (poll) - o painel de dicas (_openHintsPanel) ignora, de propósito: é exatamente pra isso que
// ele existe (ver docblock do ponto 7 no topo do arquivo).
const ALERT_IDLE_MS = 1000; // o alerta "Quase!" (valor/gatilho errado) vem logo depois da AÇÃO do aluno
// (soltar o bloco) - é quando a dica mais vale, então não espera os 3s de IDLE_BEFORE_HINT_MS
// (esses são só pra dica proativa, que INTERROMPE o aluno). Ver _evaluateHints.
// FILL_IDLE_MS (tempo de espera pro alerta de bloco zerado) mora agora em
// HintEngine.js, junto da lógica que decide o kind 'fill' - este arquivo só
// lê de volta via wrongValueInfo.idleMs, nunca precisa do valor em si.
const MISTAKE_BLINK_MS = 8000; // por quanto tempo o bloco errado pisca depois do aluno fechar o alerta
// Achado em teste real: fechar a dica/painel clicando fora do cartão, ou
// clicando no botão de fechar rápido demais (reflexo/clique duplo), dispensava
// a mensagem antes da criança dar tempo de ler. Agora só o botão dentro do
// cartão fecha (nunca o clique no fundo), e esse botão fica desabilitado
// pelos primeiros CLOSE_DELAY_MS depois de aberto - ver _showCoachModal/
// _renderHintsPanel.
const CLOSE_DELAY_MS = 2000;

let assignment = null; // { id, projectName, requirements, nivel, turmaId, existingProjectId }
let lastProgress = null; // último resultado calculado (pro popover não ficar vazio ao abrir)
let bannerEl = null;
let badgeEl = null;
let popoverEl = null;
let hintButtonEl = null; // botão flutuante "💡" - abre o painel com todas as dicas da missão
let hintsPanelEl = null; // painel navegável (Anterior/Próxima) aberto pelo botão - ver _openHintsPanel
let coachModalEl = null; // um modal por vez - serve tanto pro "parabéns" quanto pra dica de coach automática
let dismissedThisSession = false;
let dismissedHintIds = new Set(); // ids de dica já mostrada+fechada nesta sessão de aba - nunca mais reexibida automaticamente
let zeroDefaultsApplied = false; // último estado aplicado à paleta (ver _syncPaletteDefaults)
let blockBlinkEls = []; // <div>s de bloco piscando agora (ver _highlightMistake)
let blockBlinkTimer = null;
let wrongValueAlerted = new Set(); // assinaturas (ver mistakeInfo em HintEngine.js) de "valor/gatilho errado" já avisadas nesta sessão de aba
// null = ainda não sabemos (primeiro cálculo desta sessão de aba) - fica
// assim de propósito pra não disparar o modal de parabéns só por reabrir
// uma missão que já estava completa antes. Só vira true/false depois do
// primeiro _applyProgress(), e o modal só aparece numa transição
// false -> true observada DEPOIS disso.
let wasComplete = null;
// "Uma vez concluída, a missão fica concluída" (decisão explícita do
// usuário) - sticky pra sempre nesta sessão a partir do instante em que
// isComplete vira true (ver _applyProgress), e SEMEADO como true já no
// init() se o servidor disser que esta missão já foi concluída antes (ver
// GET /active#completedAt, gravado por POST /:id/complete). Ao contrário de
// wasComplete (o valor AO VIVO de cada recálculo, que volta a false se o
// aluno apagar um bloco depois), everCompleted NUNCA volta a false - é o
// flag que galleryRestriction/zeroDefaultsActive/_recomputeLocal consultam
// pra travar a conquista e parar de reavaliar a missão pra sempre.
let everCompleted = false;

function authHeader () {
    var token = window.__AUTH_TOKEN__;
    return token ? {Authorization: 'Bearer ' + token} : {};
}

function apiFetch (path, options) {
    options = options || {};
    return fetch(API_BASE_URL + path, {
        ...options,
        headers: {'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {})},
    });
}

/**
 * Fire-and-forget: registra no servidor (hint_events, ver backend/src/routes/
 * assignments.js) que uma dica de coach foi mostrada/dispensada nesta missão -
 * sinal de dificuldade/engajamento que antes só existia como dismissedHintIds
 * em memória, perdido ao fechar a aba. Nunca bloqueia nem interrompe o fluxo
 * do aluno: erro de rede aqui é só um log, o badge continua funcionando
 * normalmente mesmo sem persistir o evento.
 */
function recordHintEvent (hintId, eventType) {
    if (!assignment || !assignment.id) {
        return;
    }
    apiFetch('/assignments/' + assignment.id + '/hints/' + encodeURIComponent(hintId) + '/event', {
        method: 'POST',
        body: JSON.stringify({eventType: eventType}),
    }).catch(function (err) {
        console.warn('[AssignmentBadge] recordHintEvent falhou (não-fatal):', err && err.message);
    });
}

export default class AssignmentBadge {
    /**
     * Consultado por Library.js pra restringir a galeria de personagens/
     * fundos ao que o professor usou no projeto de referência desta missão -
     * "siga o exemplo do professor primeiro, libere tudo depois que
     * concluir" (decisão explícita do usuário). Retorna `null` quando a
     * restrição NÃO deve valer - nenhum caso trava a galeria por acidente:
     *  - sem missão ativa (projeto livre/lobby, `assignment` nunca setado);
     *  - `assignment.requirements` ausente (dado antigo/nunca calculado);
     *  - missão já concluída, mesmo que só nesta sessão (`everCompleted` -
     *    sticky pra sempre, ver docblock da variável e _applyProgress).
     * Quando não-null, characterMd5s/sceneMd5s podem INDIVIDUALMENTE ser
     * `null` (não só o objeto inteiro) - decisão explícita do usuário:
     * requirements vazios/ausentes pra UMA das duas galerias (ex.: projeto
     * de referência sem nenhum personagem, o que não devia acontecer mas
     * não custa proteger) nunca deve travar o aluno sem NENHUMA opção
     * pra escolher - melhor liberar aquela galeria específica do que
     * mostrar uma lista vazia.
     *
     * Prefere `req.characters.present`/`req.scenes.present` (todo md5 que
     * existe FISICAMENTE no projeto do professor, script ou não) a
     * `.used` (que exige pelo menos um script não-vazio pro CT scoring -
     * ver docblock de assignmentScoring.js#presentCharacterMd5Set). Achado
     * em teste real - "coloquei o vovô na missão e ele não aparecia pro
     * aluno escolher": o professor tinha posto o personagem na cena sem
     * ainda dar script a ele, então `.used` nunca o incluía, e a galeria
     * filtrava por `.used` - o personagem sumia da lista de opções por
     * completo, não só da contagem de progresso. Cai pra `.used` só quando
     * `.present` está ausente (requirements antigos, calculados antes
     * desta mudança, sem o campo novo ainda salvo).
     */
    static get galleryRestriction () {
        if (!assignment || !assignment.requirements) return null;
        if (everCompleted) return null;
        // Só restringe DENTRO do projeto da própria missão. Projeto autoral/
        // livre (ou missão ainda não iniciada) nunca é travado pelos assets
        // do professor - senão a missão ativa da turma vazava pra qualquer
        // projeto do aluno, e everCompleted (só atualizado no projeto da
        // missão) nunca liberava.
        if (!assignment.existingProjectId ||
            String(ScratchJr.currentProject) !== String(assignment.existingProjectId)) return null;
        const req = assignment.requirements;
        const characterMd5s = (req.characters && Array.isArray(req.characters.present)) ? req.characters.present :
            (req.characters && Array.isArray(req.characters.used)) ? req.characters.used : [];
        const sceneMd5s = (req.scenes && Array.isArray(req.scenes.present)) ? req.scenes.present :
            (req.scenes && Array.isArray(req.scenes.used)) ? req.scenes.used : [];
        // Limite de QUANTIDADE (pedido do professor): o exemplo dele usa N
        // vezes cada personagem e M cenas - o aluno não passa disso enquanto a
        // missão não conclui. characterMaxCounts/maxScenes ausentes (missão
        // cadastrada antes deste recurso, sem presentCounts/pageCount) = sem
        // limite, como sempre foi. Os contadores do aluno são lidos AGORA (não
        // cacheados) do palco, mesma leitura de _readProjectJson.
        const maxCounts = (req.characters && req.characters.presentCounts &&
            typeof req.characters.presentCounts === 'object') ? req.characters.presentCounts : null;
        const maxScenes = (req.scenes && Number.isFinite(req.scenes.pageCount) && req.scenes.pageCount > 0) ?
            req.scenes.pageCount : null;
        const counts = {};
        const countsByScene = []; // aluno, por cena, na ordem das páginas
        const pageIds = [];
        let sceneCount = 0;
        const projectJson = (maxCounts || maxScenes) ? AssignmentBadge._readProjectJson() : null;
        if (projectJson && Array.isArray(projectJson.pages)) {
            sceneCount = projectJson.pages.length;
            projectJson.pages.forEach(function (pageId) {
                const page = projectJson[pageId];
                if (!page || typeof page !== 'object') {
                    return; // mesma regra do manifesto: página fantasma não conta/indexa
                }
                pageIds.push(pageId);
                const inScene = {};
                (Array.isArray(page.sprites) ? page.sprites : []).forEach(function (spriteId) {
                    const sprite = page[spriteId];
                    if (sprite && sprite.type === 'sprite' && sprite.md5) {
                        counts[sprite.md5] = (counts[sprite.md5] || 0) + 1;
                        inScene[sprite.md5] = (inScene[sprite.md5] || 0) + 1;
                    }
                });
                countsByScene.push(inScene);
            });
        }
        // Limite POR CENA quando o exemplo do professor tem contagem por cena
        // (presentCountsByScene): na cena i do aluno, vale o que o professor
        // tem na cena i - dois "jarra" no exemplo, um em cada cena, não deixam
        // o aluno pôr os dois na mesma. Sem isso (missão só com presentCounts,
        // ou cena atual além das do exemplo), cai no limite do projeto todo.
        const byScene = (req.characters && Array.isArray(req.characters.presentCountsByScene)) ?
            req.characters.presentCountsByScene : null;
        const stage = ScratchJr.stage;
        const currentIdx = (projectJson && stage && stage.currentPage) ? pageIds.indexOf(stage.currentPage.id) : -1;
        const useScene = !!(byScene && currentIdx >= 0 && currentIdx < byScene.length);
        return {
            // Os limites por cena dependem da POSIÇÃO da cena (cena i do aluno
            // = cena i do exemplo) - reordenar as cenas os embaralharia. Com
            // contagem por cena disponível, Thumbs.pageMouseDown não deixa
            // arrastar cena até a missão concluir.
            sceneOrderLocked: !!byScene,
            characterLimitScope: useScene ? 'scene' : 'total',
            characterMd5s: characterMd5s.length > 0 ? new Set(characterMd5s) : null,
            sceneMd5s: sceneMd5s.length > 0 ? new Set(sceneMd5s) : null,
            // Só devolve limites quando conseguiu ler o projeto do aluno
            // (senão não dá pra saber se já atingiu - melhor não travar).
            characterMaxCounts: projectJson ? (useScene ? byScene[currentIdx] : maxCounts) : null,
            characterCounts: useScene ? countsByScene[currentIdx] : counts,
            maxScenes: projectJson ? maxScenes : null,
            sceneCount: sceneCount,
        };
    }

    /**
     * A paleta deve começar os blocos zerados agora? Mesmas condições da
     * restrição de galeria (missão ativa, projeto dela, ainda não concluída)
     * - ver galleryRestriction e Palette.newScaledBlock.
     */
    static get zeroDefaultsActive () {
        if (!assignment || !assignment.requirements) return false;
        if (everCompleted) return false;
        return !!assignment.existingProjectId &&
            String(ScratchJr.currentProject) === String(assignment.existingProjectId);
    }

    /**
     * Reconstrói a paleta quando o modo "blocos zerados" liga/desliga (missão
     * começou ou concluiu) - a paleta é montada por categoria, então sem isso
     * a categoria já aberta ficaria com os padrões antigos (ou com os zeros,
     * depois da conclusão) até o aluno trocar de aba. Só na MUDANÇA de estado.
     */
    static _syncPaletteDefaults () {
        const active = AssignmentBadge.zeroDefaultsActive;
        if (active === zeroDefaultsApplied) {
            return;
        }
        zeroDefaultsApplied = active;
        try {
            Palette.selectCategory(Palette.numcat);
        } catch (err) {
            console.warn('[AssignmentBadge] refresh da paleta falhou (não-fatal):', err && err.message);
        }
    }

    static async init () {
        let res;
        try {
            res = await apiFetch('/assignments/active');
        } catch (err) {
            console.warn('[AssignmentBadge] /assignments/active falhou:', err && err.message);
            return;
        }
        if (!res.ok) {
            return; // sem turma_id compatível no token, ou endpoint indisponível - no-op silencioso
        }
        const data = await res.json().catch(function () {
            return {};
        });
        if (!data || !data.assignment) {
            return;
        }
        assignment = data.assignment;

        // Missão já concluída em sessão/dia anterior (ver services/
        // completionSnapshot.js no backend) - trava como conquista permanente
        // já ANTES de qualquer recálculo, e pré-popula o popover com a foto
        // congelada pra não ficar "Carregando..." até o aluno clicar de novo
        // em algo que dispare um recálculo (que, sticky, nunca mais roda).
        if (assignment.completedAt) {
            everCompleted = true;
            wasComplete = true;
            if (assignment.completionSnapshot) {
                lastProgress = {projectName: assignment.projectName, ...assignment.completionSnapshot};
            }
        }

        // Recarrega as dicas que este aluno já fechou (antes só existiam em
        // memória - um F5 fazia a de introdução voltar toda vez). Best-effort:
        // falha/sem rede = começa vazio, como sempre foi.
        try {
            const dismissedRes = await apiFetch('/assignments/' + assignment.id + '/hints/dismissed');
            if (dismissedRes.ok) {
                const body = await dismissedRes.json().catch(function () {
                    return {};
                });
                (Array.isArray(body.dismissed) ? body.dismissed : []).forEach(function (id) {
                    dismissedHintIds.add(id);
                });
            }
        } catch (err) {
            console.warn('[AssignmentBadge] hints/dismissed falhou (não-fatal):', err && err.message);
        }

        const isCurrentProject = !!assignment.existingProjectId &&
            String(ScratchJr.currentProject) === String(assignment.existingProjectId);

        if (isCurrentProject) {
            AssignmentBadge._showBadge();
        } else if (!assignment.existingProjectId) {
            AssignmentBadge._showStartBanner();
        }
        // else: missão já iniciada só que NOUTRO projeto, e o aluno está
        // olhando pra este agora - fica em silêncio (ver comentário no topo do arquivo).
    }

    /**
     * Liga/desliga o visual "desabilitado" do botão de nova cena (tile
     * #emptypage, ver Thumbs.js) conforme o limite de cenas da missão -
     * roda a cada avaliação, então acompanha o aluno adicionando/apagando
     * cenas e some sozinho quando a missão conclui (galleryRestriction
     * volta null). O clique em si é barrado em Thumbs.clickOnEmptyPage.
     */
    static _syncSceneLimitUi () {
        const r = AssignmentBadge.galleryRestriction;
        const tile = document.getElementById('emptypage');
        if (tile) {
            tile.classList.toggle('assignmentLimitReached', !!(r && r.maxScenes && r.sceneCount >= r.maxScenes));
        }
        // Botão de novo personagem: desabilitado quando não sobra nenhum
        // personagem da missão pra adicionar nesta cena (ver UI.addSprite).
        const addActor = document.querySelector('.addsprite');
        if (addActor) {
            const exhausted = allCharactersAtLimit(r, (MediaLib.sprites || []).map(function (s) {
                return s.md5;
            }));
            addActor.classList.toggle('assignmentLimitReached', exhausted);
        }
    }

    static _showStartBanner () {
        if (dismissedThisSession || bannerEl) {
            return;
        }
        bannerEl = newHTML('div', 'assignmentStartBanner', document.body);
        const text = newHTML('span', 'assignmentStartText', bannerEl);
        text.textContent = '🎯 Nova missão: ' + assignment.projectName + ' — Iniciar?';
        const startBtn = newHTML('button', 'assignmentStartBtn', bannerEl);
        startBtn.type = 'button';
        startBtn.textContent = 'Iniciar';
        startBtn.onclick = AssignmentBadge._startMission;
        const closeBtn = newHTML('button', 'assignmentStartClose', bannerEl);
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Dispensar');
        closeBtn.onclick = AssignmentBadge._dismissBanner;
    }

    static _dismissBanner () {
        // Só esconde pra esta sessão de aba - não persiste nada durável
        // (pedido explícito da spec pra este primeiro passe).
        dismissedThisSession = true;
        AssignmentBadge._hideBanner();
    }

    static _hideBanner () {
        if (bannerEl && bannerEl.parentNode) {
            bannerEl.parentNode.removeChild(bannerEl);
        }
        bannerEl = null;
    }

    static _startMission () {
        if (!assignment) {
            return;
        }
        AssignmentBadge._hideBanner();
        Project.createNewProject({
            name: assignment.projectName,
            assignmentId: assignment.id,
        }, function (md5) {
            assignment.existingProjectId = md5;
            AssignmentBadge._showBadge();
        });
    }

    static _showBadge () {
        if (badgeEl) {
            return;
        }
        badgeEl = newHTML('div', 'assignmentBadge', document.body);
        badgeEl.setAttribute('role', 'button');
        badgeEl.tabIndex = 0;
        badgeEl.textContent = '🎯 …';
        badgeEl.onclick = AssignmentBadge._toggleExpanded;

        // Missão já concluída (agora, ou numa sessão anterior - ver init()):
        // mostra o selo fixo, libera galeria/paleta/limites de uma vez e
        // PARA por aqui - nunca cria o botão de dica, nunca inicia o
        // PollScheduler. É exatamente o "parar de capturar dados" depois de
        // concluída (pedido explícito do usuário) - a única coisa que ainda
        // acontece depois disso é o aluno poder abrir o popover (lastProgress,
        // semeado em init() a partir da foto congelada).
        if (everCompleted) {
            badgeEl.classList.add('completed');
            badgeEl.textContent = '✅ Concluído';
            AssignmentBadge._syncSceneLimitUi();
            AssignmentBadge._syncPaletteDefaults();
            return;
        }

        // Botão flutuante de dica - só existe se a missão tiver dicas (ver
        // docblock ponto 7). Escondido de novo em _applyProgress quando a
        // missão completa (mesma hora que _evaluateHints para de rodar).
        if (assignment && Array.isArray(assignment.hints) && assignment.hints.length) {
            AssignmentBadge._createHintButton();
        }

        AssignmentBadge._recomputeLocal();
        // Cadência de recálculo (poll normal/acelerado, recheck instantâneo
        // pós-interação, recheck em visibilitychange, refresh periódico de
        // requisitos) - ver PollScheduler.js pro racional completo. Ligado
        // uma única vez (mesma guarda `if (badgeEl) return` no topo desta
        // função); PollScheduler.stop() em _lockCompletion() desliga pra
        // sempre quando a missão conclui.
        PollScheduler.start({
            onTick: AssignmentBadge._recomputeLocal,
            onRequirementsRefresh: AssignmentBadge._refreshRequirements,
            hasPendingHints: function () {
                return !!(assignment && Array.isArray(assignment.hints) &&
                    assignment.hints.some(function (h) {
                        return h && !dismissedHintIds.has(h.id);
                    }));
            },
        });
    }

    /**
     * Lê o projeto direto do estado em memória do palco - mesmo snapshot
     * que Project.save() serializaria se salvasse agora (Project.getProject()
     * é a função usada nos dois lugares). Não bate no servidor - extraído de
     * _recomputeLocal pra ser reaproveitado também pelo painel de dicas
     * (_openHintsPanel), sem duplicar a leitura.
     */
    static _readProjectJson () {
        if (!assignment || !ScratchJr.stage || !ScratchJr.stage.pages || !ScratchJr.stage.pages.length) {
            return null; // palco ainda não montado - próximo tick tenta de novo
        }
        try {
            // Com a máscara: bloco com valor padrão ainda não confirmado pelo
            // aluno não conta como valor feito (ver Project.maskUnconfirmed).
            Project.setMaskUnconfirmed(true);
            return Project.getProject(ScratchJr.stage.pages[0].id);
        } catch (err) {
            return null; // best-effort - nunca deixa um erro de leitura quebrar o selo
        } finally {
            Project.setMaskUnconfirmed(false);
        }
    }

    static _recomputeLocal () {
        // Sticky - ver docblock de everCompleted no topo do arquivo. Nunca
        // reavalia nada depois de concluída, mesmo que o aluno mude o
        // projeto - é o que também garante que nenhum poll chegue a
        // reagendar-se de novo depois de _lockCompletion() ter parado os
        // timers (ver _applyProgress).
        if (everCompleted) {
            return;
        }
        // Aluno com um campo de bloco em edição (teclado de texto do say ou
        // teclado numérico) - não avalia nada AINDA. Pedido explícito: os
        // parabéns (e os alertas) só depois que ele termina e o campo perde o
        // foco. Sem isso, digitando "12" num bloco cujo alvo é 1, o "1"
        // intermediário já completava a missão por um instante.
        if (ScratchJr.activeFocus) {
            return;
        }
        const projectJson = AssignmentBadge._readProjectJson();
        if (!projectJson) {
            return;
        }
        AssignmentBadge._syncSceneLimitUi();
        const actual = computeProjectManifest(projectJson);
        const comparison = compareManifests(assignment.requirements, actual);
        AssignmentBadge._applyProgress({
            hasAssignment: true,
            projectName: assignment.projectName,
            ...comparison,
        });
        AssignmentBadge._evaluateHints(comparison.completed, projectJson);
    }

    /**
     * Só recarrega o lado REQUISITADO (assignment.requirements), consultando
     * GET /assignments/active de novo - cobre o caso (raro) de o professor
     * reautorar/editar o exemplo enquanto o aluno já está com a missão
     * aberta. Reaplica o cálculo local na sequência com o requisito novo.
     */
    static async _refreshRequirements () {
        if (!assignment) {
            return;
        }
        let res;
        try {
            res = await apiFetch('/assignments/active');
        } catch (err) {
            return; // best-effort - próximo tick tenta de novo
        }
        if (!res.ok) {
            return;
        }
        const data = await res.json().catch(function () {
            return {};
        });
        if (!data || !data.assignment || String(data.assignment.id) !== String(assignment.id)) {
            return; // missão mudou/sumiu no meio da sessão - não é o escopo deste refresh
        }
        assignment.requirements = data.assignment.requirements;
        AssignmentBadge._recomputeLocal();
    }

    static _applyProgress (data) {
        lastProgress = data;
        const groups = [data.scenes, data.characters, data.blocks];
        const met = groups.filter(function (g) {
            return g && g.met;
        }).length;
        const isComplete = !!data.completed;

        if (badgeEl) {
            // Verde + "Concluído" na primeira vez que completed=true - e,
            // graças ao trava-e-para-de-reavaliar logo abaixo (everCompleted),
            // essa é a ÚLTIMA vez que este bloco roda: nunca mais volta pro
            // selo normal depois, mesmo que o aluno apague um bloco/cena/
            // personagem que fazia parte do que fora exigido (decisão
            // explícita do usuário - "já foi concluído, fica concluído").
            badgeEl.classList.toggle('completed', isComplete);
            badgeEl.textContent = isComplete ? '✅ Concluído' : ('🎯 ' + met + '/' + groups.length);
        }
        if (hintButtonEl) {
            // Escondido enquanto completo - mesma regra de _evaluateHints
            // (dica de coach nunca aparece depois de concluído, então o
            // botão que dá acesso a ela também não faz sentido aqui).
            hintButtonEl.classList.toggle('hidden', isComplete);
        }
        if (popoverEl) {
            AssignmentBadge._renderPopover(data);
        }

        if (!everCompleted && isComplete) {
            // Primeira vez que fica completa nesta sessão (ou o servidor
            // ainda não sabia - ver init()) - trava pra sempre AGORA, antes
            // do modal/timers abaixo, e já reflete o destravamento na UI
            // (limite de cena/personagem) neste mesmo tick, sem esperar o
            // próximo recálculo (que não vai mais acontecer).
            everCompleted = true;
            AssignmentBadge._syncSceneLimitUi();
            AssignmentBadge._lockCompletion();
        }
        if (wasComplete === false && isComplete) {
            // Parabéns tem prioridade sobre uma dica de coach eventualmente
            // aberta neste exato tick (ver _showCoachModal - só um modal por
            // vez) - fecha ela pra abrir a celebração no lugar. wasComplete
            // vira true logo abaixo de qualquer forma, então essa dica não
            // seria reavaliada de novo mesmo se a deixássemos aberta (missão
            // completa nunca mostra dica - ver _evaluateHints). Fecha
            // também o painel navegável (_openHintsPanel), se estiver
            // aberto - senão os dois overlays (mesma classe DOM/CSS)
            // ficariam empilhados um por cima do outro.
            AssignmentBadge._closeCoachModal();
            AssignmentBadge._closeHintsPanel();
            AssignmentBadge._showCoachModal({
                icon: '🎉',
                title: 'Parabéns!',
                text: 'Você concluiu a missão: ' + ((data.projectName || (assignment && assignment.projectName)) || 'Missão'),
            });
        }
        wasComplete = isComplete;
        AssignmentBadge._syncPaletteDefaults();
    }

    /**
     * Desliga a cadência inteira (PollScheduler.stop() - poll normal, refresh
     * de requisitos do professor, recálculo instantâneo, tudo) e avisa o
     * servidor que a missão foi concluída (ver POST /assignments/:id/complete) -
     * fire-and-forget, nunca bloqueia nem desfaz o estado sticky local se
     * falhar (a conquista já vale nesta sessão de qualquer forma; só não
     * persiste entre sessões até a próxima vez que completar de novo, o que
     * aqui é impossível já que sticky nunca volta a false - então, na
     * prática, uma falha de rede aqui só significa "essa aba específica não
     * vai anunciar ao servidor", mas outra aba/sessão futura tentaria de
     * novo se algum dia everCompleted começasse false outra vez, o que não
     * acontece. Aceitável: best-effort mesmo).
     */
    static _lockCompletion () {
        PollScheduler.stop();
        if (!assignment || !assignment.id) {
            return;
        }
        apiFetch('/assignments/' + assignment.id + '/complete', {method: 'POST'})
            .then(function (res) {
                return res.ok ? res.json() : null;
            })
            .then(function (body) {
                if (body && body.completedAt) {
                    assignment.completedAt = body.completedAt;
                }
            })
            .catch(function (err) {
                console.warn('[AssignmentBadge] POST .../complete falhou (não-fatal):', err && err.message);
            });
    }

    /**
     * Avalia assignment.hints (nesta ordem - ver docblock do topo do
     * arquivo) e acha a primeira ainda não dispensada cujo `when` está
     * batendo agora no projeto do aluno. Duas coisas acontecem com esse
     * resultado, independentemente uma da outra:
     *  1. O ponto/indicador do botão flutuante é atualizado (ver
     *     _updateHintButton) - reflete "há dica pronta" mesmo que ela não
     *     seja mostrada AGORA por causa da espera de ociosidade abaixo. É
     *     assim que o botão dá acesso imediato a algo que o poll automático
     *     ainda vai esperar o aluno ficar parado (IDLE_BEFORE_HINT_MS) pra
     *     mostrar sozinho.
     *  2. Se o aluno está ocioso há IDLE_BEFORE_HINT_MS (ver PollScheduler.
     *     idleFor()), E nenhum modal está aberto agora (congrats ou outra
     *     dica), a dica é mostrada de fato via _showCoachModal.
     * Não faz nada (dica nenhuma, ponto nenhum) se a missão já está
     * completa - o modal de parabéns cobre esse caso e dica de coach nunca
     * aparece depois de concluído. Reaproveita o mesmo detailedManifest.js
     * pro projectJson já lido por _recomputeLocal, sem ida extra ao
     * servidor.
     */
    static _evaluateHints (isComplete, projectJson) {
        if (isComplete) {
            AssignmentBadge._updateHintButton(false);
            return;
        }
        const hints = (assignment && Array.isArray(assignment.hints)) ? assignment.hints : [];
        if (!hints.length) {
            return;
        }
        const detailed = computeDetailedManifest(projectJson);
        // Só a dica MAIS ANTIGA (na ordem que o professor cadastrou) cujo
        // requisito ainda não foi cumprido pode aparecer sozinha - mesmo que
        // a condição de uma dica POSTERIOR já esteja batendo agora. Achado
        // em teste real: fechar a dica 1 (sem o aluno ter feito a tarefa
        // dela) deixava ela em dismissedHintIds, e o .find() de antes pulava
        // direto pra dica 2 assim que a espera de ociosidade batesse - as
        // dicas apareciam em sequência sem o aluno nunca ter cumprido a
        // primeira. Agora, se a primeira pendente já foi dispensada, nenhuma
        // dica aparece sozinha até ela ser resolvida de verdade (o botão
        // flutuante de dica continua dando acesso a todas via _openHintsPanel,
        // que ignora esta trava de propósito - ver docblock do ponto 7).
        const firstPending = hints.find(function (hint) {
            return hint && hintConditionHolds(hint, detailed);
        });
        const readyHint = (firstPending && !dismissedHintIds.has(firstPending.id)) ? firstPending : null;
        // Ponto do botão flutuante: reflete "há dica pronta" mesmo quando ela
        // ainda não pode ser MOSTRADA agora (ociosidade/modal já aberto, ver
        // guardas abaixo) - ver docblock do ponto 1 no topo do arquivo. Bug
        // real encontrado nesta refatoração: esta chamada nunca existia com
        // `true`, só com `false` (no ramo isComplete acima) - o pontinho
        // nunca ligava, mesmo quando havia dica pronta esperando o aluno
        // ficar ocioso.
        AssignmentBadge._updateHintButton(!!readyHint);
        // Alerta de VALOR ERRADO - canal separado da dica proativa (readyHint):
        // a dica proativa aparece uma vez e, fechada, nunca volta
        // (dismissedHintIds); mas o aluno pode montar o bloco DEPOIS de
        // fechá-la, com o valor errado - e ninguém avisava (achado em teste
        // real, aluno Josué/missão "Cofrinho": grow 5 em vez de 2, silêncio).
        // Independe de dismissedHintIds; cada combinação de valores errados
        // avisa uma única vez (wrongValueAlerted) - mudar pra OUTRO valor
        // errado avisa de novo, ficar parado no mesmo não repete.
        let wrongValueHint = null;
        let wrongValueInfo = null;
        hints.some(function (hint) {
            const info = computeMistakeInfo(hint, detailed);
            if (info && !wrongValueAlerted.has(info.sig)) {
                wrongValueHint = hint;
                wrongValueInfo = info;
                return true;
            }
            return false;
        });

        // Alerta de FORA DE ORDEM (só se não há erro de valor/gatilho a
        // apontar): o aluno montou o bloco de uma dica POSTERIOR enquanto uma
        // anterior do mesmo personagem ainda está pendente (achado em teste
        // real: clique + say montados antes da bandeira + say que a dica
        // pedia primeiro - nada avisava, a dica da bandeira já tinha sido
        // fechada). Ver orderInfo em HintEngine.js.
        if (!wrongValueHint) {
            const orderInfo = computeOrderInfo(hints, detailed);
            if (orderInfo && !wrongValueAlerted.has(orderInfo.sig)) {
                wrongValueHint = orderInfo.doneHint;
                wrongValueInfo = orderInfo;
            }
        }

        if ((!readyHint && !wrongValueHint) || coachModalEl || hintsPanelEl) {
            // hintsPanelEl aberto: o aluno já está olhando as dicas por conta
            // própria (ver _openHintsPanel) - não faz sentido interromper com
            // o modal automático por cima nesse momento.
            return;
        }
        const idleFor = PollScheduler.idleFor();
        if (wrongValueHint) {
            if (idleFor < (wrongValueInfo.idleMs || ALERT_IDLE_MS)) {
                return; // acabou de soltar/arrastar algo - espera só um instante, não os 3s da dica proativa
            }
            const alertHint = wrongValueHint;
            const alertInfo = wrongValueInfo;
            // Em "fora de ordem" o texto dito (e o evento gravado) é o da dica
            // PENDENTE que o aluno pulou, não o da que ele já montou.
            const spokenHint = alertInfo.kind === 'order' ? alertInfo.pendingHint : alertHint;
            const kindText = {
                trigger: 'Quase! O bloco está no lugar errado - confira qual bloco de início vem antes dele. ',
                order: 'Opa, esse bloco vem depois! Primeiro faça: ',
                confirm: 'Quase! Toque no número do bloco para confirmar o valor. ',
                fill: 'Falta escolher o valor do bloco - toque nele para definir. ',
                value: 'Quase! O valor do bloco ainda não está certo. ',
            };
            recordHintEvent(spokenHint.id, 'shown');
            recordHintEvent(spokenHint.id, 'wrong_' + alertInfo.kind);
            AssignmentBadge._showCoachModal({
                icon: '🤔',
                text: (kindText[alertInfo.kind] || kindText.value) + spokenHint.text,
                extraClass: 'assignmentCoachCard',
                onClose: function () {
                    wrongValueAlerted.add(alertInfo.sig);
                    // Esta dica já foi dita (agora) - não repete a versão
                    // proativa com o mesmo texto logo em seguida.
                    dismissedHintIds.add(spokenHint.id);
                    recordHintEvent(spokenHint.id, 'dismissed');
                    // O modal cobria o palco - agora que fechou, mostra QUAL
                    // bloco está errado.
                    AssignmentBadge._highlightMistake(alertHint, alertInfo);
                },
            });
            return;
        }
        if (idleFor < IDLE_BEFORE_HINT_MS) {
            return; // pronta, mas o aluno ainda está mexendo em algo - espera ele parar
        }
        recordHintEvent(readyHint.id, 'shown');
        AssignmentBadge._showCoachModal({
            icon: '💡',
            text: readyHint.text,
            extraClass: 'assignmentCoachCard',
            onClose: function () {
                dismissedHintIds.add(readyHint.id);
                recordHintEvent(readyHint.id, 'dismissed');
                // Não precisa marcar atividade aqui - o próprio clique no
                // botão de fechar já passa pelo listener global de
                // PollScheduler (fase de captura, ver docblock daquele
                // arquivo), reiniciando a espera de ociosidade sozinho.
            },
        });
    }

    /**
     * Gatilho (onflag/onclick/...) do script onde `block` está - sobe pela
     * cadeia prev até o primeiro bloco; se ele for o miolo de um `repeat`
     * (ninguém aponta pra ele por prev), sobe pro repeat que o contém.
     * null se o script não começa com um bloco de início.
     */
    static _triggerOfBlock (block, allBlocks) {
        let first = block.findFirst();
        for (let guard = 0; guard < 20; guard++) {
            if (/^on(flag|click|touch|message)$/.test(first.blocktype)) {
                return first.blocktype;
            }
            const first0 = first;
            const owner = allBlocks.find(function (b) {
                return b.inside === first0;
            });
            if (!owner) {
                return null;
            }
            first = owner.findFirst();
        }
        return null;
    }

    /**
     * Faz PISCAR no editor o(s) bloco(s) que o alerta "Quase!" aponta como
     * errado: os do tipo da dica com valor diferente do exigido (kind
     * 'value') ou sob outro gatilho (kind 'trigger'). Só quando o personagem
     * da dica é o que está selecionado agora (a área de scripts mostrada é a
     * dele) - senão não há o que piscar ali, e o texto do alerta já disse o
     * que fazer. Best-effort: qualquer surpresa no DOM legado vira no-op,
     * nunca um erro pro aluno. Sai sozinho depois de MISTAKE_BLINK_MS.
     */
    static _highlightMistake (hint, info) {
        AssignmentBadge._clearMistakeBlink();
        try {
            const when = hint.when;
            const spr = ScratchJr.getSprite();
            const scriptsEl = ScratchJr.getActiveScript();
            if (!spr || spr.md5 !== when.characterMd5 || !scriptsEl || !scriptsEl.owner) {
                return;
            }
            const blocks = scriptsEl.owner.getBlocks();
            const wantedTypes = Array.isArray(when.blockTypes) ? when.blockTypes : [];
            const wantedArgs = when.blockArgs || {};
            blockBlinkEls = blocks.filter(function (b) {
                if (!wantedTypes.includes(b.blocktype)) {
                    return false;
                }
                const trigger = AssignmentBadge._triggerOfBlock(b, blocks);
                if (info.kind === 'confirm' || info.kind === 'fill') {
                    if (when.trigger && trigger !== when.trigger) {
                        return false;
                    }
                    return !!(b.arg && b.arg.unconfirmed);
                }
                if (info.kind === 'order') {
                    // Os blocos que ele já montou da dica posterior (no gatilho dela).
                    return !when.trigger || trigger === when.trigger;
                }
                if (info.kind === 'trigger') {
                    return trigger !== when.trigger;
                }
                if (when.trigger && trigger !== when.trigger) {
                    return false;
                }
                const want = wantedArgs[b.blocktype];
                return want !== undefined && Number(b.getArgValue()) !== want;
            }).map(function (b) {
                return b.div;
            });
            blockBlinkEls.forEach(function (el) {
                el.classList.add('assignmentBlockBlink');
            });
            if (blockBlinkEls.length) {
                blockBlinkTimer = window.setTimeout(AssignmentBadge._clearMistakeBlink, MISTAKE_BLINK_MS);
            }
        } catch (err) {
            console.warn('[AssignmentBadge] _highlightMistake falhou (não-fatal):', err && err.message);
        }
    }

    static _clearMistakeBlink () {
        if (blockBlinkTimer) {
            window.clearTimeout(blockBlinkTimer);
            blockBlinkTimer = null;
        }
        blockBlinkEls.forEach(function (el) {
            el.classList.remove('assignmentBlockBlink');
        });
        blockBlinkEls = [];
    }

    // _blockMatch, _orderInfo, _mistakeInfo, _findSceneAndCharacter,
    // _actorLabelFor e _hintConditionHolds foram extraídas pra HintEngine.js
    // (refatoração Fase 0) - eram as únicas funções 100% puras deste arquivo
    // (sem DOM/ScratchJr), usadas tanto por _evaluateHints (poll automático)
    // quanto por _openHintsPanel/_renderHintsPanel (painel manual). Ver
    // HintEngine.js e HintEngine.test.js. Import no topo deste arquivo.

    /**
     * Botão flutuante de dica - via manual pro aluno/professor testando não
     * ficar refém do poll automático (ver constantes HINTS_PENDING_REFRESH_MS/
     * IDLE_BEFORE_HINT_MS no topo do arquivo). Fica ao lado do selo de
     * progresso, mesma linguagem visual (ver assignment.css). Criado uma
     * única vez em _showBadge(), só se a missão tiver pelo menos uma dica.
     */
    static _createHintButton () {
        hintButtonEl = newHTML('div', 'assignmentHintButton', document.body);
        hintButtonEl.setAttribute('role', 'button');
        hintButtonEl.tabIndex = 0;
        hintButtonEl.title = 'Ver todas as dicas';
        hintButtonEl.textContent = '💡';
        const dot = newHTML('span', 'assignmentHintButtonDot hidden', hintButtonEl);
        dot.setAttribute('aria-hidden', 'true');
        hintButtonEl.onclick = AssignmentBadge._openHintsPanel;
    }

    /**
     * Liga/desliga o pontinho de "dica pronta" no botão - chamado a cada
     * avaliação (_evaluateHints), então reflete o estado real mesmo quando
     * a dica em si ainda não foi mostrada por causa do cooldown.
     */
    static _updateHintButton (hasReadyHint) {
        if (!hintButtonEl) {
            return;
        }
        const dot = hintButtonEl.querySelector('.assignmentHintButtonDot');
        if (dot) {
            dot.classList.toggle('hidden', !hasReadyHint);
        }
    }

    /**
     * Clique no botão flutuante: abre um painel navegável (Anterior/
     * Próxima) com TODAS as dicas da missão, na ordem de assignment.hints -
     * não depende de nenhuma condição estar "pronta" nem de cooldown (ver
     * _showCoachModal/_evaluateHints pro modal automático, que continua
     * existindo em paralelo - achado em teste real: a espera do automático
     * "hora funciona hora não" por natureza, já que é baseado em timing;
     * o painel é a via 100% determinística, sempre disponível). Recomputa
     * o projeto antes de montar o painel pra cada dica mostrar seu status
     * (✅ já resolvida / 💡 ainda vale) com base no estado ATUAL, não no
     * momento em que a dica foi gerada. Não abre por cima do modal
     * automático já aberto - fecha primeiro (clicar fora/Continuar) antes
     * de abrir o painel.
     */
    static _openHintsPanel () {
        if (!assignment || coachModalEl || hintsPanelEl) {
            return;
        }
        const hints = Array.isArray(assignment.hints) ? assignment.hints : [];
        if (!hints.length) {
            return; // nunca deveria acontecer - o botão só existe com hints.length > 0
        }
        AssignmentBadge._recomputeLocal(); // status de cada dica no painel reflete o projeto agora
        const projectJson = AssignmentBadge._readProjectJson();
        const detailed = projectJson ? computeDetailedManifest(projectJson) : {scenes: []};

        // Sempre começa na primeira dica, em ordem, cuja condição ainda
        // esteja batendo no projeto do aluno agora (primeira tarefa ainda
        // não concluída) - decisão explícita do usuário: clicar na dica deve
        // levar direto pro que falta fazer. Não depende de dismissedHintIds
        // (que controla só o modal automático - uma dica dispensada pode
        // voltar a valer se o aluno desfizer progresso).
        //
        // "mission_intro" NUNCA conta como tarefa pra esse cálculo - achado em
        // teste real (2ª rodada): ela é a apresentação da missão inteira, sem
        // cena/personagem nenhum pra checar, então hintConditionHolds (HintEngine.js) sempre
        // devolve true pra ela (ver aquele switch case) - sem essa exclusão,
        // o painel sempre abria de volta na intro (ela é sempre hints[0]),
        // nunca avançava pra tarefa de verdade mesmo com progresso real já
        // feito. Filtrada só AQUI (navegação); ela continua contando
        // normalmente pro modal automático (_evaluateHints) e pro botão
        // Anterior/Próxima dentro do painel já aberto.
        let startIndex = hints.findIndex(function (h) {
            return h && h.when && h.when.type !== 'mission_intro' && hintConditionHolds(h, detailed);
        });
        if (startIndex < 0) {
            startIndex = 0;
        }

        AssignmentBadge._renderHintsPanel(hints, detailed, startIndex);
    }

    /**
     * Monta o painel uma única vez e reaproveita os mesmos elementos nos
     * cliques de Anterior/Próxima (só troca texto/contador/status) - sem
     * recriar DOM a cada navegação. Fecha só pelo botão "Fechar" (nunca
     * clicando fora), e esse botão só funciona depois de CLOSE_DELAY_MS -
     * ver docblock daquela constante no topo do arquivo.
     */
    static _renderHintsPanel (hints, detailed, startIndex) {
        let index = startIndex;

        hintsPanelEl = newHTML('div', 'assignmentCompleteOverlay', document.body);
        // Sem onclick no fundo - só o botão "Fechar" dentro do cartão fecha
        // (ver CLOSE_DELAY_MS no topo do arquivo).
        const card = newHTML('div', 'assignmentCompleteCard assignmentCoachCard assignmentHintsPanelCard', hintsPanelEl);
        const emoji = newHTML('div', 'assignmentCompleteEmoji', card);
        emoji.textContent = '💡';
        const status = newHTML('div', 'assignmentHintsPanelStatus', card);
        const actorEl = newHTML('div', 'assignmentHintsPanelActor', card);
        const textEl = newHTML('div', 'assignmentCompleteText', card);
        const counter = newHTML('div', 'assignmentHintsPanelCounter', card);

        const nav = newHTML('div', 'assignmentHintsPanelNav', card);
        const prevBtn = newHTML('button', 'assignmentHintsPanelNavBtn', nav);
        prevBtn.type = 'button';
        prevBtn.textContent = '◀ Anterior';
        const nextBtn = newHTML('button', 'assignmentHintsPanelNavBtn', nav);
        nextBtn.type = 'button';
        nextBtn.textContent = 'Próxima ▶';

        const closeBtn = newHTML('button', 'assignmentCompleteClose', card);
        closeBtn.type = 'button';
        closeBtn.textContent = 'Fechar';

        function render () {
            const hint = hints[index];
            textEl.textContent = (hint && hint.text) || '';
            const actorLabel = hint ? actorLabelFor(hint, detailed) : null;
            actorEl.textContent = actorLabel || '';
            actorEl.classList.toggle('hidden', !actorLabel);
            counter.textContent = (index + 1) + ' de ' + hints.length;
            const stillNeeded = hint && hintConditionHolds(hint, detailed);
            status.textContent = stillNeeded ? '💡 ainda vale' : '✅ já resolvida';
            status.classList.toggle('done', !stillNeeded);
            prevBtn.disabled = index <= 0;
            nextBtn.disabled = index >= hints.length - 1;
        }

        prevBtn.onclick = function () {
            if (index > 0) {
                index -= 1;
                render();
            }
        };
        nextBtn.onclick = function () {
            if (index < hints.length - 1) {
                index += 1;
                render();
            }
        };
        closeBtn.onclick = AssignmentBadge._closeHintsPanel;
        // Navegar (Anterior/Próxima) fica liberado na hora - só o "Fechar"
        // tem o delay, já que é a única ação que descarta o painel de vez.
        closeBtn.disabled = true;
        window.setTimeout(function () {
            closeBtn.disabled = false;
        }, CLOSE_DELAY_MS);

        render();
    }

    static _closeHintsPanel () {
        if (hintsPanelEl && hintsPanelEl.parentNode) {
            hintsPanelEl.parentNode.removeChild(hintsPanelEl);
        }
        hintsPanelEl = null;
    }

    /**
     * Modal central reutilizável - mostra tanto o "Parabéns" (transição ao
     * vivo pra completo, ver wasComplete acima) quanto uma dica de coach
     * (assignment.hints, ver _evaluateHints), com a mesma estrutura DOM e
     * as mesmas classes CSS de sempre (assignmentComplete* - nome
     * histórico do parabéns, mantido de propósito pra não precisar tocar
     * no CSS já existente). `extraClass`, quando passado, soma uma classe
     * a mais no cartão (usado pela dica pra ganhar um acento visual
     * diferente - ver a seção nova em assignment.css). `title` omitido/
     * null pula o elemento de título inteiro (a dica é só ícone + texto,
     * sem cabeçalho). Só o botão "Continuar" fecha (clicar fora do cartão
     * não faz mais nada - ver CLOSE_DELAY_MS no topo do arquivo), e mesmo
     * esse botão só funciona depois de CLOSE_DELAY_MS (fica desabilitado
     * até lá) - clicar dispara `onClose`, se houver: _evaluateHints usa
     * isso pra marcar a dica como dispensada nesta sessão (ver
     * dismissedHintIds).
     */
    static _showCoachModal ({icon, title, text, extraClass, onClose}) {
        if (coachModalEl) {
            return; // já tem um modal (parabéns ou dica) aberto - não duplica/sobrepõe
        }
        const close = function () {
            AssignmentBadge._closeCoachModal();
            if (onClose) {
                onClose();
            }
        };
        coachModalEl = newHTML('div', 'assignmentCompleteOverlay', document.body);
        // Sem onclick no fundo - só o botão dentro do cartão fecha (ver
        // CLOSE_DELAY_MS acima).
        const cardClass = 'assignmentCompleteCard' + (extraClass ? (' ' + extraClass) : '');
        const card = newHTML('div', cardClass, coachModalEl);
        const emoji = newHTML('div', 'assignmentCompleteEmoji', card);
        emoji.textContent = icon || '💡';
        if (title) {
            const titleEl = newHTML('div', 'assignmentCompleteTitle', card);
            titleEl.textContent = title;
        }
        const textEl = newHTML('div', 'assignmentCompleteText', card);
        textEl.textContent = text || '';
        const closeBtn = newHTML('button', 'assignmentCompleteClose', card);
        closeBtn.type = 'button';
        closeBtn.textContent = 'Continuar';
        closeBtn.onclick = close;
        closeBtn.disabled = true;
        window.setTimeout(function () {
            closeBtn.disabled = false;
        }, CLOSE_DELAY_MS);
    }

    static _closeCoachModal () {
        if (coachModalEl && coachModalEl.parentNode) {
            coachModalEl.parentNode.removeChild(coachModalEl);
        }
        coachModalEl = null;
    }

    static _toggleExpanded () {
        if (popoverEl) {
            AssignmentBadge._closePopover();
        } else {
            AssignmentBadge._openPopover();
        }
    }

    static _openPopover () {
        popoverEl = newHTML('div', 'assignmentPopover', document.body);
        if (lastProgress) {
            AssignmentBadge._renderPopover(lastProgress);
        } else {
            popoverEl.textContent = 'Carregando...';
        }
        // Registra o listener de "clicar fora fecha" só no próximo tick -
        // senão o próprio clique que ABRIU o popover (que já borbulhou até
        // aqui) seria capturado de novo e fecharia na hora.
        window.setTimeout(function () {
            document.addEventListener('mousedown', AssignmentBadge._onOutsideClick);
        }, 0);
    }

    static _closePopover () {
        document.removeEventListener('mousedown', AssignmentBadge._onOutsideClick);
        if (popoverEl && popoverEl.parentNode) {
            popoverEl.parentNode.removeChild(popoverEl);
        }
        popoverEl = null;
    }

    static _onOutsideClick (e) {
        if (!popoverEl) {
            return;
        }
        if (popoverEl.contains(e.target) || e.target === badgeEl) {
            return;
        }
        AssignmentBadge._closePopover();
    }

    static _renderPopover (data) {
        popoverEl.innerHTML = '';
        const title = newHTML('div', 'assignmentPopoverTitle', popoverEl);
        title.textContent = data.projectName || 'Missão';
        AssignmentBadge._renderRow(popoverEl, '🎬 Cenas', data.scenes);
        AssignmentBadge._renderRow(popoverEl, '🧑 Personagens', data.characters);
        AssignmentBadge._renderRow(popoverEl, '🧩 Blocos', data.blocks);
    }

    static _renderRow (parent, label, group) {
        if (!group) {
            return;
        }
        const row = newHTML('div', 'assignmentPopoverRow' + (group.met ? ' met' : ''), parent);
        const name = newHTML('span', 'assignmentPopoverLabel', row);
        name.textContent = label;
        const val = newHTML('span', 'assignmentPopoverValue', row);
        val.textContent = group.actual + '/' + group.required + (group.met ? ' ✓' : '');
    }
}

// Registra-se como fonte de verdade de GalleryRestriction.js - ver docblock
// daquele arquivo pra entender por quê isso não é um import direto no
// sentido contrário (Library.js -> este arquivo).
registerZeroBlockDefaultsProvider(function () {
    return AssignmentBadge.zeroDefaultsActive;
});
registerGalleryRestrictionProvider(function () {
    return AssignmentBadge.galleryRestriction;
});
