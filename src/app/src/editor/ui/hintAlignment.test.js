/**
 * Fase 3 - alinhamento posição a posição (shared/hintAlignment.mjs) e os
 * tokens do manifesto detalhado (shared/detailedManifest.mjs#tokenizeScript/
 * scriptTokens). As dicas aqui são montadas como o gerador vai montar:
 * when.expected.script = tokens do projeto do PROFESSOR (mesmo tokenizador
 * do aluno), uma dica por posição (covered: [i]) salvo quando o teste diz
 * outra coisa.
 */
import {describe, expect, it} from 'vitest';
import {project, b, repeat, onflag, onclick, onmessage, script} from '../../../../../shared/testing/projectFixtures.mjs';
import {
    computeDetailedManifest, scriptTokens, toExpectedTokens, tokenizeScript, REPEAT_CLOSE,
} from '../../../../../shared/detailedManifest.mjs';
import {alignScript, evaluateExpectedHints, hasExpected, ALIGN_STATES} from '../../../../../shared/hintAlignment.mjs';

const SCENE = 'Bosque.svg';
const RUBY = 'HY-Ruby.svg';
const GATO = 'HY-Gato.svg';

/** Projeto de uma cena com a Ruby (ou várias cópias/personagens). */
function proj (rubyScripts, extraSprites) {
    return project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: rubyScripts}].concat(extraSprites || [])}]);
}

/**
 * Dicas "como o gerador faria": uma por posição (exceto '/repeat') de cada
 * script com gatilho do projeto do professor. opts.group = covered múltiplo
 * (uma dica por script cobrindo tudo); opts.occurrence = grava
 * characterOccurrence.
 */
function hintsFrom (teacherProject, opts) {
    opts = opts || {};
    const det = computeDetailedManifest(teacherProject);
    const hints = [];
    det.scenes.forEach(function (scene) {
        scene.characters.forEach(function (ch) {
            const seen = new Map();
            ch.scripts.forEach(function (sc) {
                const exp = toExpectedTokens(sc.tokens);
                const key = JSON.stringify([sc.trigger, sc.triggerArg, exp]);
                seen.set(key, (seen.get(key) || 0) + 1);
                const base = {
                    type: 'character_missing_block_type',
                    sceneMd5: scene.sceneMd5,
                    sceneOccurrence: scene.sceneOccurrence,
                    characterMd5: ch.characterMd5,
                    blockTypes: [],
                };
                if (opts.occurrence) base.characterOccurrence = ch.characterOccurrence;
                const expected = (covered) => {
                    const e = {trigger: sc.trigger, triggerArg: sc.triggerArg, script: exp, covered};
                    if (seen.get(key) > 1) e.occurrence = seen.get(key);
                    return e;
                };
                const positions = exp.map((t, i) => i).filter((i) => exp[i].type !== REPEAT_CLOSE);
                if (opts.group) {
                    hints.push({id: 'h' + (hints.length + 1), text: '', when: Object.assign({}, base, {expected: expected(positions)})});
                } else {
                    positions.forEach(function (i) {
                        hints.push({
                            id: 'h' + (hints.length + 1),
                            text: '',
                            when: Object.assign({}, base, {blockTypes: [exp[i].type], expected: expected([i])}),
                        });
                    });
                }
            });
        });
    });
    return hints;
}

/** {hintId: resultado} - Map -> objeto pra comparar fácil. */
function evaluate (hints, studentProject) {
    return Object.fromEntries(evaluateExpectedHints(hints, computeDetailedManifest(studentProject)));
}

function states (results) {
    return Object.fromEntries(Object.entries(results).map(([id, r]) => [id, r.state]));
}

function only (results, state) {
    return Object.entries(results).filter(([, r]) => r.state === state);
}

// ---------------------------------------------------------------------------

describe('detailedManifest - tokens e scriptIndex', () => {
    it('tokeniza na ordem, com path original, marcadores de repeat e sem gatilho/carets', () => {
        const p = proj([
            [], // vazio: não vira item, mas conta no scriptIndex
            [b('forward', 2)], // solto (D1): idem
            [b('caretstart'), onflag(), b('say', 'Oi'), repeat(4, [b('forward', 2), b('caretcmd'), b('hop', 1)]), b('wait', 10)],
        ]);
        const sc = computeDetailedManifest(p).scenes[0].characters[0].scripts;
        expect(sc).toHaveLength(1);
        expect(sc[0].scriptIndex).toBe(2);
        expect(sc[0].tokens).toEqual([
            {type: 'say', num: null, pending: null, unset: false, path: [2]},
            {type: 'repeat', num: 4, pending: null, unset: false, path: [3]},
            {type: 'forward', num: 2, pending: null, unset: false, path: [3, 0]},
            {type: 'hop', num: 1, pending: null, unset: false, path: [3, 2]},
            {type: REPEAT_CLOSE, num: null, pending: null, unset: false, path: [3]},
            {type: 'wait', num: 10, pending: null, unset: false, path: [4]},
        ]);
        // caminho legado intacto
        expect(sc[0].blocks.map((x) => x.type)).toEqual(['say', 'repeat', 'forward', 'hop', 'wait']);
    });

    it('estados pending/unset; blocks não muda (say padrão continua fora)', () => {
        const p = proj([[onflag(), b('forward', 'unconfirmed:3'), b('wait', 'null'), b('setspeed', 3),
            b('setspeed', 'unconfirmed:3'), b('say', 'olá'), b('say', ''), b('repeat', 'unconfirmed:4', []), b('hide')]]);
        const sc = computeDetailedManifest(p).scenes[0].characters[0].scripts[0];
        expect(sc.tokens.map((t) => [t.type, t.num, t.pending, t.unset])).toEqual([
            ['forward', null, 3, false],
            ['wait', null, null, true],
            ['setspeed', null, null, true],
            ['setspeed', null, 3, false],
            ['say', null, null, true],
            ['say', null, null, true],
            ['repeat', null, 4, false],
            [REPEAT_CLOSE, null, null, false],
            ['hide', null, null, false],
        ]);
        expect(sc.blocks.map((x) => x.type)).toEqual(['forward', 'wait', 'setspeed', 'setspeed', 'say', 'repeat', 'hide']);
        expect(sc.blocks[2].num).toBe(3); // legado: setspeed 3 continua num 3 em blocks
    });

    it('scriptTokens(tupla crua) == toExpectedTokens(tokens do manifesto); say sem valor', () => {
        const raw = [onflag(), b('say', 'Bom dia'), repeat(2, [b('forward', 3)]), b('wait', 'null')];
        const fromManifest = toExpectedTokens(computeDetailedManifest(proj([raw])).scenes[0].characters[0].scripts[0].tokens);
        expect(scriptTokens(raw)).toEqual(fromManifest);
        expect(scriptTokens(raw)).toEqual([
            {type: 'say', num: null}, {type: 'repeat', num: 2}, {type: 'forward', num: 3},
            {type: REPEAT_CLOSE, num: null}, {type: 'wait', num: null},
        ]);
        expect(scriptTokens(null)).toEqual([]);
        expect(scriptTokens([b('caretstart')])).toEqual([]);
        expect(tokenizeScript('x')).toEqual([]);
        expect(toExpectedTokens(null)).toEqual([]);
        expect(toExpectedTokens([{type: 'hide'}])).toEqual([{type: 'hide', num: null}]);
    });
});

// ---------------------------------------------------------------------------

