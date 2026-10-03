/**
 * src/app/src/editor/ui/PollScheduler.js
 *
 * Cadência de recálculo do selo de missão (lado do aluno) - extraído de
 * AssignmentBadge.js (refatoração Fase 3). Isola os 3 temporizadores
 * (poll encadeado, refresh de requisitos, recálculo instantâneo pós-
 * interação) e o rastreamento de atividade do aluno, que antes viviam
 * espalhados em 6 métodos diferentes da classe (_trackActivity,
 * _scheduleInstantRecompute, _scheduleRecompute, _onVisibilityChange,
 * trechos de _showBadge/_lockCompletion) - essa cadência já passou por
 * pelo menos 2 reescritas documentadas ("cadência desordenada", "demora
 * muito pra perceber que uma ação foi tomada", ver docblock do topo de
 * AssignmentBadge.js) sem nunca ganhar um teste. Isolada aqui, agora dá pra
 * testar com fake timers sem precisar montar o resto do selo.
 *
 * Uso: start({onTick, onRequirementsRefresh, hasPendingHints}) uma vez
 * (idempotente); stop() quando a missão conclui - nunca mais reagenda nada
 * depois, mesma garantia que _lockCompletion() já dava. idleFor() devolve
 * há quanto tempo (ms) o aluno não interage com a página - consumido por
 * AssignmentBadge._evaluateHints() pra decidir SE uma dica pronta pode
 * interromper agora (IDLE_BEFORE_HINT_MS/ALERT_IDLE_MS continuam em
 * AssignmentBadge.js: são política de QUANDO mostrar, não de agendamento).
 *
 * Correção de 2 vazamentos encontrados ao extrair (ambos herdados do
 * código original, nunca intencionais - ver docblock de `active` abaixo):
 * o poll encadeado e o recálculo instantâneo continuavam se rearmando pra
 * sempre mesmo DEPOIS da missão concluir (stop() limpava o timer ATUAL,
 * mas o próprio callback em execução reagendava um NOVO timer depois,
 * sem checar se a missão tinha acabado de concluir no meio do mesmo tick).
 * O efeito prático era pequeno (cada rodada extra só executava um guard
 * `if (everCompleted) return` e saía) mas nunca parava de verdade enquanto
 * a aba ficasse aberta - agora `active` é checado nos dois pontos certos e
 * a cadeia realmente termina em stop().
 */

const ACTUAL_REFRESH_MS = 2000; // recálculo local, em memória - barato, pode ser frequente
const HINTS_PENDING_REFRESH_MS = 800; // cadência mais rápida enquanto há dica ainda não dispensada -
// ver scheduleNext(). Ainda é só um scan de JSON pequeno em memória, custo desprezível.
const REQUIREMENTS_REFRESH_MS = 30000; // ida ao servidor - só pra pegar reautoria do professor

let actualTimer = null;
let requirementsTimer = null;
let instantRecomputeTimer = null;
// true entre start() e stop() - substitui os dois guards independentes que
// o código original usava pra "já fui desligado?" (!badgeEl em
// _scheduleInstantRecompute, o próprio clearTimeout/clearInterval em
// _lockCompletion sem re-checagem no callback já em voo) por um único flag
// que start()/stop() controlam e todo callback agendado relê antes de agir
// ou se rearmar - ver docblock do topo do arquivo.
let active = false;
let listenersRegistered = false; // trackActivity() só registra os listeners globais uma vez por carregamento de página
// Date.now() da última interação REAL do aluno em qualquer lugar da página
// (clique/toque/arrasto/tecla). 0 (nunca tocou em nada ainda) conta como
// "já ocioso há muito tempo" de propósito - é o que deixa a primeira dica
// (mission_intro) aparecer imediatamente ao abrir a missão, sem esperar uma
// inatividade que ainda nem começou.
let lastActivityAt = 0;

let onTickCb = null;
let onRequirementsRefreshCb = null;
let hasPendingHintsCb = null;

