/**
 * backend/src/routes/share.js
 *
 * Rotas de compartilhamento público de projetos e reações emoji.
 *
 * Rotas autenticadas (requerem owner):
 *   POST   /api/share/:projectId        → gera/retorna share_token
 *   DELETE /api/share/:projectId        → revoga share_token
 *
 * Rotas públicas (sem auth — registradas em index.js antes do middleware):
 *   GET    /api/public/project/:token   → dados públicos do projeto + reações
 *   POST   /api/public/project/:token/react  → incrementa contador de emoji
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const router = express.Router();
const publicRouter = express.Router();

const ALLOWED_EMOJIS = ['❤️', '😄', '👏', '🌟', '🎉'];

let _supabase = null;
function getSupabase() {
    if (_supabase) return _supabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _supabase = createClient(url, key);
    return _supabase;
}

// ============================================
// Rotas autenticadas
// ============================================

/**
 * POST /api/share/:projectId
 * Gera (ou retorna existente) share_token para o projeto.
 * Requer: req.userId (injetado pelo identity middleware).
 */
router.post('/:projectId', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const projectId = parseInt(req.params.projectId, 10);
    if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

    try {
        const { data: project, error: fetchErr } = await supabase
            .from('projects')
            .select('id, share_token, owner')
            .eq('id', projectId)
            .eq('owner', req.userId)
            .single();

        if (fetchErr || !project) return res.status(404).json({ error: 'Project not found or access denied' });

        let token = project.share_token;
        if (!token) {
            token = crypto.randomUUID();
            const { data: updated, error: updateErr } = await supabase
                .from('projects')
                .update({ share_token: token })
                .eq('id', projectId)
                .eq('owner', req.userId)
                .select('share_token');

            if (updateErr) {
                console.error('[share] UPDATE error:', updateErr);
                return res.status(500).json({ error: 'Erro ao salvar token: ' + updateErr.message });
            }
            if (!updated || updated.length === 0) {
                console.error('[share] UPDATE affected 0 rows — projectId:', projectId, 'userId:', req.userId);
                return res.status(500).json({ error: 'Projeto não encontrado ou permissão negada ao salvar token.' });
            }
            token = updated[0].share_token;
        }

        const baseUrl = req.headers.origin || (req.protocol + '://' + req.get('host'));
        console.log('[share] Token gerado para projeto', projectId, ':', token);
        res.json({ shareToken: token, shareUrl: baseUrl + '/player.html?token=' + token });
    } catch (err) {
        console.error('[share] POST error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/share/:projectId
 * Revoga o share_token do projeto.
 */
router.delete('/:projectId', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const projectId = parseInt(req.params.projectId, 10);
    if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

    try {
        const { error } = await supabase
            .from('projects')
            .update({ share_token: null })
            .eq('id', projectId)
            .eq('owner', req.userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('[share] DELETE error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Rotas públicas (sem autenticação)
// ============================================

/**
 * GET /api/public/project/:token
 * Retorna dados públicos do projeto + contagem de reações.
 */
publicRouter.get('/project/:token', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { token } = req.params;
    if (!token || token.length < 10) return res.status(400).json({ error: 'Invalid token' });

    try {
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id, name, json, thumbnail, owner')
            .eq('share_token', token)
            .eq('deleted', 'NO')
            .single();

        if (projErr || !project) {
            console.error('[public] Project not found for token:', token, 'supabase error:', projErr);
            return res.status(404).json({ error: 'Projeto não encontrado. Verifique se o link é válido.' });
        }

        const { data: reactionRows } = await supabase
            .from('reactions')
            .select('emoji, count')
            .eq('project_id', project.id);

        const reactions = {};
        ALLOWED_EMOJIS.forEach(e => { reactions[e] = 0; });
        (reactionRows || []).forEach(r => {
            if (ALLOWED_EMOJIS.includes(r.emoji)) reactions[r.emoji] = r.count;
        });

        // Resolve thumbnail filename to a full public Supabase Storage URL
        let thumbnailUrl = null;
        try {
            const th = project.thumbnail;
            const parsed = typeof th === 'string' ? JSON.parse(th) : th;
            const filename = parsed && parsed.md5 ? parsed.md5 : null;
            if (filename && !filename.startsWith('data:') && !filename.startsWith('http')) {
                const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'media';
                const { data: urlData } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(`aluno/${project.owner}/${filename}`);
                thumbnailUrl = urlData && urlData.publicUrl ? urlData.publicUrl : null;
            } else if (filename) {
                thumbnailUrl = filename;
            }
        } catch (_) { /* thumbnail inválido, ok */ }

        res.json({ name: project.name, json: project.json, thumbnailUrl, reactions });
    } catch (err) {
        console.error('[public] GET project error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/public/project/:token/react
 * Body: { emoji: "❤️" }
 * Incrementa contador do emoji para o projeto.
 */
publicRouter.post('/project/:token/react', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { token } = req.params;
    const { emoji } = req.body;

    if (!ALLOWED_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: 'Invalid emoji' });
    }

    try {
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id')
            .eq('share_token', token)
            .eq('deleted', 'NO')
            .single();

        if (projErr || !project) return res.status(404).json({ error: 'Project not found' });

        const { data: existing } = await supabase
            .from('reactions')
            .select('count')
            .eq('project_id', project.id)
            .eq('emoji', emoji)
            .single();

        if (existing) {
            await supabase
                .from('reactions')
                .update({ count: existing.count + 1 })
                .eq('project_id', project.id)
                .eq('emoji', emoji);
            res.json({ success: true, count: existing.count + 1 });
        } else {
            await supabase
                .from('reactions')
                .insert({ project_id: project.id, emoji, count: 1 });
            res.json({ success: true, count: 1 });
        }
    } catch (err) {
        console.error('[public] POST react error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = { shareRouter: router, publicRouter };