describe('alignScript', () => {
    const T = (...xs) => xs.map(([type, num]) => ({type, num: num === undefined ? null : num}));
    const S = (...xs) => xs.map(([type, num, extra]) => Object.assign({type, num: num === undefined ? null : num, pending: null, unset: false, path: []}, extra));

    it('valor igual pesa mais que só tipo', () => {
        const al = alignScript(T(['forward', 3]), S(['forward', 5], ['forward', 3]));
        expect(al.teacherToStudent).toEqual([1]);
        expect(al.studentToTeacher).toEqual([-1, 0]);
        expect([al.score, al.exact]).toEqual([2, 1]);
    });

    it('troca do mesmo tipo: prefere um par exato a dois pares só de tipo', () => {
        const al = alignScript(T(['forward', 3], ['forward', 5]), S(['forward', 5], ['forward', 3]));
        expect(al.teacherToStudent).toEqual([1, -1]);
    });

    it('nunca pareia dentro de repeat com fora de repeat', () => {
        const teacher = T(['forward', 2], ['repeat', 4], ['hop', 1], [REPEAT_CLOSE]);
        const student = S(['repeat', 4], ['forward', 2], ['hop', 1], [REPEAT_CLOSE]);
        const al = alignScript(teacher, student);
        expect(al.teacherToStudent).toEqual([-1, 0, 2, 3]);
    });

    it('pending/unset pareia por tipo com peso de "só tipo"', () => {
        const al = alignScript(T(['forward', 3]), S(['forward', null, {pending: 3}]));
        expect(al.teacherToStudent).toEqual([0]);
        expect([al.score, al.exact]).toEqual([1, 0]);
    });

    it('defensivo: fechamento órfão, repeat sem fechamento, entradas inválidas', () => {
        expect(alignScript(T([REPEAT_CLOSE], ['hide']), S([REPEAT_CLOSE], ['hide'])).teacherToStudent).toEqual([-1, 1]);
        expect(alignScript(T(['repeat', 2], ['hide']), S(['repeat', 2], ['hide'])).teacherToStudent).toEqual([0, 1]);
        // repeat fechado x sem fechamento: abre pareia, fechamento fica sem par
        expect(alignScript(T(['repeat', 2], [REPEAT_CLOSE]), S(['repeat', 2])).teacherToStudent).toEqual([0, -1]);
        expect(alignScript(null, undefined)).toEqual({teacherToStudent: [], studentToTeacher: [], score: 0, exact: 0});
    });
});

// ---------------------------------------------------------------------------

/** Projeto "completo" do professor usado pelos testes de invariante. */
function teacherProject () {
    return project([
        {md5: SCENE, sprites: [
            {md5: RUBY, name: 'Ruby', scripts: [
                script(onflag(), b('say', 'Oi'), b('forward', 3), repeat(2, [b('hop', 2), b('wait', 5)]), b('setspeed', 2), b('message', 'azul')),
                script(onclick(), b('grow', 2), b('shrink', 2)),
            ]},
            {md5: GATO, name: 'Gato', scripts: [
                script(onmessage('azul'), b('back', 4), b('say', 'Miau'), b('forward', 4)),
            ]},
        ]},
        {md5: 'Praia.svg', sprites: [
            {md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('left', 1), b('right', 1))]},
        ]},
    ]);
}

