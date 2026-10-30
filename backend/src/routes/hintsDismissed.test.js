/**
 * backend/src/routes/hintsDismissed.test.js
 *
 * Regressão R6 / P2 (bug CONFIRMADO, ainda não corrigido): os ids das dicas
 * são posicionais (h1..hN, hintsGeneration.js) e GET /:id/hints/dismissed
 * devolve todo hint_id com event 'dismissed' do aluno SEM filtro de tempo.
 * Depois que o professor regenera as dicas, a nova 'h3' (outra dica!) nasce
 * "dispensada" porque o aluno dispensou a 'h3' da geração anterior.
 *
 * Correção futura: coluna assignments.hints_updated_at; só contam dispensas
 * com created_at >= hints_updated_at. Por isso o teste usa `test.failing`:
 * passa HOJE (o bug existe); quando a correção entrar ele passa a FALHAR e
 * deve virar `test` normal.
 *
 * Supabase é mockado via jest.mock('@supabase/supabase-js') - a rota obtém o
 * cliente com createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) e a
 * identidade vem pronta em req.userId (o identityMiddleware roda antes, em
 * index.js), então basta preencher req.userId. O fake respeita eq/gte sobre
 * as colunas, então vale tanto pra filtro feito na query quanto em JS.
 * Nenhum código de produção é alterado.
 */

'use strict';

const path = require('path');

const HINTS_UPDATED_AT = '2026-10-20T12:00:00.000Z';

// O prefixo "mock" é exigido pelo jest pra variáveis usadas dentro de
// jest.mock() (a factory é içada pro topo do arquivo).
const mockTables = {
    hint_events: [
        // Dispensa da 'h3' da geração ANTERIOR (antes da regeneração).
        { student_id: 'stu-1', assignment_id: 7, hint_id: 'h3', event_type: 'dismissed', created_at: '2026-10-10T10:00:00.000Z' },
        // Dispensa da 'h1' feita DEPOIS da regeneração: continua valendo.
        { student_id: 'stu-1', assignment_id: 7, hint_id: 'h1', event_type: 'dismissed', created_at: '2026-10-25T10:00:00.000Z' },
    ],
    assignments: [
        { id: 7, hints_updated_at: HINTS_UPDATED_AT },
    ],
};

jest.mock('@supabase/supabase-js', () => {
    /** Query builder encadeável mínimo; await devolve {data, error}. */
    function fakeBuilder(table) {
        const filters = [];
        const exec = () => ({
            data: mockTables[table].filter((row) => filters.every((f) => f(row))),
            error: null,
        });
        const b = {
            select: () => b,
            eq: (col, val) => { filters.push((r) => r[col] === val); return b; },
            gte: (col, val) => { filters.push((r) => r[col] >= val); return b; },
            gt: (col, val) => { filters.push((r) => r[col] > val); return b; },
            in: (col, vals) => { filters.push((r) => vals.includes(r[col])); return b; },
            order: () => b,
            limit: () => b,
            single: () => Promise.resolve({ data: exec().data[0] || null, error: null }),
            maybeSingle: () => Promise.resolve({ data: exec().data[0] || null, error: null }),
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

describe('GET /:id/hints/dismissed', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        jest.resetModules();
        process.env = {
            ...ORIGINAL_ENV,
            SUPABASE_URL: 'http://supabase.invalid',
            SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa-de-teste',
        };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    async function call() {
        const router = require(path.join(__dirname, 'assignments.js'));
        const handler = findRoute(router, 'get', '/:id/hints/dismissed');
        const res = mockRes();
        await handler({ params: { id: '7' }, userId: 'stu-1', headers: {}, query: {} }, res);
        return res;
    }

    test('sanidade: a dispensa recente continua sendo devolvida', async () => {
        const res = await call();
        expect(res.statusCode).toBe(200);
        expect(res.body.dismissed).toContain('h1');
    });

    // Passa enquanto o bug existe (a rota devolve 'h3' mesmo com a dispensa
    // anterior a hints_updated_at). Remover o `.failing` quando corrigir.
    test.failing('NÃO devolve dispensa criada antes de hints_updated_at (dicas regeneradas)', async () => {
        const res = await call();
        expect(res.body.dismissed).not.toContain('h3');
    });
});
