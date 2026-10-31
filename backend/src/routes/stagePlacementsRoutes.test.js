/**
 * backend/src/routes/stagePlacementsRoutes.test.js
 *
 * Sombra de posicionamento no palco (assignments.stage_placements, ver
 * services/stagePlacements.js e shared/detailedManifest.mjs#
 * buildStagePlacements):
 *  - POST /register grava stage_placements nos DOIS ramos (primeiro cadastro
 *    = insert; reautoria = update do template), num UPDATE à parte;
 *  - GET /active devolve stagePlacements, herdado do template numa referência;
 *  - coluna ainda NÃO migrada (SQL manual não aplicado): nenhuma das duas
 *    rotas cai - /register continua cadastrando a missão e /active continua
 *    devolvendo requirements/hints, só sem sombra. É a regressão que importa:
 *    a família de apagão de produção descrita no CLAUDE.md.
 *
 * Supabase é mockado via jest.mock('@supabase/supabase-js') - nada toca um
 * banco real. O fake simula a coluna inexistente do jeito que o Supabase
 * real responde: 42703 num SELECT que a menciona, PGRST204 num
 * UPDATE/INSERT que a manda.
 */

'use strict';

const path = require('path');
const { project, script, onflag, b } = require('../../../shared/testing/projectFixtures.mjs');

const mockDb = {
    tables: {},
    columnMissing: false,
    selects: [], // {table, cols} de toda consulta
    writes: [], // {table, kind, payload}
    nextId: 100,
};

jest.mock('../services/helloyotta', () => ({
    notifyAssignmentRegistered: jest.fn(() => Promise.resolve()),
}));

jest.mock('@supabase/supabase-js', () => {
    function fakeBuilder(table) {
        const filters = [];
        let selected = '';
        let pending = null; // {kind: 'update'|'insert', payload}
        const missingColumnError = (kind) => (kind === 'select' ?
            { code: '42703', message: 'column assignments.stage_placements does not exist' } :
            { code: 'PGRST204', message: "Could not find the 'stage_placements' column of 'assignments' in the schema cache" });
        const exec = () => {
            if (mockDb.columnMissing && table === 'assignments') {
                if (pending && 'stage_placements' in pending.payload) return { data: null, error: missingColumnError('write') };
                if (!pending && selected.includes('stage_placements')) return { data: null, error: missingColumnError('select') };
            }
            if (pending && pending.kind === 'insert') {
                const row = { id: mockDb.nextId++, template_id: null, ...pending.payload };
                mockDb.tables[table].push(row);
                mockDb.writes.push({ table, kind: 'insert', payload: pending.payload });
                return { data: [row], error: null };
            }
            const rows = mockDb.tables[table].filter((row) => filters.every((f) => f(row)));
            if (pending && pending.kind === 'update') {
                mockDb.writes.push({ table, kind: 'update', payload: pending.payload });
                rows.forEach((r) => Object.assign(r, pending.payload));
            }
            return { data: rows, error: null };
        };
        const first = () => {
            const r = exec();
            return Promise.resolve({ data: r.data ? r.data[0] || null : null, error: r.error });
        };
        const builder = {
            select: (cols) => {
                selected = cols || '';
                if (!pending) mockDb.selects.push({ table, cols: selected });
                return builder;
            },
            update: (payload) => { pending = { kind: 'update', payload }; return builder; },
            insert: (payload) => { pending = { kind: 'insert', payload }; return builder; },
            eq: (col, val) => { filters.push((r) => r[col] === val); return builder; },
            neq: (col, val) => { filters.push((r) => r[col] !== val); return builder; },
            order: () => builder,
            limit: () => builder,
            single: first,
            maybeSingle: first,
            then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject),
        };
        return builder;
    }
    return { createClient: jest.fn(() => ({ from: (table) => fakeBuilder(table) })) };
});

function findRoute(router, method, routePath) {
    const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
    if (!layer) throw new Error(`Rota ${method.toUpperCase()} ${routePath} não encontrada`);
    const handlers = layer.route.stack.map((s) => s.handle);
    return handlers[handlers.length - 1];
}

function mockRes() {
    const res = { statusCode: 200 };
    res.status = jest.fn((code) => { res.statusCode = code; return res; });
    res.json = jest.fn((payload) => { res.body = payload; return res; });
    return res;
}

// Projeto do professor: Ruby arrastada pra (100, 300) na cena 1; o gato
// ficou na casa padrão (240, 180) e não vira sombra.
const TEACHER_PROJECT = project([{
    md5: 'Woods.svg',
    sprites: [
        { md5: 'Ruby.svg', homex: 100, homey: 300, homescale: 1.5, scripts: [script(onflag(), b('forward', 3))] },
        { md5: 'Cat.svg' },
    ],
}]);
const EXPECTED_PLACEMENTS = [[
    { characterMd5: 'Ruby.svg', characterOccurrence: 1, homex: 100, homey: 300, homescale: 1.5 },
]];