describe('evaluateExpectedHints - estados básicos', () => {
    it('o projeto do PRÓPRIO professor -> todas done', () => {
        const p = teacherProject();
        const hints = hintsFrom(p);
        expect(hints.length).toBeGreaterThan(10);
        const r = evaluate(hints, p);
        expect(Object.keys(r)).toHaveLength(hints.length);
        expect(Object.values(r).every((x) => x.state === 'done')).toBe(true);
        expect(evaluate(hintsFrom(p, {group: true}), p)).toSatisfy((x) => Object.values(x).every((y) => y.state === 'done'));
    });

    it('pending: bloco que falta (missing), personagem/cena inexistente, script inexistente', () => {
        const t = proj([[onflag(), b('forward', 3), b('hop', 2)]]);
        const hints = hintsFrom(t);
        const r = evaluate(hints, proj([[onflag(), b('forward', 3)]]));
        expect(r.h1.state).toBe('done');
        expect(r.h2).toMatchObject({state: 'pending', reason: 'missing', blockType: 'hop', teacherIndex: 1, scriptIndex: 0, characterOccurrence: 1});
        expect(r.h2.position).toBeUndefined();

        const none = evaluate(hints, project([{md5: SCENE, sprites: []}]));
        expect(none.h1).toEqual({state: 'pending', reason: 'no_character', scriptIndex: null, characterOccurrence: null});
        expect(evaluate(hints, project([{md5: 'Outra.svg', sprites: [{md5: RUBY}]}])).h1.reason).toBe('no_character');
        expect(evaluateExpectedHints(hints, null).get('h1').reason).toBe('no_character');

        const noScript = evaluate(hints, proj([[onclick(), b('forward', 3), b('hop', 2)]]));
        expect(noScript.h1).toEqual({state: 'pending', reason: 'no_script', scriptIndex: null, characterOccurrence: 1});
    });

    it('pending/unset NUNCA é wrong_value', () => {
        const t = proj([[onflag(), b('forward', 3), b('say', 'Oi'), b('setspeed', 2), b('wait', 5)]]);
        const hints = hintsFrom(t);
        // recém-arrastado (valor padrão mascarado) - igual e diferente do pedido
        const r = evaluate(hints, proj([[onflag(), b('forward', 'unconfirmed:3'), b('say', 'olá'), b('setspeed', 3), b('wait', 'unconfirmed:1')]]));
        expect(r.h1).toMatchObject({state: 'pending', reason: 'unconfirmed', expected: 3, got: 3, position: {scriptIndex: 0, path: [1]}});
        expect(r.h2).toMatchObject({state: 'pending', reason: 'unset', blockType: 'say', position: {scriptIndex: 0, path: [2]}});
        expect(r.h3).toMatchObject({state: 'pending', reason: 'unset', expected: 2, got: null});
        expect(r.h4).toMatchObject({state: 'pending', reason: 'unconfirmed', expected: 5, got: 1});
        // numérico sem valor real (kind 'fill' do legado)
        expect(evaluate(hints, proj([[onflag(), b('forward', 'null'), b('say', 'x'), b('setspeed', 2), b('wait', 5)]])).h1)
            .toMatchObject({state: 'pending', reason: 'unset'});
        expect(only(evaluate(hints, proj([[onflag(), b('forward', 'unconfirmed:0'), b('say', 'hi'), b('setspeed', 'unconfirmed:3'), b('wait', 'null')]])), 'wrong_value')).toEqual([]);
    });

    it('say: qualquer texto não-padrão serve', () => {
        const hints = hintsFrom(proj([[onflag(), b('say', 'Bom dia')]]));
        expect(evaluate(hints, proj([[onflag(), b('say', 'Qualquer coisa')]])).h1.state).toBe('done');
        expect(evaluate(hints, proj([[onflag(), b('say', 'Hi ')]])).h1.state).toBe('pending');
    });

    it('professor com numérico sem valor = qualquer valor serve', () => {
        const hints = hintsFrom(proj([[onflag(), b('forward', 'null')]]));
        expect(hints[0].when.expected.script).toEqual([{type: 'forward', num: null}]);
        expect(evaluate(hints, proj([[onflag(), b('forward', 7)]])).h1.state).toBe('done');
    });

    it('repeat: valor do repeat conferido; repeat pendente não é erro', () => {
        const hints = hintsFrom(proj([[onflag(), repeat(4, [b('hop', 1)])]]));
        const r = evaluate(hints, proj([[onflag(), repeat(3, [b('hop', 1)])]]));
        expect(r.h1).toMatchObject({state: 'wrong_value', blockType: 'repeat', expected: 4, got: 3, position: {path: [1]}});
        expect(r.h2.state).toBe('done');
        expect(evaluate(hints, proj([[onflag(), b('repeat', 'unconfirmed:4', [b('hop', 1)])]])).h1.reason).toBe('unconfirmed');
    });

    it('ALIGN_STATES e hasExpected', () => {
        expect(ALIGN_STATES).toEqual(['done', 'pending', 'wrong_value', 'wrong_order', 'extra_block']);
        expect(hasExpected(null)).toBe(false);
        expect(hasExpected({when: {type: 'character_missing_block_type'}})).toBe(false);
        expect(hasExpected({when: {type: 'character_missing', expected: {trigger: 'onflag', script: []}}})).toBe(false);
        expect(hasExpected({when: {type: 'character_missing_block_type', expected: {trigger: 'onflag', script: []}}})).toBe(true);
    });

    it('dicas sem when.expected ficam fora do Map (caminho legado)', () => {
        const hints = hintsFrom(proj([[onflag(), b('forward', 3)]]));
        hints.push({id: 'legacy', when: {type: 'character_missing_block_type', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY, blockTypes: ['forward']}});
        hints.push(null);
        const r = evaluateExpectedHints(hints, computeDetailedManifest(proj([[onflag(), b('forward', 3)]])));
        expect([...r.keys()]).toEqual(['h1']);
        expect(evaluateExpectedHints(null, null).size).toBe(0);
    });

    it('covered: inválidos/duplicados/fechamento ignorados; vazio = "crie o script"', () => {
        const t = proj([[onflag(), repeat(2, [b('hop', 1)])]]);
        const exp = scriptTokens(t.page1.sprite1_1.scripts[0]);
        const mk = (covered) => ({id: 'x', when: {type: 'character_missing_block_type', sceneMd5: SCENE, characterMd5: RUBY,
            expected: {trigger: 'onflag', script: exp, covered}}});
        const student = proj([[onflag(), repeat(2, [b('hop', 9)])]]);
        expect(evaluate([mk([2, 99, -1, 1.5, 'a', 0, 0])], student).x.state).toBe('done'); // 2 = '/repeat' ignorado
        expect(evaluate([mk([1, 1])], student).x).toMatchObject({state: 'wrong_value', teacherIndex: 1});
        expect(evaluate([mk([])], student).x.state).toBe('done');
        expect(evaluate([mk(undefined)], proj([[onclick()]])).x.reason).toBe('no_script');
    });
});

