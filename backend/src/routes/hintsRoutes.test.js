/**
 * backend/src/routes/hintsRoutes.test.js
 *
 * Testes de rota (Supabase MOCKADO) do sistema de dicas em routes/assignments.js:
 *   - GET  /:id/hints/dismissed
 *   - POST /:id/hints/:hintId/event
 *   - POST /:id/hints
 *
 * Complementa hintsDismissed.test.js (que cobre o carimbo hints_updated_at e o
 * trigger emulado) sem duplicá-lo; reaproveita o padrão dele: jest.mock de
 * '@supabase/supabase-js' com query builder encadeável + handler extraído do
 * router (sem subir Express). Aqui o fake também suporta insert e injeção de
 * erro por tabela/operação.
 *
 * HINT_EVENT_TYPES não é exportado por assignments.js; o teste o LÊ do código
 * fonte (regex) pra não quebrar quando novos tipos forem adicionados.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// "mock*" é exigido pelo jest pra variáveis usadas dentro da factory içada.
const mockDb = {
    tables: {},
    inserts: [], // { table, row }
    updates: [], // { table, payload }
    failOn: {}, // { 'hint_events.select': {code,message}, ... }
};

jest.mock('@supabase/supabase-js', () => {
    function fakeBuilder(table) {
        const filters = [];
        let op = 'select';
        let payload = null;
        const exec = () => {
            const fail = mockDb.failOn[`${table}.${op}`];
            if (fail) return { data: null, error: fail };
            if (op === 'insert') {
                mockDb.inserts.push({ table, row: payload });
                (mockDb.tables[table] = mockDb.tables[table] || []).push({ ...payload });
                return { data: null, error: null };
            }
            const rows = (mockDb.tables[table] || []).filter((r) => filters.every((f) => f(r)));
            if (op === 'update') {
                mockDb.updates.push({ table, payload });
                rows.forEach((r) => Object.assign(r, payload));
            }
            return { data: rows, error: null };
        };
        const first = () => {
            const r = exec();
            return Promise.resolve({ data: r.data ? r.data[0] || null : null, error: r.error });
        };
        const b = {
            select: () => b,
            insert: (row) => { op = 'insert'; payload = row; return b; },
            update: (p) => { op = 'update'; payload = p; return b; },
            eq: (c, v) => { filters.push((r) => r[c] === v); return b; },
            gte: (c, v) => { filters.push((r) => r[c] >= v); return b; },
            order: () => b,
            limit: () => b,
            single: first,
            maybeSingle: first,
            then: (resolve, reject) => Promise.resolve(exec()).then(resolve, reject),
        };
        return b;
    }
    return { createClient: jest.fn(() => ({ from: (t) => fakeBuilder(t) })) };
});

// Identidade: sem rede nem JWT de verdade. turma vem de req.turmaId.
jest.mock('../services/identity', () => ({
    getTurmaIdFromClaims: jest.fn(() => null),
    getNivelFromClaims: jest.fn(() => null),
    verifyAndDecode: jest.fn(async () => null),
}));

const ROUTES_SRC = fs.readFileSync(path.join(__dirname, 'assignments.js'), 'utf8');
const HINT_EVENT_TYPES = (() => {
    const m = ROUTES_SRC.match(/HINT_EVENT_TYPES\s*=\s*new Set\(\[([^\]]+)\]\)/);
    if (!m) throw new Error('HINT_EVENT_TYPES não encontrado em assignments.js');
    return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
})();

function findRoute(router, method, routePath) {
    const layer = router.stack.find((l) => l.route && l.route.path === routePath && l.route.methods[method]);
    if (!layer) throw new Error(`Rota ${method.toUpperCase()} ${routePath} não encontrada`);
    const handlers = layer.route.stack.map((s) => s.handle);
    return handlers[handlers.length - 1];
}

function mockRes() {
    const res = { statusCode: 200 };
    res.status = jest.fn((c) => { res.statusCode = c; return res; });
    res.json = jest.fn((p) => { res.body = p; return res; });
    return res;
}

describe('rotas de dicas (assignments.js) com Supabase mockado', () => {
    const ORIGINAL_ENV = { ...process.env };
    let errSpy;
    let warnSpy;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV, SUPABASE_URL: 'http://supabase.invalid', SUPABASE_SERVICE_ROLE_KEY: 'chave-falsa' };
        mockDb.inserts = [];
        mockDb.updates = [];
        mockDb.failOn = {};
        mockDb.tables = {
            assignments: [
                { id: 7, template_id: null, hints: [{ id: 'h9', text: 'velha', when: { type: 'always' } }], hints_updated_at: null },
                { id: 8, template_id: 7, hints: null, hints_updated_at: null },
                { id: 20, template_id: null, hints: null, hints_updated_at: null }, // missão de outra pessoa/sem projeto do prof-1
            ],
            projects: [
                { assignment_id: 7, owner: 'prof-1', deleted: 'NO' },
                { assignment_id: 20, owner: 'prof-2', deleted: 'NO' },
            ],
            hint_events: [],
        };
        errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    async function call(method, routePath, req) {
        const router = require(path.join(__dirname, 'assignments.js'));
        const handler = findRoute(router, method, routePath);
        const res = mockRes();
        await handler({ headers: {}, query: {}, params: {}, body: {}, ...req }, res);
        return res;
    }

    const getDismissed = (req) => call('get', '/:id/hints/dismissed', { params: { id: '7' }, userId: 'stu-1', ...req });
    const postEvent = (req) => call('post', '/:id/hints/:hintId/event', {
        params: { id: '7', hintId: 'h1' }, userId: 'stu-1', turmaId: 'turma-A', body: { eventType: 'shown' }, ...req,
    });
    const postHints = (req) => call('post', '/:id/hints', { params: { id: '7' }, userId: 'prof-1', ...req });

    const ev = (over) => ({
        student_id: 'stu-1', assignment_id: 7, hint_id: 'h1', event_type: 'dismissed', created_at: '2026-10-25T10:00:00.000Z', ...over,
    });

    test('leitura dos tipos de evento do código-fonte funcionou', () => {
        expect(HINT_EVENT_TYPES).toEqual(expect.arrayContaining(['shown', 'dismissed']));
    });

    describe('GET /:id/hints/dismissed', () => {
        test('sem userId -> 401 e nenhuma consulta', async () => {
            const res = await getDismissed({ userId: undefined });
            expect(res.statusCode).toBe(401);
        });

        test('id não numérico -> 400', async () => {
            const res = await getDismissed({ params: { id: 'abc' } });
            expect(res.statusCode).toBe(400);
        });

        test('sem Supabase configurado -> 503', async () => {
            delete process.env.SUPABASE_URL;
            const res = await getDismissed();
            expect(res.statusCode).toBe(503);
        });

        test('missão inexistente -> 200 com lista vazia (não 404)', async () => {
            mockDb.tables.hint_events = [ev({ assignment_id: 7 })];
            const res = await getDismissed({ params: { id: '999' } });
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ dismissed: [] });
        });

        test('só devolve dispensas do PRÓPRIO aluno', async () => {
            mockDb.tables.hint_events = [ev({ hint_id: 'h1' }), ev({ student_id: 'stu-2', hint_id: 'h2' })];
            const res = await getDismissed();
            expect(res.body.dismissed).toEqual(['h1']);
        });

        test('aluno de outra missão: eventos de outro assignment_id não aparecem', async () => {
            mockDb.tables.hint_events = [ev({ assignment_id: 20, hint_id: 'h5' }), ev({ hint_id: 'h1' })];
            const res = await getDismissed();
            expect(res.body.dismissed).toEqual(['h1']);
        });

        test('eventos de outros tipos (todos de HINT_EVENT_TYPES exceto dismissed) não aparecem', async () => {
            const outros = HINT_EVENT_TYPES.filter((t) => t !== 'dismissed');
            mockDb.tables.hint_events = outros.map((t, i) => ev({ hint_id: `x${i}`, event_type: t }));
            mockDb.tables.hint_events.push(ev({ hint_id: 'h1' }));
            const res = await getDismissed();
            expect(res.body.dismissed).toEqual(['h1']);
        });

        test('deduplica ids repetidos (dispensou a mesma dica várias vezes)', async () => {
            mockDb.tables.hint_events = [ev(), ev({ created_at: '2026-10-26T10:00:00.000Z' }), ev({ hint_id: 'h2' })];
            const res = await getDismissed();
            expect(res.body.dismissed.sort()).toEqual(['h1', 'h2']);
        });

        test('tabela hint_events ausente (42P01) -> 200 lista vazia', async () => {
            mockDb.failOn['hint_events.select'] = { code: '42P01', message: 'relation does not exist' };
            const res = await getDismissed();
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ dismissed: [] });
        });

        test('erro do Supabase -> 500 (e o erro é logado)', async () => {
            mockDb.failOn['hint_events.select'] = { code: 'XX000', message: 'boom interno' };
            const res = await getDismissed();
            expect(res.statusCode).toBe(500);
            expect(errSpy).toHaveBeenCalled();
        });

        // COMPORTAMENTO ESTRANHO documentado: a rota devolve err.message cru do
        // Supabase no 500 (pode vazar nome de tabela/coluna). Hoje vaza; quando
        // for sanitizado, este test.failing passa a falhar -> trocar por test.
        test.failing('500 NÃO deveria vazar a mensagem interna do Supabase', async () => {
            mockDb.failOn['hint_events.select'] = { code: 'XX000', message: 'boom interno' };
            const res = await getDismissed();
            expect(JSON.stringify(res.body)).not.toContain('boom interno');
        });
    });

    describe('POST /:id/hints/:hintId/event', () => {
        test.each(HINT_EVENT_TYPES)('eventType "%s" grava a linha com os campos certos', async (type) => {
            const res = await postEvent({ body: { eventType: type } });
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true });
            expect(mockDb.inserts).toEqual([{
                table: 'hint_events',
                row: { student_id: 'stu-1', assignment_id: 7, turma_id: 'turma-A', hint_id: 'h1', event_type: type },
            }]);
        });

        test('sem turma nas claims grava turma_id = null', async () => {
            const res = await postEvent({ turmaId: undefined });
            expect(res.statusCode).toBe(200);
            expect(mockDb.inserts[0].row.turma_id).toBeNull();
        });

        test('não manda created_at (quem carimba é o DEFAULT do banco)', async () => {
            await postEvent();
            expect(mockDb.inserts[0].row).not.toHaveProperty('created_at');
        });

        test.each([['inventado'], [''], [undefined], [null], [123], [['shown']]])(
            'eventType inválido (%p) -> 400 e nada gravado', async (bad) => {
                const res = await postEvent({ body: { eventType: bad } });
                expect(res.statusCode).toBe(400);
                expect(mockDb.inserts).toEqual([]);
            }
        );

        test('sem body -> 400', async () => {
            const res = await postEvent({ body: undefined });
            expect(res.statusCode).toBe(400);
        });

        test('sem userId -> 401 e nada gravado', async () => {
            const res = await postEvent({ userId: undefined });
            expect(res.statusCode).toBe(401);
            expect(mockDb.inserts).toEqual([]);
        });

        test('id da missão não numérico -> 400', async () => {
            const res = await postEvent({ params: { id: 'x', hintId: 'h1' } });
            expect(res.statusCode).toBe(400);
            expect(mockDb.inserts).toEqual([]);
        });

        test('hintId vazio -> 400', async () => {
            const res = await postEvent({ params: { id: '7', hintId: '' } });
            expect(res.statusCode).toBe(400);
            expect(mockDb.inserts).toEqual([]);
        });

        // Comportamento atual: hintId "malformado" (fora do padrão hN) NÃO é
        // validado - qualquer string não vazia é gravada como veio (o Supabase
        // parametriza, então não há injeção, só lixo em hint_events).
        test('hintId fora do padrão hN é gravado como veio (sem validação de formato)', async () => {
            const res = await postEvent({ params: { id: '7', hintId: "x'; DROP TABLE hint_events;--" } });
            expect(res.statusCode).toBe(200);
            expect(mockDb.inserts[0].row.hint_id).toBe("x'; DROP TABLE hint_events;--");
        });

        test('sem Supabase configurado -> 503', async () => {
            delete process.env.SUPABASE_URL;
            const res = await postEvent();
            expect(res.statusCode).toBe(503);
        });

        test('tabela ausente (42P01) -> descarta o evento mas responde sucesso', async () => {
            mockDb.failOn['hint_events.insert'] = { code: '42P01', message: 'relation does not exist' };
            const res = await postEvent();
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true });
        });

        test('erro do Supabase -> 500, logado', async () => {
            mockDb.failOn['hint_events.insert'] = { code: 'XX000', message: 'segredo interno' };
            const res = await postEvent();
            expect(res.statusCode).toBe(500);
            expect(errSpy).toHaveBeenCalled();
        });

        test.failing('500 NÃO deveria vazar a mensagem interna do Supabase', async () => {
            mockDb.failOn['hint_events.insert'] = { code: 'XX000', message: 'segredo interno' };
            const res = await postEvent();
            expect(JSON.stringify(res.body)).not.toContain('segredo interno');
        });

        // Observação: a rota NÃO confere se a missão existe nem se o aluno
        // pertence a ela - missão inexistente só falha pela FK do banco (500).
        test('missão inexistente no mock (sem FK) é aceita: a rota não valida a missão', async () => {
            const res = await postEvent({ params: { id: '999', hintId: 'h1' } });
            expect(res.statusCode).toBe(200);
            expect(mockDb.inserts[0].row.assignment_id).toBe(999);
        });
    });

    describe('POST /:id/hints', () => {
        const H = (id, extra) => ({ id, text: `dica ${id}`, when: { type: 'always' }, ...extra });

        test('sem userId -> 401', async () => {
            const res = await postHints({ userId: undefined, body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(401);
            expect(mockDb.updates).toEqual([]);
        });

        test('sem Supabase configurado -> 503', async () => {
            delete process.env.SUPABASE_URL;
            const res = await postHints({ body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(503);
        });

        test('id da missão não numérico -> 400', async () => {
            const res = await postHints({ params: { id: 'x' }, body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(400);
        });

        test('professor dono salva; SUBSTITUI o array inteiro (sem merge)', async () => {
            const hints = [H('h1'), H('h2')];
            const res = await postHints({ body: { hints } });
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ success: true });
            expect(mockDb.tables.assignments.find((a) => a.id === 7).hints).toEqual(hints);
            // a 'h9' antiga some
            expect(JSON.stringify(mockDb.tables.assignments[0].hints)).not.toContain('h9');
        });

        test('payload do update contém SÓ { hints } (carimbo vem do trigger do banco)', async () => {
            const hints = [H('h1')];
            await postHints({ body: { hints } });
            expect(mockDb.updates).toEqual([{ table: 'assignments', payload: { hints } }]);
            expect(mockDb.updates[0].payload).not.toHaveProperty('hints_updated_at');
        });

        test('array vazio é aceito (professor apaga todas as dicas)', async () => {
            const res = await postHints({ body: { hints: [] } });
            expect(res.statusCode).toBe(200);
            expect(mockDb.tables.assignments[0].hints).toEqual([]);
        });

        test('professor que NÃO é dono do projeto-exemplo -> 404 e nada gravado', async () => {
            const res = await postHints({ userId: 'prof-2', body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(404);
            expect(mockDb.updates).toEqual([]);
        });

        test('aluno/usuário qualquer (sem projeto vinculado) -> 404 e nada gravado', async () => {
            const res = await postHints({ userId: 'stu-1', body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(404);
            expect(mockDb.updates).toEqual([]);
        });

        test('missão inexistente -> 404', async () => {
            const res = await postHints({ params: { id: '999' }, body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(404);
            expect(mockDb.updates).toEqual([]);
        });

        test('referência (template_id setado) é RECUSADA com 400, não redirecionada ao template', async () => {
            const res = await postHints({ params: { id: '8' }, body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(400);
            expect(mockDb.updates).toEqual([]);
            expect(mockDb.tables.assignments.find((a) => a.id === 7).hints[0].id).toBe('h9');
        });

        test('projeto marcado deleted != NO não conta como dono', async () => {
            mockDb.tables.projects[0].deleted = 'YES';
            const res = await postHints({ body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(404);
            expect(mockDb.updates).toEqual([]);
        });

        describe('validação do body', () => {
            test.each([
                ['body ausente', undefined],
                ['hints ausente', {}],
                ['hints string', { hints: 'oi' }],
                ['hints objeto', { hints: { id: 'h1' } }],
                ['hints null', { hints: null }],
                ['item null', { hints: [null] }],
                ['item string', { hints: ['h1'] }],
                ['dica sem id', { hints: [{ text: 't', when: { type: 'always' } }] }],
                ['id vazio', { hints: [{ id: '', text: 't', when: { type: 'always' } }] }],
                ['id numérico', { hints: [{ id: 1, text: 't', when: { type: 'always' } }] }],
                ['dica sem text', { hints: [{ id: 'h1', when: { type: 'always' } }] }],
                ['text vazio', { hints: [{ id: 'h1', text: '', when: { type: 'always' } }] }],
                ['dica sem when', { hints: [{ id: 'h1', text: 't' }] }],
                ['when string', { hints: [{ id: 'h1', text: 't', when: 'always' }] }],
                ['when sem type', { hints: [{ id: 'h1', text: 't', when: {} }] }],
                ['when.type vazio', { hints: [{ id: 'h1', text: 't', when: { type: '' } }] }],
                ['uma válida e uma inválida', { hints: [H('h1'), { id: 'h2' }] }],
            ])('%s -> 400 e nada gravado', async (_nome, body) => {
                const res = await postHints({ body });
                expect(res.statusCode).toBe(400);
                expect(mockDb.updates).toEqual([]);
            });

            // Comportamento atual: não há limite de tamanho no array nem no
            // texto (só o limite de body do Express, em index.js). Documentado
            // aqui pra alguém notar se um limite for adicionado.
            test('sem limite de quantidade/tamanho na rota: 500 dicas com texto longo são aceitas', async () => {
                const hints = Array.from({ length: 500 }, (_, i) => H(`h${i + 1}`, { text: 'x'.repeat(2000) }));
                const res = await postHints({ body: { hints } });
                expect(res.statusCode).toBe(200);
                expect(mockDb.tables.assignments[0].hints).toHaveLength(500);
            });

            test('campos extras da dica são persistidos como vieram (sem sanitização)', async () => {
                const hints = [H('h1', { extra: 'x', when: { type: 'always', foo: 1 } })];
                await postHints({ body: { hints } });
                expect(mockDb.tables.assignments[0].hints).toEqual(hints);
            });
        });

        test('erro no update -> 500 e erro logado', async () => {
            mockDb.failOn['assignments.update'] = { code: 'XX000', message: 'falha no update' };
            const res = await postHints({ body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(500);
            expect(errSpy).toHaveBeenCalled();
        });

        test('erro ao consultar projetos -> 500', async () => {
            mockDb.failOn['projects.select'] = { code: 'XX000', message: 'falha projects' };
            const res = await postHints({ body: { hints: [H('h1')] } });
            expect(res.statusCode).toBe(500);
            expect(mockDb.updates).toEqual([]);
        });

        test.failing('500 NÃO deveria vazar a mensagem interna do Supabase', async () => {
            mockDb.failOn['assignments.update'] = { code: 'XX000', message: 'falha no update' };
            const res = await postHints({ body: { hints: [H('h1')] } });
            expect(JSON.stringify(res.body)).not.toContain('falha no update');
        });
    });
});
