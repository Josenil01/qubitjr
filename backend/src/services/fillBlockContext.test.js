'use strict';

const { fillBlockContext, fillCharacterOccurrence } = require('./hintsGeneration');
const { computeDetailedManifest } = require('./detailedManifest');
const fx = require('../../../shared/testing/projectFixtures.mjs');

// Cofrinho da missão de teste: bandeira -> say, wait, say ; clique -> grow.
function project() {
    return {
        pages: ['p1'],
        p1: {
            md5: 'Bedroom.svg',
            sprites: ['c1'],
            c1: {
                type: 'sprite',
                md5: 'HY-Cofre.svg',
                name: 'Cofrinho',
                scripts: [
                    [['onflag'], ['say', 'Oi'], ['wait', 20], ['say', 'Mais uma']],
                    [['onclick'], ['grow', 2]],
                ],
            },
        },
    };
}

const base = { sceneMd5: 'Bedroom.svg', sceneOccurrence: 1, characterMd5: 'HY-Cofre.svg' };
const hint = (blockTypes) => ({ text: 't', when: { type: 'character_missing_block_type', ...base, blockTypes } });

describe('detailedManifest scripts/blockCounts', () => {
    it('separa os scripts por gatilho e conta os blocos', () => {
        const c = computeDetailedManifest(project()).scenes[0].characters[0];
        expect(c.blockCounts.say).toBe(2);
        // pending (ver docblock de shared/detailedManifest.mjs) é um campo
        // só-cliente (Project.maskUnconfirmed) - do lado do servidor nunca
        // tem como ser diferente de null, mas a fonte única agora inclui o
        // campo nos dois lados, então o fixture precisa listá-lo também.
        // triggerArg (Fase 2, falha F8): nome da mensagem do onmessage -
        // null pros outros gatilhos.
        expect(c.scripts).toEqual([
            { trigger: 'onflag', triggerArg: null, blocks: [{ type: 'say', num: null, pending: null }, { type: 'wait', num: 20, pending: null }, { type: 'say', num: null, pending: null }] },
            { trigger: 'onclick', triggerArg: null, blocks: [{ type: 'grow', num: 2, pending: null }] },
        ]);
    });
});

describe('fillBlockContext', () => {
    it('numera a 2ª dica com o mesmo bloco (minCounts) e grava o gatilho', () => {
        const hints = fillBlockContext([hint(['say']), hint(['wait']), hint(['say']), hint(['grow'])], computeDetailedManifest(project()));
        expect(hints[0].when.trigger).toBe('onflag');
        expect(hints[0].when.minCounts).toBeUndefined();
        expect(hints[1].when.trigger).toBe('onflag');
        expect(hints[2].when.trigger).toBe('onflag');
        expect(hints[2].when.minCounts).toEqual({ say: 2 });
        expect(hints[3].when.trigger).toBe('onclick');
    });

    it('nunca exige mais ocorrências do que o professor tem', () => {
        const hints = fillBlockContext([hint(['grow']), hint(['grow'])], computeDetailedManifest(project()));
        expect(hints[1].when.minCounts).toBeUndefined();
    });

    it('o mesmo bloco em gatilhos diferentes conta relativo ao gatilho da dica', () => {
        const p = project();
        p.p1.c1.scripts = [[['onflag'], ['say', 'a']], [['onclick'], ['say', 'b']]];
        const hints = fillBlockContext([hint(['say']), hint(['say'])], computeDetailedManifest(p));
        expect(hints[0].when.trigger).toBe('onflag');
        expect(hints[1].when.trigger).toBe('onclick');
        expect(hints[1].when.minCounts).toBeUndefined(); // 1º say do onclick
    });

    it('ignora dicas de outros tipos e sobrescreve valores vindos da LLM', () => {
        const other = { text: 't', when: { type: 'scene_missing', sceneMd5: 'Bedroom.svg' } };
        const llm = hint(['grow']);
        llm.when.trigger = 'onflag';
        const out = fillBlockContext([other, llm], computeDetailedManifest(project()));
        expect(out[0].when.trigger).toBeUndefined();
        expect(out[1].when.trigger).toBe('onclick');
    });
});

describe('fillBlockContext - triggerExclusive', () => {
    it('só marca exclusivo quando o professor usa o tipo apenas naquele gatilho', () => {
        const hints = fillBlockContext([hint(['say']), hint(['grow'])], computeDetailedManifest(project()));
        expect(hints[0].when.triggerExclusive).toBe(true); // say só no onflag neste projeto
        expect(hints[1].when.triggerExclusive).toBe(true); // grow só no onclick
    });

    it('não é exclusivo se o mesmo bloco aparece em outro gatilho', () => {
        const p = project();
        p.p1.c1.scripts = [[['onflag'], ['say', 'a']], [['onclick'], ['say', 'b']]];
        const hints = fillBlockContext([hint(['say']), hint(['say'])], computeDetailedManifest(p));
        expect(hints[0].when.triggerExclusive).toBeUndefined();
        expect(hints[1].when.triggerExclusive).toBeUndefined();
    });
});

