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
 *     Cadência (achado em teste real - dica demorando/aparecendo em bloco):
 *     o poll roda mais rápido (HINTS_PENDING_REFRESH_MS, 800ms) enquanto
 *     houver dica pendente, volta pro ritmo normal (ACTUAL_REFRESH_MS, 2s)
 *     quando não; um recheck imediato dispara em visibilitychange (o poll
 *     PARA por completo com a aba oculta - sem isso, todo progresso feito
 *     nesse meio-tempo só aparecia no próximo tick); e uma dica só aparece
 *     sozinha depois que o aluno fica PARADO (sem clicar/arrastar/digitar,
 *     ver lastActivityAt/IDLE_BEFORE_HINT_MS) por um tempo - achado em teste
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
import {computeProjectManifest, compareManifests} from './assignmentScoring.js';
import {computeDetailedManifest} from './detailedManifest.js';
import MediaLib from '../../iPad/MediaLib.js';
import {registerGalleryRestrictionProvider, allCharactersAtLimit} from './GalleryRestriction.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));
const ACTUAL_REFRESH_MS = 2000; // recálculo local, em memória - barato, pode ser frequente
const HINTS_PENDING_REFRESH_MS = 800; // cadência mais rápida enquanto há dica ainda não dispensada -
// ver _scheduleRecompute(). Ainda é só um scan de JSON pequeno em memória, custo desprezível.
const IDLE_BEFORE_HINT_MS = 3000; // aluno precisa ficar esse tempo sem clicar/arrastar/digitar em
// lugar NENHUM da página antes da próxima dica poder aparecer sozinha - achado em teste real
// ("cadência desordenada"): um tempo fixo desde o fechamento da dica anterior (mecanismo
// antigo) não tinha relação com o que o aluno estava fazendo, podendo interromper ele no meio
// de uma ação. Ver lastActivityAt/_trackActivity abaixo. Só vale pro caminho automático (poll) -
// o painel de dicas (_openHintsPanel) ignora, de propósito: é exatamente pra isso que ele
// existe (ver docblock do ponto 7 no topo do arquivo).
const ALERT_IDLE_MS = 1000; // o alerta "Quase!" (valor/gatilho errado) vem logo depois da AÇÃO do aluno
// (soltar o bloco) - é quando a dica mais vale, então não espera os 3s de IDLE_BEFORE_HINT_MS
// (esses são só pra dica proativa, que INTERROMPE o aluno). Ver _evaluateHints.
const MISTAKE_BLINK_MS = 8000; // por quanto tempo o bloco errado pisca depois do aluno fechar o alerta
const REQUIREMENTS_REFRESH_MS = 30000; // ida ao servidor - só pra pegar reautoria do professor
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
let actualTimer = null;
let requirementsTimer = null;
let dismissedThisSession = false;
let dismissedHintIds = new Set(); // ids de dica já mostrada+fechada nesta sessão de aba - nunca mais reexibida automaticamente
let blockBlinkEls = []; // <div>s de bloco piscando agora (ver _highlightMistake)
let blockBlinkTimer = null;
let wrongValueAlerted = new Set(); // assinaturas (ver _mistakeInfo) de "valor/gatilho errado" já avisadas nesta sessão de aba
// Date.now() da última interação REAL do aluno em qualquer lugar da página
// (clique/toque/arrasto/tecla - ver _trackActivity/CADÊNCIA acima). 0 (nunca
// tocou em nada ainda) conta como "já ocioso há muito tempo" de propósito -
// é o que deixa a primeira dica (mission_intro) aparecer imediatamente ao
// abrir a missão, sem esperar 3s de inatividade que ainda nem começaram.
let lastActivityAt = 0;
// null = ainda não sabemos (primeiro cálculo desta sessão de aba) - fica
// assim de propósito pra não disparar o modal de parabéns só por reabrir
// uma missão que já estava completa antes. Só vira true/false depois do
// primeiro _applyProgress(), e o modal só aparece numa transição
// false -> true observada DEPOIS disso.
let wasComplete = null;

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
     *  - missão já concluída (`wasComplete === true` - ver _applyProgress).
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
        if (wasComplete === true) return null;
        // Só restringe DENTRO do projeto da própria missão. Projeto autoral/
        // livre (ou missão ainda não iniciada) nunca é travado pelos assets
        // do professor - senão a missão ativa da turma vazava pra qualquer
        // projeto do aluno, e wasComplete (só atualizado no projeto da
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
        AssignmentBadge._trackActivity();
        badgeEl = newHTML('div', 'assignmentBadge', document.body);
        badgeEl.setAttribute('role', 'button');
        badgeEl.tabIndex = 0;
        badgeEl.textContent = '🎯 …';
        badgeEl.onclick = AssignmentBadge._toggleExpanded;

        // Botão flutuante de dica - só existe se a missão tiver dicas (ver
        // docblock ponto 7). Escondido de novo em _applyProgress quando a
        // missão completa (mesma hora que _evaluateHints para de rodar).
        if (assignment && Array.isArray(assignment.hints) && assignment.hints.length) {
            AssignmentBadge._createHintButton();
        }

        AssignmentBadge._recomputeLocal();
        // Agendamento em cadeia (setTimeout que se reagenda), não setInterval
        // fixo - deixa _scheduleRecompute() decidir o próximo atraso a cada
        // rodada (mais rápido enquanto há dica pendente, ver constantes no
        // topo do arquivo). Ver também o listener de visibilitychange abaixo.
        AssignmentBadge._scheduleRecompute();
        // Recheck IMEDIATO ao voltar o foco da aba - sem isso, qualquer
        // progresso feito enquanto a aba estava oculta (poll pausado de
        // propósito, ver _scheduleRecompute) só seria percebido no próximo
        // tick agendado (até HINTS_PENDING_REFRESH_MS/ACTUAL_REFRESH_MS de
        // atraso) - era a causa mais provável do "demora um monte" relatado
        // em teste. Registrado uma única vez (ver guarda no topo de _showBadge).
        document.addEventListener('visibilitychange', AssignmentBadge._onVisibilityChange);

        requirementsTimer = window.setInterval(function () {
            if (document.visibilityState === 'visible') {
                AssignmentBadge._refreshRequirements();
            }
        }, REQUIREMENTS_REFRESH_MS);
    }

    static _onVisibilityChange () {
        if (document.visibilityState === 'visible' && badgeEl) {
            AssignmentBadge._recomputeLocal();
        }
    }

    /**
     * Registra (uma única vez - chamado só de dentro do guard `if (badgeEl)
     * return` de _showBadge) um listener global de "o aluno tocou em algo"
     * pra alimentar lastActivityAt/IDLE_BEFORE_HINT_MS (ver _evaluateHints).
     * Fase de CAPTURA (terceiro argumento `true`) - dispara ANTES de
     * qualquer handler no elemento clicado poder chamar stopPropagation(),
     * então nunca perde um clique real só porque o alvo específico
     * (ex.: o botão de fechar da própria dica) parou a propagação.
     * mousemove/touchmove entram de propósito, não só mousedown/touchstart -
     * sem eles, um arrasto longo (segurar e mover um bloco por vários
     * segundos) só contaria como atividade no instante em que começou, e o
     * relógio de ociosidade já teria passado dos 3s ENQUANTO o aluno ainda
     * está arrastando - a dica apareceria bem no pior momento possível.
     * {passive:true} - nunca chama preventDefault, então não atrapalha
     * scroll/drag nativo do navegador.
     */
    static _trackActivity () {
        const mark = function () {
            lastActivityAt = Date.now();
        };
        const opts = {capture: true, passive: true};
        document.addEventListener('mousedown', mark, opts);
        document.addEventListener('mouseup', mark, opts);
        // mousemove SÓ com botão pressionado (arrasto): passar o mouse por
        // cima do palco sem clicar NÃO é atividade - senão, na prática, a
        // espera de ociosidade nunca fechava enquanto o aluno "olhava" com o
        // mouse mexendo (achado em teste real: dica demorando muito).
        document.addEventListener('mousemove', function (e) {
            if (e.buttons) {
                mark();
            }
        }, opts);
        document.addEventListener('touchstart', mark, opts);
        document.addEventListener('touchmove', mark, opts);
        document.addEventListener('touchend', mark, opts);
        document.addEventListener('keydown', mark, true);
    }

    /**
     * Reagenda o próximo _recomputeLocal(). Atraso curto
     * (HINTS_PENDING_REFRESH_MS) enquanto existir pelo menos uma dica ainda
     * não dispensada nesta sessão - é justamente quando a cadência importa
     * mais pro aluno. Volta pro atraso normal (ACTUAL_REFRESH_MS) assim que
     * todas as dicas já tiverem sido mostradas+fechadas (ou a missão não tem
     * dicas). setTimeout em cadeia (em vez de setInterval fixo) porque o
     * atraso muda de tick pra tick, dependendo desse estado.
     */
    static _scheduleRecompute () {
        const hasPendingHints = !!(assignment && Array.isArray(assignment.hints) &&
            assignment.hints.some(function (h) {
                return h && !dismissedHintIds.has(h.id);
            }));
        const delay = hasPendingHints ? HINTS_PENDING_REFRESH_MS : ACTUAL_REFRESH_MS;
        actualTimer = window.setTimeout(function () {
            if (document.visibilityState === 'visible') {
                AssignmentBadge._recomputeLocal();
            }
            AssignmentBadge._scheduleRecompute();
        }, delay);
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
            return Project.getProject(ScratchJr.stage.pages[0].id);
        } catch (err) {
            return null; // best-effort - nunca deixa um erro de leitura quebrar o selo
        }
    }

    static _recomputeLocal () {
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
            // Verde + "Concluído" enquanto completed=true; volta pro selo
            // normal (🎯 X/3, cor padrão) na hora que deixar de ser - ex.:
            // aluno apagou um bloco/cena/personagem depois de já ter
            // completado. classList.toggle já cobre as duas direções.
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
     *  2. Se o aluno está ocioso há IDLE_BEFORE_HINT_MS (ver lastActivityAt/
     *     _trackActivity), E nenhum modal está aberto agora (congrats ou
     *     outra dica), a dica é mostrada de fato via _showCoachModal.
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
        const readyHint = hints.find(function (hint) {
            return hint && !dismissedHintIds.has(hint.id) && AssignmentBadge._hintConditionHolds(hint, detailed);
        });
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
            const info = AssignmentBadge._mistakeInfo(hint, detailed);
            if (info && !wrongValueAlerted.has(info.sig)) {
                wrongValueHint = hint;
                wrongValueInfo = info;
                return true;
            }
            return false;
        });

        if ((!readyHint && !wrongValueHint) || coachModalEl || hintsPanelEl) {
            // hintsPanelEl aberto: o aluno já está olhando as dicas por conta
            // própria (ver _openHintsPanel) - não faz sentido interromper com
            // o modal automático por cima nesse momento.
            return;
        }
        const idleFor = Date.now() - lastActivityAt;
        if (wrongValueHint) {
            if (idleFor < ALERT_IDLE_MS) {
                return; // acabou de soltar/arrastar algo - espera só um instante, não os 3s da dica proativa
            }
            const alertHint = wrongValueHint;
            const alertInfo = wrongValueInfo;
            recordHintEvent(alertHint.id, 'shown');
            recordHintEvent(alertHint.id, alertInfo.kind === 'trigger' ? 'wrong_trigger' : 'wrong_value');
            AssignmentBadge._showCoachModal({
                icon: '🤔',
                text: (wrongValueInfo.kind === 'trigger' ?
                    'Quase! O bloco está no lugar errado - confira qual bloco de início vem antes dele. ' :
                    'Quase! O valor do bloco ainda não está certo. ') + alertHint.text,
                extraClass: 'assignmentCoachCard',
                onClose: function () {
                    wrongValueAlerted.add(alertInfo.sig);
                    // Esta dica já foi dita (agora) - não repete a versão
                    // proativa com o mesmo texto logo em seguida.
                    dismissedHintIds.add(alertHint.id);
                    recordHintEvent(alertHint.id, 'dismissed');
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
                // Não precisa marcar lastActivityAt aqui - o próprio clique no
                // botão de fechar já passa pelo listener global de
                // _trackActivity (fase de captura, ver docblock daquela
                // função), reiniciando a espera de ociosidade sozinho.
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

    /**
     * Confere os blocos de UM personagem contra o `when` de uma dica
     * character_missing_block_type. Usa os scripts do manifesto (ver
     * detailedManifest.js#buildScriptDetail), não só a lista achatada de
     * tipos, pra respeitar dois campos que o gerador grava (ver
     * hintsGeneration.js#fillBlockContext):
     *  - when.trigger: o bloco só conta dentro de scripts com ESSE gatilho
     *    (onflag/onclick/...) - "quando clicar no Cofrinho, cresça" não fica
     *    resolvida com o `grow` sob a bandeira verde;
     *  - when.minCounts: a dica descreve a N-ésima ocorrência de um tipo
     *    (2º `say`) - N blocos daquele tipo precisam existir (dentro do
     *    gatilho, se houver).
     * Dica sem esses campos (salva antes deles existirem) se comporta como
     * sempre: qualquer script, pelo menos 1 de cada tipo.
     * Retorna {typesOk, argsOk, values, wrongTrigger}: wrongTrigger = os
     * blocos existem (contando todos os scripts) mas não no gatilho pedido.
     */
    static _blockMatch (character, when) {
        const wantedTypes = Array.isArray(when.blockTypes) ? when.blockTypes : [];
        const wantedArgs = when.blockArgs && typeof when.blockArgs === 'object' ? when.blockArgs : {};
        const minCounts = when.minCounts && typeof when.minCounts === 'object' ? when.minCounts : {};
        const allScripts = Array.isArray(character.scripts) ? character.scripts : [];
        const evaluate = function (pool) {
            const counts = {};
            const values = {};
            pool.forEach(function (script) {
                // O bloco de início também conta como "tipo presente" (uma
                // dica pode listar onflag/onmessage em blockTypes).
                if (script.trigger) {
                    counts[script.trigger] = (counts[script.trigger] || 0) + 1;
                }
                script.blocks.forEach(function (b) {
                    counts[b.type] = (counts[b.type] || 0) + 1;
                    if (b.num !== null && b.num !== undefined) {
                        (values[b.type] = values[b.type] || []).push(b.num);
                    }
                });
            });
            return {
                values: values,
                typesOk: wantedTypes.every(function (bt) {
                    return (counts[bt] || 0) >= (minCounts[bt] || 1);
                }),
                argsOk: Object.keys(wantedArgs).every(function (bt) {
                    return (values[bt] || []).includes(wantedArgs[bt]);
                }),
            };
        };
        const scoped = when.trigger ? allScripts.filter(function (script) {
            return script.trigger === when.trigger;
        }) : allScripts;
        const result = evaluate(scoped);
        // wrongTrigger só quando o professor usa esse bloco APENAS naquele
        // gatilho (when.triggerExclusive) - senão um bloco fora dele pode ser
        // o de outra dica, não um erro (ver fillBlockContext).
        result.wrongTrigger = !!when.trigger && when.triggerExclusive === true &&
            !result.typesOk && evaluate(allScripts).typesOk;
        return result;
    }

    /**
     * Erro do aluno numa dica de bloco, distinto de "ainda não fez": o bloco
     * do tipo certo EXISTE mas com VALOR errado (kind 'value') ou no
     * GATILHO errado (kind 'trigger'). Retorna {kind, sig} - sig identifica
     * o estado atual do erro (dica + valores/gatilhos que o aluno tem
     * agora), então trocar de um erro pra OUTRO gera assinatura nova (novo
     * alerta) e ficar parado no mesmo não repete - ver wrongValueAlerted.
     * null se a dica não é desse tipo, o personagem/blocos ainda não existem
     * (vale a dica proativa) ou nada está errado.
     */
    static _mistakeInfo (hint, detailed) {
        const when = hint && hint.when;
        if (!when || when.type !== 'character_missing_block_type') {
            return null;
        }
        const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
        const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
        if (!found.character) {
            return null;
        }
        const match = AssignmentBadge._blockMatch(found.character, when);
        if (match.typesOk && !match.argsOk) {
            const wantedArgs = when.blockArgs || {};
            const wrong = Object.keys(wantedArgs).filter(function (bt) {
                return !(match.values[bt] || []).includes(wantedArgs[bt]);
            });
            return {
                kind: 'value',
                sig: hint.id + '|value|' + wrong.map(function (bt) {
                    return bt + '=' + (match.values[bt] || []).join(',');
                }).join(';'),
            };
        }
        if (match.wrongTrigger) {
            const wantedTypes = Array.isArray(when.blockTypes) ? when.blockTypes : [];
            const where = (found.character.scripts || []).filter(function (script) {
                return script.blocks.some(function (b) {
                    return wantedTypes.includes(b.type);
                });
            }).map(function (script) {
                return script.trigger || 'solto';
            });
            return {kind: 'trigger', sig: hint.id + '|trigger|' + where.join(',')};
        }
        return null;
    }

    /**
     * Encontra, dentro do detailedManifest, a cena com o sceneMd5 dado e
     * (se characterMd5 também for passado) o personagem com esse
     * characterMd5 dentro dela. Retorna null se a cena (ou o personagem
     * dentro dela) simplesmente não existir ainda no projeto do aluno -
     * chamado só sabe decidir o que fazer com esse "não existe" (ver cada
     * ramo de _hintConditionHolds).
     *
     * sceneOccurrence (1-based, default 1) escolhe QUAL cena entre as que
     * usam o mesmo fundo - um projeto pode reusar o mesmo sceneMd5 em mais
     * de uma página (ex.: a história volta pro "Bosque" mais adiante), e sem
     * distinguir a ocorrência, uma dica sobre a 2ª vez sempre acabava
     * batendo (errado) na 1ª cena que usa aquele fundo, já que essa lista é
     * filtrada e indexada na ORDEM em que as cenas aparecem no projeto do
     * aluno (não precisa bater com a posição/página exata do professor -
     * só com "qual em ordem, entre as que têm esse fundo"). Ausente/1 se
     * comporta como antes (sempre a primeira ocorrência) - hints salvos
     * antes deste campo existir (sem sceneOccurrence no `when`) continuam
     * funcionando sem mudança.
     */
    static _findSceneAndCharacter (scenes, sceneMd5, characterMd5, sceneOccurrence) {
        const matches = scenes.filter(function (s) {
            return s.sceneMd5 === sceneMd5;
        });
        const scene = matches[(sceneOccurrence || 1) - 1] || null;
        if (!scene) {
            return {scene: null, character: null};
        }
        const character = scene.characters.find(function (c) {
            return c.characterMd5 === characterMd5;
        }) || null;
        return {scene, character};
    }

    /**
     * Rótulo "🧑 Nome" mostrado acima do texto da dica no painel navegável -
     * pedido explícito do usuário depois de um teste real: o texto da dica
     * às vezes só usa pronome ("faça ELE dizer...", regra de tom do
     * SYSTEM_PROMPT do backend permite isso depois da primeira menção ao
     * personagem numa SEQUÊNCIA de dicas, mas ao navegar solto pelo painel -
     * Anterior/Próxima, ou abrindo direto numa dica no meio - essa primeira
     * menção pode nunca ter sido lida) e a criança ficava sem saber de quem
     * a dica estava falando. Deriva o nome do characterMd5+sceneMd5+
     * sceneOccurrence do próprio `when` da dica, contra o projeto ATUAL do
     * aluno (mesmo detailed manifest já calculado por _openHintsPanel) -
     * nunca do projeto de referência do professor, que o aluno nunca vê.
     * Retorna null (painel esconde a linha) pra dicas sem personagem
     * (scene_missing/message_not_received/mission_intro/manual) ou quando o
     * personagem ainda nem existe no projeto do aluno (nada pra nomear
     * ainda) ou não tem nome salvo.
     */
    static _actorLabelFor (hint, detailed) {
        const when = hint && hint.when;
        if (!when || !when.characterMd5 || !when.sceneMd5) {
            return null;
        }
        const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
        const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
        if (!found.character || !found.character.characterName) {
            return null;
        }
        return '🧑 ' + found.character.characterName;
    }

    /**
     * Regras de cada when.type - ver o docblock do Part 2 desta feature
     * (mesma nomenclatura/contrato que AssignmentAuthorBar.js usa pra
     * rotular as dicas na tela do professor). Nunca lança - when.type
     * desconhecido/malformado simplesmente não bate (retorna false).
     */
    static _hintConditionHolds (hint, detailed) {
        const when = hint && hint.when;
        if (!when || !when.type) {
            return false;
        }
        const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];

        switch (when.type) {
        case 'scene_missing': {
            // "Faltando" agora é relativo à OCORRÊNCIA pedida, não só "existe
            // uma cena qualquer com esse fundo" - senão, assim que a 1ª cena
            // de um fundo reusado existisse, uma dica sobre trazer aquele
            // fundo DE VOLTA numa cena posterior (sceneOccurrence >= 2) já
            // apareceria como resolvida sem o aluno ter feito nada (bug real
            // encontrado: duas dicas com o mesmo sceneMd5 e sem essa
            // distinção nunca conseguiam representar "adicione mais uma
            // cena" como uma tarefa própria).
            const occurrencesSoFar = scenes.filter(function (s) {
                return s.sceneMd5 === when.sceneMd5;
            }).length;
            return occurrencesSoFar < (when.sceneOccurrence || 1);
        }

        case 'character_missing': {
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
            // Cena em si nem existindo ainda não conta como "personagem
            // faltando" - esse caso é coberto por um hint scene_missing
            // separado (ver comentário no topo do arquivo/spec).
            return !!found.scene && !found.character;
        }

        case 'character_no_script': {
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
            return !!found.character && !found.character.hasScript;
        }

        case 'character_missing_block_type': {
            // Achado em teste real (1) - "!hasScript => false" (por baixo,
            // "resolvida") tratava "o personagem ainda nem tem NENHUM
            // script" como se já tivesse feito o que a dica pede, mostrando
            // "✅ já resolvida" pra um personagem com o script totalmente
            // vazio. A ideia original parece ter sido "deixa o
            // character_no_script cobrir esse caso primeiro" - mas como o
            // personagem no projeto do professor TEM script (é por isso que
            // esta dica de blockTypes existe pra ele), o pipeline nunca gera
            // uma character_no_script companheira pra esse mesmo personagem,
            // e a condição nunca tinha chance de bater "ainda precisa" nesse
            // meio-tempo. Sem o atalho: blockTypes de um personagem sem
            // nenhum script ainda é sempre [] (ver detailedManifest.js), então
            // já dá "ainda precisa" corretamente, sem precisar de um caso
            // especial.
            //
            // Achado em teste real (2) - `wanted.some(...)` (OU) considerava
            // a dica resolvida assim que QUALQUER UM dos blockTypes pedidos
            // aparecesse, mesmo quando a dica descreve uma COMBINAÇÃO (ex.:
            // blockTypes ["wait","say"] pra "espere um pouco e depois diga
            // X") - bastava o aluno colocar só o "wait" (ou só o "say") pra a
            // dica já sumir e a próxima aparecer, sem o comportamento
            // completo ter sido montado. Trocado pra `wanted.every(...)` (E):
            // só conta como feito quando TODOS os tipos pedidos já estão no
            // personagem. isHintValid() no backend garante que todo tipo
            // listado é um tipo que o personagem do professor de fato usa
            // ali - então exigir todos nunca deixa a dica impossível.
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
            if (!found.character) {
                return false; // personagem nem existe ainda - character_missing cobre esse caso
            }
            // Tipos (com contagem/gatilho - ver _blockMatch) e valores
            // exigidos: ainda precisa enquanto algum não bater. Valor:
            // achado em teste real (3), decisão explícita do usuário - "say"
            // é o ÚNICO bloco cujo argumento pode divergir do professor
            // (por isso nunca aparece em blockArgs), todos os outros exigem
            // o valor exato.
            const match = AssignmentBadge._blockMatch(found.character, when);
            return !match.typesOk || !match.argsOk;
        }

        case 'message_not_received': {
            let sent = false;
            let received = false;
            scenes.forEach(function (s) {
                s.characters.forEach(function (c) {
                    if (c.messagesSent.includes(when.messageName)) sent = true;
                    if (c.messagesReceived.includes(when.messageName)) received = true;
                });
            });
            return sent && !received;
        }

        case 'default_character_present': {
            // Toda página em branco no ScratchJr cria automaticamente um
            // personagem com o asset default (ver Page.js#createCat/
            // UI.js#mascotData) - inclusive toda vez que o aluno clica em
            // "+ nova cena", não só na primeira. A dica bate ENQUANTO esse
            // personagem ainda estiver na cena (quer dizer que o aluno ainda
            // não removeu o que sobrou) - some sozinha assim que ele apagar.
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
            return !!found.character;
        }

        case 'mission_intro':
            // Dica de apresentação (ver hintsGeneration.js#buildIntroHint) -
            // não referencia cena/personagem nenhum, sempre "bate" - é sempre
            // a primeira dica da missão (índice 0 no array assignment.hints)
            // e some pra sempre nesta sessão assim que o aluno fechar, mesma
            // regra de dismissedHintIds de qualquer outra dica.
            return true;

        case 'manual':
            // Dica escrita à mão pelo professor na tela de revisão (ver
            // AssignmentAuthorBar.js#_showHintReview addBtn) - não referencia
            // nenhuma cena/personagem/bloco do projeto, então não tem como
            // checar automaticamente se "já foi feita". Sempre bate (igual
            // mission_intro) - fica disponível no painel até o aluno mesmo
            // fechar, nunca marcada "✅ já resolvida" sozinha. Sem este caso
            // explícito, cairia no `default: return false` abaixo e apareceria
            // como resolvida na hora, antes mesmo do aluno ler.
            return true;

        default:
            return false;
        }
    }

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
        // cena/personagem nenhum pra checar, então _hintConditionHolds sempre
        // devolve true pra ela (ver aquele switch case) - sem essa exclusão,
        // o painel sempre abria de volta na intro (ela é sempre hints[0]),
        // nunca avançava pra tarefa de verdade mesmo com progresso real já
        // feito. Filtrada só AQUI (navegação); ela continua contando
        // normalmente pro modal automático (_evaluateHints) e pro botão
        // Anterior/Próxima dentro do painel já aberto.
        let startIndex = hints.findIndex(function (h) {
            return h && h.when && h.when.type !== 'mission_intro' && AssignmentBadge._hintConditionHolds(h, detailed);
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
            const actorLabel = hint ? AssignmentBadge._actorLabelFor(hint, detailed) : null;
            actorEl.textContent = actorLabel || '';
            actorEl.classList.toggle('hidden', !actorLabel);
            counter.textContent = (index + 1) + ' de ' + hints.length;
            const stillNeeded = hint && AssignmentBadge._hintConditionHolds(hint, detailed);
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
registerGalleryRestrictionProvider(function () {
    return AssignmentBadge.galleryRestriction;
});
