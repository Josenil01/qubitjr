'use strict';

const { fillBlockContext } = require('./hintsGeneration');
const { computeDetailedManifest } = require('./detailedManifest');

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
        expect(c.scripts).toEqual([
            { trigger: 'onflag', blocks: [{ type: 'say', num: null }, { type: 'wait', num: 20 }, { type: 'say', num: null }] },
            { trigger: 'onclick', blocks: [{ type: 'grow', num: 2 }] },
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
