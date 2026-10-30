import {describe, expect, it} from 'vitest';
import {
    decideHintAction,
    nextProactiveHint,
    IDLE_BEFORE_HINT_MS,
    ALERT_IDLE_MS,
} from './HintEngine.js';
import {project, b, onflag, onclick} from '../../../../../shared/testing/projectFixtures.mjs';
import {computeDetailedManifest, scriptTokens} from '../../../../../shared/detailedManifest.mjs';

/**
 * Testes de CARACTERIZAÇÃO de HintEngine.js#decideHintAction (Fase 1, R4):
 * fixam o comportamento que AssignmentBadge.js#_evaluateHints tinha antes da
 * extração - prioridade alerta > dica, esperas de ociosidade, guardas de
 * modal/painel, pontinho do botão. Projetos sintéticos via
 * shared/testing/projectFixtures.mjs + computeDetailedManifest (o mesmo
 * caminho que o editor usa em produção).
 */

const SCENE = 'Woods.svg';
const CHAR = 'HY-Ruby.svg';
const LONG_IDLE = 60000;

function detailedFor (scripts) {
    return computeDetailedManifest(project([
        {md5: SCENE, sprites: [{md5: CHAR, name: 'Ruby', scripts}]},
    ]));
}

function blockHint (id, extra) {
    return {
        id: id,
        text: 'texto ' + id,
        when: Object.assign({
            type: 'character_missing_block_type',
            sceneMd5: SCENE,
            characterMd5: CHAR,
            blockTypes: ['forward'],
        }, extra),
    };
}

const intro = {id: 'h1', text: 'Bem-vindo', when: {type: 'mission_intro'}};

/** Chamada com defaults "tudo livre" - cada teste sobrescreve o que importa. */
function decide (overrides) {
    return decideHintAction(Object.assign({
        hints: [],
        detailed: detailedFor([[onflag()]]),
        dismissed: new Set(),
        alerted: new Set(),
        idleMs: LONG_IDLE,
        modalOpen: false,
        panelOpen: false,
    }, overrides));
}

