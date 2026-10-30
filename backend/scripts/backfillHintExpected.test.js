'use strict';

/**
 * backfillHintExpected.test.js - lógica pura da migração de when.expected
 * (backend/scripts/backfillHintExpected.js) contra os fixtures ANONIMIZADOS
 * reais (shared/testing/fixtures/*.json) e projetos sintéticos. Nenhum teste
 * aqui toca a rede/Supabase: writeMission roda com um cliente FALSO.
 *
 * Também é o I1 dos fixtures "com expected do backfill": o vitest
 * (hintInvariants.test.js) não consegue importar buildExpectedForHints
 * (CommonJS do backend), então o invariante "toda dica migrada dá done no
 * projeto do professor" mora aqui.
 */

const fs = require('fs');
const path = require('path');
const {
    parseArgs, planMission, mergeExpected, assertOnlyExpectedAdded, summarize, formatReport, writeMission, projectSavedMs,
} = require('./backfillHintExpected');
const { buildExpectedForHints } = require('../src/services/hintsGeneration');
const { computeDetailedManifest } = require('../src/services/detailedManifest');
const { evaluateExpectedHints, ALIGN_STATES } = require('../src/services/hintAlignment');
const { hintConditionHolds } = require('../../src/app/src/editor/ui/HintEngine.js');
const fx = require('../../shared/testing/projectFixtures.mjs');

const FIXTURE_DIR = path.join(__dirname, '../../shared/testing/fixtures');
const fixtures = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8')));

const legacyHolds = (hint, detailed) => hintConditionHolds(hint, detailed);
const strip = (hints) => hints.map((h) => {
    const c = JSON.parse(JSON.stringify(h));
    if (c.when) delete c.when.expected;
    return c;
});
const planOf = (fixture, extra) => planMission({
    assignment: { id: 1, hints: strip(fixture.hints), hints_updated_at: null, ...(extra && extra.assignment) },
    project: { json: JSON.stringify(fixture.projectJson), mtime: null, updated_at: null, ...(extra && extra.project) },
    legacyHolds,
});

const SCENE = 'Woods.svg';
const RUBY = 'HY-Ruby.svg';
const blockHint = (id, blockTypes, extra) => ({
    id, text: 'texto ' + id,
    when: { type: 'character_missing_block_type', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY, blockTypes, ...extra },
});
const rubyProject = (scripts, extraSprites) => fx.project([{ md5: SCENE, sprites: [{ md5: RUBY, name: 'Ruby', scripts }].concat(extraSprites || []) }]);

describe('fixtures reais - I1 com o expected do backfill (reconcileLegacy:false)', () => {
    it('há fixtures', () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(3);
    });

    fixtures.forEach((f) => {
        it(`${f.name}: toda dica que ganha expected dá done no projeto do professor, sem estado de erro`, () => {
            const detailed = computeDetailedManifest(f.projectJson);
            const { hints, report } = buildExpectedForHints(strip(f.hints), f.projectJson, { reconcileLegacy: false });
            expect(report.filter((r) => r.reason === 'not_done')).toEqual([]);
            const merged = mergeExpected(strip(f.hints), hints);
            const results = evaluateExpectedHints(merged, detailed);
            expect(results.size).toBe(report.filter((r) => r.status === 'expected').length);
            for (const [id, r] of results) {
                expect(ALIGN_STATES).toContain(r.state);
                expect({ id, state: r.state }).toEqual({ id, state: 'done' });
            }
        });

        it(`${f.name}: a mescla só ADICIONA when.expected (todo o resto deep-equal)`, () => {
            const original = strip(f.hints);
            const { hints } = buildExpectedForHints(original, f.projectJson, { reconcileLegacy: false });
            const merged = mergeExpected(original, hints);
            expect(merged).toHaveLength(original.length);
            merged.forEach((h, i) => {
                const { expected, ...whenRest } = h.when;
                expect({ ...h, when: whenRest }).toEqual(original[i]);
                if (expected) expect(original[i].when.type).toBe('character_missing_block_type');
            });
            expect(merged.some((h) => h.when.expected)).toBe(true);
        });
    });
});

