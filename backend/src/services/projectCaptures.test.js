const { fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath } = require('./projectCaptures');

const snapshot = {
    pages: ['scene-a', 'scene-b'], currentPage: 'scene-a',
    'scene-a': { sprites: ['actor-a', 'text-a'], 'actor-a': { type: 'sprite', name: 'Ruby' }, 'text-a': { type: 'text' } },
    'scene-b': { sprites: ['actor-b'], 'actor-b': { type: 'sprite', name: 'Ruby', shown: false } },
};

test('version hash is stable across database key ordering, but detects script changes', () => {
    expect(fingerprint({ b: 2, a: 1 })).toBe(fingerprint({ a: 1, b: 2 }));
    expect(fingerprint({ scripts: [['forward', 1]] })).not.toBe(fingerprint({ scripts: [['forward', 2]] }));
    expect(projectSnapshot(snapshot)).not.toHaveProperty('currentPage');
    expect(snapshot).toHaveProperty('currentPage');
});

test('captures every scene and every actor occurrence including hidden actors', () => {
    const items = captureManifest(snapshot);
    expect(items).toHaveLength(6);
    expect(items.filter((item) => item.kind === 'scene')).toHaveLength(2);
    expect(items.filter((item) => item.kind === 'scripts').map((item) => item.actor_id)).toEqual(['actor-a', 'actor-b']);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
    expect(items.some((item) => item.actor_id === 'text-a')).toBe(false);
});

test('storage paths use server-derived indices rather than untrusted scene or actor names', () => {
    expect(imagePath({ id: 'capture', project_id: 42 }, { scene_index: 1, actor_index: 2, kind: 'scripts', actor_id: '../' }))
        .toBe('projetos/42/capturas/capture/cenas/2/atores/3/programacao.png');
});

test('validates PNG header and actual dimensions instead of client-supplied metadata', () => {
    const data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5VQAAAAASUVORK5CYII=';
    expect(decodePNG({ data, width: 999 })).toMatchObject({ width: 1, height: 1 });
    expect(() => decodePNG({ data: 'data:image/png;base64,PHN2Zz4=' })).toThrow('PNG inválido');
    expect(() => decodePNG({ data: 'data:image/svg+xml;base64,PHN2Zz4=' })).toThrow();
    const huge = Buffer.from(data.split(',')[1], 'base64');
    huge.writeUInt32BE(20000, 16);
    expect(() => decodePNG({ data: 'data:image/png;base64,' + huge.toString('base64') })).toThrow('Dimensões');
});

test('invalid and oversized snapshots are rejected', () => {
    expect(() => projectSnapshot(undefined)).toThrow('Snapshot inválido');
    expect(() => projectSnapshot({ pages: [] })).toThrow('sem cenas');
    const page = { sprites: [] };
    for (let i = 0; i < 151; i++) { page.sprites.push('s' + i); page['s' + i] = { type: 'sprite' }; }
    expect(() => captureManifest({ pages: ['p'], p: page })).toThrow('300');
});
