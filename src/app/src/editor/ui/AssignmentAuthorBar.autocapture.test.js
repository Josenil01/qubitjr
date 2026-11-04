// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({ scratch: {currentProject: 42, onHold: false}, ensure: vi.fn() }));
vi.mock('../ScratchJr.js', () => ({default: mocks.scratch}));
vi.mock('./AssignmentCapture.js', () => ({ensureAssignmentCaptures: mocks.ensure}));

let AuthorBar;
function token(role) {
    return 'header.' + btoa(JSON.stringify({role})).replace(/=+$/, '') + '.signature';
}
beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="frame"></div>';
    history.replaceState(null, '', '/editor.html?pmd5=42');
    window.__AUTH_TOKEN__ = token('professor');
    mocks.scratch.onHold = false;
    mocks.ensure.mockResolvedValue({status: 'existing'});
    vi.stubGlobal('fetch', vi.fn(async () => ({ok: true, json: async () => ({assignment: {id: 7, hints: []}})})));
    AuthorBar = (await import('./AssignmentAuthorBar.js')).default;
});
afterEach(() => { vi.unstubAllGlobals(); delete window.__AUTH_TOKEN__; });

describe('automatic capture integration in editor entry modes', () => {
    it('checks missing images when the teacher reopens an existing mission', async () => {
        AuthorBar.init();
        await vi.waitFor(() => expect(mocks.ensure).toHaveBeenCalledOnce());
        expect(mocks.ensure.mock.calls[0][0]).toBe(7);
    });
    it('does not capture a free project that is not yet linked to a mission', async () => {
        fetch.mockResolvedValue({ok: true, json: async () => ({assignment: null})});
        AuthorBar.init();
        await vi.waitFor(() => expect(document.querySelector('.assignmentAuthorBtn')).not.toBeNull());
        expect(mocks.ensure).not.toHaveBeenCalled();
    });
    it('does not run for student projects', async () => {
        window.__AUTH_TOKEN__ = token('aluno');
        AuthorBar.init();
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.ensure).not.toHaveBeenCalled();
    });
    it('also starts the check in the dedicated admin editor', async () => {
        AuthorBar.initAdminEdit(7);
        await vi.waitFor(() => expect(mocks.ensure).toHaveBeenCalledOnce());
        expect(mocks.ensure.mock.calls[0][0]).toBe(7);
    });
    it('locks editing during capture and restores the editor afterwards', async () => {
        mocks.ensure.mockImplementation(async (_id, _request, options) => {
            expect(options.canStart()).toBe(true);
            options.onStart();
            expect(mocks.scratch.onHold).toBe(true);
            expect(document.querySelector('.assignmentAuthorBtn').disabled).toBe(true);
            options.onProgress('Gerando imagem 1 de 3...');
            expect(document.querySelector('[role="status"]').textContent).toContain('1 de 3');
            options.onFinish();
            expect(mocks.scratch.onHold).toBe(false);
            expect(document.querySelector('.assignmentHintsOverlay')).toBeNull();
            expect(document.querySelector('.assignmentAuthorBtn').disabled).toBe(false);
        });
        AuthorBar.initAdminEdit(7);
        await vi.waitFor(() => expect(mocks.ensure).toHaveBeenCalledOnce());
        await mocks.ensure.mock.results[0].value;
    });
});
