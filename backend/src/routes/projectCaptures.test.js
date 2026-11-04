const express = require('express');
const createRoutes = require('./projectCaptures');
const { randomUUID } = require('crypto');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5VQAAAAASUVORK5CYII=';
const snapshot = { pages: ['p'], p: { sprites: ['a'], a: { type: 'sprite', name: 'Ruby' } } };
let server, base, state;

function query(table) {
    let mode = 'read', values, single = false;
    const filters = [];
    const q = {
        select: () => q, eq: (key, value) => { filters.push([key, value]); return q; },
        order: () => q, limit: () => q,
        insert: (value) => { mode = 'insert'; values = value; return q; },
        upsert: (value) => { mode = 'upsert'; values = value; return q; },
        update: (value) => { mode = 'update'; values = value; return q; },
        single: () => { single = true; return q; }, maybeSingle: () => { single = true; return q; },
        then: (resolve, reject) => Promise.resolve().then(() => {
            let rows = state[table];
            if (mode === 'insert') { const row = { id: randomUUID(), ...values }; rows.push(row); return { data: row, error: null }; }
            if (mode === 'upsert') {
                const index = rows.findIndex((r) => r.capture_id === values.capture_id && r.image_key === values.image_key);
                if (index < 0) rows.push(values); else rows[index] = values;
                return { error: null };
            }
            rows = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
            if (mode === 'update') rows.forEach((row) => Object.assign(row, values));
            return { data: single ? rows[0] || null : rows, error: null };
        }).then(resolve, reject),
    };
    return q;
}

beforeEach(async () => {
    state = { project_captures: [], project_capture_images: [], assignments: [{ id: 7, hints: [{ id: 'h1' }] }], uploads: [] };
    const db = { from: query, storage: { from: () => ({
        upload: async (path) => { state.uploads.push(path); return { error: null }; },
        createSignedUrls: async (paths) => ({ data: paths.map((path) => ({ signedUrl: 'signed:' + path })), error: null }),
    }) } };
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.userId = req.headers['x-user']; next(); });
    app.use('/:id/captures', createRoutes({ getSupabase: () => db,
        findOwnedTemplateProject: async (_db, id, req) => req.userId === 'teacher' && id === 7 ?
            { project: { id: 42, json: snapshot } } : { httpError: { status: 403, body: { error: 'Forbidden' } } },
    }));
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = 'http://127.0.0.1:' + server.address().port;
});
afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });

async function api(path, method = 'GET', body, user = 'teacher') {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': user } : {}) },
        body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
}
async function start() {
    const result = await api('/7/captures', 'POST', { projectId: 42, snapshot, hints: [{ id: 'h1' }] });
    expect(result.status).toBe(201);
    return result.body.capture;
}

test('full workflow associates scene, actor and program with project, returning private signed URLs', async () => {
    const capture = await start();
    expect(capture.expected).toHaveLength(3);
    for (const item of capture.expected) {
        const r = await api(`/7/captures/${capture.id}/images/${item.key}`, 'PUT', { data: png });
        expect(r.status).toBe(200);
    }
    expect((await api(`/7/captures/${capture.id}/complete`, 'POST', {})).status).toBe(200);
    const detail = await api(`/7/captures/${capture.id}`);
    expect(detail.body.capture.status).toBe('completed');
    expect(detail.body.images).toHaveLength(3);
    expect(detail.body.images.every((image) => image.project_id === 42 && image.scene_id === 'p' && image.url.startsWith('signed:'))).toBe(true);
    expect(state.uploads.every((path) => path.startsWith(`projetos/42/capturas/${capture.id}/`))).toBe(true);
});

test('incomplete batch never replaces a complete batch and completed images cannot be overwritten', async () => {
    const previous = await start();
    for (const item of previous.expected) await api(`/7/captures/${previous.id}/images/${item.key}`, 'PUT', { data: png });
    await api(`/7/captures/${previous.id}/complete`, 'POST', {});
    const pending = await start();
    expect((await api(`/7/captures/${pending.id}/complete`, 'POST', {})).status).toBe(409);
    expect(state.project_captures[0].status).toBe('completed');
    expect(state.project_captures[1].status).toBe('pending');
    expect((await api(`/7/captures/${previous.id}/images/0-scene`, 'PUT', { data: png })).status).toBe(409);
});

test('unauthenticated users and other owners cannot list, upload or read captures', async () => {
    expect((await api('/7/captures', 'GET', null, null)).status).toBe(401);
    const capture = await start();
    expect((await api('/7/captures', 'GET', null, 'other')).status).toBe(403);
    expect((await api(`/7/captures/${capture.id}`, 'GET', null, 'other')).status).toBe(403);
    expect((await api(`/7/captures/${capture.id}/images/0-scene`, 'PUT', { data: png }, 'other')).status).toBe(403);
    expect(state.uploads).toHaveLength(0);
});

test('rejects stale project or hints and arbitrary image keys before uploading', async () => {
    expect((await api('/7/captures', 'POST', { projectId: 42, snapshot: { ...snapshot, extra: 1 }, hints: [{ id: 'h1' }] })).status).toBe(409);
    expect((await api('/7/captures', 'POST', { projectId: 42, snapshot, hints: [] })).status).toBe(409);
    const capture = await start();
    expect((await api(`/7/captures/${capture.id}/images/arbitrary`, 'PUT', { data: png })).status).toBe(400);
    expect(state.uploads).toHaveLength(0);
});


test('automatic capture status returns saved hints only when no complete batch exists', async () => {
    const initial = await api('/7/captures/status');
    expect(initial.status).toBe(200);
    expect(initial.body).toEqual({projectId: 42, hasCompletedCapture: false, hints: [{id: 'h1'}]});
    const pending = await start();
    expect((await api('/7/captures/status')).body.hasCompletedCapture).toBe(false);
    for (const item of pending.expected) await api(`/7/captures/${pending.id}/images/${item.key}`, 'PUT', {data: png});
    await api(`/7/captures/${pending.id}/complete`, 'POST', {});
    const ready = await api('/7/captures/status');
    expect(ready.body).toEqual({projectId: 42, hasCompletedCapture: true, captureId: pending.id});
});

test('onlyIfMissing does not create another batch after an existing capture completes', async () => {
    const capture = await start();
    for (const item of capture.expected) await api(`/7/captures/${capture.id}/images/${item.key}`, 'PUT', {data: png});
    await api(`/7/captures/${capture.id}/complete`, 'POST', {});
    const result = await api('/7/captures', 'POST', {projectId: 42, onlyIfMissing: true});
    expect(result.status).toBe(200);
    expect(result.body.skipped).toBe(true);
    expect(result.body.capture.id).toBe(capture.id);
    expect(state.project_captures).toHaveLength(1);
});

test('capture status remains private even though image consultation is public', async () => {
    expect((await api('/7/captures/status', 'GET', null, null)).status).toBe(401);
    expect((await api('/7/captures/status', 'GET', null, 'other')).status).toBe(403);
});
