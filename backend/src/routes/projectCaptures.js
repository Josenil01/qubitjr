const express = require('express');
const { CAPTURE_BUCKET, fingerprint, projectSnapshot, captureManifest, decodePNG, imagePath } =
    require('../services/projectCaptures');

module.exports = function projectCaptureRoutes({ getSupabase, findOwnedTemplateProject }) {
    const router = express.Router({ mergeParams: true });

    async function authorize(req) {
        if (!req.userId) throw Object.assign(new Error('Missing user identity'), { status: 401 });
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) throw Object.assign(new Error('Invalid assignment id'), { status: 400 });
        const db = getSupabase();
        if (!db) throw Object.assign(new Error('Database not configured'), { status: 503 });
        const { project, httpError } = await findOwnedTemplateProject(db, id, req);
        if (httpError) throw Object.assign(new Error(httpError.body.error), { status: httpError.status });
        return { db, project, assignmentId: id };
    }

    function endpoint(handler) {
        return async (req, res) => {
            try { await handler(req, res, await authorize(req)); }
            catch (err) {
                if (!err.status || err.status >= 500) console.error('[projectCaptures]', err.message);
                res.status(err.status || 500).json({ error: err.status ? err.message :
                    'Não foi possível processar as capturas. Verifique a migração project-captures no banco.' });
            }
        };
    }

    async function batchFor(req, { db, project, assignmentId }) {
        if (!/^[0-9a-f-]{36}$/i.test(req.params.captureId || '')) {
            throw Object.assign(new Error('Captura inválida.'), { status: 400 });
        }
        const { data, error } = await db.from('project_captures').select('*')
            .eq('id', req.params.captureId).eq('project_id', project.id).eq('assignment_id', assignmentId).maybeSingle();
        if (error) throw error;
        if (!data) throw Object.assign(new Error('Captura não encontrada.'), { status: 404 });
        return data;
    }

    router.post('/', endpoint(async (req, res, context) => {
        const { db, project, assignmentId } = context;
        if (String(req.body.projectId) !== String(project.id)) {
            throw Object.assign(new Error('O projeto aberto não corresponde ? missão.'), { status: 409 });
        }
        const snapshot = projectSnapshot(project.json);
        if (fingerprint(projectSnapshot(req.body.snapshot)) !== fingerprint(snapshot)) {
            throw Object.assign(new Error('O projeto no banco difere do editor. Salve o projeto e tente novamente.'), { status: 409 });
        }
        const { data: assignment, error: hintError } = await db.from('assignments')
            .select('hints').eq('id', assignmentId).single();
        if (hintError) throw hintError;
        if (fingerprint(assignment.hints || []) !== fingerprint(req.body.hints || [])) {
            throw Object.assign(new Error('As dicas mudaram durante o salvamento. Reabra a revisão.'), { status: 409 });
        }
        const expected = captureManifest(snapshot);
        const { data: capture, error } = await db.from('project_captures').insert({
            project_id: project.id, assignment_id: assignmentId, created_by: req.userId,
            project_version: fingerprint(snapshot), project_snapshot: snapshot,
            hints_version: fingerprint(assignment.hints || []), hints_snapshot: assignment.hints || [],
            expected, status: 'pending',
        }).select('id, project_id, project_version, status, expected, created_at').single();
        if (error) throw error;
        res.status(201).json({ capture });
    }));

    router.get('/', endpoint(async (req, res, { db, project, assignmentId }) => {
        const { data, error } = await db.from('project_captures')
            .select('id, project_id, assignment_id, project_version, hints_version, status, created_at, completed_at')
            .eq('project_id', project.id).eq('assignment_id', assignmentId)
            .order('created_at', { ascending: false }).limit(30);
        if (error) throw error;
        res.json({ projectId: project.id, captures: data });
    }));

    router.put('/:captureId/images/:key', endpoint(async (req, res, context) => {
        const { db } = context;
        const capture = await batchFor(req, context);
        if (capture.status !== 'pending') throw Object.assign(new Error('Captura já finalizada.'), { status: 409 });
        const item = capture.expected.find((entry) => entry.key === req.params.key);
        if (!item) throw Object.assign(new Error('Imagem não pertence ao projeto capturado.'), { status: 400 });
        const { bytes, width, height } = decodePNG(req.body);
        const storagePath = imagePath(capture, item);
        const { error: uploadError } = await db.storage.from(CAPTURE_BUCKET).upload(storagePath, bytes,
            { contentType: 'image/png', upsert: true, cacheControl: '31536000' });
        if (uploadError) throw uploadError;
        const { error } = await db.from('project_capture_images').upsert({
            capture_id: capture.id, image_key: item.key, project_id: capture.project_id,
            scene_id: item.scene_id, scene_index: item.scene_index, actor_id: item.actor_id,
            actor_name: item.actor_name, kind: item.kind, storage_path: storagePath,
            width, height, bytes: bytes.length,
        }, { onConflict: 'capture_id,image_key' });
        if (error) throw error;
        res.json({ success: true });
    }));

    router.post('/:captureId/complete', endpoint(async (req, res, context) => {
        const { db } = context;
        const capture = await batchFor(req, context);
        const { data: images, error: imageError } = await db.from('project_capture_images')
            .select('image_key').eq('capture_id', capture.id);
        if (imageError) throw imageError;
        const keys = new Set(images.map((image) => image.image_key));
        if (!capture.expected.every((item) => keys.has(item.key))) {
            throw Object.assign(new Error('Ainda existem imagens pendentes.'), { status: 409 });
        }
        const { error } = await db.from('project_captures')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', capture.id).eq('status', 'pending');
        if (error) throw error;
        res.json({ success: true, captureId: capture.id });
    }));

    router.get('/:captureId', endpoint(async (req, res, context) => {
        const { db } = context;
        const capture = await batchFor(req, context);
        const { data: images, error } = await db.from('project_capture_images').select('*')
            .eq('capture_id', capture.id).order('scene_index').order('image_key');
        if (error) throw error;
        const { data: urls, error: urlError } = images.length ?
            await db.storage.from(CAPTURE_BUCKET).createSignedUrls(images.map((image) => image.storage_path), 600) :
            { data: [], error: null };
        if (urlError) throw urlError;
        res.json({ capture, images: images.map((image, index) => ({ ...image, url: urls[index].signedUrl })) });
    }));
    return router;
};