describe('say com o texto padrão não conta como feito', () => {
    const { computeProjectManifest } = require('./assignmentScoring');
    const say = (text) => ({
        pages: ['p1'],
        p1: { md5: 'Bedroom.svg', sprites: ['c1'], c1: { type: 'sprite', md5: 'HY-Cofre.svg', scripts: [[['onflag'], ['say', text]]] } },
    });

    it('scoring ignora say com o texto default (qualquer idioma/caixa)', () => {
        expect(computeProjectManifest(say('olá')).blocks.byType.say).toBeUndefined();
        expect(computeProjectManifest(say(' Hi ')).blocks.byType.say).toBeUndefined();
        expect(computeProjectManifest(say('Oi! Eu sou o cofrinho.')).blocks.byType.say).toBe(1);
    });

    it('detailedManifest também não lista o say não editado', () => {
        const c = computeDetailedManifest(say('olá')).scenes[0].characters[0];
        expect(c.blockTypes).not.toContain('say');
        expect(computeDetailedManifest(say('Bom dia!')).scenes[0].characters[0].blockTypes).toContain('say');
    });
});

// ---------------------------------------------------------------------------
// Fase 2 do sistema de dicas - F8 (onmessage por mensagem), F9 (cópias do
// mesmo personagem na cena) e F10 (blocos soltos ignorados). Projetos
// montados com shared/testing/projectFixtures.mjs.
// ---------------------------------------------------------------------------

const SCENE = 'Woods.svg';
const RUBY = 'HY-Ruby.svg';
const blockHint = (blockTypes, extra) => ({
    text: 't',
    when: { type: 'character_missing_block_type', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY, blockTypes, ...extra },
});
const oneScene = (sprites) => computeDetailedManifest(fx.project([{ md5: SCENE, sprites }]));

describe('F8/R2 - fillBlockContext conta por (gatilho, mensagem)', () => {
    // Professor: onmessage "azul" -> forward 1 ; onmessage "verde" -> forward 2, forward 3.
    const manifest = oneScene([{ md5: RUBY, name: 'Ruby', scripts: [
        [fx.onmessage('azul'), fx.b('forward', 1)],
        [fx.onmessage('verde'), fx.b('forward', 2), fx.b('forward', 3)],
    ] }]);

    it('o manifesto guarda triggerArg por script', () => {
        const ruby = manifest.scenes[0].characters[0];
        expect(ruby.scripts.map((s) => [s.trigger, s.triggerArg])).toEqual([['onmessage', 'azul'], ['onmessage', 'verde']]);
    });

    it('grava when.triggerArg e numera minCounts só dentro da MESMA mensagem', () => {
        const hints = fillBlockContext([blockHint(['forward']), blockHint(['forward']), blockHint(['forward'])], manifest);
        expect(hints.map((h) => h.when.triggerArg)).toEqual(['azul', 'verde', 'verde']);
        expect(hints.every((h) => h.when.trigger === 'onmessage')).toBe(true);
        // 1º forward do "azul" (k=1); 1º do "verde" (k=2 global, mas 1 dentro da
        // mensagem - antes saía minCounts {forward: 2} somando o do "azul": o
        // aluno precisaria de 2 forwards sob "verde" pra uma dica que descreve
        // o 1º); 2º do "verde".
        expect(hints[0].when.minCounts).toBeUndefined();
        expect(hints[1].when.minCounts).toBeUndefined();
        expect(hints[2].when.minCounts).toEqual({ forward: 2 });
    });

    it('triggerExclusive é por mensagem: o mesmo bloco sob OUTRA mensagem não é exclusivo', () => {
        const hints = fillBlockContext([blockHint(['forward'])], manifest);
        expect(hints[0].when.triggerExclusive).toBeUndefined();
        const only = oneScene([{ md5: RUBY, scripts: [[fx.onmessage('azul'), fx.b('hop', 1)], [fx.onmessage('verde'), fx.b('forward', 2)]] }]);
        const h = fillBlockContext([blockHint(['hop'])], only);
        expect(h[0].when).toMatchObject({ trigger: 'onmessage', triggerArg: 'azul', triggerExclusive: true });
    });

    it('blockTypes em duas mensagens diferentes = sem gatilho comum (nada de trigger/triggerArg)', () => {
        const m = oneScene([{ md5: RUBY, scripts: [[fx.onmessage('azul'), fx.b('hop', 1)], [fx.onmessage('verde'), fx.b('forward', 2)]] }]);
        const h = fillBlockContext([blockHint(['hop', 'forward'])], m);
        expect(h[0].when.trigger).toBeUndefined();
        expect(h[0].when.triggerArg).toBeUndefined();
    });

    it('onmessage sem mensagem escolhida (\'null\') e outros gatilhos não ganham triggerArg', () => {
        const m = oneScene([{ md5: RUBY, scripts: [[fx.onmessage('null'), fx.b('hop', 1)], [fx.onflag(), fx.b('forward', 2)]] }]);
        const h = fillBlockContext([blockHint(['hop']), blockHint(['forward'])], m);
        expect(h[0].when.trigger).toBe('onmessage');
        expect('triggerArg' in h[0].when).toBe(false);
        expect('triggerArg' in h[1].when).toBe(false);
    });

    it('sobrescreve um triggerArg vindo da LLM', () => {
        const llm = blockHint(['forward'], { trigger: 'onmessage', triggerArg: 'inventada' });
        expect(fillBlockContext([llm], manifest)[0].when.triggerArg).toBe('azul');
    });
});

