import ScratchJr from '../ScratchJr.js';
import Project from './Project.js';
import {captureActor, captureScripts, waitForScene} from './CaptureRenderer.js';

export async function saveAssignmentCaptures(assignmentId, hints, request, progress) {
    var stage = ScratchJr.stage;
    if (!stage || !stage.pages.length) throw new Error('Projeto sem cenas.');
    ScratchJr.stopStrips();
    await new Promise((resolve, reject) => {
        var timer = setTimeout(() => reject(new Error('Tempo esgotado ao salvar o projeto.')), 60000);
        ScratchJr.saveProject(null, () => { clearTimeout(timer); resolve(); }, true);
    });
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
    var result = await api(base, {method: 'POST', body: JSON.stringify({projectId, snapshot, hints})});
    var capture = result.capture;
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
