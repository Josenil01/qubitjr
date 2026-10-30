/**
 * Sanidade do montador shared/testing/projectFixtures.mjs do lado do jest:
 * prova que o .mjs é transformado pelo babel do backend e que o projeto
 * sintético é lido pelos walkers reais.
 */
const { project, b, onflag, repeat } = require('../../../shared/testing/projectFixtures.mjs');
const { computeDetailedManifest } = require('./detailedManifest');
const { computeProjectManifest } = require('./assignmentScoring');

describe('shared/testing/projectFixtures (via jest)', () => {
    test('é consumível pelos manifestos do backend', () => {
        const p = project([
            { md5: 'Woods.svg', sprites: [{ md5: 'A.svg', name: 'Ana', scripts: [[onflag(), b('forward', 3), repeat(2, [b('say', 'Oi!')])]] }] },
        ]);
        const detailed = computeDetailedManifest(p);
        expect(detailed.scenes[0].characters[0].blockTypes).toEqual(['onflag', 'forward', 'repeat', 'say']);
        expect(computeProjectManifest(p).blocks.byType.say).toBe(1);
    });
});
