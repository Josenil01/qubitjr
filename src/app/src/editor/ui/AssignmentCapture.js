import ScratchJr from '../ScratchJr.js';
import Project from './Project.js';
import {CAPTURE_RENDERER_VERSION, captureActor, captureScripts, waitForScene} from './CaptureRenderer.js';

export async function saveAssignmentCaptures(assignmentId, hints, request, progress, options = {}) {
    var stage = ScratchJr.stage;
    if (!stage || !stage.pages.length) throw new Error('Projeto sem cenas.');
    if (options.saveProject !== false) {
        ScratchJr.stopStrips();
        await new Promise((resolve, reject) => {
            var timer = setTimeout(() => reject(new Error('Tempo esgotado ao salvar o projeto.')), 60000);
            ScratchJr.saveProject(null, () => { clearTimeout(timer); resolve(); }, true);
        });
    } else if (ScratchJr.runtime && !ScratchJr.runtime.inactive()) {
        throw new Error('Pare a animação antes de gerar as imagens.');
    }
    var snapshot = Project.getProject(stage.pages[0].id);
    var snapshotText = JSON.stringify(snapshot);
    var projectId = ScratchJr.currentProject;
    var base = '/assignments/' + encodeURIComponent(assignmentId) + '/captures';
    async function api(path, options) {
        var response = await request(path, options);
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao salvar as imagens.');
        return result;
    }
    var result = await api(base, {method: 'POST', body: JSON.stringify({projectId, snapshot, hints, rendererVersion: CAPTURE_RENDERER_VERSION, onlyIfMissing: options.onlyIfMissing === true})});
    var capture = result.capture;
    if (result.skipped) return capture.id;
    var index = 0;
    for (var item of capture.expected) {
        if (String(ScratchJr.currentProject) !== String(projectId) ||
            JSON.stringify(Project.getProject(stage.pages[0].id)) !== snapshotText) {
            throw new Error('O projeto mudou durante a captura. Tente novamente.');
        }
        progress('Gerando imagem ' + (index + 1) + ' de ' + capture.expected.length + '...');
        var page = stage.pages.find(entry => entry.id === item.scene_id);
        if (!page) throw new Error('Cena não encontrada.');
        var data;
        if (item.kind === 'scene') {
            await waitForScene(page);
            data = await new Promise((resolve, reject) => {
                var timer = setTimeout(() => reject(new Error('Tempo esgotado ao capturar a cena.')), 30000);
                Project.getThumbnailPNG(page, 960, 720, image => { clearTimeout(timer); resolve(image); }, true);
            });
        } else {
            var element = document.getElementById(item.actor_id);
            if (!element || !element.owner) throw new Error('Ator não encontrado.');
            data = item.kind === 'actor' ? await captureActor(element.owner) :
                await captureScripts(document.getElementById(item.actor_id + '_scripts'));
        }
        await api(base + '/' + capture.id + '/images/' + item.key,
            {method: 'PUT', body: JSON.stringify({data})});
        index++;
    }
    if (String(ScratchJr.currentProject) !== String(projectId) ||
        JSON.stringify(Project.getProject(stage.pages[0].id)) !== snapshotText) {
        throw new Error('O projeto mudou durante a captura. Tente novamente.');
    }
    await api(base + '/' + capture.id + '/complete', {method: 'POST', body: '{}'});
    return capture.id;
}

const automaticChecks = new Map();

export function ensureAssignmentCaptures(assignmentId, request, options = {}) {
    var projectId = ScratchJr.currentProject;
    if (!assignmentId || !projectId) return Promise.resolve({status: 'skipped'});
    var key = String(assignmentId) + ':' + String(projectId);
    if (automaticChecks.has(key)) return automaticChecks.get(key);
    var job = (async function () {
        var deadline = Date.now() + 60000;
        while (Project.loadedProjectId !== String(projectId)) {
            if (String(ScratchJr.currentProject) !== String(projectId)) return {status: 'skipped'};
            if (Date.now() > deadline) throw new Error('O projeto não terminou de carregar para gerar as imagens.');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        var response = await request('/assignments/' + encodeURIComponent(assignmentId) + '/captures/status');
        if (!response.ok) throw new Error('Não foi possível consultar as imagens do projeto.');
        var status = await response.json();
        if (String(ScratchJr.currentProject) !== String(projectId) || String(status.projectId) !== String(projectId)) {
            return {status: 'skipped'};
        }
        if (status.hasCompletedCapture) return {status: 'existing', captureId: status.captureId};
        if (options.canStart && !options.canStart()) return {status: 'skipped'};
        try {
            if (options.onStart) options.onStart();
            var captureId = await saveAssignmentCaptures(assignmentId, status.hints || [], request,
                options.onProgress || function () {}, {saveProject: false, onlyIfMissing: true});
            return {status: 'completed', captureId};
        } finally {
            if (options.onFinish) options.onFinish();
        }
    })();
    automaticChecks.set(key, job);
    return job;
}
