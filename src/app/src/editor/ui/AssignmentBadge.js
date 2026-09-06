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
import {registerGalleryRestrictionProvider} from './GalleryRestriction.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));
const ACTUAL_REFRESH_MS = 2000; // recálculo local, em memória - barato, pode ser frequente
const HINTS_PENDING_REFRESH_MS = 800; // cadência mais rápida enquanto há dica ainda não dispensada -
// ver _scheduleRecompute(). Ainda é só um scan de JSON pequeno em memória, custo desprezível.
const HINT_COOLDOWN_MS = 5000; // intervalo mínimo entre uma dica fechar e a próxima aparecer sozinha -
// evita o "despejo" de várias dicas em sequência rápida quando mais de uma condição vira
// verdadeira no mesmo instante (ex.: aluno voltou de outra aba depois de progredir bastante).
// Só vale pro caminho automático (poll) - o painel de dicas (_openHintsPanel) ignora, de
// propósito: é exatamente pra isso que ele existe (ver docblock do ponto 7 no topo do arquivo).
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
     */
    static get galleryRestriction () {
        if (!assignment || !assignment.requirements) return null;
        if (wasComplete === true) return null;
        const req = assignment.requirements;
        const characterMd5s = (req.characters && Array.isArray(req.characters.used)) ? req.characters.used : [];
        const sceneMd5s = (req.scenes && Array.isArray(req.scenes.used)) ? req.scenes.used : [];
        return {
            characterMd5s: characterMd5s.length > 0 ? new Set(characterMd5s) : null,
            sceneMd5s: sceneMd5s.length > 0 ? new Set(sceneMd5s) : null,
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
        const projectJson = AssignmentBadge._readProjectJson();
        if (!projectJson) {
            return;
        }
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
        AssignmentBadge._updateHintButton(!!readyHint);

        if (!readyHint || coachModalEl || hintsPanelEl) {
            // hintsPanelEl aberto: o aluno já está olhando as dicas por conta
            // própria (ver _openHintsPanel) - não faz sentido interromper com
            // o modal automático por cima nesse momento.
            return;
        }
        const cooldownElapsed = (Date.now() - lastHintClosedAt) >= HINT_COOLDOWN_MS;
        if (!cooldownElapsed) {
            return; // pronta, mas ainda dentro do intervalo mínimo entre dicas - espera
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
            const wanted = Array.isArray(when.blockTypes) ? when.blockTypes : [];
            const typesOk = wanted.every(function (bt) {
                return found.character.blockTypes.includes(bt);
            });
            if (!typesOk) return true; // ainda precisa

            // Achado em teste real (3) - um tipo sozinho em blockTypes só diz
            // "o personagem tem um forward/wait/setspeed/etc.", nunca COM QUE
            // VALOR - uma dica que pede "3 passos"/"velocidade normal"
            // ficava resolvida assim que QUALQUER bloco daquele tipo
            // aparecesse, com qualquer valor (ex.: o aluno usa 5 passos, ou
            // ainda está ajustando a velocidade, e o sistema já libera a
            // próxima dica). when.blockArgs ({[blockType]: number}, só
            // presente quando o VALOR daquele tipo é inequívoco no projeto
            // do professor - ver fillBlockArgs no backend) precisa bater
            // exatamente com um valor que o aluno já configurou nesse tipo -
            // decisão explícita do usuário: "say" é o ÚNICO bloco cujo
            // argumento pode divergir do professor, todos os outros exigem
            // o valor exato (por isso "say" nunca aparece em blockArgs).
            const wantedArgs = when.blockArgs && typeof when.blockArgs === 'object' ? when.blockArgs : {};
            const argsOk = Object.keys(wantedArgs).every(function (blockType) {
                const realValues = found.character.blockArgs && found.character.blockArgs[blockType];
                return Array.isArray(realValues) && realValues.includes(wantedArgs[blockType]);
            });
            return !argsOk; // ainda precisa se algum valor exigido ainda não bate
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

        // Começa na última dica mostrada automaticamente, se houver - é a
        // mais provável de ser "onde o aluno parou". Sem isso, começa na
        // primeira ainda não dispensada, ou simplesmente na primeira de todas.
        let startIndex = 0;
        if (lastShownHint) {
            const idx = hints.findIndex(function (h) { return h && h.id === lastShownHint.id; });
            if (idx >= 0) startIndex = idx;
        } else {
            const idx = hints.findIndex(function (h) { return h && !dismissedHintIds.has(h.id); });
            if (idx >= 0) startIndex = idx;
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
