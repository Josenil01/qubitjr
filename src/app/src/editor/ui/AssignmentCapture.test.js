// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
    snapshot: { pages: ['p'], currentPage: 'p', p: { sprites: ['a'], a: { type: 'sprite', name: 'Ruby' } } },
    saveProject: vi.fn(), thumbnail: vi.fn(), actor: vi.fn(), scripts: vi.fn(), loadedProjectId: '42',
}));
vi.mock('../ScratchJr.js', () => ({ default: {
    currentProject: 42, stage: { pages: [{ id: 'p' }] }, stopStrips: vi.fn(),
    saveProject: (...args) => mocks.saveProject(...args),
} }));
vi.mock('./Project.js', () => ({ default: {
    get loadedProjectId() { return mocks.loadedProjectId; },
    getProject: () => structuredClone(mocks.snapshot), getThumbnailPNG: (...args) => mocks.thumbnail(...args),
} }));
vi.mock('./CaptureRenderer.js', () => ({ CAPTURE_RENDERER_VERSION: 2, captureActor: mocks.actor, captureScripts: mocks.scripts, waitForScene: vi.fn() }));
import {saveAssignmentCaptures, ensureAssignmentCaptures} from './AssignmentCapture.js';

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
    mocks.loadedProjectId = '42';
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

function automaticRequest(status = {}) {
    return vi.fn(async (path) => ({ ok: true, json: async () => path.endsWith('/status') ?
        { projectId: 42, hasCompletedCapture: false, hints: [{id: 'saved-hint'}], ...status } :
        { capture: { id: 'automatic-capture', expected: manifest } },
    }));
}

describe('automatic capture on opening the editor', () => {
    it('does nothing when the project already has a completed capture', async () => {
        const api = automaticRequest({hasCompletedCapture: true, captureId: 'existing'});
        const start = vi.fn();
        expect(await ensureAssignmentCaptures(101, api, {onStart: start})).toEqual({status: 'existing', captureId: 'existing'});
        expect(api).toHaveBeenCalledOnce();
        expect(start).not.toHaveBeenCalled();
        expect(mocks.saveProject).not.toHaveBeenCalled();
        expect(mocks.scripts).not.toHaveBeenCalled();
    });
    it('captures missing images with the saved hints, without saving the project or hints again', async () => {
        const api = automaticRequest();
        const start = vi.fn(), finish = vi.fn();
        expect(await ensureAssignmentCaptures(102, api, {onStart: start, onFinish: finish})).toMatchObject({status: 'completed'});
        expect(mocks.saveProject).not.toHaveBeenCalled();
        expect(api.mock.calls.some(([path]) => path.endsWith('/hints'))).toBe(false);
        const created = api.mock.calls.find(([path]) => path === '/assignments/102/captures');
        expect(JSON.parse(created[1].body)).toMatchObject({hints: [{id: 'saved-hint'}], onlyIfMissing: true});
        expect(start).toHaveBeenCalledOnce();
        expect(finish).toHaveBeenCalledOnce();
    });
    it('also works for an existing mission without saved hints', async () => {
        const api = automaticRequest({hints: []});
        await ensureAssignmentCaptures(103, api);
        const created = api.mock.calls.find(([path]) => path === '/assignments/103/captures');
        expect(JSON.parse(created[1].body).hints).toEqual([]);
        expect(mocks.saveProject).not.toHaveBeenCalled();
    });
    it('coalesces repeated checks for the same project in this editor session', async () => {
        const api = automaticRequest({hasCompletedCapture: true});
        const first = ensureAssignmentCaptures(104, api);
        const second = ensureAssignmentCaptures(104, api);
        expect(second).toBe(first);
        await first;
        expect(api).toHaveBeenCalledOnce();
    });
    it('waits until all scenes have finished loading before checking captures', async () => {
        vi.useFakeTimers();
        try {
            mocks.loadedProjectId = null;
            const api = automaticRequest({hasCompletedCapture: true});
            const pending = ensureAssignmentCaptures(105, api);
            expect(api).not.toHaveBeenCalled();
            mocks.loadedProjectId = '42';
            await vi.advanceTimersByTimeAsync(100);
            await pending;
            expect(api).toHaveBeenCalledOnce();
        } finally { vi.useRealTimers(); }
    });
    it('does not interrupt another save or hint review already in progress', async () => {
        const api = automaticRequest();
        const start = vi.fn();
        expect(await ensureAssignmentCaptures(106, api, {canStart: () => false, onStart: start})).toEqual({status: 'skipped'});
        expect(api).toHaveBeenCalledOnce();
        expect(start).not.toHaveBeenCalled();
    });
    it('unlocks the UI if an upload fails', async () => {
        const api = automaticRequest();
        const finish = vi.fn();
        api.mockImplementation(async (path) => ({ok: !path.includes('/images/'), json: async () =>
            path.endsWith('/status') ? {projectId: 42, hasCompletedCapture: false, hints: []} :
            {capture: {id: 'capture', expected: manifest}, error: 'Upload falhou'},
        }));
        await expect(ensureAssignmentCaptures(107, api, {onFinish: finish})).rejects.toThrow('Upload falhou');
        expect(finish).toHaveBeenCalledOnce();
        expect(mocks.saveProject).not.toHaveBeenCalled();
    });
    it('accepts an existing capture detected by the server after the initial check', async () => {
        const api = automaticRequest();
        api.mockImplementation(async (path) => ({ok: true, json: async () => path.endsWith('/status') ?
            {projectId: 42, hasCompletedCapture: false, hints: []} : {skipped: true, capture: {id: 'other-tab'}},
        }));
        expect(await ensureAssignmentCaptures(108, api)).toMatchObject({captureId: 'other-tab'});
        expect(api).toHaveBeenCalledTimes(2);
        expect(mocks.scripts).not.toHaveBeenCalled();
    });
});
