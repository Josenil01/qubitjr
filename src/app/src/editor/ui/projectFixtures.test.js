import {describe, expect, it} from 'vitest';
import {project, b, repeat, onflag, onclick, onmessage} from '../../../../../shared/testing/projectFixtures.mjs';
import {computeDetailedManifest} from '../../../../../shared/detailedManifest.mjs';
import {computeProjectManifest} from '../../../../../shared/assignmentScoring.mjs';

/** Sanidade do montador de projetos sintéticos: os manifestos reais o leem como esperado. */
describe('projectFixtures', () => {
    const p = project([
        {md5: 'Woods.svg', sprites: [
            {md5: 'A.svg', name: 'Ana', scripts: [
                [onflag(), b('forward', 3), repeat(4, [b('wait', 10), b('say', 'Oi!')])],
                [onmessage('go'), b('grow', 'unconfirmed:2')],
                [b('hop', 1)], // script solto, sem gatilho
            ]},
            {md5: 'B.svg', name: 'Beto', scripts: []},
        ]},
        {md5: 'Woods.svg', sprites: [{md5: 'A.svg', scripts: [[onclick(), b('say', 'olá')]]}]},
    ]);

    it('gera ids determinísticos e o formato esperado', () => {
        expect(p.pages).toEqual(['page1', 'page2']);
        expect(p.page1.sprites).toEqual(['sprite1_1', 'sprite1_2']);
        expect(p.page1.sprite1_1).toMatchObject({type: 'sprite', md5: 'A.svg', name: 'Ana'});
        expect(project([{md5: 'Woods.svg', sprites: []}])).toEqual(project([{md5: 'Woods.svg', sprites: []}]));
    });

    it('computeDetailedManifest lê cenas, gatilhos, repeat aninhado, pendente e ignora o solto', () => {
        const d = computeDetailedManifest(p);
        expect(d.scenes.map((s) => s.sceneOccurrence)).toEqual([1, 2]);
        const ana = d.scenes[0].characters[0];
        expect(ana.characterName).toBe('Ana');
        // Fase 2 (falha F10, decisão D1): o script solto [hop 1] nunca
        // executa, então some de TODOS os agregados - nem script com
        // trigger null, nem hop em blockArgs/blockTypes.
        expect(ana.scripts.map((s) => s.trigger)).toEqual(['onflag', 'onmessage']);
        expect(ana.scripts.map((s) => s.triggerArg)).toEqual([null, 'go']);
        expect(ana.scripts[0].blocks.map((x) => x.type)).toEqual(['forward', 'repeat', 'wait', 'say']);
        expect(ana.blockArgs).toEqual({forward: [3], repeat: [4], wait: [10]});
        expect(ana.blockTypes).not.toContain('hop');
        expect(ana.messagesReceived).toEqual(['go']);
        expect(ana.scripts[1].blocks[0]).toMatchObject({type: 'grow', num: null, pending: 2});
        expect(d.scenes[0].characters[1].hasScript).toBe(false);
        // 'olá' é o texto padrão do say: não conta como feito.
        expect(d.scenes[1].characters[0].blockTypes).toEqual(['onclick']);
    });

    it('computeProjectManifest conta blocos (inclusive aninhados)', () => {
        const m = computeProjectManifest(p);
        expect(m.blocks.byType.say).toBe(1);
        expect(m.blocks.byType.wait).toBe(1);
        expect(m.blocks.byTypeValue.forward).toEqual({3: 1});
    });
});
