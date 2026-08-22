/**
 * backend/src/routes/share.test.js
 *
 * Smoke test standalone para routes/share.js: em vez de subir um servidor
 * HTTP de verdade, pega o handler direto de publicRouter.stack (Express
 * guarda cada rota registrada como { route: { path, stack: [{ handle }] } })
 * e chama com req/res mockados. Cobre só os caminhos que não dependem de uma
 * conexão Supabase real (checagem de auth e validação de body/params) - os
 * caminhos que tocam o banco (sucesso, 404 de molde, etc.) ficam pra um teste
 * de integração à parte, que precisaria de um Supabase real ou mockado.
 */

'use strict';

const path = require('path');

function loadRouterFresh() {
    // jest cacheia require() entre testes; como cada teste mexe em
    // process.env antes de importar, usamos jest.resetModules() no
    // beforeEach (abaixo) em vez de invalidar o cache aqui manualmente.
    return require(path.join(__dirname, 'share.js'));
}

function findRoute(router, method, routePath) {
    const layer = router.stack.find(
        (l) => l.route && l.route.path === routePath && l.route.methods[method]
    );
    if (!layer) {
        throw new Error(`Rota ${method.toUpperCase()} ${routePath} não encontrada no router`);
    }
    // Pega o último handler da pilha da rota (o handler "de verdade", depois
    // de eventuais middlewares — nenhuma dessas rotas tem middleware extra
    // hoje, mas isso deixa o teste robusto se algum for adicionado depois).
    const handlers = layer.route.stack.map((s) => s.handle);
    return handlers[handlers.length - 1];
}

function mockReq({ params = {}, query = {}, headers = {}, body = {} } = {}) {
    return { params, query, headers, body };
}

function mockRes() {
    const res = {};
    res.statusCode = 200;
    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn((payload) => {
        res.body = payload;
        return res;
    });
    return res;
}

describe('publicRouter POST /activities/:activityId/adopt', () => {
    const ROUTE = '/activities/:activityId/adopt';
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    test('503 quando HELLOYOTTA_INBOUND_API_KEY não está configurada', async () => {
        delete process.env.HELLOYOTTA_INBOUND_API_KEY;
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: {},
            body: { turmaId: 'turma-1', teacherId: 'prof-1' },
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.body).toEqual({ error: 'Endpoint not configured' });
    });

    test('401 quando a chave enviada está errada', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: { authorization: 'Bearer chave-errada' },
            body: { turmaId: 'turma-1', teacherId: 'prof-1' },
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ error: 'Invalid or missing API key' });
    });

    test('401 quando não envia nenhum header de autorização', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: {},
            body: { turmaId: 'turma-1', teacherId: 'prof-1' },
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('400 quando falta turmaId no body (com chave e Supabase configurados)', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: { authorization: 'Bearer chave-correta' },
            body: { teacherId: 'prof-1' }, // turmaId ausente de propósito
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body.error).toMatch(/turmaId/);
    });

    test('400 quando falta teacherId no body (com chave e Supabase configurados)', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: { authorization: 'Bearer chave-correta' },
            body: { turmaId: 'turma-1' }, // teacherId ausente de propósito
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body.error).toMatch(/teacherId/);
    });

    test('400 quando falta turmaId e teacherId juntos', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: { authorization: 'Bearer chave-correta' },
            body: {},
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 quando activityId no path não é um número válido', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: 'not-a-number' },
            headers: { authorization: 'Bearer chave-correta' },
            body: { turmaId: 'turma-1', teacherId: 'prof-1' },
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body).toEqual({ error: 'Invalid activityId' });
    });

    test('503 quando Supabase não está configurado (mesmo com chave e body OK)', async () => {
        process.env.HELLOYOTTA_INBOUND_API_KEY = 'chave-correta';
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const { publicRouter } = loadRouterFresh();
        const handler = findRoute(publicRouter, 'post', ROUTE);

        const req = mockReq({
            params: { activityId: '1' },
            headers: { authorization: 'Bearer chave-correta' },
            body: { turmaId: 'turma-1', teacherId: 'prof-1' },
        });
        const res = mockRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.body).toEqual({ error: 'Database not configured' });
    });
});

describe('publicRouter — outras rotas continuam registradas', () => {
    test('GET /students/:studentId/assignment-score e GET /teachers/:teacherId/activities ainda existem', () => {
        const { publicRouter } = loadRouterFresh();
        expect(() => findRoute(publicRouter, 'get', '/students/:studentId/assignment-score')).not.toThrow();
        expect(() => findRoute(publicRouter, 'get', '/teachers/:teacherId/activities')).not.toThrow();
    });
});
