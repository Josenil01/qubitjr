const { project, b, onflag, script } = require('../../shared/testing/projectFixtures.mjs');
const scoring = require('../src/services/assignmentScoring');
const { parseArgs, diffRequirements, computeTemplateImpact, formatReport } = require('./requirementsImpact');

describe('requirementsImpact - parseArgs', () => {
    test('padrão é dry-run', () => {
        expect(parseArgs([], {}).write).toBe(false);
    });
    test('--write sem CONFIRM_BACKFILL=yes aborta', () => {
        expect(() => parseArgs(['--write'], {})).toThrow(/CONFIRM_BACKFILL/);
        expect(() => parseArgs(['--write'], { CONFIRM_BACKFILL: 'sim' })).toThrow(/CONFIRM_BACKFILL/);
    });
    test('--write com confirmação passa', () => {
        expect(parseArgs(['--write'], { CONFIRM_BACKFILL: 'yes' }).write).toBe(true);
    });
    test('argumento desconhecido', () => {
        expect(() => parseArgs(['--x'], {})).toThrow();
    });
});

describe('requirementsImpact - diffRequirements', () => {
    test('idênticos => vazio', () => {
        expect(diffRequirements({ a: { b: 1 } }, { a: { b: 1 } })).toEqual([]);
    });
    test('diff campo a campo, incluindo campos que somem', () => {
        const d = diffRequirements({ blocks: { count: 3, byType: { forward: 1, back: 2 } } }, { blocks: { count: 1, byType: { forward: 1 } } });
        expect(d).toEqual([
            { field: 'blocks.byType.back', before: 2, after: undefined },
            { field: 'blocks.count', before: 3, after: 1 },
        ]);
    });
    test('arrays são comparados por conteúdo', () => {
        expect(diffRequirements({ s: { used: ['A'] } }, { s: { used: [] } })).toHaveLength(1);
    });
});

describe('requirementsImpact - computeTemplateImpact', () => {
    const withLoose = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [script(onflag(), b('forward', 3)), script(b('back', 2))] }] }]);
    const clean = project([{ md5: 'S.svg', sprites: [{ md5: 'A.svg', scripts: [script(onflag(), b('forward', 3))] }] }]);
    const tpl = () => ({ id: 1, project_name: 'M', requirements: scoring.computeProjectManifest(withLoose, { includeLooseScripts: true }) });

    test('referência com solto => requisitos mudam e aluno ao vivo sem o solto continua concluindo', () => {
        const r = computeTemplateImpact(tpl(), withLoose, [{ json: clean, frozen: false }], scoring);
        expect(r.diffs.map((d) => d.field)).toContain('blocks.byType.back');
        expect(r.drift).toBe(false);
        // antes: aluno não tinha 'back' => incompleto; agora requisito novo não exige => completo
        expect(r.students).toMatchObject({ live: 1, liveChanged: 1, becameComplete: 1, becameIncomplete: 0 });
    });
    test('congelado não muda e é contado', () => {
        const r = computeTemplateImpact(tpl(), withLoose, [{ json: clean, frozen: true }, { json: null, frozen: false }], scoring);
        expect(r.students).toMatchObject({ frozen: 1, live: 0, liveChanged: 0, frozenWouldFail: 0, unreadable: 1 });
    });
    test('referência sem solto => sem diff', () => {
        const t = { id: 2, requirements: scoring.computeProjectManifest(clean) };
        expect(computeTemplateImpact(t, clean, [], scoring).diffs).toEqual([]);
    });
    test('sem projeto de referência', () => {
        const r = computeTemplateImpact(tpl(), null, [], scoring);
        expect(r.hasReference).toBe(false);
        expect(formatReport([r])).toMatch(/SEM projeto de referência/);
    });
    test('relatório nunca contém ids de aluno', () => {
        const r = computeTemplateImpact(tpl(), withLoose, [{ json: clean, frozen: false }], scoring);
        expect(formatReport([r])).toMatch(/Missões com requisitos DIFERENTES: 1/);
    });
});