/**
 * Registra (uma única vez - ver listenersRegistered) um listener global de
 * "o aluno tocou em algo" pra alimentar lastActivityAt. Fase de CAPTURA
 * (terceiro argumento `true`) - dispara ANTES de qualquer handler no
 * elemento clicado poder chamar stopPropagation(), então nunca perde um
 * clique real só porque o alvo específico (ex.: o botão de fechar da
 * própria dica) parou a propagação. mousemove/touchmove entram de
 * propósito, não só mousedown/touchstart - sem eles, um arrasto longo
 * (segurar e mover um bloco por vários segundos) só contaria como
 * atividade no instante em que começou, e o relógio de ociosidade já teria
 * passado ENQUANTO o aluno ainda está arrastando - a dica apareceria bem
 * no pior momento possível. {passive:true} - nunca chama preventDefault,
 * então não atrapalha scroll/drag nativo do navegador.
 */
function trackActivity () {
    if (listenersRegistered) {
        return;
    }
    listenersRegistered = true;

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

    // Segundo conjunto de listeners, propositalmente diferente do de cima:
    // gatilho pra recalcular NA HORA (ver scheduleInstantRecompute), não só
    // marcar ociosidade. Achado em teste real ("demora muito pra perceber
    // que uma ação foi tomada"): sem isso, soltar um bloco no lugar certo,
    // confirmar um valor ou adicionar/remover um personagem só era percebido
    // no próximo tick agendado (até 800ms-2s depois) - o selo/contador
    // ficava "atrasado" da ação real. Cobre os três casos sem precisar
    // plugar chamada nenhuma dentro do motor do editor (ScriptsPane/Stage/
    // UI/BlockArg/ScratchJr.js): soltar bloco, confirmar valor (número ou
    // velocidade) e adicionar/remover personagem terminam TODOS num
    // mouseup/touchend/keyup.
    //
    // Fase de BOLHA (sem capture, ao contrário do `mark` acima) DE PROPÓSITO:
    // se disparasse na fase de captura (antes do alvo), rodaria ANTES do
    // handler de verdade que aplica o drop/confirmação, lendo o projeto no
    // estado VELHO. Na fase de bolha, já roda depois de qualquer handler no
    // próprio elemento (onde o drop é processado). setTimeout(0) some por
    // cima disso - garante rodar só depois que TODA a pilha síncrona do
    // evento (bolha inclusa) já terminou, mesmo que a ordem de registro dos
    // listeners mude no futuro.
    document.addEventListener('mouseup', scheduleInstantRecompute, {passive: true});
    document.addEventListener('touchend', scheduleInstantRecompute, {passive: true});
    document.addEventListener('keyup', scheduleInstantRecompute, {passive: true});
}

/**
 * Agenda onTick() pro próximo tick (setTimeout 0), coalescendo chamadas
 * repetidas (ex.: multi-touch gerando vários touchend seguidos) numa só -
 * instantRecomputeTimer não nulo significa que já tem uma rodada pendente,
 * não empilha outra. Nunca substitui o poll agendado em scheduleNext()
 * (continua rodando como rede de segurança pra mudanças sem evento de UI
 * associado) - só antecipa o próximo cálculo pra logo após uma interação
 * de verdade, em vez de esperar o timer.
 */
function scheduleInstantRecompute () {
    if (!active || instantRecomputeTimer) {
        return;
    }
    instantRecomputeTimer = window.setTimeout(function () {
        instantRecomputeTimer = null;
        if (active && onTickCb) {
            onTickCb();
        }
    }, 0);
}