describe('F9/R5 - fillCharacterOccurrence (cópias do mesmo personagem na cena)', () => {
    const twins = oneScene([
        { md5: RUBY, name: 'Ruby', scripts: [[fx.onflag(), fx.b('say', 'Oi')]] },
        { md5: RUBY, name: 'Ruby', scripts: [[fx.onclick(), fx.b('forward', 5), fx.b('forward', 5)]] },
    ]);

    it('o manifesto numera as cópias (characterOccurrence 1, 2)', () => {
        expect(twins.scenes[0].characters.map((c) => c.characterOccurrence)).toEqual([1, 2]);
    });

    it('grava characterOccurrence só quando o professor tem cópias repetidas', () => {
        const single = oneScene([{ md5: RUBY, scripts: [[fx.onflag(), fx.b('forward', 3)]] }]);
        const llmSent = blockHint(['forward'], { characterOccurrence: 2 }); // LLM mandou à toa
        const out = fillCharacterOccurrence([blockHint(['forward']), llmSent], single);
        expect('characterOccurrence' in out[0].when).toBe(false);
        expect('characterOccurrence' in out[1].when).toBe(false);
    });

    it('com cópias: escolhe a cópia que tem todos os blockTypes quando a LLM omite ou erra', () => {
        const out = fillCharacterOccurrence([
            blockHint(['say']),
            blockHint(['forward']),
            blockHint(['forward'], { characterOccurrence: 1 }), // a 1ª não tem forward
        ], twins);
        expect(out.map((h) => h.when.characterOccurrence)).toEqual([1, 2, 2]);
    });

    it('character_missing: a k-ésima dica de "coloque a Ruby" vira a cópia k', () => {
        const cm = () => ({ text: 't', when: { type: 'character_missing', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY } });
        const out = fillCharacterOccurrence([cm(), cm(), cm()], twins);
        expect(out.map((h) => h.when.characterOccurrence)).toEqual([1, 2, 2]);
    });

    it('fillBlockContext numera minCounts e escolhe o gatilho POR CÓPIA', () => {
        const hints = fillCharacterOccurrence([blockHint(['say']), blockHint(['forward']), blockHint(['forward'])], twins);
        fillBlockContext(hints, twins);
        expect(hints[0].when).toMatchObject({ characterOccurrence: 1, trigger: 'onflag' });
        expect(hints[1].when).toMatchObject({ characterOccurrence: 2, trigger: 'onclick' });
        expect(hints[1].when.minCounts).toBeUndefined();
        expect(hints[2].when.minCounts).toEqual({ forward: 2 });
    });
});

describe('F10 - blocos soltos do professor não viram dica', () => {
    it('um bloco só num script solto não conta pra minCounts nem para o gatilho', () => {
        const m = oneScene([{ md5: RUBY, scripts: [[fx.b('forward', 9)], [fx.onflag(), fx.b('forward', 3)]] }]);
        const ruby = m.scenes[0].characters[0];
        expect(ruby.blockCounts.forward).toBe(1);
        expect(ruby.blockArgs.forward).toEqual([3]);
        const h = fillBlockContext([blockHint(['forward']), blockHint(['forward'])], m);
        expect(h[0].when.trigger).toBe('onflag');
        expect(h[1].when.minCounts).toBeUndefined(); // nunca exige o forward solto
    });

    it('personagem só com blocos soltos fica sem script', () => {
        const m = oneScene([{ md5: RUBY, scripts: [[fx.b('forward', 9), fx.b('say', 'Oi')]] }]);
        const ruby = m.scenes[0].characters[0];
        expect(ruby.hasScript).toBe(false);
        expect(ruby).toMatchObject({ blockTypes: [], blockCounts: {}, blockArgs: {}, sayTexts: [], blockSequence: [], scripts: [] });
    });
});