describe('evaluateExpectedHints - falhas F3..F7', () => {
    it('F3: valor certo + errado do mesmo tipo -> extra_block (nunca done silencioso)', () => {
        const hints = hintsFrom(proj([[onflag(), b('forward', 3)]]));
        const a = evaluate(hints, proj([[onflag(), b('forward', 3), b('forward', 5)]]));
        expect(a.h1).toMatchObject({state: 'extra_block', blockType: 'forward', position: {scriptIndex: 0, path: [2]}, extraCount: 1});
        const c = evaluate(hints, proj([[onflag(), b('forward', 5), b('forward', 3)]]));
        expect(c.h1).toMatchObject({state: 'extra_block', position: {path: [1]}});
    });

    it('F4: a 2ª ocorrência tem o valor DELA conferido', () => {
        const hints = hintsFrom(proj([[onflag(), b('say', 'Oi'), b('forward', 3), b('forward', 5)]]));
        const r = evaluate(hints, proj([[onflag(), b('say', 'Oi'), b('forward', 3), b('forward', 7)]]));
        expect(states(r)).toEqual({h1: 'done', h2: 'done', h3: 'wrong_value'});
        expect(r.h3).toMatchObject({expected: 5, got: 7, position: {path: [3]}, teacherIndex: 2});
    });

    it('F5: mesmo bloco com valores diferentes - cada um conferido', () => {
        const hints = hintsFrom(proj([[onflag(), b('forward', 2), b('wait', 1), b('forward', 4)]]));
        expect(states(evaluate(hints, proj([[onflag(), b('forward', 2), b('wait', 1), b('forward', 4)]])))).toEqual({h1: 'done', h2: 'done', h3: 'done'});
        const swapped = evaluate(hints, proj([[onflag(), b('forward', 4), b('wait', 1), b('forward', 2)]]));
        expect(swapped.h1).toMatchObject({state: 'wrong_value', expected: 2, got: 4});
        expect(swapped.h3).toMatchObject({state: 'wrong_value', expected: 4, got: 2});
        const same = evaluate(hints, proj([[onflag(), b('forward', 2), b('wait', 1), b('forward', 2)]]));
        expect(states(same)).toEqual({h1: 'done', h2: 'done', h3: 'wrong_value'});
    });

    it('F6: ordem trocada -> wrong_order apontando o bloco do aluno', () => {
        const hints = hintsFrom(proj([[onflag(), b('say', 'Oi'), b('forward', 3), b('hop', 2)]]));
        const r = evaluate(hints, proj([[onflag(), b('say', 'Oi'), b('hop', 2), b('forward', 3)]]));
        expect(states(r)).toEqual({h1: 'done', h2: 'done', h3: 'wrong_order'});
        expect(r.h3).toMatchObject({blockType: 'hop', teacherIndex: 2, position: {scriptIndex: 0, path: [2]}});
    });

    it('F7: fora/dentro do repeat -> wrong_order', () => {
        const hints = hintsFrom(proj([[onflag(), repeat(4, [b('forward', 2)])]]));
        const out = evaluate(hints, proj([[onflag(), b('forward', 2), repeat(4, [])]]));
        expect(states(out)).toEqual({h1: 'done', h2: 'wrong_order'});
        expect(out.h2.position.path).toEqual([1]);
        expect(evaluate(hints, proj([[onflag(), repeat(4, []), b('forward', 2)]])).h2.position.path).toEqual([2]);

        const outside = hintsFrom(proj([[onflag(), repeat(4, [b('hop', 1)]), b('forward', 2)]]));
        const inside = evaluate(outside, proj([[onflag(), repeat(4, [b('hop', 1), b('forward', 2)])]]));
        expect(inside.h3).toMatchObject({state: 'wrong_order', position: {path: [1, 1]}});
    });

    it('wrong_order reivindica cada bloco do aluno uma vez só, preferindo o de valor igual', () => {
        const hints = hintsFrom(proj([[onflag(), repeat(2, [b('forward', 3), b('forward', 5)])]]));
        const one = evaluate(hints, proj([[onflag(), b('forward', 3), repeat(2, [])]]));
        expect(states(one)).toEqual({h1: 'done', h2: 'wrong_order', h3: 'pending'});
        const two = evaluate(hints, proj([[onflag(), b('forward', 5), b('forward', 3), repeat(2, [])]]));
        expect(two.h2.position.path).toEqual([2]);
        expect(two.h3.position.path).toEqual([1]);
    });

    it('onmessage: mensagem diferente não casa; triggerArg null = qualquer', () => {
        const hints = hintsFrom(proj([[onmessage('azul'), b('forward', 3)]]));
        expect(hints[0].when.expected.triggerArg).toBe('azul');
        expect(evaluate(hints, proj([[onmessage('vermelho'), b('forward', 3)]])).h1.reason).toBe('no_script');
        expect(evaluate(hints, proj([[onmessage('vermelho'), b('forward', 3)], [onmessage('azul'), b('forward', 3)]])).h1)
            .toMatchObject({state: 'done', scriptIndex: 1});
        const any = hintsFrom(proj([[onmessage('null'), b('forward', 3)]]));
        expect(any[0].when.expected.triggerArg).toBe(null);
        expect(evaluate(any, proj([[onmessage('vermelho'), b('forward', 3)]])).h1.state).toBe('done');
    });
});