describe('stage_placements nas rotas de assignments', () => {
    const ORIGINAL_ENV = { ...process.env };

    function reset({ projectAssignmentId = null, assignments = [] } = {}) {
        mockDb.columnMissing = false;
        mockDb.selects = [];
        mockDb.writes = [];
        mockDb.nextId = 100;
        mockDb.tables = {
            assignments,
            projects: [
                { id: 1, name: 'Missão Bosque', json: JSON.stringify(TEACHER_PROJECT), owner: 'prof-1', assignment_id: projectAssignmentId, deleted: 'NO' },
                { id: 2, name: 'Missão Bosque', json: '{}', owner: 'stu-1', assignment_id: 9, deleted: 'NO' },
            ],
        };
    }

    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        process.env = { ...ORIGINAL_ENV, SUPABASE_URL: 'http://supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa-de-teste' };
        reset();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    async function call(method, routePath, req) {
        const router = require(path.join(__dirname, 'assignments.js'));
        const res = mockRes();
        await findRoute(router, method, routePath)({ headers: {}, query: {}, params: {}, ...req }, res);
        return res;
    }

    const register = () => call('post', '/register', { userId: 'prof-1', turmaId: 'turma-1', body: { projectId: 1 } });
    const active = () => call('get', '/active', { userId: 'stu-1', turmaId: 'turma-1' });

    test('POST /register (primeiro cadastro): grava stage_placements na linha inserida', async () => {
        const res = await register();
        expect(res.statusCode).toBe(200);
        const inserted = mockDb.tables.assignments.find((a) => a.id === res.body.assignmentId);
        expect(inserted.requirements).toBeTruthy();
        expect(inserted.stage_placements).toEqual(EXPECTED_PLACEMENTS);
        // Nunca no INSERT principal (que grava requirements) - só no UPDATE à parte.
        const insert = mockDb.writes.find((w) => w.kind === 'insert');
        expect(insert.payload).not.toHaveProperty('stage_placements');
    });

    test('POST /register (reautoria do template): grava stage_placements no template existente', async () => {
        reset({ projectAssignmentId: 7, assignments: [{ id: 7, template_id: null, turma_id: 'turma-1', active: false, requirements: null }] });
        const res = await register();
        expect(res.statusCode).toBe(200);
        expect(res.body.assignmentId).toBe(7);
        expect(mockDb.tables.assignments[0].stage_placements).toEqual(EXPECTED_PLACEMENTS);
        expect(mockDb.writes.some((w) => w.kind === 'insert')).toBe(false);
    });

    test('POST /register com a coluna NÃO migrada: missão cadastrada mesmo assim (sem 500)', async () => {
        reset();
        mockDb.columnMissing = true;
        const res = await register();
        expect(res.statusCode).toBe(200);
        const inserted = mockDb.tables.assignments.find((a) => a.id === res.body.assignmentId);
        expect(inserted.requirements).toBeTruthy();
        expect(inserted.active).toBe(true);
        expect(inserted).not.toHaveProperty('stage_placements');
    });

    test('GET /active (template): devolve stagePlacements', async () => {
        reset({ assignments: [{ id: 9, template_id: null, turma_id: 'turma-1', active: true, project_name: 'Missão Bosque', requirements: { r: 1 }, hints: [], stage_placements: EXPECTED_PLACEMENTS }] });
        const res = await active();
        expect(res.statusCode).toBe(200);
        expect(res.body.assignment.stagePlacements).toEqual(EXPECTED_PLACEMENTS);
        expect(res.body.assignment.requirements).toEqual({ r: 1 });
    });

    test('GET /active (referência): herda stagePlacements do TEMPLATE, não da própria linha', async () => {
        reset({ assignments: [
            { id: 7, template_id: null, turma_id: 'turma-0', active: false, project_name: 'Missão Bosque', requirements: { r: 1 }, hints: [], stage_placements: EXPECTED_PLACEMENTS },
            { id: 9, template_id: 7, turma_id: 'turma-1', active: true, project_name: null, requirements: null, hints: null, stage_placements: null },
        ] });
        const res = await active();
        expect(res.statusCode).toBe(200);
        expect(res.body.assignment.id).toBe(9);
        expect(res.body.assignment.stagePlacements).toEqual(EXPECTED_PLACEMENTS);
        expect(res.body.assignment.requirements).toEqual({ r: 1 });
    });

    test('GET /active com a coluna NÃO migrada: 200 com requirements/hints intactos e stagePlacements null', async () => {
        reset({ assignments: [{ id: 9, template_id: null, turma_id: 'turma-1', active: true, project_name: 'Missão Bosque', requirements: { r: 1 }, hints: [{ id: 'h1' }] }] });
        mockDb.columnMissing = true;
        const res = await active();
        expect(res.statusCode).toBe(200);
        expect(res.body.assignment.requirements).toEqual({ r: 1 });
        expect(res.body.assignment.hints).toEqual([{ id: 'h1' }]);
        expect(res.body.assignment.stagePlacements).toBeNull();
    });

    test('stage_placements nunca entra num SELECT junto com outras colunas (consulta sempre separada)', async () => {
        reset({ assignments: [
            { id: 7, template_id: null, turma_id: 'turma-0', active: false, project_name: 'X', requirements: {}, hints: [], stage_placements: [] },
            { id: 9, template_id: 7, turma_id: 'turma-1', active: true },
        ] });
        await active();
        const withColumn = mockDb.selects.filter((s) => s.cols.includes('stage_placements'));
        expect(withColumn.length).toBeGreaterThan(0);
        withColumn.forEach((s) => expect(s.cols.trim()).toBe('stage_placements'));
    });
});
