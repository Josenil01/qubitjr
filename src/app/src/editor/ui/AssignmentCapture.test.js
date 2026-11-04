// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
    snapshot: { pages: ['p'], currentPage: 'p', p: { sprites: ['a'], a: { type: 'sprite', name: 'Ruby' } } },
    saveProject: vi.fn(), thumbnail: vi.fn(), actor: vi.fn(), scripts: vi.fn(),
}));
vi.mock('../ScratchJr.js', () => ({ default: {
    currentProject: 42, stage: { pages: [{ id: 'p' }] }, stopStrips: vi.fn(),
    saveProject: (...args) => mocks.saveProject(...args),
} }));
vi.mock('./Project.js', () => ({ default: {
    getProject: () => structuredClone(mocks.snapshot), getThumbnailPNG: (...args) => mocks.thumbnail(...args),
} }));
vi.mock('./CaptureRenderer.js', () => ({ captureActor: mocks.actor, captureScripts: mocks.scripts, waitForScene: vi.fn() }));
import {saveAssignmentCaptures} from './AssignmentCapture.js';

const manifest = [{key: '0-scene', kind: 'scene', scene_id: 'p'},
    {key: '0-0-actor', kind: 'actor', scene_id: 'p', actor_id: 'a'},
    {key: '0-0-scripts', kind: 'scripts', scene_id: 'p', actor_id: 'a'}];
function request(onRequest = () => {}) {
    return vi.fn(async (path, options) => {
        onRequest(path, options);
        return { ok: true, json: async () => ({ capture: { id: 'capture-1', expected: manifest } }) };
    });
}
beforeEach(() => {
    vi.clearAllMocks();
    delete mocks.snapshot.extra;
    document.body.innerHTML = '<div id="a"></div><div id="a_scripts"></div>';
    document.getElementById('a').owner = {};
    mocks.saveProject.mockImplementation((_event, done) => done());
    mocks.thumbnail.mockImplementation((_page, _w, _h, done) => done('scene-png'));
    mocks.actor.mockResolvedValue('actor-png');
    mocks.scripts.mockResolvedValue('scripts-png');
});
describe('capture save pipeline', () => {
    it('saves the project, uploads each image and only then completes the version', async () => {
        const api = request();
        await saveAssignmentCaptures(7, [{id: 'h'}], api, vi.fn());
        expect(mocks.saveProject).toHaveBeenCalledOnce();
        expect(api.mock.calls.map(([path]) => path)).toEqual([
            '/assignments/7/captures', '/assignments/7/captures/capture-1/images/0-scene',
            '/assignments/7/captures/capture-1/images/0-0-actor', '/assignments/7/captures/capture-1/images/0-0-scripts',
            '/assignments/7/captures/capture-1/complete',
        ]);
        expect(mocks.scripts).toHaveBeenCalledWith(document.getElementById('a_scripts'));
    });
    it('does not complete when the project changes during the last upload', async () => {
        const api = request((path) => { if (path.endsWith('images/0-0-scripts')) mocks.snapshot.extra = true; });
        await expect(saveAssignmentCaptures(7, [], api, vi.fn())).rejects.toThrow('mudou');
        expect(api.mock.calls.some(([path]) => path.endsWith('/complete'))).toBe(false);
    });
    it('does not complete when an image fails to upload', async () => {
        const api = request();
        api.mockImplementationOnce(async () => ({ok: true, json: async () => ({capture: {id: 'capture-1', expected: manifest}})}));
        api.mockImplementationOnce(async () => ({ok: false, json: async () => ({error: 'Upload falhou'})}));
        await expect(saveAssignmentCaptures(7, [], api, vi.fn())).rejects.toThrow('Upload falhou');
        expect(api.mock.calls.some(([path]) => path.endsWith('/complete'))).toBe(false);
    });
});