/**
 * Reagenda o próximo onTick(). Atraso curto (HINTS_PENDING_REFRESH_MS)
 * enquanto hasPendingHintsCb() disser que existe pelo menos uma dica ainda
 * não dispensada - é justamente quando a cadência importa mais pro aluno.
 * Volta pro atraso normal (ACTUAL_REFRESH_MS) assim que todas as dicas já
 * tiverem sido mostradas+fechadas (ou a missão não tem dicas). setTimeout em
 * cadeia (em vez de setInterval fixo) porque o atraso muda de tick pra tick,
 * dependendo desse estado - e porque só assim dá pra checar `active` antes
 * de rearmar (ver docblock do topo do arquivo pro vazamento que isso evita).
 */
function scheduleNext () {
    const delay = (hasPendingHintsCb && hasPendingHintsCb()) ? HINTS_PENDING_REFRESH_MS : ACTUAL_REFRESH_MS;
    actualTimer = window.setTimeout(function () {
        if (!active) {
            return; // stop() rodou durante a espera - não reagenda
        }
        if (document.visibilityState === 'visible' && onTickCb) {
            onTickCb();
        }
        // onTick() pode ter concluído a missão e chamado stop() agora mesmo
        // (ver AssignmentBadge._applyProgress -> _lockCompletion) - sem esta
        // checagem, a cadeia se rearmava pra sempre mesmo depois de parada.
        if (active) {
            scheduleNext();
        }
    }, delay);
}

/**
 * Recheck imediato ao voltar o foco da aba - sem isso, qualquer progresso
 * feito enquanto a aba estava oculta (poll pausado de propósito, ver
 * scheduleNext) só seria percebido no próximo tick agendado (até
 * HINTS_PENDING_REFRESH_MS/ACTUAL_REFRESH_MS de atraso) - era a causa mais
 * provável do "demora um monte" relatado em teste.
 */
function onVisibilityChange () {
    if (document.visibilityState === 'visible' && active && onTickCb) {
        onTickCb();
    }
}

export default class PollScheduler {
    /**
     * Liga a cadência inteira. Idempotente - uma segunda chamada enquanto já
     * ativo é ignorada (mesma guarda que `if (badgeEl) return` já dava no
     * _showBadge original, que só chamava o equivalente disto uma vez).
     * @param {object} opts
     * @param {function} opts.onTick - chamado a cada recálculo (poll normal,
     *   recálculo instantâneo pós-interação, ou volta de visibilidade).
     * @param {function} opts.onRequirementsRefresh - chamado a cada
     *   REQUIREMENTS_REFRESH_MS (só com a aba visível).
     * @param {function} opts.hasPendingHints - consultado a cada rodada do
     *   poll pra escolher a cadência (rápida/normal).
     */
    static start ({onTick, onRequirementsRefresh, hasPendingHints}) {
        if (active) {
            return;
        }
        active = true;
        onTickCb = onTick;
        onRequirementsRefreshCb = onRequirementsRefresh;
        hasPendingHintsCb = hasPendingHints;

        trackActivity();
        scheduleNext();
        document.addEventListener('visibilitychange', onVisibilityChange);

        requirementsTimer = window.setInterval(function () {
            if (document.visibilityState === 'visible' && onRequirementsRefreshCb) {
                onRequirementsRefreshCb();
            }
        }, REQUIREMENTS_REFRESH_MS);
    }

    /**
     * Desliga pra sempre nesta sessão de aba - mesma semântica sticky de
     * everCompleted em AssignmentBadge.js (nunca reativado depois). Limpa os
     * 3 temporizadores e marca `active = false`, que os próprios callbacks
     * já em voo relêem antes de agir ou se rearmar (ver docblock do topo).
     */
    static stop () {
        active = false;
        if (requirementsTimer) {
            window.clearInterval(requirementsTimer);
            requirementsTimer = null;
        }
        if (actualTimer) {
            window.clearTimeout(actualTimer);
            actualTimer = null;
        }
        if (instantRecomputeTimer) {
            window.clearTimeout(instantRecomputeTimer);
            instantRecomputeTimer = null;
        }
    }

    /** Milissegundos desde a última interação real do aluno na página. */
    static idleFor () {
        return Date.now() - lastActivityAt;
    }
}
