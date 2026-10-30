/**
 * Decisão D1: scripts "soltos" (primeiro bloco não é gatilho) nunca executam e
 * são ignorados por TODA a pontuação/requisitos/conclusão. `includeLooseScripts`
 * é o modo legado, só para o relatório de impacto.
 */
const { project, b, repeat, onflag, onclick, script } = require('../../../shared/testing/projectFixtures.mjs');
const { computeProjectManifest, compareManifests } = require('./assignmentScoring');

describe('computeProjectManifest - scripts soltos (D1)', () => {
    test('script solto não conta em blocks, hasLoop, ctScores', () => {
        const p = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [
            script(b('forward', 3), repeat(2, [b('wait', 1)]), b('say', 'Oi')),
        ] }] }]);
        const m = computeProjectManifest(p);
        expect(m.blocks.count).toBe(0);
        expect(m.blocks.byType).toEqual({});
        expect(m.ctScores).toEqual({ parallelism: 0, flowControl: 0, synchronization: 0, userInteractivity: 0, abstraction: 0, dataRepresentation: 0 });
    });

    test('sprite só com soltos não qualifica personagem nem cena, mas segue em present', () => {
        const p = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [script(b('forward', 3))] }] }]);
        const m = computeProjectManifest(p);
        expect(m.characters.count).toBe(0);
        expect(m.characters.used).toEqual([]);
        expect(m.scenes.count).toBe(0);
        expect(m.scenes.used).toEqual([]);
        expect(m.characters.present).toEqual(['A.svg']);
        expect(m.scenes.present).toEqual(['S.svg']);
    });

    test('mistura: só o script com gatilho conta; solto no mesmo sprite é ignorado', () => {
        const p = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [
            script(onflag(), b('forward', 3)),
            script(b('back', 9), repeat(4, [b('hop', 1)])),
        ] }] }]);
        const m = computeProjectManifest(p);
        expect(m.blocks.byType).toEqual({ onflag: 1, forward: 1 });
        expect(m.blocks.byTypeValue).toEqual({ forward: { 3: 1 } });
        expect(m.characters.count).toBe(1);
        expect(m.ctScores.flowControl).toBe(1); // sem loop: o repeat estava no script solto
        expect(m.ctScores.abstraction).toBe(0);
    });

    test('caret antes do gatilho não faz o script virar solto', () => {
        const p = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [
            [['caretstart', null, 0, 0], onclick(), b('forward', 2)],
        ] }] }]);
        const m = computeProjectManifest(p);
        expect(m.blocks.byType).toEqual({ onclick: 1, forward: 1 });
        expect(m.ctScores.userInteractivity).toBe(2);
    });

    test('aluno com bloco solto não cumpre requisito de bloco', () => {
        const ref = computeProjectManifest(project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [script(onflag(), b('forward', 3))] }] }]));
        const aluno = computeProjectManifest(project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [script(onflag()), script(b('forward', 3))] }] }]));
        expect(compareManifests(ref, aluno).completed).toBe(false);
    });

    test('includeLooseScripts:true restaura o comportamento legado', () => {
        const p = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [script(b('forward', 3))] }] }]);
        const m = computeProjectManifest(p, { includeLooseScripts: true });
        expect(m.blocks.byType).toEqual({ forward: 1 });
        expect(m.characters.count).toBe(1);
        expect(m.scenes.used).toEqual(['S.svg']);
    });
});