describe('planMission nos fixtures', () => {
    // Resultado atual de cada fixture - se mudar, conferir à mão: é o que o
    // dry-run diria dessas missões.
    it('decisão por fixture', () => {
        const byName = {};
        fixtures.forEach((f) => {
            const p = planOf(f);
            byName[f.name] = { status: p.status, reason: p.reason };
        });
        // mensagens e cenas-padrao têm dica legada pendente no PRÓPRIO
        // professor (KNOWN em hintInvariants.test.js: dica obsoleta / bloco
        // solto) -> puladas como inconsistentes. anda-repete tem uma falha de
        // default_character_present, que a checagem ignora de propósito.
        expect(byName).toEqual({
            'anda-repete': { status: 'ready', reason: undefined },
            'cenas-padrao': { status: 'skip', reason: 'inconsistent_legacy_hints' },
            'clique-cresce': { status: 'ready', reason: undefined },
            mensagens: { status: 'skip', reason: 'inconsistent_legacy_hints' },
            'quatro-cenas': { status: 'ready', reason: undefined },
        });
    });

    it('ready: hints mesclados passam na guarda e cada dica ganha no máximo expected', () => {
        fixtures.forEach((f) => {
            const p = planOf(f);
            if (p.status !== 'ready') return;
            expect(() => assertOnlyExpectedAdded(strip(f.hints), p.hints)).not.toThrow();
            expect(p.stats.gained).toBeGreaterThan(0);
            expect(p.stats.fallback).toBe(p.stats.gained); // sem LLM: tudo fallback
            expect(p.writable).toBe(p.pending.length === 0);
        });
    });

    it('já com expected (gerada depois da E6b) -> pula, não recalcula', () => {
        const f = fixtures.find((x) => x.name === 'clique-cresce');
        const { hints } = buildExpectedForHints(f.hints, f.projectJson);
        const p = planMission({ assignment: { id: 2, hints }, project: { json: JSON.stringify(f.projectJson) }, legacyHolds });
        expect(p).toMatchObject({ status: 'skip', reason: 'already_has_expected' });
    });
});

