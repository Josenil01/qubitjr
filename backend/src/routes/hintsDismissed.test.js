/**
 * backend/src/routes/hintsDismissed.test.js
 *
 * Regressão R6 / P2 (corrigida): os ids das dicas são posicionais (h1..hN,
 * hintsGeneration.js) e GET /:id/hints/dismissed devolvia todo hint_id com
 * event 'dismissed' do aluno SEM filtro de tempo - depois que o professor
 * regenerava as dicas, a nova 'h3' (outra dica!) nascia "dispensada".
 *
 * Correção (decisão D2): coluna assignments.hints_updated_at (carimbada pelo
 * BANCO via trigger ao salvar dicas, ver backend/supabase-setup.sql); só
 * contam dispensas com created_at >= carimbo do TEMPLATE da missão. NULL =
 * legado (sem filtro); coluna ausente (SQL não aplicado) degrada pro legado.
 *
 * Supabase é mockado via jest.mock('@supabase/supabase-js'). O fake respeita
 * eq/gte, simula "coluna inexistente" (erro 42703 ao selecionar
 * hints_updated_at) e emula o trigger do banco no update de assignments.hints
 * (a rota NÃO manda o carimbo - quem o põe é o banco).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STAMP = '2026-10-20T12:00:00.000Z';
const BASE_EVENTS = () => [
    // Dispensa da 'h3' da geração ANTERIOR (antes da regeneração).
    { student_id: 'stu-1', assignment_id: 7, hint_id: 'h3', event_type: 'dismissed', created_at: '2026-10-10T10:00:00.000Z' },
    // Dispensa da 'h1' feita DEPOIS da regeneração: continua valendo.
    { student_id: 'stu-1', assignment_id: 7, hint_id: 'h1', event_type: 'dismissed', created_at: '2026-10-25T10:00:00.000Z' },
];

// O prefixo "mock" é exigido pelo jest pra variáveis usadas dentro de
// jest.mock() (a factory é içada pro topo do arquivo).
const mockDb = {
    tables: {},
    columnMissing: false, // simula o SQL de hints_updated_at ainda não aplicado
    triggerNow: '2026-11-01T00:00:00.000Z', // now() do "banco" no update
    updates: [], // payloads de update em assignments
};

jest.mock('@supabase/supabase-js', () => {
    /** Query builder encadeável mínimo; await devolve {data, error}. */
    function fakeBuilder(table) {
        const filters = [];
        let selected = '';
        let pendingUpdate = null;
        const exec = () => {
            if (mockDb.columnMissing && table === 'assignments' && selected.includes('hints_updated_at')) {
                return { data: null, error: { code: '42703', message: 'column assignments.hints_updated_at does not exist' } };
            }
            const rows = mockDb.tables[table].filter((row) => filters.every((f) => f(row)));
            if (pendingUpdate) {
                mockDb.updates.push({ table, payload: pendingUpdate });
                rows.forEach((r) => {
                    Object.assign(r, pendingUpdate);
                    // Emula o trigger BEFORE UPDATE OF hints (carimbo = now() do banco).
                    if (table === 'assignments' && 'hints' in pendingUpdate && !mockDb.columnMissing) {
                        r.hints_updated_at = mockDb.triggerNow;
                    }
                });
            }
            return { data: rows, error: null };
        };
        const first = () => {
            const r = exec();
            return Promise.resolve({ data: r.data ? r.data[0] || null : null, error: r.error });
        };
        const b = {
            select: (cols) => { selected = cols || ''; return b; },
            update: (payload) => { pendingUpdate = payload; return b; },
            eq: (col, val) => { filters.push((r) => r[col] === val); return b; },
            gte: (col, val) => { filters.push((r) => r[col] >= val); return b; },
            gt: (col, val) => { filters.push((r) => r[col] > val); return b; },
            in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return b; },
            order: () => b,
            limit: () => b,
            single: first,
            maybeSingle: first,
            then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject),
        };
        return b;
    }
    return { createClient: jest.fn(() => ({ from: (table) => fakeBuilder(table) })) };
});

function findRoute(router, method, routePath) {
    const layer = router.stack.find(
        (l) => l.route && l.route.path === routePath && l.route.methods[method]
    );
    if (!layer) throw new Error(`Rota ${method.toUpperCase()} ${routePath} não encontrada no router`);
    const handlers = layer.route.stack.map((s) => s.handle);
    return handlers[handlers.length - 1];
}

function mockRes() {
    const res = {};
    res.statusCode = 200;
    res.status = jest.fn((code) => { res.statusCode = code; return res; });
    res.json = jest.fn((payload) => { res.body = payload; return res; });
    return res;
}