describe('evaluateExpectedHints - extra_block', () => {
    const t = proj([[onflag(), b('say', 'Oi'), b('forward', 3), b('hop', 2)]]);
    const hints = hintsFrom(t);

    it('só quando todas as posições do professor estão pareadas', () => {
        const r = evaluate(hints, proj([[onflag(), b('say', 'Oi'), b('forward', 3), b('forward', 9)]]));
        // hop falta -> o forward a mais NÃO é sobra ainda (pode ser o hop que falta, em outro tipo)
        expect(states(r)).toEqual({h1: 'done', h2: 'done', h3: 'pending'});
    });

    it('nunca say; nunca tipo que o professor não usa no script', () => {
        expect(states(evaluate(hints, proj([[onflag(), b('say', 'Oi'), b('forward', 3), b('hop', 2), b('say', 'mais'), b('grow', 2)]]))))
            .toEqual({h1: 'done', h2: 'done', h3: 'done'});
    });

    it('ignora scripts com gatilho que o professor não tem e scripts que sobraram na atribuição', () => {
        const r = evaluate(hints, proj([
            [onflag(), b('say', 'Oi'), b('forward', 3), b('hop', 2)],
            [onclick(), b('forward', 1)],
            [onflag(), b('hop', 7)],
        ]));
        expect(states(r)).toEqual({h1: 'done', h2: 'done', h3: 'done'});
    });

    it('atribuída à 1ª dica (ordem do array) que cobre o tipo; prioridade abaixo de wrong_value', () => {
        const h = hintsFrom(proj([[onflag(), b('forward', 3), b('forward', 5)]]));
        const r = evaluate(h, proj([[onflag(), b('forward', 3), b('forward', 5), b('forward', 9), b('forward', 8)]]));
        expect(r.h1).toMatchObject({state: 'extra_block', extraCount: 2, position: {path: [3]}});
        expect(r.h2.state).toBe('done');
        // mesma ordem invertida no array -> a dona passa a ser a h2
        const rev = evaluate([h[1], h[0]], proj([[onflag(), b('forward', 3), b('forward', 5), b('forward', 9)]]));
        expect(rev.h2.state).toBe('extra_block');
        expect(rev.h1.state).toBe('done');
        // dica com wrong_value não vira extra_block
        const g = hintsFrom(proj([[onflag(), b('forward', 3), b('wait', 1)]]), {group: true});
        expect(evaluate(g, proj([[onflag(), b('forward', 3), b('wait', 2), b('forward', 4)]])).h1.state).toBe('wrong_value');
        expect(evaluate(g, proj([[onflag(), b('forward', 3), b('wait', 1), b('forward', 4)]])).h1.state).toBe('extra_block');
    });

    it('sobra num tipo que nenhuma dica cobre fica sem dona', () => {
        const exp = scriptTokens([onflag(), b('forward', 3), b('hop', 1)]);
        const h = [{id: 'only', when: {type: 'character_missing_block_type', sceneMd5: SCENE, characterMd5: RUBY,
            expected: {trigger: 'onflag', script: exp, covered: [0]}}}];
        expect(evaluate(h, proj([[onflag(), b('forward', 3), b('hop', 1), b('hop', 1)]])).only.state).toBe('done');
    });
});