describe('decideHintAction - caracterização do _evaluateHints antigo', () => {
    it('missão sem dicas: não mexe no pontinho nem mostra nada', () => {
        expect(decide({hints: []})).toEqual({buttonDot: null, action: null});
        expect(decide({hints: undefined})).toEqual({buttonDot: null, action: null});
    });

    it('dica pronta e aluno ocioso: mostra a dica proativa e liga o pontinho', () => {
        const d = decide({hints: [intro, blockHint('h2')]});
        expect(d.buttonDot).toBe(true);
        expect(d.action).toEqual({kind: 'hint', hint: intro});
    });

    it('ociosidade insuficiente: pontinho ligado, nada mostrado ainda', () => {
        const d = decide({hints: [intro], idleMs: IDLE_BEFORE_HINT_MS - 1});
        expect(d).toEqual({buttonDot: true, action: null});
        // Exatamente no limite já mostra (comparação era `<`).
        expect(decide({hints: [intro], idleMs: IDLE_BEFORE_HINT_MS}).action.kind).toBe('hint');
    });

    it('modal aberto: pontinho ligado, nada mostrado', () => {
        expect(decide({hints: [intro], modalOpen: true})).toEqual({buttonDot: true, action: null});
    });

    it('painel aberto: pontinho ligado, nada mostrado', () => {
        expect(decide({hints: [intro], panelOpen: true})).toEqual({buttonDot: true, action: null});
    });

    it('tarefa já cumprida não é proativa; sem nada pendente o pontinho apaga', () => {
        const detailed = detailedFor([[onflag(), b('forward', 3)]]);
        expect(decide({hints: [blockHint('h2')], detailed})).toEqual({buttonDot: false, action: null});
    });

    it('a dica proativa é a 1ª pendente na ordem, mesmo com uma posterior pendente', () => {
        const hints = [blockHint('h2'), blockHint('h3', {blockTypes: ['up']})];
        expect(decide({hints}).action.hint.id).toBe('h2');
    });

    it('alerta de valor errado: kind alert, spokenHint = a própria dica', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 5)]]);
        const d = decide({hints: [hint], detailed, idleMs: ALERT_IDLE_MS});
        expect(d.action.kind).toBe('alert');
        expect(d.action.hint).toBe(hint);
        expect(d.action.spokenHint).toBe(hint);
        expect(d.action.info).toEqual({kind: 'value', sig: 'h2|value|forward=5'});
        // h2 está pendente (valor errado) e não dispensada: pontinho ligado.
        expect(d.buttonDot).toBe(true);
    });

    it('alerta tem prioridade sobre a dica proativa, e espera só ALERT_IDLE_MS', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 5)]]);
        // Intro pronta, mas o alerta passa na frente.
        expect(decide({hints: [intro, hint], detailed}).action.kind).toBe('alert');
        // Alerta pendente mas ainda sem a ociosidade dele: NADA aparece (a
        // proativa não "passa na frente" do alerta).
        expect(decide({hints: [intro, hint], detailed, idleMs: ALERT_IDLE_MS - 1}))
            .toEqual({buttonDot: true, action: null});
    });

    it('alerta de bloco zerado (fill) usa o idleMs próprio do info', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 'unconfirmed:0')]]);
        const early = decide({hints: [hint], detailed, idleMs: ALERT_IDLE_MS});
        expect(early.action).toBe(null);
        const d = decide({hints: [hint], detailed, idleMs: 2000});
        expect(d.action.kind).toBe('alert');
        expect(d.action.info.kind).toBe('fill');
    });

    it('alerta já avisado (sig em alerted) não repete; cai pra dica proativa', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 5)]]);
        const d = decide({hints: [hint], detailed, alerted: new Set(['h2|value|forward=5'])});
        expect(d.action).toEqual({kind: 'hint', hint});
        // Já avisado E dispensado: nada.
        const none = decide({
            hints: [hint], detailed,
            alerted: new Set(['h2|value|forward=5']),
            dismissed: new Set(['h2']),
        });
        expect(none).toEqual({buttonDot: false, action: null});
    });

    it('alerta de fora de ordem: hint = a posterior montada, spokenHint = a pendente pulada', () => {
        const first = blockHint('h2', {blockTypes: ['forward'], trigger: 'onflag'});
        const later = blockHint('h3', {blockTypes: ['up'], trigger: 'onclick'});
        const detailed = detailedFor([[onflag()], [onclick(), b('up', 2)]]);
        const d = decide({hints: [first, later], detailed, dismissed: new Set(['h2'])});
        expect(d.action.kind).toBe('alert');
        expect(d.action.info.kind).toBe('order');
        expect(d.action.info.sig).toBe('h2|order|h3');
        expect(d.action.hint).toBe(later);
        expect(d.action.spokenHint).toBe(first);
        // Ordem já avisada: nada (h2 dispensada trava a proativa).
        const none = decide({
            hints: [first, later], detailed,
            dismissed: new Set(['h2']),
            alerted: new Set(['h2|order|h3']),
        });
        expect(none).toEqual({buttonDot: false, action: null});
    });

    it('não modifica os Sets recebidos', () => {
        const dismissed = new Set(['x']);
        const alerted = new Set(['y']);
        decide({hints: [intro, blockHint('h2')], dismissed, alerted});
        expect([...dismissed]).toEqual(['x']);
        expect([...alerted]).toEqual(['y']);
    });

    // Era a caracterização do bug P1 (intro dispensada => null; telemetria:
    // 88 de 93 pares fecharam a intro, só 2 receberam qualquer dica
    // proativa depois). Mudou de propósito na Fase 1 (R4 b).
    it('P1 corrigido: intro dispensada + tarefa pendente => a tarefa é a proativa', () => {
        const task = blockHint('h2');
        const hints = [intro, task];
        const dismissed = new Set(['h1']);
        expect(nextProactiveHint(hints, detailedFor([[onflag()]]), dismissed)).toBe(task);
        expect(decide({hints, dismissed})).toEqual({buttonDot: true, action: {kind: 'hint', hint: task}});
    });
});

