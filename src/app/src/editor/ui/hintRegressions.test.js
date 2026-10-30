import {describe, expect, it} from 'vitest';
import {hintConditionHolds, nextProactiveHint, expectedResultsFor, alignmentInfo} from './HintEngine.js';
import {project, b, repeat, onflag, onmessage} from '../../../../../shared/testing/projectFixtures.mjs';
import {computeDetailedManifest, scriptTokens} from '../../../../../shared/detailedManifest.mjs';

/**
 * Regressões R6 do sistema de dicas, montadas com projetos sintéticos
 * (shared/testing/projectFixtures.mjs). Convenção:
 *  - `it.fails`: descreve o comportamento CORRETO de um bug já confirmado.
 *    Passa HOJE (a asserção falha porque o bug existe); quando a correção
 *    entrar o teste passa a falhar e deve virar `it` normal.
 *  - `it` em 'limitações conhecidas do caminho legado': documenta o
 *    comportamento ANTIGO (passa hoje). As regressões reais dessas nascem na
 *    Fase 3, com when.expected.
 * Lembrete: hintConditionHolds === true significa dica AINDA pendente.
 */

const SCENE = 'Woods.svg';
const CHAR = 'HY-Ruby.svg';

function detailedFor (scripts, extraSprites) {
    return computeDetailedManifest(project([
        {md5: SCENE, sprites: [{md5: CHAR, name: 'Ruby', scripts}].concat(extraSprites || [])},
    ]));
}

function blockHint (id, extra) {
    return {
        id: id,
        when: Object.assign({
            type: 'character_missing_block_type',
            sceneMd5: SCENE,
            characterMd5: CHAR,
            blockTypes: ['forward'],
        }, extra),
    };
}

const intro = {id: 'h1', when: {type: 'mission_intro'}};
const manual = (id) => ({id: id, when: {type: 'manual'}});

// P1: a trava "só a dica mais antiga pendente" de AssignmentBadge.js#
// _evaluateHints agora mora em HintEngine.nextProactiveHint (Fase 1, R4).
// mission_intro/manual SEMPRE seguram a condição (true), então depois de
// dispensadas continuavam sendo a "primeira pendente" e travavam as outras.
// Corrigido na Fase 1 (R4 b): intro/manual dispensadas são puladas.
describe('P1: dica proativa travada por intro/manual dispensada', () => {
    const detailed = detailedFor([[onflag()]]); // tarefa (forward) ainda não feita

    it('com a intro dispensada e uma tarefa pendente, a proativa é a tarefa', () => {
        const task = blockHint('h2');
        const next = nextProactiveHint([intro, task], detailed, new Set(['h1']));
        expect(next && next.id).toBe('h2');
    });

    it('com uma dica manual dispensada no meio, a proativa é a tarefa seguinte', () => {
        const task = blockHint('h3');
        const next = nextProactiveHint([manual('h1'), manual('h2'), task], detailed, new Set(['h1', 'h2']));
        expect(next && next.id).toBe('h3');
    });

    it('sanidade: sem nada dispensado a intro é a proativa', () => {
        expect(nextProactiveHint([intro, blockHint('h2')], detailed, new Set()).id).toBe('h1');
    });
});

describe('P8: onmessage não confere QUAL mensagem', () => {
    it('blocos sob onmessage de OUTRA mensagem não resolvem a dica', () => {
        const hint = blockHint('h2', {trigger: 'onmessage', triggerArg: 'abrir'});
        const detailed = detailedFor([[onmessage('fechar'), b('forward', 3)]]);
        expect(hintConditionHolds(hint, detailed)).toBe(true);
    });
});

describe('P9: personagem repetido na cena, só a 1ª cópia é avaliada', () => {
    const twin = (scripts) => ({md5: CHAR, name: 'Ruby 2', scripts: scripts});

    it('(a) dica legada: blocos só na 2ª cópia contam como feita ("qualquer cópia")', () => {
        const detailed = detailedFor([[onflag()]], [twin([[onflag(), b('forward', 3)]])]);
        expect(hintConditionHolds(blockHint('h2'), detailed)).toBe(false);
    });

    it('(b) characterOccurrence: 2 avalia só a 2ª cópia', () => {
        // Blocos só na 1ª cópia; a dica da 2ª continua pendente.
        const detailed = detailedFor([[onflag(), b('forward', 3)]], [twin([[onflag()]])]);
        expect(hintConditionHolds(blockHint('h2', {characterOccurrence: 2}), detailed)).toBe(true);
    });
});

