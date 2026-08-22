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
 *
 * Rotas servidor-a-servidor pra HelloYotta puxar dado nosso (não usa o fluxo
 * de JWT normal - quem chama é o backend deles, não um usuário logado; mesma
 * chave estática HELLOYOTTA_INBOUND_API_KEY protege as cinco):
 *   GET    /api/public/students/:studentId/time-spent       → tempo total do aluno
 *                                                               + quantidade de projetos
 *                                                               + métricas completas do
 *                                                               projeto mais recente
 *   GET    /api/public/students/:studentId/assignment-score → progresso do aluno na
 *                                                               missão ativa da turma
 *   GET    /api/public/teachers/:teacherId/activities        → missões cadastradas por
 *                                                               um professor num nível
 *   POST   /api/public/activities/:activityId/adopt          → turma adota um molde de
 *                                                               missão (template) já
 *                                                               cadastrado por um professor
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { computeProjectManifest, compareManifests } = require('../services/assignmentScoring');
const { resolveAssignmentFields } = require('../services/assignmentResolver');

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

function timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * A tabela assignments não tem coluna própria de "deletado" - só projects
 * tem. O projeto de exemplo que originou um template (projects.assignment_id
 * = o id do TEMPLATE, nunca o de uma linha de referência) pode ter sido
 * apagado pelo professor depois de cadastrar a missão. Regra: só devolvemos
 * pra HelloYotta missões cujo projeto de origem não esteja deletado.
 *
 * templateId: o id do TEMPLATE (não de uma referência - resolva
 * row.template_id || row.id antes de chamar isto).
 * Sem nenhum projeto vinculado (link falhou uma vez, ou caso raro qualquer),
 * não dá pra provar que foi deletado - trata como NÃO deletado (falha aberta,
 * não esconde uma missão válida por engano).
 */
