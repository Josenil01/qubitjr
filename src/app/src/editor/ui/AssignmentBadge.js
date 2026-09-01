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
 *     nesse meio-tempo só aparecia no próximo tick); e um cooldown
 *     (HINT_COOLDOWN_MS, 5s) entre uma dica fechar e a próxima aparecer
 *     sozinha evita que várias condições satisfeitas ao mesmo tempo (ex.:
 *     progresso feito com a aba oculta) apareçam em sequência rápida demais.
 *     O botão flutuante de dica (hintButtonEl, _createHintButton) é a via
 *     manual que ignora esse cooldown - clique força uma checagem imediata
 *     (_recomputeLocal(true)) e, se nada bater ainda, reabre a última dica
 *     já mostrada (lastShownHint) como fallback, nunca ficando sem reação.
 */

import ScratchJr from '../ScratchJr.js';
import Project from './Project.js';
import {newHTML} from '../../utils/lib.js';
import {computeProjectManifest, compareManifests} from './assignmentScoring.js';
import {computeDetailedManifest} from './detailedManifest.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));
const ACTUAL_REFRESH_MS = 2000; // recálculo local, em memória - barato, pode ser frequente
const HINTS_PENDING_REFRESH_MS = 800; // cadência mais rápida enquanto há dica ainda não dispensada -
// ver _scheduleRecompute(). Ainda é só um scan de JSON pequeno em memória, custo desprezível.
const HINT_COOLDOWN_MS = 5000; // intervalo mínimo entre uma dica fechar e a próxima aparecer sozinha -
// evita o "despejo" de várias dicas em sequência rápida quando mais de uma condição vira
// verdadeira no mesmo instante (ex.: aluno voltou de outra aba depois de progredir bastante).
// Só vale pro caminho automático (poll) - o botão flutuante (forced=true) ignora, de propósito:
// é exatamente pra isso que ele existe.
const REQUIREMENTS_REFRESH_MS = 30000; // ida ao servidor - só pra pegar reautoria do professor

let assignment = null; // { id, projectName, requirements, nivel, turmaId, existingProjectId }
let lastProgress = null; // último resultado calculado (pro popover não ficar vazio ao abrir)
let bannerEl = null;
let badgeEl = null;
let popoverEl = null;
let hintButtonEl = null; // botão flutuante "💡" - abre a dica pronta agora, ou a última mostrada
let coachModalEl = null; // um modal por vez - serve tanto pro "parabéns" quanto pra dica de coach
let actualTimer = null;
let requirementsTimer = null;
let dismissedThisSession = false;
let dismissedHintIds = new Set(); // ids de dica já mostrada+fechada nesta sessão de aba - nunca mais reexibida automaticamente
let lastShownHint = null; // última dica (objeto completo) mostrada nesta sessão - fallback do botão flutuante
let lastHintClosedAt = 0; // Date.now() do fechamento da última dica - referência do cooldown acima
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

export default class AssignmentBadge {
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
     * _recomputeLocal pra ser reaproveitado também pelo clique do botão
     * flutuante (_onHintButtonClick), sem duplicar a leitura.
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

    /**
     * `forced` (default false) repassa pra _evaluateHints - true só no
     * clique do botão flutuante, pra ignorar o cooldown entre dicas e
     * mostrar a próxima pronta na hora, mesmo que o cooldown normal ainda
     * não tenha passado. Retorna true se alguma dica foi de fato aberta
     * nesta chamada (o botão flutuante usa isso pra saber se precisa cair
     * no fallback de reabrir a última dica já mostrada).
     */
    static _recomputeLocal (forced) {
        const projectJson = AssignmentBadge._readProjectJson();
        if (!projectJson) {
            return false;
        }
        const actual = computeProjectManifest(projectJson);
        const comparison = compareManifests(assignment.requirements, actual);
        AssignmentBadge._applyProgress({
            hasAssignment: true,
            projectName: assignment.projectName,
            ...comparison,
        });
        return AssignmentBadge._evaluateHints(comparison.completed, projectJson, !!forced);
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
            // completa nunca mostra dica - ver _evaluateHints).
            AssignmentBadge._closeCoachModal();
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
     *     seja mostrada AGORA por causa do cooldown abaixo. É assim que o
     *     botão dá acesso imediato a algo que o poll automático ainda vai
     *     demorar HINT_COOLDOWN_MS pra mostrar sozinho.
     *  2. Se `forced` (clique no botão) OU o cooldown desde a última dica
     *     fechada já passou, E nenhum modal está aberto agora (congrats ou
     *     outra dica), a dica é mostrada de fato via _showCoachModal.
     * Não faz nada (dica nenhuma, ponto nenhum) se a missão já está
     * completa - o modal de parabéns cobre esse caso e dica de coach nunca
     * aparece depois de concluído. Reaproveita o mesmo detailedManifest.js
     * pro projectJson já lido por _recomputeLocal, sem ida extra ao
     * servidor. Retorna true se uma dica foi de fato aberta nesta chamada.
     */
    static _evaluateHints (isComplete, projectJson, forced) {
        if (isComplete) {
            AssignmentBadge._updateHintButton(false);
            return false;
        }
        const hints = (assignment && Array.isArray(assignment.hints)) ? assignment.hints : [];
        if (!hints.length) {
            return false;
        }
        const detailed = computeDetailedManifest(projectJson);
        const readyHint = hints.find(function (hint) {
            return hint && !dismissedHintIds.has(hint.id) && AssignmentBadge._hintConditionHolds(hint, detailed);
        });
        AssignmentBadge._updateHintButton(!!readyHint);

        if (!readyHint || coachModalEl) {
            return false;
        }
        const cooldownElapsed = (Date.now() - lastHintClosedAt) >= HINT_COOLDOWN_MS;
        if (!forced && !cooldownElapsed) {
            return false; // pronta, mas ainda dentro do intervalo mínimo entre dicas - espera
        }
        AssignmentBadge._showCoachModal({
            icon: '💡',
            text: readyHint.text,
            extraClass: 'assignmentCoachCard',
            onClose: function () {
                dismissedHintIds.add(readyHint.id);
                lastHintClosedAt = Date.now();
            },
        });
        lastShownHint = readyHint;
        return true;
    }

    /**
     * Encontra, dentro do detailedManifest, a cena com o sceneMd5 dado e
     * (se characterMd5 também for passado) o personagem com esse
     * characterMd5 dentro dela. Retorna null se a cena (ou o personagem
     * dentro dela) simplesmente não existir ainda no projeto do aluno -
     * chamado só sabe decidir o que fazer com esse "não existe" (ver cada
     * ramo de _hintConditionHolds).
     */
    static _findSceneAndCharacter (scenes, sceneMd5, characterMd5) {
        const scene = scenes.find(function (s) {
            return s.sceneMd5 === sceneMd5;
        });
        if (!scene) {
            return {scene: null, character: null};
        }
        const character = scene.characters.find(function (c) {
            return c.characterMd5 === characterMd5;
        }) || null;
        return {scene, character};
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
        case 'scene_missing':
            return !scenes.some(function (s) {
                return s.sceneMd5 === when.sceneMd5;
            });

        case 'character_missing': {
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5);
            // Cena em si nem existindo ainda não conta como "personagem
            // faltando" - esse caso é coberto por um hint scene_missing
            // separado (ver comentário no topo do arquivo/spec).
            return !!found.scene && !found.character;
        }

        case 'character_no_script': {
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5);
            return !!found.character && !found.character.hasScript;
        }