describe('evaluateExpectedHints - prioridade', () => {
    const g = hintsFrom(proj([[onflag(), b('forward', 3), b('hop', 2), b('wait', 1), b('grow', 2)]]), {group: true});
    const g3 = hintsFrom(proj([[onflag(), b('forward', 3), b('hop', 2), b('wait', 1)]]), {group: true});

    it('pending > wrong_order > wrong_value > extra_block', () => {
        // grow falta (pending) + forward fora do lugar + wait errado
        expect(evaluate(g, proj([[onflag(), b('hop', 2), b('forward', 5), b('wait', 2)]])).h1).toMatchObject({state: 'pending', blockType: 'grow'});
        // forward fora do lugar + wait errado
        expect(evaluate(g3, proj([[onflag(), b('hop', 2), b('forward', 5), b('wait', 2)]])).h1).toMatchObject({state: 'wrong_order', blockType: 'forward'});
        // wait errado + sobra
        expect(evaluate(g3, proj([[onflag(), b('forward', 3), b('hop', 2), b('wait', 2), b('hop', 1)]])).h1).toMatchObject({state: 'wrong_value', blockType: 'wait'});
        // só sobra
        expect(evaluate(g3, proj([[onflag(), b('forward', 3), b('hop', 2), b('wait', 1), b('hop', 1)]])).h1).toMatchObject({state: 'extra_block', blockType: 'hop'});
    });

    it('empate de prioridade: a 1ª posição do professor', () => {
        const r = evaluate(g3, proj([[onflag(), b('forward', 4), b('hop', 3), b('wait', 1)]]));
        expect(r.h1).toMatchObject({state: 'wrong_value', blockType: 'forward', teacherIndex: 0});
    });
});

describe('evaluateExpectedHints - cópias e scripts repetidos', () => {
    const t = proj([[onflag(), b('forward', 3)]]);

    it('"qualquer cópia" escolhe a melhor; characterOccurrence fixa a cópia', () => {
        const student = proj([[]], [{md5: RUBY, name: 'Ruby2', scripts: [[onflag(), b('forward', 3)]]}]);
        const anyCopy = evaluate(hintsFrom(t), student);
        expect(anyCopy.h1).toMatchObject({state: 'done', characterOccurrence: 2, scriptIndex: 0});
        const fixed = evaluate(hintsFrom(t, {occurrence: true}), student);
        expect(fixed.h1).toMatchObject({state: 'pending', reason: 'no_script', characterOccurrence: 1});
        const h = hintsFrom(t, {occurrence: true});
        h[0].when.characterOccurrence = 3;
        expect(evaluate(h, student).h1.reason).toBe('no_character');
        // empate entre cópias -> a 1ª
        const tie = evaluate(hintsFrom(t), proj([[onflag(), b('forward', 3)]], [{md5: RUBY, scripts: [[onflag(), b('forward', 3)]]}]));
        expect(tie.h1.characterOccurrence).toBe(1);
        // cópia com valor errado perde para a cópia sem nada? não: wrong_value é não-pendente
        const partial = evaluate(hintsFrom(t), proj([[]], [{md5: RUBY, scripts: [[onflag(), b('forward', 1)]]}]));
        expect(partial.h1).toMatchObject({state: 'wrong_value', characterOccurrence: 2});
    });

    it('dois scripts do professor com o mesmo gatilho: atribuição gulosa de scripts distintos', () => {
        const h = hintsFrom(proj([[onflag(), b('forward', 3)], [onflag(), b('hop', 2)]]));
        expect(states(evaluate(h, proj([[onflag(), b('hop', 2)], [onflag(), b('forward', 3)]])))).toEqual({h1: 'done', h2: 'done'});
        const r = evaluate(h, proj([[onflag(), b('forward', 3), b('hop', 2)]]));
        expect(r.h1.state).toBe('done');
        expect(r.h2.reason).toBe('no_script');
    });

    it('scripts idênticos do professor -> expected.occurrence separa os grupos', () => {
        const h = hintsFrom(proj([[onflag(), b('forward', 3)], [onflag(), b('forward', 3)]]));
        expect(h[1].when.expected.occurrence).toBe(2);
        expect(evaluate(h, proj([[onflag(), b('forward', 3)]])).h2.reason).toBe('no_script');
        expect(states(evaluate(h, proj([[onflag(), b('forward', 3)], [onflag(), b('forward', 3)]])))).toEqual({h1: 'done', h2: 'done'});
    });
});

