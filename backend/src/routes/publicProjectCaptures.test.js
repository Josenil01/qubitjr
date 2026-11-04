const express = require('express');
const routes = require('./publicProjectCaptures');

let state, server, base, reachedAuth;
function query(table) {
    const filters = [], sorts = [];
    let limit = Infinity, single = false;
    const q = {
        select: () => q,
        eq: (key, value) => { filters.push([key, value]); return q; },
        order: (key, options) => { sorts.push([key, !options || options.ascending !== false]); return q; },
        limit: (value) => { limit = value; return q; },
        maybeSingle: () => { single = true; return q; },
        then: (resolve, reject) => Promise.resolve().then(() => {
            let rows = state[table].filter((row) => filters.every(([key, value]) => row[key] === value));
            rows.sort((a, b) => {
                for (const [key, ascending] of sorts) {
                    if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
                }
                return 0;
            });
            rows = rows.slice(0, limit);
            return { data: single ? rows[0] || null : rows, error: null };
        }).then(resolve, reject),
    };
    return q;
}

beforeEach(async () => {
    reachedAuth = 0;
    state = {
        projects: [{ id: 42, deleted: 'NO' }, { id: 50, deleted: 'YES' }, { id: 60, deleted: 'NO' }],
        project_captures: [
            { id: 'older', project_id: 42, status: 'completed', created_at: '2026-11-01', project_version: 'v1' },
            { id: 'latest', project_id: 42, status: 'completed', created_at: '2026-11-02', completed_at: '2026-11-02', project_version: 'v2', project_snapshot: 'private', hints_snapshot: 'private', created_by: 'private' },
            { id: 'pending', project_id: 42, status: 'pending', created_at: '2026-11-03' },
            { id: 'other-project', project_id: 99, status: 'completed', created_at: '2026-11-04' },
        ],
        project_capture_images: ['scene', 'actor', 'scripts'].map((kind, index) => ({
            capture_id: 'latest', project_id: 42, image_key: String(index), kind,
            scene_id: 'scene-a', scene_index: 0, actor_id: kind === 'scene' ? null : 'actor-a',
            actor_name: kind === 'scene' ? null : 'Ruby', storage_path: 'private/' + kind + '.png', width: 480, height: 360,
        })),
    };
    state.sign = jest.fn(async (paths, ttl) => ({
        data: paths.map((path) => ({ path, signedUrl: 'https://storage.example/' + path + '?expires=' + ttl })).reverse(), error: null,
    }));
    const db = { from: query, storage: { from: () => ({ createSignedUrls: (...args) => state.sign(...args) }) } };
    const app = express();
    app.use('/api/public', routes(() => db));
    app.use((_req, res) => { reachedAuth++; res.status(401).json({ error: 'Authorization required' }); });
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = 'http://127.0.0.1:' + server.address().port;
});
afterEach(async () => { await new Promise((resolve) => server.close(resolve)); });
async function get(id) {
    const response = await fetch(base + '/api/public/projects/' + id + '/captures');
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
}

test('public request needs no auth and returns latest complete capture, not newer pending or other projects', async () => {
    const result = await get(42);
    expect(result.status).toBe(200);
    expect(reachedAuth).toBe(0);
    expect(result.cache).toBe('no-store');
    expect(result.body).toMatchObject({ projectId: 42, captureId: 'latest', projectVersion: 'v2', expiresIn: 600 });
    expect(result.body.images.map((image) => image.type)).toEqual(['scene', 'actor', 'scripts']);
    expect(result.body.images[0].actorId).toBeNull();
    expect(result.body.images[2]).toMatchObject({ sceneId: 'scene-a', actorId: 'actor-a', actorName: 'Ruby' });
    expect(result.body.images[2].url).toContain('/scripts.png?expires=600');
    expect(result.body).not.toHaveProperty('project_snapshot');
    expect(result.body).not.toHaveProperty('hints_snapshot');
    expect(result.body).not.toHaveProperty('created_by');
    expect(result.body.images.every((image) => !('storage_path' in image))).toBe(true);
});

test.each(['0', '-1', '1.5', '42x', '9007199254740992'])('rejects invalid id %s before accessing storage', async (id) => {
    expect((await get(id)).status).toBe(400);
    expect(state.sign).not.toHaveBeenCalled();
});

test('returns 404 for missing/deleted projects and projects without complete captures', async () => {
    for (const id of [123, 50, 60]) expect((await get(id)).status).toBe(404);
    expect(state.sign).not.toHaveBeenCalled();
});

test('does not mix images from a different project', async () => {
    state.project_capture_images.push({ ...state.project_capture_images[0], project_id: 99 });
    expect((await get(42)).body.images).toHaveLength(3);
});

test('fails explicitly when a storage object cannot be signed instead of returning a partial response', async () => {
    state.sign.mockResolvedValue({ data: [{ path: 'private/scene.png', error: 'Object missing' }], error: null });
    const result = await get(42);
    expect(result.status).toBe(502);
    expect(result.body).not.toHaveProperty('images');
});


test('missing captures return a machine-readable code for integrations', async () => {
    expect((await get(60)).body.code).toBe('CAPTURES_NOT_FOUND');
});