describe('planMission - regras de pulo', () => {
    const project = rubyProject([[fx.onflag(), fx.b('hop', 2), fx.b('forward', 3)]]);
    const hints = [
        { id: 'h1', text: 'intro', when: { type: 'mission_intro' } },
        blockHint('h2', ['hop']),
        blockHint('h3', ['forward']),
        { id: 'h4', text: 'manual', when: { type: 'manual' } },
    ];
    const plan = (assignment, proj) => planMission({
        assignment: { id: 9, hints, ...assignment },
        project: proj === null ? null : { json: JSON.stringify(project), ...proj },
        legacyHolds,
    });

    it('caso feliz: só dicas de bloco ganham expected; intro/manual intactos', () => {
        const p = plan({}, {});
        expect(p).toMatchObject({ status: 'ready', writable: true, pending: [] });
        expect(p.stats).toMatchObject({ hints: 4, blockHints: 2, gained: 2, fallback: 2 });
        expect(p.hints[0]).toEqual(hints[0]);
        expect(p.hints[3]).toEqual(hints[3]);
        expect(p.hints[1].when.expected).toEqual({ trigger: 'onflag', triggerArg: null,
            script: [{ type: 'hop', num: 2 }, { type: 'forward', num: 3 }], covered: [0] });
        expect(p.hints[1].when.blockTypes).toEqual(['hop']); // legado intocado (reconcileLegacy:false)
        expect(p.hints[1].when.trigger).toBeUndefined();
    });

    it('sem dicas / sem projeto / JSON ilegível', () => {
        expect(plan({ hints: [] }, {}).reason).toBe('no_hints');
        expect(plan({}, null).reason).toBe('no_project');
        expect(planMission({ assignment: { id: 1, hints }, project: { json: '{quebrado' }, legacyHolds }).reason).toBe('unreadable_project');
    });

    it('projeto salvo depois do carimbo das dicas -> pula (mtime manda; updated_at só se mtime nulo)', () => {
        const changed = plan({ hints_updated_at: '2026-10-01T10:00:00+00:00' }, { mtime: '2026-10-02 09:00:00' });
        expect(changed).toMatchObject({ status: 'skip', reason: 'project_changed_after_hints' });
        expect(changed.detail.projectSavedAt).toBe('2026-10-02T09:00:00.000Z');
        // updated_at mais novo (abrir o projeto conta tempo de tela) não pesa se mtime é antigo.
        expect(plan({ hints_updated_at: '2026-10-01T10:00:00Z' }, { mtime: '2026-09-30 09:00:00', updated_at: '2026-10-05 09:00:00' }).status).toBe('ready');
        expect(plan({ hints_updated_at: '2026-10-01T10:00:00Z' }, { mtime: null, updated_at: '2026-10-05 09:00:00' }).reason).toBe('project_changed_after_hints');
        expect(projectSavedMs({})).toBeNull();
    });

    it('sem carimbo: dica legada pendente no próprio professor -> inconsistente', () => {
        const stale = [...hints, blockHint('h5', ['grow'])]; // professor não tem grow
        const p = planMission({ assignment: { id: 3, hints: stale, hints_updated_at: null }, project: { json: JSON.stringify(project) }, legacyHolds });
        expect(p).toMatchObject({ status: 'skip', reason: 'inconsistent_legacy_hints' });
        expect(p.detail).toEqual([{ index: 4, id: 'h5', type: 'character_missing_block_type' }]);
    });

    it('pendências: occurrence (scripts gêmeos) e cópias do personagem', () => {
        const twins = rubyProject([[fx.onflag(), fx.b('hop', 2)], [fx.onflag(), fx.b('hop', 2)]]);
        const p1 = planMission({ assignment: { id: 4, hints: [blockHint('h1', ['hop']), blockHint('h2', ['hop'])] },
            project: { json: JSON.stringify(twins) }, legacyHolds });
        expect(p1).toMatchObject({ status: 'ready', writable: false, pending: ['occurrence:h1', 'occurrence:h2'] });
        const copies = rubyProject([[fx.onflag(), fx.b('hop', 2)]], [{ md5: RUBY, name: 'Ruby2', scripts: [[fx.onflag(), fx.b('hop', 2)]] }]);
        const p2 = planMission({ assignment: { id: 5, hints: [blockHint('h1', ['hop'])] }, project: { json: JSON.stringify(copies) }, legacyHolds });
        expect(p2).toMatchObject({ status: 'ready', writable: false, pending: ['copies:h1'] });
    });

    it('dica de bloco sem script possível fica legada e vira pendência; nada a ganhar = nothing', () => {
        const split = rubyProject([[fx.onflag(), fx.b('hop', 2)], [fx.onclick(), fx.b('forward', 3)]]);
        // hop+forward em scripts diferentes: no_script (o legado resolve, então não é inconsistência).
        const p = planMission({ assignment: { id: 6, hints: [blockHint('h1', ['hop', 'forward']), blockHint('h2', ['hop'])] },
            project: { json: JSON.stringify(split) }, legacyHolds });
        expect(p).toMatchObject({ status: 'ready', writable: false, pending: ['legacy:no_script:h1'] });
        expect(p.stats.legacy).toEqual({ no_script: 1 });
        const none = planMission({ assignment: { id: 7, hints: [blockHint('h1', ['hop', 'forward'])] },
            project: { json: JSON.stringify(split) }, legacyHolds });
        expect(none.status).toBe('nothing');
    });
});

describe('guardas da mescla', () => {
    it('assertOnlyExpectedAdded rejeita qualquer outra mudança', () => {
        const a = [blockHint('h1', ['hop'])];
        const exp = { trigger: 'onflag', triggerArg: null, script: [], covered: [] };
        expect(() => assertOnlyExpectedAdded(a, [{ ...a[0], when: { ...a[0].when, expected: exp } }])).not.toThrow();
        expect(() => assertOnlyExpectedAdded(a, [{ ...a[0], text: 'outro' }])).toThrow(/mudou/);
        expect(() => assertOnlyExpectedAdded(a, [{ ...a[0], when: { ...a[0].when, blockTypes: ['forward'] } }])).toThrow(/mudou/);
        expect(() => assertOnlyExpectedAdded(a, [])).toThrow(/tamanho/);
        const withExp = [{ ...a[0], when: { ...a[0].when, expected: exp } }];
        expect(() => assertOnlyExpectedAdded(withExp, [{ ...a[0], when: { ...a[0].when, expected: { ...exp, covered: [1] } } }])).toThrow(/já tinha/);
    });

    it('mergeExpected ignora o que buildExpectedForHints mexe fora de expected (ponteiros apagados etc.)', () => {
        const original = [blockHint('h1', ['hop'], { scriptRef: 'S1', blockIndices: [1] })];
        const built = [{ id: 'h1', text: 'x', when: { type: 'character_missing_block_type', expected: { trigger: 'onflag', triggerArg: null, script: [], covered: [] } } }];
        const merged = mergeExpected(original, built);
        expect(merged[0].when.scriptRef).toBe('S1');
        expect(merged[0].text).toBe('texto h1');
        expect(merged[0].when.expected.trigger).toBe('onflag');
    });
});