async function isTemplateProjectDeleted(supabase, templateId) {
    const { data: linkedProject } = await supabase
        .from('projects')
        .select('deleted')
        .eq('assignment_id', templateId)
        .limit(1)
        .maybeSingle();
    return !!linkedProject && linkedProject.deleted !== 'NO';
}

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

        const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'media';

        // Resolve thumbnail filename to a full public Supabase Storage URL
        let thumbnailUrl = null;
        try {
            const th = project.thumbnail;
            const parsed = typeof th === 'string' ? JSON.parse(th) : th;
            const filename = parsed && parsed.md5 ? parsed.md5 : null;
            if (filename && !filename.startsWith('data:') && !filename.startsWith('http')) {
                const { data: urlData } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(`aluno/${project.owner}/${filename}`);
                thumbnailUrl = urlData && urlData.publicUrl ? urlData.publicUrl : null;
            } else if (filename) {
                thumbnailUrl = filename;
            }
        } catch (_) { /* thumbnail inválido, ok */ }

        // Public base URL for user media assets (sprites, backgrounds, sounds)
        let mediaBaseUrl = null;
        try {
            const { data: baseUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(`aluno/${project.owner}/__x__`);
            if (baseUrlData && baseUrlData.publicUrl) {
                mediaBaseUrl = baseUrlData.publicUrl.replace('/__x__', '/');
            }
        } catch (_) {}

        res.json({ name: project.name, json: project.json, thumbnailUrl, mediaBaseUrl, reactions });
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

/**
 * GET /api/public/students/:studentId/time-spent
 * Endpoint servidor-a-servidor pra HelloYotta puxar (pull) o tempo total que
 * um aluno já passou editando, somado entre todos os projetos dele
 * (projects.time_spent_seconds, alimentado pelos heartbeats do editor - ver
 * POST /api/db/project/:id/heartbeat em routes/db.js), quantos projetos
 * (não apagados) esse aluno tem, e um retrato completo (nome + todas as
 * métricas de computeProjectManifest) só do projeto mais recente - de
 * propósito NÃO mandamos isso pra todos os projetos do aluno, só o último
 * (evita um payload que só cresce, e o mais recente é o sinal mais
 * relevante do nível atual do aluno).
 *
 * "Mais recente" = maior mtime, não updated_at: updated_at não é tocado
 * pelo fluxo normal de salvar (IO.saveProject's UPDATE não inclui essa
 * coluna no SET), então ficaria sempre parado na criação da linha. mtime é
 * atualizado a cada save (Project.save's metadata.mtime) e é o mesmo campo
 * que o resto do app já usa pra ordenar por "última edição" (ex:
 * Home.js's 'ctime desc').
 *
 * Não usa o identityMiddleware normal (não há JWT de usuário aqui - quem
 * chama é o backend da HelloYotta) - protegido por uma chave estática
 * própria (HELLOYOTTA_INBOUND_API_KEY), comparada em tempo constante pra não
 * vazar informação por timing. studentId desconhecido/sem projetos devolve
 * totalTimeSeconds: 0, projectCount: 0 e latestProject: null em vez de 404,
 * pra não revelar se um id existe.
 */
publicRouter.get('/students/:studentId/time-spent', async (req, res) => {
    const expectedKey = process.env.HELLOYOTTA_INBOUND_API_KEY;
    if (!expectedKey) return res.status(503).json({ error: 'Endpoint not configured' });

    const auth = req.headers.authorization || '';
    const providedKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { studentId } = req.params;
    if (!studentId) return res.status(400).json({ error: 'Invalid studentId' });

    try {
        const { data, error } = await supabase
            .from('projects')
            .select('name, json, mtime, time_spent_seconds')
            .eq('owner', studentId)
            .eq('deleted', 'NO')
            .order('mtime', { ascending: false });

        if (error) throw error;

        const rows = data || [];
        const totalTimeSeconds = rows.reduce((sum, p) => sum + (p.time_spent_seconds || 0), 0);

        let latestProject = null;
        if (rows.length > 0) {
            let manifest;
            try {
                manifest = computeProjectManifest(JSON.parse(rows[0].json));
            } catch (parseErr) {
                console.error('[public] time-spent: projeto mais recente de', studentId, 'com json inválido:', parseErr.message);
                manifest = computeProjectManifest(null); // zerado - não derruba o endpoint inteiro por causa de 1 projeto
            }
            latestProject = { projectName: rows[0].name, ...manifest };
        }

        res.json({ studentId, totalTimeSeconds, projectCount: rows.length, latestProject });
    } catch (err) {
        console.error('[public] GET students/:studentId/time-spent error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/public/students/:studentId/assignment-score
 * Endpoint servidor-a-servidor (mesma chave HELLOYOTTA_INBOUND_API_KEY do
 * time-spent acima) pra HelloYotta puxar o progresso do aluno na missão
 * ativa da turma dele. Acha o projeto mais recente do aluno que esteja
 * vinculado a uma assignment ainda ativa (join projects→assignments) e
 * compara o manifesto real do projeto com os requisitos da missão.
 *
 * Sem missão ativa/projeto vinculado devolve 200 com hasAssignment: false,
 * não 404 - mesma filosofia do time-spent de não vazar existência via
 * código de erro, e "sem missão ativa" é estado normal, não erro.
 */
publicRouter.get('/students/:studentId/assignment-score', async (req, res) => {
    const expectedKey = process.env.HELLOYOTTA_INBOUND_API_KEY;
    if (!expectedKey) return res.status(503).json({ error: 'Endpoint not configured' });

    const auth = req.headers.authorization || '';
    const providedKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { studentId } = req.params;
    if (!studentId) return res.status(400).json({ error: 'Invalid studentId' });

    try {
        // Supabase JS não faz JOIN condicional direto no filtro de uma tabela
        // relacionada de forma simples com !inner + eq encadeado; usamos a
        // sintaxe de embed do PostgREST (assignments!inner(...)) pra filtrar
        // por assignments.active = true na mesma query.
        const { data: rows, error } = await supabase
            .from('projects')
            .select('id, json, assignment_id, assignments!inner(id, template_id, project_name, requirements, active)')
            .eq('owner', studentId)
            .eq('deleted', 'NO')
            .eq('assignments.active', true)
            .not('assignment_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        const project = rows && rows[0];
        if (!project || !project.assignments) {
            return res.json({ studentId, hasAssignment: false });
        }

        const assignment = project.assignments;

        // A linha da assignment pode ser um template (project_name/requirements
        // próprios) ou uma referência (template_id apontando pra outro molde) -
        // resolveAssignmentFields esconde essa diferença e devolve os campos
        // EFETIVOS já resolvidos, propagando edições feitas no template. Ver
        // backend/src/services/assignmentResolver.js e backend/supabase-setup.sql.
        const resolved = await resolveAssignmentFields(supabase, assignment);

        let projectJson;
        try {
            projectJson = JSON.parse(project.json);
        } catch (parseErr) {
            console.error('[public] assignment-score: projeto', project.id, 'com json inválido:', parseErr.message);
            return res.status(500).json({ error: 'Projeto com json inválido' });
        }

        const actualManifest = computeProjectManifest(projectJson);
        const comparison = compareManifests(resolved.requirements, actualManifest);

        res.json({
            studentId,
            hasAssignment: true,
            projectName: resolved.projectName,
            ...comparison,
        });
    } catch (err) {
        console.error('[public] GET students/:studentId/assignment-score error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/public/teachers/:teacherId/activities?nivel=X
 * Endpoint servidor-a-servidor (mesma chave HELLOYOTTA_INBOUND_API_KEY) pra
 * HelloYotta listar as missões cadastradas por um professor num nível/ano.
 * nivel é obrigatório na query string - sem ele não dá pra saber que
 * conjunto de turmas/anos o professor quer ver (um professor pode dar aula
 * em mais de um nível).
 */
publicRouter.get('/teachers/:teacherId/activities', async (req, res) => {
    const expectedKey = process.env.HELLOYOTTA_INBOUND_API_KEY;
    if (!expectedKey) return res.status(503).json({ error: 'Endpoint not configured' });

    const auth = req.headers.authorization || '';
    const providedKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const { teacherId } = req.params;
    const { nivel } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Invalid teacherId' });
    if (!nivel) return res.status(400).json({ error: 'nivel query param is required' });

    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('id, template_id, project_name, requirements, active, created_at')
            .eq('teacher_id', teacherId)
            .eq('nivel', nivel)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Cada linha pode ser um template ou uma referência (ver
        // assignmentResolver.js) - resolve projectName/requirements de cada
        // uma em paralelo (Promise.all) em vez de um await em série por linha,
        // já que são N queries pequenas e independentes entre si.
        // activityId/active/createdAt NÃO passam por resolução: são sempre os
        // da própria linha (uma referência tem seu próprio registro de
        // ativação por turma, mesmo que os campos de conteúdo venham do
        // template).
        //
        // Só devolvemos pra HelloYotta missões cujo projeto de origem (o
        // exemplo do professor, ligado ao TEMPLATE - row.template_id || row.id)
        // não esteja deletado - ver isTemplateProjectDeleted acima.
        const withDeletionCheck = await Promise.all((data || []).map(async (row) => {
            const resolved = await resolveAssignmentFields(supabase, row);
            const templateId = row.template_id || row.id;
            const projectDeleted = await isTemplateProjectDeleted(supabase, templateId);
            return {
                projectDeleted,
                activity: {
                    activityId: row.id,
                    projectName: resolved.projectName,
                    requirements: resolved.requirements,
                    active: row.active,
                    createdAt: row.created_at,
                },
            };
        }));

        const activities = withDeletionCheck
            .filter((r) => !r.projectDeleted)
            .map((r) => r.activity);

        res.json({ nivel, activities });
    } catch (err) {
        console.error('[public] GET teachers/:teacherId/activities error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/public/activities/:activityId/adopt
 * Body: { turmaId, teacherId }
 * Endpoint servidor-a-servidor (mesma chave HELLOYOTTA_INBOUND_API_KEY dos
 * outros endpoints deste arquivo) pra HelloYotta fazer uma turma "adotar" um
 * molde de missão (template) já cadastrado por outro professor: cria uma
 * linha de REFERÊNCIA na tabela assignments (template_id apontando pro
 * molde), desativando antes qualquer missão já ativa daquela turma - mesmo
 * invariante ("uma assignment ativa por turma_id de cada vez") já aplicado
 * em POST /api/assignments/register (routes/assignments.js).
 *
 * :activityId deve ser o id de um TEMPLATE original (template_id IS NULL) -
 * não dá pra adotar a referência de outra turma (sem encadeamento; ver a
 * nota sobre esse invariante em backend/supabase-setup.sql).
 *
 * Chamado pelo backend da HelloYotta, não por um professor no navegador -
 * por isso turmaId/teacherId vêm no corpo da requisição em vez de
 * req.userId/req.turmaId (não há JWT de sessão normal aqui, só a chave
 * estática de servidor-a-servidor).
 */
publicRouter.post('/activities/:activityId/adopt', async (req, res) => {
    const expectedKey = process.env.HELLOYOTTA_INBOUND_API_KEY;
    if (!expectedKey) return res.status(503).json({ error: 'Endpoint not configured' });

    const auth = req.headers.authorization || '';
    const providedKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const activityId = parseInt(req.params.activityId, 10);
    if (!Number.isFinite(activityId)) return res.status(400).json({ error: 'Invalid activityId' });

    const { turmaId, teacherId } = req.body || {};
    if (!turmaId || !teacherId) {
        return res.status(400).json({ error: 'turmaId e teacherId são obrigatórios' });
    }

    try {
        // 1. Busca o molde apontado por activityId.
        const { data: template, error: templateErr } = await supabase
            .from('assignments')
            .select('id, template_id, project_name, requirements, nivel')
            .eq('id', activityId)
            .maybeSingle();

        if (templateErr) throw templateErr;
        if (!template) return res.status(404).json({ error: 'Molde não encontrado' });

        // 2. Invariante "sem encadeamento": só um template original
        // (template_id IS NULL) pode ser adotado. Se activityId apontar pra
        // uma linha que já é ela mesma uma referência (ativação de outra
        // turma), recusa - ver nota em backend/supabase-setup.sql.
        if (template.template_id) {
            return res.status(400).json({
                error: 'Só é possível adotar um molde original, não uma ativação já existente de outra turma',
            });
        }

        // 2b. Mesma regra da listagem (GET /teachers/:id/activities): não dá
        // pra adotar um molde cujo projeto de exemplo já foi apagado pelo
        // professor - trata como se o activityId não existisse (404), caso a
        // HelloYotta tenha um id em cache de antes da exclusão.
        if (await isTemplateProjectDeleted(supabase, template.id)) {
            return res.status(404).json({ error: 'Molde não encontrado' });
        }

        // 3. Desativa qualquer missão já ativa da turma alvo - mesmo passo
        // usado em POST /api/assignments/register (routes/assignments.js).
        const { error: deactivateErr } = await supabase
            .from('assignments')
            .update({ active: false })
            .eq('turma_id', turmaId)
            .eq('active', true);

        if (deactivateErr) {
            console.error('[public] adopt: falha ao desativar missão anterior da turma', turmaId, ':', deactivateErr);
            return res.status(500).json({ error: 'Falha ao desativar missão anterior: ' + deactivateErr.message });
        }

        // 4. Insere a linha de REFERÊNCIA - de propósito sem project_name/
        // requirements próprios (ficam null): esses campos são resolvidos ao
        // vivo via template_id por todo mundo que lê assignments (Tasks 1/2
        // acima, e /active e /my-progress em routes/assignments.js), então
        // editar o molde depois propaga sem precisar readotar.
        const { data: inserted, error: insertErr } = await supabase
            .from('assignments')
            .insert({
                turma_id: turmaId,
                teacher_id: teacherId,
                template_id: template.id,
                nivel: template.nivel,
                active: true,
            })
            .select('id')
            .single();

        if (insertErr || !inserted) {
            // A missão anterior da turma já foi desativada no passo 3 - loga
            // alto pra ficar claro que a turma pode ter ficado sem NENHUMA
            // missão ativa (mesmo estilo defensivo de POST /register).
            console.error('[public] adopt: INSERT falhou APÓS desativar a missão anterior da turma', turmaId, '- turma ficou sem missão ativa. Erro:', insertErr);
            return res.status(500).json({ error: 'Falha ao adotar molde: ' + (insertErr ? insertErr.message : 'unknown') });
        }

        res.json({ success: true, activityId: inserted.id });
    } catch (err) {
        console.error('[public] POST activities/:activityId/adopt error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = { shareRouter: router, publicRouter };