        case 'character_missing_block_type': {
            const found = AssignmentBadge._findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5);
            if (!found.character || !found.character.hasScript) {
                return false;
            }
            const wanted = Array.isArray(when.blockTypes) ? when.blockTypes : [];
            return !wanted.some(function (bt) {
                return found.character.blockTypes.includes(bt);
            });
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

        default:
            return false;
        }
    }

    /**
     * Botão flutuante de dica - via manual pro aluno/professor testando não
     * ficar refém do poll automático (ver constantes HINTS_PENDING_REFRESH_MS/
     * HINT_COOLDOWN_MS no topo do arquivo). Fica ao lado do selo de
     * progresso, mesma linguagem visual (ver assignment.css). Criado uma
     * única vez em _showBadge(), só se a missão tiver pelo menos uma dica.
     */
    static _createHintButton () {
        hintButtonEl = newHTML('div', 'assignmentHintButton', document.body);
        hintButtonEl.setAttribute('role', 'button');
        hintButtonEl.tabIndex = 0;
        hintButtonEl.title = 'Ver dica';
        hintButtonEl.textContent = '💡';
        const dot = newHTML('span', 'assignmentHintButtonDot hidden', hintButtonEl);
        dot.setAttribute('aria-hidden', 'true');
        hintButtonEl.onclick = AssignmentBadge._onHintButtonClick;
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
     * Clique no botão flutuante: força uma recomputação ignorando o
     * cooldown (ver _recomputeLocal(true) -> _evaluateHints(..., true)). Se
     * isso abrir uma dica nova, pronto. Se não (nada bateu agora), cai no
     * fallback de reabrir a ÚLTIMA dica já mostrada nesta sessão, pra o
     * clique nunca ficar sem reação nenhuma - e se nem isso existir ainda
     * (aluno mal começou, nenhuma condição bateu ainda), um aceno visual
     * rápido no próprio botão (ver _flashHintButtonEmpty) substitui o
     * silêncio total.
     */
    static _onHintButtonClick () {
        if (!assignment || coachModalEl) {
            return; // já tem modal aberto agora - nada a fazer
        }
        const shown = AssignmentBadge._recomputeLocal(true);
        if (shown) {
            return;
        }
        if (lastShownHint) {
            AssignmentBadge._showCoachModal({
                icon: '💡',
                text: lastShownHint.text,
                extraClass: 'assignmentCoachCard',
                onClose: function () {
                    lastHintClosedAt = Date.now();
                },
            });
            return;
        }
        AssignmentBadge._flashHintButtonEmpty();
    }

    /**
     * Feedback rápido (classe CSS temporária, ver assignment.css) pro
     * clique no botão quando não há absolutamente nada pra mostrar ainda
     * (nenhuma dica nunca foi mostrada E nenhuma condição bate agora) -
     * evita a sensação de "cliquei e não aconteceu nada".
     */
    static _flashHintButtonEmpty () {
        if (!hintButtonEl) {
            return;
        }
        hintButtonEl.classList.add('empty-flash');
        window.setTimeout(function () {
            if (hintButtonEl) {
                hintButtonEl.classList.remove('empty-flash');
            }
        }, 600);
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
     * sem cabeçalho). Clicar no botão "Continuar" ou fora do cartão fecha
     * e dispara `onClose`, se houver - _evaluateHints usa isso pra marcar
     * a dica como dispensada nesta sessão (ver dismissedHintIds).
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
        coachModalEl.onclick = function (e) {
            if (e.target === coachModalEl) {
                close();
            }
        };
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