describe('summarize / formatReport / parseArgs', () => {
    it('agrega e formata sem quebrar', () => {
        const plans = fixtures.map((f, i) => Object.assign(planOf(f, { assignment: { id: i + 1 } }), { references: 2 }));
        const s = summarize(plans);
        expect(s.missions).toBe(fixtures.length);
        expect(s.ready + s.nothing + Object.values(s.skipped).reduce((a, b) => a + b, 0)).toBe(fixtures.length);
        expect(formatReport(plans, s, { write: false })).toContain('DRY-RUN');
    });

    it('dry-run é o padrão', () => {
        expect(parseArgs([]).write).toBe(false);
        expect(parseArgs(['--write']).write).toBe(true);
        expect(parseArgs(['--assignment', '12', '--json'])).toMatchObject({ assignment: 12, json: true });
        expect(() => parseArgs(['--xpto'])).toThrow();
    });
});

describe('writeMission (cliente FALSO - nunca o banco)', () => {
    function fakeSupabase(responses) {
        const calls = [];
        const client = {
            from(table) {
                const call = { table, ops: [] };
                calls.push(call);
                const chain = {
                    update(v) { call.ops.push(['update', v]); return chain; },
                    eq(c, v) { call.ops.push(['eq', c, v]); return chain; },
                    is(c, v) { call.ops.push(['is', c, v]); return chain; },
                    select(c) { call.ops.push(['select', c]); return Promise.resolve(responses.shift()); },
                    then(res, rej) { return Promise.resolve(responses.shift()).then(res, rej); },
                };
                return chain;
            },
        };
        return { client, calls };
    }

    it('guarda otimista pelo carimbo lido e restaura o carimbo depois', async () => {
        const { client, calls } = fakeSupabase([{ data: [{ id: 3 }], error: null }, { error: null }]);
        const r = await writeMission(client, { id: 3, hints_updated_at: '2026-10-01T10:00:00+00:00' }, [{ id: 'h1' }]);
        expect(r).toEqual({ id: 3, written: true, stampRestored: true });
        expect(calls[0].ops).toEqual([['update', { hints: [{ id: 'h1' }] }], ['eq', 'id', 3],
            ['eq', 'hints_updated_at', '2026-10-01T10:00:00+00:00'], ['select', 'id']]);
        expect(calls[1].ops).toEqual([['update', { hints_updated_at: '2026-10-01T10:00:00+00:00' }], ['eq', 'id', 3]]);
    });

    it('carimbo NULL: guarda IS NULL e restaura NULL; professor salvou no meio -> não grava', async () => {
        const a = fakeSupabase([{ data: [{ id: 4 }], error: null }, { error: null }]);
        await writeMission(a.client, { id: 4, hints_updated_at: null }, []);
        expect(a.calls[0].ops).toContainEqual(['is', 'hints_updated_at', null]);
        expect(a.calls[1].ops[0]).toEqual(['update', { hints_updated_at: null }]);
        const b = fakeSupabase([{ data: [], error: null }]);
        expect(await writeMission(b.client, { id: 5, hints_updated_at: null }, [])).toEqual({ id: 5, written: false, reason: 'changed_since_read' });
        expect(b.calls).toHaveLength(1);
    });

    it('falha ao restaurar o carimbo é relatada com o valor a restaurar', async () => {
        const { client } = fakeSupabase([{ data: [{ id: 6 }], error: null }, { error: { message: 'boom' } }]);
        expect(await writeMission(client, { id: 6, hints_updated_at: 'T' }, [])).toEqual({
            id: 6, written: true, stampRestored: false, restoreTo: 'T', error: 'boom',
        });
    });
});