describe('hints_updated_at (dispensas versionadas)', () => {
    const ORIGINAL_ENV = { ...process.env };

    function reset({ template = { id: 7, template_id: null, hints_updated_at: STAMP }, extra = [] } = {}) {
        mockDb.columnMissing = false;
        mockDb.updates = [];
        mockDb.tables = {
            hint_events: BASE_EVENTS(),
            assignments: [template, ...extra],
            projects: [{ assignment_id: 7, owner: 'prof-1', deleted: 'NO' }],
        };
    }

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...ORIGINAL_ENV,
            SUPABASE_URL: 'http://supabase.invalid',
            SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa-de-teste',
        };
        reset();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    async function getDismissed(id = '7') {
        const router = require(path.join(__dirname, 'assignments.js'));
        const handler = findRoute(router, 'get', '/:id/hints/dismissed');
        const res = mockRes();
        await handler({ params: { id }, userId: 'stu-1', headers: {}, query: {} }, res);
        return res;
    }

    async function postHints(hints) {
        const router = require(path.join(__dirname, 'assignments.js'));
        const handler = findRoute(router, 'post', '/:id/hints');
        const res = mockRes();
        await handler({ params: { id: '7' }, userId: 'prof-1', headers: {}, query: {}, body: { hints } }, res);
        return res;
    }

    test('a dispensa recente (>= carimbo) continua sendo devolvida', async () => {
        const res = await getDismissed();
        expect(res.statusCode).toBe(200);
        expect(res.body.dismissed).toContain('h1');
    });

    test('NÃO devolve dispensa criada antes de hints_updated_at (dicas regeneradas)', async () => {
        const res = await getDismissed();
        expect(res.body.dismissed).not.toContain('h3');
    });

    test('hints_updated_at NULL = legado: sem filtro, devolve tudo', async () => {
        reset({ template: { id: 7, template_id: null, hints_updated_at: null } });
        const res = await getDismissed();
        expect(res.body.dismissed.sort()).toEqual(['h1', 'h3']);
    });

    test('referência (turma) resolve o carimbo do TEMPLATE, não o da própria linha', async () => {
        // Aluno está na referência 9, que aponta pro template 7 (carimbo STAMP).
        reset({
            template: { id: 7, template_id: null, hints_updated_at: STAMP },
            extra: [{ id: 9, template_id: 7, hints_updated_at: null }],
        });
        mockDb.tables.hint_events.forEach((e) => { e.assignment_id = 9; });
        const res = await getDismissed('9');
        expect(res.body.dismissed).toEqual(['h1']);
    });

    test('coluna ausente (SQL não aplicado) degrada pro legado, sem 500', async () => {
        mockDb.columnMissing = true;
        const res = await getDismissed();
        expect(res.statusCode).toBe(200);
        expect(res.body.dismissed.sort()).toEqual(['h1', 'h3']);
    });

    test('POST /:id/hints salva as dicas e o banco carimba hints_updated_at', async () => {
        reset({ template: { id: 7, template_id: null, hints_updated_at: null, hints: null } });
        const hints = [{ id: 'h1', text: 'Oi', when: { type: 'always' } }];
        const res = await postHints(hints);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true });
        // A rota manda só `hints`: o carimbo é do banco (trigger), não do Node.
        expect(mockDb.updates).toEqual([{ table: 'assignments', payload: { hints } }]);
        expect(mockDb.tables.assignments[0].hints_updated_at).toBe(mockDb.triggerNow);
        // Com o carimbo novo, as dispensas antigas (h1 em 2026-10-25) caem.
        const after = await getDismissed();
        expect(after.body.dismissed).toEqual([]);
    });

    test('POST /:id/hints segue funcionando com a coluna ausente', async () => {
        reset({ template: { id: 7, template_id: null, hints: null } });
        mockDb.columnMissing = true;
        const res = await postHints([{ id: 'h1', text: 'Oi', when: { type: 'always' } }]);
        expect(res.statusCode).toBe(200);
    });

    describe('supabase-setup.sql (idempotência e guarda do trigger de arquivar)', () => {
        const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase-setup.sql'), 'utf8');

        test('coluna e trigger são idempotentes', () => {
            expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS hints_updated_at TIMESTAMPTZ/);
            expect(sql).toMatch(/CREATE OR REPLACE FUNCTION stamp_assignment_hints_updated_at/);
            expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_assignments_hints_updated_at ON assignments/);
        });

        test('só carimba em update direto (pg_trigger_depth() = 1), não via trigger de arquivar', () => {
            expect(sql).toMatch(/pg_trigger_depth\(\) = 1/);
        });

        test('o trigger de arquivar/restaurar não escreve em hints_updated_at', () => {
            const start = sql.indexOf('CREATE OR REPLACE FUNCTION sync_template_hints_on_project_delete');
            const end = sql.indexOf('$$ LANGUAGE plpgsql', start);
            expect(sql.slice(start, end)).not.toMatch(/hints_updated_at/);
        });
    });
});
