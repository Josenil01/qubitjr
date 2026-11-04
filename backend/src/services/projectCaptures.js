const { createHash } = require('crypto');

const CAPTURE_BUCKET = 'project-captures';
const CAPTURE_RENDERER_VERSION = 2;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function fingerprint(value) {
    return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function projectSnapshot(value) {
    let snapshot;
    try { snapshot = typeof value === 'string' ? JSON.parse(value) : JSON.parse(JSON.stringify(value)); }
    catch (_err) { throw Object.assign(new Error('Snapshot inválido.'), { status: 400 }); }
    if (!snapshot || !Array.isArray(snapshot.pages) || !snapshot.pages.length) {
        throw Object.assign(new Error('Projeto sem cenas para capturar.'), { status: 400 });
    }
    delete snapshot.currentPage;
    return snapshot;
}

function captureManifest(snapshot, rendererVersion = CAPTURE_RENDERER_VERSION) {
    const items = [];
    snapshot.pages.forEach((sceneId, sceneIndex) => {
        const scene = snapshot[sceneId];
        if (!scene || !Array.isArray(scene.sprites)) throw new Error('Cena inválida no projeto.');
        items.push({ key: `${sceneIndex}-scene`, kind: 'scene', scene_id: sceneId,
            scene_index: sceneIndex, actor_id: null, actor_name: null, actor_index: null });
        scene.sprites.forEach((actorId, actorIndex) => {
            const actor = scene[actorId];
            if (!actor || actor.type !== 'sprite') return;
            for (const kind of ['actor', 'scripts']) {
                items.push({ key: `${sceneIndex}-${actorIndex}-${kind}`, kind, scene_id: sceneId,
                    scene_index: sceneIndex, actor_id: actorId, actor_name: actor.name || actorId,
                    actor_index: actorIndex });
            }
        });
    });
    if (items.length > 300) throw Object.assign(new Error('Projeto excede o limite de 300 imagens.'), { status: 400 });
    return items.map((item) => ({ ...item, rendererVersion }));
}

function isCurrentCapture(capture) {
    return !!(capture && Array.isArray(capture.expected) && capture.expected.length &&
        capture.expected.every((item) => item.rendererVersion === CAPTURE_RENDERER_VERSION));
}

function decodePNG(image) {
    if (!image || typeof image.data !== 'string' || image.data.length > MAX_IMAGE_BYTES * 4 / 3 + 100) {
        throw Object.assign(new Error('Imagem ausente ou maior que 3 MB.'), { status: 400 });
    }
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.data);
    const bytes = match && Buffer.from(match[1], 'base64');
    if (!bytes || bytes.length < 33 || bytes.length > MAX_IMAGE_BYTES ||
        bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        bytes.subarray(12, 16).toString() !== 'IHDR') {
        throw Object.assign(new Error('PNG inválido.'), { status: 400 });
    }
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (!width || !height || width > 16384 || height > 16384 || width * height > 32000000) {
        throw Object.assign(new Error('Dimensões de imagem inválidas.'), { status: 400 });
    }
    return { bytes, width, height };
}

function imagePath(capture, item) {
    const base = `projetos/${capture.project_id}/capturas/${capture.id}/cenas/${item.scene_index + 1}`;
    return item.kind === 'scene' ? `${base}/cena.png` :
        `${base}/atores/${item.actor_index + 1}/${item.kind === 'actor' ? 'personagem' : 'programacao'}.png`;
}

module.exports = { CAPTURE_RENDERER_VERSION, isCurrentCapture, CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath };
