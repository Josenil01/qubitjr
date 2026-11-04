const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { CAPTURE_BUCKET } = require('../services/projectCaptures');

const URL_TTL_SECONDS = 600;
let client;
function defaultClient() {
    if (client) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    client = createClient(url, key);
    return client;
}

module.exports = function publicProjectCaptures(getSupabase = defaultClient) {
    const router = express.Router();
    router.get('/projects/:projectId/captures', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const rawId = req.params.projectId;
        const projectId = Number(rawId);
        if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(projectId)) {
            return res.status(400).json({ error: 'ID do projeto inválido.' });
        }
        const db = getSupabase();
        if (!db) return res.status(503).json({ error: 'Database not configured' });
        try {
            const { data: project, error: projectError } = await db.from('projects').select('id')
                .eq('id', projectId).eq('deleted', 'NO').maybeSingle();
            if (projectError) throw projectError;
            if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });

            const { data: capture, error: captureError } = await db.from('project_captures')
                .select('id, project_version, created_at, completed_at')
                .eq('project_id', projectId).eq('status', 'completed')
                .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
            if (captureError) throw captureError;
            if (!capture) return res.status(404).json({ error: 'O projeto ainda não possui capturas concluídas.' });

            const { data: images, error: imageError } = await db.from('project_capture_images')
                .select('image_key, scene_id, scene_index, actor_id, actor_name, kind, storage_path, width, height')
                .eq('capture_id', capture.id).eq('project_id', projectId)
                .order('scene_index').order('image_key');
            if (imageError) throw imageError;
            if (!images.length) return res.status(404).json({ error: 'Nenhuma imagem disponível para esta captura.' });

            const { data: signed, error: signError } = await db.storage.from(CAPTURE_BUCKET)
                .createSignedUrls(images.map((image) => image.storage_path), URL_TTL_SECONDS);
            if (signError) throw signError;
            if (!signed || signed.length !== images.length || signed.some((entry) => entry.error || !entry.signedUrl)) {
                return res.status(502).json({ error: 'Não foi possível disponibilizar todas as imagens. Tente novamente.' });
            }
            const urls = new Map(signed.map((entry) => [entry.path, entry.signedUrl]));
            if (images.some((image) => !urls.has(image.storage_path))) {
                return res.status(502).json({ error: 'Resposta de imagens incompleta. Tente novamente.' });
            }
            res.json({
                projectId, captureId: capture.id, projectVersion: capture.project_version,
                capturedAt: capture.created_at, completedAt: capture.completed_at,
                expiresIn: URL_TTL_SECONDS,
                images: images.map((image) => ({
                    key: image.image_key, type: image.kind,
                    sceneId: image.scene_id, sceneIndex: image.scene_index,
                    actorId: image.actor_id, actorName: image.actor_name,
                    width: image.width, height: image.height, url: urls.get(image.storage_path),
                })),
            });
        } catch (err) {
            console.error('[publicProjectCaptures]', err.message);
            res.status(500).json({ error: 'Não foi possível consultar as imagens do projeto.' });
        }
    });
    return router;
};