/**
 * Fase 3 (E6c) - dicas com when.expected: alertas do alinhamento
 * (info.source 'expected'). As caracterizações acima continuam sendo o
 * caminho LEGADO (dicas sem expected) e não mudaram.
 */
describe('decideHintAction - alertas do alinhamento (when.expected)', () => {
    const teacher = [onflag(), b('forward', 3), b('setspeed', 1), b('up', 2)];
    const expectedHint = (id, covered) => blockHint(id, {
        blockTypes: [], trigger: 'onflag',
        expected: {trigger: 'onflag', triggerArg: null, script: scriptTokens(teacher), covered},
    });
    const hints = [intro, expectedHint('h2', [0]), expectedHint('h3', [1]), expectedHint('h4', [2])];
    const dismissedIntro = new Set(['h1']);

    it('kind value: info completo, spokenHint = a própria dica', () => {
        const detailed = detailedFor([[onflag(), b('forward', 3), b('setspeed', 1), b('up', 5)]]);
        const d = decide({hints, detailed, idleMs: ALERT_IDLE_MS});
        expect(d.action.kind).toBe('alert');
        expect(d.action.hint).toBe(hints[3]);
        expect(d.action.spokenHint).toBe(hints[3]);
        expect(d.action.info).toEqual({
            source: 'expected', kind: 'value', sig: 'h4|align|value|0:3|up|5', state: 'wrong_value',
            blockType: 'up', position: {scriptIndex: 0, path: [3]}, characterOccurrence: 1,
            teacherIndex: 2, expected: 2, got: 5,
        });
        // Alerta antes da proativa (intro ainda pronta), mesma espera ALERT_IDLE_MS.
        expect(decide({hints, detailed, idleMs: ALERT_IDLE_MS - 1})).toEqual({buttonDot: true, action: null});
    });

    it('kind order: a dica do bloco fora do lugar é a dita (não há "pendente pulada")', () => {
        const detailed = detailedFor([[onflag(), b('setspeed', 1), b('forward', 3), b('up', 2)]]);
        const d = decide({hints, detailed, dismissed: dismissedIntro});
        expect(d.action.info.kind).toBe('order');
        expect(d.action.spokenHint).toBe(d.action.hint);
        expect(d.action.info.pendingHint).toBeUndefined();
    });

    it('kind extra: bloco a mais quando o resto está completo', () => {
        const detailed = detailedFor([[onflag(), b('forward', 3), b('setspeed', 1), b('up', 2), b('up', 2)]]);
        const d = decide({hints, detailed, dismissed: dismissedIntro});
        expect(d.action.info).toMatchObject({kind: 'extra', blockType: 'up', extraCount: 1, position: {scriptIndex: 0, path: [4]}});
        // Avisado: nada mais (todas as tarefas "pendentes" por causa da sobra, mas h4 não dispensada => proativa h4).
        const after = decide({hints, detailed, dismissed: dismissedIntro, alerted: new Set([d.action.info.sig])});
        expect(after.action).toEqual({kind: 'hint', hint: hints[3]});
    });

    it('kinds confirm/fill herdados do legado (unconfirmed / unset), nunca value', () => {
        const confirm = decide({hints, dismissed: dismissedIntro, detailed: detailedFor([[onflag(), b('forward', 'unconfirmed:3')]])});
        expect(confirm.action.info).toMatchObject({kind: 'confirm', reason: 'unconfirmed', got: 3});
        const fill = decide({hints, dismissed: dismissedIntro, idleMs: 2000, detailed: detailedFor([[onflag(), b('forward', 'unconfirmed:1')]])});
        expect(fill.action.info).toMatchObject({kind: 'fill', idleMs: 2000});
        const speed = decide({hints, dismissed: dismissedIntro, idleMs: 2000, detailed: detailedFor([[onflag(), b('forward', 3), b('setspeed', 3)]])});
        expect(speed.action.info).toMatchObject({kind: 'fill', blockType: 'setspeed', reason: 'unset'});
    });

    it('varredura na ordem das dicas: o 1º alerta não avisado vence', () => {
        const detailed = detailedFor([[onflag(), b('forward', 4), b('setspeed', 1), b('up', 5)]]);
        const first = decide({hints, detailed});
        expect(first.action.hint.id).toBe('h2');
        const second = decide({hints, detailed, alerted: new Set([first.action.info.sig])});
        expect(second.action.hint.id).toBe('h4');
    });

    it('nada errado e tudo feito: sem alerta, pontinho apagado', () => {
        const detailed = detailedFor([[onflag(), b('forward', 3), b('setspeed', 1), b('up', 2)]]);
        expect(decide({hints, detailed, dismissed: dismissedIntro})).toEqual({buttonDot: false, action: null});
    });

    it('falta fazer (pending missing/no_script): sem alerta, só a proativa', () => {
        expect(decide({hints, dismissed: dismissedIntro, detailed: detailedFor([])}).action).toEqual({kind: 'hint', hint: hints[1]});
        expect(decide({hints, dismissed: dismissedIntro, detailed: detailedFor([[onflag(), b('forward', 3)]])}).action)
            .toEqual({kind: 'hint', hint: hints[2]});
    });
});

describe('nextProactiveHint - regra da Fase 1', () => {
    const pendingDetailed = detailedFor([[onflag()]]);
    const manual = (id) => ({id: id, text: 'manual ' + id, when: {type: 'manual'}});

    it('tarefa dispensada continua travando (decisão deliberada, não muda)', () => {
        const hints = [intro, blockHint('h2'), blockHint('h3', {blockTypes: ['up']})];
        expect(nextProactiveHint(hints, pendingDetailed, new Set(['h1', 'h2']))).toBe(null);
    });

    it('intro/manual NÃO dispensadas aparecem normalmente na sua vez', () => {
        const m = manual('h3');
        const hints = [intro, blockHint('h2', {blockTypes: ['up']}), m, blockHint('h4')];
        // h2 cumprida (up existe), intro dispensada: a manual h3 é a vez dela.
        const detailed = detailedFor([[onflag(), b('up', 2)]]);
        expect(nextProactiveHint(hints, detailed, new Set(['h1']))).toBe(m);
        // Antes de dispensar a intro, ela continua sendo a primeira.
        expect(nextProactiveHint(hints, detailed, new Set())).toBe(intro);
        // Manual dispensada: segue pra tarefa h4.
        expect(nextProactiveHint(hints, detailed, new Set(['h1', 'h3'])).id).toBe('h4');
    });

    it('tudo resolvido (só intro/manuais dispensadas sobrando): null', () => {
        const hints = [intro, manual('h2'), blockHint('h3')];
        const done = detailedFor([[onflag(), b('forward', 3)]]);
        expect(nextProactiveHint(hints, done, new Set(['h1', 'h2']))).toBe(null);
    });

    /**
     * Invariante I2 (R7): com SÓ intro/manuais dispensadas (nenhuma tarefa
     * dispensada), a proativa nunca é null enquanto houver tarefa pendente -
     * e, sem modal/painel/alerta e com ociosidade de sobra, decideHintAction
     * devolve action kind 'hint'. Enumera todas as sequências de até 5 dicas
     * (intro opcional no índice 0, manuais e tarefas em qualquer ordem), todo
     * subconjunto de intro/manuais dispensadas e todo subconjunto de tarefas
     * já cumpridas.
     */
    it('I2: só intro/manuais dispensadas + tarefa pendente => proativa não-null e action hint', () => {
        // Tarefas distintas: cada uma pede um tipo de bloco próprio, sem
        // blockArgs (alerta de valor impossível) e sem gatilho (wrongTrigger
        // impossível). O único alerta possível é o de ORDEM (tarefa posterior
        // cumprida antes de uma anterior do mesmo personagem) - ele tem
        // prioridade legítima sobre a proativa, então nesse caso só se
        // confere que é mesmo 'order'.
        const TASK_TYPES = ['forward', 'up', 'down', 'right', 'left'];
        let checked = 0;
        const shapes = [];
        const build = function (prefix, len) {
            if (prefix.length === len) {
                shapes.push(prefix);
                return;
            }
            ['manual', 'task'].forEach(function (k) {
                build(prefix.concat([k]), len);
            });
        };
        for (let len = 1; len <= 4; len++) {
            build([], len);
        }
        shapes.forEach(function (shape) {
            [false, true].forEach(function (withIntro) {
                const kinds = (withIntro ? ['intro'] : []).concat(shape);
                let taskIdx = 0;
                const hints = kinds.map(function (k, i) {
                    const id = 'h' + (i + 1);
                    if (k === 'intro') return {id, text: 'intro', when: {type: 'mission_intro'}};
                    if (k === 'manual') return manual(id);
                    return blockHint(id, {blockTypes: [TASK_TYPES[taskIdx++]]});
                });
                const alwaysIds = hints.filter((h) => h.when.type !== 'character_missing_block_type').map((h) => h.id);
                const tasks = hints.filter((h) => h.when.type === 'character_missing_block_type');
                // Todo subconjunto de tarefas cumpridas x todo subconjunto de intro/manuais dispensadas.
                for (let doneMask = 0; doneMask < (1 << tasks.length); doneMask++) {
                    const doneTypes = tasks.filter((t, i) => doneMask & (1 << i)).map((t) => t.when.blockTypes[0]);
                    const detailed = detailedFor([[onflag()].concat(doneTypes.map((t) => b(t, 1)))]);
                    const anyTaskPending = tasks.length > 0 && doneTypes.length < tasks.length;
                    for (let disMask = 0; disMask < (1 << alwaysIds.length); disMask++) {
                        const dismissed = new Set(alwaysIds.filter((id, i) => disMask & (1 << i)));
                        const next = nextProactiveHint(hints, detailed, dismissed);
                        if (anyTaskPending) {
                            expect(next).not.toBe(null);
                            const d = decide({hints, detailed, dismissed});
                            if (d.action && d.action.kind === 'alert') {
                                // Só ordem pode alertar aqui (cumpriu uma posterior
                                // antes de uma anterior do mesmo personagem).
                                expect(d.action.info.kind).toBe('order');
                            } else {
                                expect(d.action).toEqual({kind: 'hint', hint: next});
                            }
                        }
                        checked++;
                    }
                }
            });
        });
        expect(checked).toBeGreaterThan(100);
    });

    it('I2 sem alertas possíveis (tarefas cumpridas só em ordem): action é sempre hint', () => {
        // Prefixo cumprido: nenhuma posterior feita antes de anterior => sem
        // alerta de ordem; a proativa tem que sair como 'hint'.
        const hints = [intro, manual('h2'), blockHint('h3'), manual('h4'), blockHint('h5', {blockTypes: ['up']})];
        [[], ['forward']].forEach(function (doneTypes) {
            const detailed = detailedFor([[onflag()].concat(doneTypes.map((t) => b(t, 1)))]);
            [[], ['h1'], ['h2'], ['h1', 'h2'], ['h1', 'h2', 'h4'], ['h4']].forEach(function (ids) {
                const d = decide({hints, detailed, dismissed: new Set(ids)});
                expect(d.action && d.action.kind).toBe('hint');
                expect(d.buttonDot).toBe(true);
            });
        });
    });
});
