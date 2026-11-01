/**
 * backend/src/routes/share.projectsAssignment.test.js
 *
 * Cobre o campo `assignment` adicionado a GET /api/public/students/:studentId/
 * projects (pedido HelloYotta - "status de conclusão por projeto no
 * histórico", ver docblock da rota em share.js). share.test.js já cobre
 * auth/validação desta rota sem tocar o banco; este arquivo cobre o shape
 * de dado em si, com Supabase mockado (mesmo padrão de
 * stagePlacementsRoutes.test.js), incluindo `.in()`, que aquele mock não
 * precisava. requirements/manifestos vêm de computeProjectManifest sobre
 * fixtures reais (shared/testing/projectFixtures.mjs), não escritos à mão -
 * garante que "requirements" e o json do aluno usam exatamente o mesmo
 * shape que a rota de verdade produz/compara.
 */

'use strict';

const path = require('path');
const { project, script, onflag, b } = require('../../../shared/testing/projectFixtures.mjs');
const { computeProjectManifest } = require('../../../shared/assignmentScoring.mjs');

const mockDb = {
    tables: {},
    columnMissing: false,
};

jest.mock('@supabase/supabase-js', () => {
    function fakeBuilder(table) {
        const filters = [];
        let selected = '';
        const missingColumnError = { code: '42703', message: 'column projects.assignment_completed_at does not exist' };
        const exec = () => {
            if (mockDb.columnMissing && table === 'projects' && selected.includes('assignment_completed_at')) {
                return { data: null, error: missingColumnError };
            }
            const rows = (mockDb.tables[table] || []).filter((row) => filters.every((f) => f(row)));
            return { data: rows, error: null };
        };
        const first = () => {
            const r = exec();
            return Promise.resolve({ data: r.data ? r.data[0] || null : null, error: r.error });
        };
        const builder = {
            select: (cols) => { selected = cols || ''; return builder; },
            eq: (col, val) => { filters.push((r) => r[col] === val); return builder; },
            gt: (col, val) => { filters.push((r) => r[col] > val); return builder; },
            in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return builder; },
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

// Projeto-exemplo do professor: 2 cenas, 1 personagem com 1 script (onflag+forward).
const TEACHER_PROJECT = project([
    { md5: 'Woods.svg', sprites: [{ md5: 'Cat.svg', scripts: [script(onflag(), b('forward', 3))] }] },
    { md5: 'Beach.svg', sprites: [] },
]);
const REQUIREMENTS = computeProjectManifest(TEACHER_PROJECT);

// Projeto do aluno que CUMPRE os requisitos acima (mesmas 2 cenas, mesmo
// personagem com script).
const STUDENT_PROJECT_DONE = project([
    { md5: 'Woods.svg', sprites: [{ md5: 'Cat.svg', scripts: [script(onflag(), b('forward', 3))] }] },
    { md5: 'Beach.svg', sprites: [] },
]);

// Projeto do aluno que NÃO cumpre (só 1 cena, sem script).
const STUDENT_PROJECT_PENDING = project([
    { md5: 'Woods.svg', sprites: [{ md5: 'Cat.svg' }] },
]);

describe('GET /students/:studentId/projects — campo assignment', () => {
    const ORIGINAL_ENV = { ...process.env };

    function reset(overrides = {}) {
        mockDb.columnMissing = false;
        mockDb.tables = {
            projects: [
                { id: 1, name: 'Projeto livre', json: '{}', owner: 'aluno-1', deleted: 'NO', ctime: 't1', mtime: 'm1', share_token: null, assignment_id: null },
                { id: 2, name: 'Missão antiga (já concluída)', json: JSON.stringify(STUDENT_PROJECT_DONE), owner: 'aluno-1', deleted: 'NO', ctime: 't2', mtime: 'm2', share_token: null, assignment_id: 10 },
                { id: 3, name: 'Missão nova (em andamento)', json: JSON.stringify(STUDENT_PROJECT_PENDING), owner: 'aluno-1', deleted: 'NO', ctime: 't3', mtime: 'm3', share_token: null, assignment_id: 20 },
            ],
            assignments: [
                { id: 10, template_id: null, project_name: 'Missão A', requirements: REQUIREMENTS, active: false },
                { id: 20, template_id: null, project_name: 'Missão B', requirements: REQUIREMENTS, active: true },
            ],
            reactions: [],
            ...overrides,
        };
    }

    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        process.env = {
            ...ORIGINAL_ENV,
            SUPABASE_URL: 'http://supabase.invalid',
            SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa-de-teste',
            HELLOYOTTA_INBOUND_API_KEY: 'chave-correta',
        };
        reset();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    async function call() {
        const { publicRouter } = require(path.join(__dirname, 'share.js'));
        const handler = findRoute(publicRouter, 'get', '/students/:studentId/projects');
        const res = mockRes();
        await handler({
            params: { studentId: 'aluno-1' },
            query: {},
            headers: { authorization: 'Bearer chave-correta' },
        }, res);
        return res;
    }

    test('projeto livre (sem assignment_id) não ganha campo `assignment`', async () => {
        const res = await call();
        expect(res.statusCode).toBe(200);
        const livre = res.body.projects.find((p) => p.projectId === 1);
        expect(livre.assignment).toBeUndefined();
    });

    test('projeto com missão ATIVA agora, requisitos não cumpridos: assignment presente, calculado ao vivo', async () => {
        const res = await call();
        const emAndamento = res.body.projects.find((p) => p.projectId === 3);
        expect(emAndamento.assignment).toBeDefined();
        expect(emAndamento.assignment.activityId).toBe(20);
        expect(emAndamento.assignment.completedAt).toBeNull();
        expect(emAndamento.assignment.completed).toBe(false);
        expect(emAndamento.assignment.scenes.met).toBe(false); // só 1 de 2 cenas
    });

    test('projeto com missão JÁ SUBSTITUÍDA (active:false) continua trazendo o vínculo e completed:true - fecha a lacuna real reportada pela HelloYotta', async () => {
        const res = await call();
        const antiga = res.body.projects.find((p) => p.projectId === 2);
        expect(antiga.assignment).toBeDefined();
        expect(antiga.assignment.activityId).toBe(10);
        expect(antiga.assignment.completed).toBe(true);
        expect(antiga.assignment.scenes.met).toBe(true);
        expect(antiga.assignment.characters.met).toBe(true);
        expect(antiga.assignment.blocks.met).toBe(true);
    });

    test('com foto congelada (assignment_completed_at), usa a foto em vez de recalcular', async () => {
        const frozenSnapshot = { scenes: { required: 2, actual: 2, met: true }, characters: { required: 1, actual: 1, met: true }, blocks: { required: 1, actual: 1, met: true, byType: {} }, completed: true };
        reset({
            projects: [
                {
                    id: 2, name: 'Missão antiga', json: JSON.stringify(STUDENT_PROJECT_DONE), owner: 'aluno-1', deleted: 'NO',
                    ctime: 't2', mtime: 'm2', share_token: null, assignment_id: 10,
                    assignment_completed_at: '2026-10-01T00:00:00.000Z',
                    assignment_completion_snapshot: frozenSnapshot,
                },
            ],
        });
        const res = await call();
        const item = res.body.projects.find((p) => p.projectId === 2);
        expect(item.assignment.completedAt).toBe('2026-10-01T00:00:00.000Z');
        expect(item.assignment).toMatchObject(frozenSnapshot);
    });

    test('coluna assignment_completed_at ainda não migrada (42703): degrada sem derrubar o endpoint', async () => {
        mockDb.columnMissing = true;
        const res = await call();
        expect(res.statusCode).toBe(200);
        const antiga = res.body.projects.find((p) => p.projectId === 2);
        // Sem a coluna, nunca acha foto congelada - cai pro cálculo ao vivo,
        // que ainda funciona normalmente.
        expect(antiga.assignment.completedAt).toBeNull();
        expect(antiga.assignment.completed).toBe(true);
    });

    test('raiz do item NUNCA é sobrescrita pelo shape de assignment (scenes/characters/blocks do manifesto bruto continuam {count,used,present})', async () => {
        const res = await call();
        const antiga = res.body.projects.find((p) => p.projectId === 2);
        // Shape do manifesto bruto (computeProjectManifest) - não o de compareManifests.
        expect(antiga.scenes).toHaveProperty('count');
        expect(antiga.scenes).not.toHaveProperty('required');
        expect(antiga.assignment.scenes).toHaveProperty('required');
    });
});