describe('P10: blocos soltos (sem gatilho) satisfazem dica sem when.trigger', () => {
    it('blocos só num script solto: a dica continua pendente', () => {
        const detailed = detailedFor([[b('forward', 3)]]);
        expect(hintConditionHolds(blockHint('h2'), detailed)).toBe(true);
    });
});

describe('limitações conhecidas do caminho legado', () => {
    // Comportamento ANTIGO, documentado - continua valendo para dicas SEM
    // when.expected. As regressões reais (com expected) estão em
    // 'Fase 3 - regressões com when.expected', no fim do arquivo.

    it('P3: valor certo + errado do mesmo tipo conta como feito (argsOk usa "contém")', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 3), b('forward', 5)]]);
        expect(hintConditionHolds(hint, detailed)).toBe(false);
    });

    it('P4: a 2ª ocorrência (minCounts) não confere o valor dela', () => {
        // Dica descreve o 2º forward (valor 5), mas o aluno tem 5 na 1ª posição e 9 na 2ª.
        const hint = blockHint('h2', {minCounts: {forward: 2}, blockArgs: {forward: 5}});
        const detailed = detailedFor([[onflag(), b('forward', 5), b('forward', 9)]]);
        expect(hintConditionHolds(hint, detailed)).toBe(false);
    });

    it('P5: sem blockArgs (professor usou o mesmo bloco com valores diferentes, fillBlockArgs não grava) qualquer valor serve', () => {
        // fillBlockArgs só grava quando o personagem do professor tem UM valor (size===1).
        const hint = blockHint('h2', {blockArgs: {}});
        const detailed = detailedFor([[onflag(), b('forward', 99)]]);
        expect(hintConditionHolds(hint, detailed)).toBe(false);
    });

    it('P6: ordem dos blocos dentro do script não é conferida', () => {
        const hint = blockHint('h2', {blockTypes: ['wait', 'say']});
        const detailed = detailedFor([[onflag(), b('say', 'Oi!'), b('wait', 10)]]); // invertido
        expect(hintConditionHolds(hint, detailed)).toBe(false);
    });

    it('P7: dentro/fora do repeat é indistinguível', () => {
        const hint = blockHint('h2', {blockTypes: ['repeat', 'forward']});
        const inside = detailedFor([[onflag(), repeat(4, [b('forward', 3)])]]);
        const outside = detailedFor([[onflag(), b('forward', 3), repeat(4, [b('wait', 1)])]]);
        expect(hintConditionHolds(hint, inside)).toBe(false);
        expect(hintConditionHolds(hint, outside)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Fase 3 (E6c): P3-P7 como regressões REAIS, com when.expected (alinhamento
// posição a posição, shared/hintAlignment.mjs). As "limitações conhecidas do
// caminho legado" acima continuam valendo para dicas SEM expected.
// ---------------------------------------------------------------------------

/**
 * Dica com when.expected a partir do script CRU do professor (scriptTokens -
 * o mesmo que o gerador grava). `covered` = posições que ESTA dica ensina.
 */
function expectedHint (id, teacherScript, covered) {
    const head = teacherScript[0];
    return blockHint(id, {
        blockTypes: [],
        trigger: head[0],
        expected: {
            trigger: head[0],
            triggerArg: head[0] === 'onmessage' ? head[1] : null,
            script: scriptTokens(teacherScript),
            covered: covered,
        },
    });
}

/** Estado do alinhamento de cada dica (todas avaliadas juntas, como no ciclo). */
function states (hints, detailed) {
    const results = expectedResultsFor(hints, detailed);
    return hints.map((h) => results.get(h.id).state);
}

describe('Fase 3 - regressões com when.expected', () => {
    it('P3: valor certo + valor errado do mesmo tipo NÃO é done silencioso', () => {
        const teacher = [onflag(), b('forward', 3)];
        const hint = expectedHint('h2', teacher, [0]);
        const detailed = detailedFor([[onflag(), b('forward', 3), b('forward', 5)]]);
        expect(hintConditionHolds(hint, detailed)).toBe(true);
        const info = alignmentInfo(hint, expectedResultsFor([hint], detailed).get('h2'));
        expect(info).toMatchObject({kind: 'extra', blockType: 'forward', position: {scriptIndex: 0, path: [2]}});
        // Só o valor errado: alerta de valor apontando o bloco.
        const wrongOnly = detailedFor([[onflag(), b('forward', 5)]]);
        expect(alignmentInfo(hint, expectedResultsFor([hint], wrongOnly).get('h2'))).toMatchObject({kind: 'value', expected: 3, got: 5});
        expect(hintConditionHolds(hint, detailedFor([[onflag(), b('forward', 3)]]))).toBe(false);
    });

    it('P4: a 2ª ocorrência tem o valor DELA conferido', () => {
        const teacher = [onflag(), b('forward', 3), b('forward', 5)];
        const hints = [expectedHint('h2', teacher, [0]), expectedHint('h3', teacher, [1])];
        const wrongSecond = detailedFor([[onflag(), b('forward', 3), b('forward', 9)]]);
        expect(states(hints, wrongSecond)).toEqual(['done', 'wrong_value']);
        const r = expectedResultsFor(hints, wrongSecond).get('h3');
        expect([r.expected, r.got, r.position.path]).toEqual([5, 9, [2]]);
        expect(states(hints, detailedFor([[onflag(), b('forward', 3), b('forward', 5)]]))).toEqual(['done', 'done']);
    });

    it('P5: mesmo bloco com valores diferentes no professor - cada um conferido', () => {
        const teacher = [onflag(), b('forward', 3), b('wait', 10), b('forward', 7)];
        const hints = [expectedHint('h2', teacher, [0]), expectedHint('h3', teacher, [1]), expectedHint('h4', teacher, [2])];
        expect(states(hints, detailedFor([[onflag(), b('forward', 3), b('wait', 10), b('forward', 99)]])))
            .toEqual(['done', 'done', 'wrong_value']);
        expect(states(hints, detailedFor([[onflag(), b('forward', 99), b('wait', 10), b('forward', 7)]])))
            .toEqual(['wrong_value', 'done', 'done']);
        expect(states(hints, detailedFor([[onflag(), b('forward', 3), b('wait', 10), b('forward', 7)]])))
            .toEqual(['done', 'done', 'done']);
    });

    it('P6: a ordem dos blocos dentro do script é conferida', () => {
        const teacher = [onflag(), b('wait', 10), b('say', 'Oi!')];
        const hints = [expectedHint('h2', teacher, [0]), expectedHint('h3', teacher, [1])];
        const swapped = detailedFor([[onflag(), b('say', 'Oi!'), b('wait', 10)]]);
        expect(states(hints, swapped)).toContain('wrong_order');
        expect(hints.some((h) => hintConditionHolds(h, swapped, expectedResultsFor(hints, swapped)))).toBe(true);
        expect(states(hints, detailedFor([[onflag(), b('wait', 10), b('say', 'Tchau')]]))).toEqual(['done', 'done']);
    });

    it('P7: dentro e fora do repeat são posições diferentes', () => {
        const teacher = [onflag(), repeat(4, [b('forward', 3)])];
        const hints = [expectedHint('h2', teacher, [0]), expectedHint('h3', teacher, [1])];
        const inside = detailedFor([[onflag(), repeat(4, [b('forward', 3)])]]);
        const outside = detailedFor([[onflag(), b('forward', 3), repeat(4, [b('wait', 1)])]]);
        expect(states(hints, inside)).toEqual(['done', 'done']);
        expect(states(hints, outside)[1]).toBe('wrong_order');
        expect(hintConditionHolds(hints[1], outside, expectedResultsFor(hints, outside))).toBe(true);
    });
});