describe('determinismo e invariantes (I4/I5 em nível de alinhamento)', () => {
    it('mesma entrada -> mesmo resultado; dicas de outros personagens não interferem', () => {
        const p = teacherProject();
        const hints = hintsFrom(p);
        const student = proj([[onflag(), b('forward', 3), b('say', 'x'), repeat(2, [b('wait', 5)]), b('hop', 1)]]);
        const a = JSON.stringify(evaluate(hints, student));
        expect(JSON.stringify(evaluate(hints, student))).toBe(a);
        const rubyOnly = hints.filter((h) => h.when.characterMd5 === RUBY && h.when.sceneMd5 === SCENE);
        const reversedOthers = hints.filter((h) => !rubyOnly.includes(h)).reverse().concat(rubyOnly);
        const r1 = evaluate(hints, student);
        const r2 = evaluate(reversedOthers, student);
        rubyOnly.forEach((h) => expect(r2[h.id]).toEqual(r1[h.id]));
    });

    it('I4: mutar UM número no projeto do professor -> exatamente uma wrong_value naquele path', () => {
        const base = teacherProject();
        const hints = hintsFrom(base);
        const det = computeDetailedManifest(base);
        let checked = 0;
        det.scenes.forEach((scene, si) => scene.characters.forEach((ch, ci) => ch.scripts.forEach((sc) => {
            sc.tokens.forEach((tok) => {
                if (tok.num === null || tok.type === REPEAT_CLOSE) return;
                const mutated = JSON.parse(JSON.stringify(base));
                const page = mutated[mutated.pages[si]];
                const tuples = page[page.sprites[ci]].scripts[sc.scriptIndex];
                let block = tuples[tok.path[0]];
                for (let k = 1; k < tok.path.length; k++) block = block[4][tok.path[k]];
                block[1] = tok.type === 'setspeed' ? (tok.num + 1) % 3 : tok.num + 10;
                const r = evaluate(hints, mutated);
                const wrong = only(r, 'wrong_value');
                expect(wrong).toHaveLength(1);
                expect(wrong[0][1].position).toEqual({scriptIndex: sc.scriptIndex, path: tok.path});
                expect(Object.values(r).filter((x) => x.state !== 'done')).toHaveLength(1);
                checked++;
            });
        })));
        expect(checked).toBeGreaterThanOrEqual(10);
    });

    it('I5: trocar dois blocos vizinhos de lugar -> wrong_order (exatamente uma dica)', () => {
        const base = [onflag(), b('say', 'Oi'), b('forward', 3), b('hop', 2), b('wait', 1), b('grow', 2)];
        const hints = hintsFrom(proj([base]));
        for (let i = 1; i < base.length - 1; i++) {
            const swapped = base.slice();
            [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
            const r = evaluate(hints, proj([swapped]));
            expect(only(r, 'wrong_order')).toHaveLength(1);
            expect(Object.values(r).filter((x) => x.state !== 'done')).toHaveLength(1);
        }
    });

    it('I5: tirar um bloco de dentro do repeat -> wrong_order', () => {
        const hints = hintsFrom(teacherProject());
        const p = teacherProject();
        const sc = p.page1.sprite1_1.scripts[0]; // [onflag, say, forward, repeat[hop, wait], setspeed, message]
        const wait = sc[3][4].pop();
        sc.splice(4, 0, wait);
        const r = evaluate(hints, p);
        const wo = only(r, 'wrong_order');
        expect(wo).toHaveLength(1);
        expect(wo[0][1]).toMatchObject({blockType: 'wait', position: {scriptIndex: 0, path: [4]}});
        expect(Object.values(r).filter((x) => x.state !== 'done')).toHaveLength(1);
    });
});
