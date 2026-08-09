/**
 * backend/src/routes/teacher.js
 *
 * Rotas do lobby do professor (observação ao vivo de alunos).
 * Autorização de turma vem da HelloYotta (ver services/helloyotta.js);
 * aqui só cruzamos o roster autorizado com os projetos do Supabase.
 * Todas as rotas passam pelo identityMiddleware — req.userId identifica
 * quem chamou (professor OU aluno, dependendo do token). Heartbeat e end
 * são chamados pelos dois lados (ver comentário de cada rota); as
 * checagens de dono aceitam teacher_id OU student_id por isso.
 *
 * GET  /api/teacher/classroom/:turmaId/students
 * POST /api/teacher/session/start
 * POST /api/teacher/session/:sessionId/heartbeat
 * POST /api/teacher/session/:sessionId/end
 *
 * Expiração de 50min: sem processo em background (serverless não sustenta
 * timer entre requisições). O cliente conta o tempo e mostra o aviso; o
 * servidor só confirma a idade da sessão a cada heartbeat/start e fecha se
 * já passou do limite — ver SESSION_DURATION_MS abaixo.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { getClassroomRoster } = require('../services/helloyotta');

const router = express.Router();

const SESSION_DURATION_MS = 50 * 60 * 1000;

let _supabase = null;
function getSupabase() {
    if (_supabase) return _supabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _supabase = createClient(url, key);
    return _supabase;
}

/**
 * projects.thumbnail é um JSON cru (ex.: {"pagecount":1,"md5":"foo.png"}),
 * não uma URL — precisa resolver contra o Supabase Storage. Mesma lógica de
 * backend/src/routes/share.js (rota pública do player), duplicada aqui
 * porque os dois módulos não compartilham um helper comum ainda.
 */
function resolveThumbnailUrl(supabase, ownerId, thumbnailRaw) {
    try {
        const parsed = typeof thumbnailRaw === 'string' ? JSON.parse(thumbnailRaw) : thumbnailRaw;
        const filename = parsed && parsed.md5 ? parsed.md5 : null;
        if (!filename) return null;
        if (filename.startsWith('data:') || filename.startsWith('http')) return filename;
        const bucket = process.env.SUPABASE_MEDIA_BUCKET || 'media';
        const { data } = supabase.storage.from(bucket).getPublicUrl(`aluno/${ownerId}/${filename}`);
        return data && data.publicUrl ? data.publicUrl : null;
    } catch (_) {
        return null; // thumbnail ausente/inválido — card mostra o placeholder vazio
    }
}

function sessionExpiresAt(startedAt) {
    return new Date(new Date(startedAt).getTime() + SESSION_DURATION_MS);
}

function isExpired(startedAt) {
    return Date.now() >= sessionExpiresAt(startedAt).getTime();
}

function serializeSession(row) {
    return {
        sessionId: row.id,
        studentId: row.student_id,
        turmaId: row.turma_id,
        projectId: row.project_id,
        deviceId: row.device_id,
        startedAt: row.started_at,
        expiresAt: sessionExpiresAt(row.started_at).toISOString(),
        // UUID imprevisível, não o id sequencial — ver comentário em
        // supabase-setup.sql sobre por que o canal é público, não privado.
        realtimeChannel: `teacher-session:${row.channel_token}`,
    };
}

/**
 * GET /api/teacher/classroom/:turmaId/students
 * Lista os alunos da turma (autorizados pela HelloYotta) com o projeto mais
 * recente de cada um. Status "online agora" é responsabilidade do canal
 * Realtime no frontend — esta rota devolve só o snapshot estático inicial.
 */
router.get('/classroom/:turmaId/students', async (req, res) => {
    const { turmaId } = req.params;
    if (!turmaId) return res.status(400).json({ error: 'Invalid turmaId' });

    let roster;
    try {
        roster = await getClassroomRoster(req.rawToken, req.userId, turmaId);
    } catch (err) {
        console.error('[teacher] HelloYotta error:', err);
        return res.status(502).json({ error: 'Falha ao consultar HelloYotta' });
    }

    if (!roster) {
        return res.status(403).json({ error: 'Professor não autorizado para esta turma' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const studentIds = roster.students.map((s) => s.id);
    if (studentIds.length === 0) {
        return res.json({ turmaId, turmaName: roster.turmaName, students: [] });
    }

    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('id, name, owner, thumbnail, mtime')
            .in('owner', studentIds)
            .eq('deleted', 'NO')
            .order('mtime', { ascending: false });

        if (error) throw error;

        // A query já vem ordenada por mtime desc, então a primeira ocorrência
        // de cada owner é o projeto mais recente daquele aluno.
        const latestByOwner = {};
        (projects || []).forEach((p) => {
            if (!latestByOwner[p.owner]) latestByOwner[p.owner] = p;
        });

        const students = roster.students.map((s) => {
            const project = latestByOwner[s.id];
            return {
                id: s.id,
                name: s.name,
                project: project
                    ? {
                        id: project.id,
                        name: project.name,
                        thumbnail: resolveThumbnailUrl(supabase, s.id, project.thumbnail),
                    }
                    : null,
            };
        });

        res.json({ turmaId, turmaName: roster.turmaName, students });
    } catch (err) {
        console.error('[teacher] GET students error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/teacher/session/start
 * Body: { turmaId, studentId, deviceId, projectId? }
 *
 * Regras aplicadas aqui:
 *  - Reconfirma autorização professor→turma→aluno na HelloYotta (nunca confia
 *    só no que o cliente mandou).
 *  - Fecha qualquer sessão ativa anterior do mesmo professor — se o deviceId
 *    for diferente, end_reason='kicked_new_device' (a notificação "você
 *    entrou em outro lugar" pro dispositivo antigo é publicada no canal
 *    Realtime, não aqui); se for o mesmo device mas outro aluno,
 *    end_reason='switched_student'.
 */
router.post('/session/start', async (req, res) => {
    const { turmaId, studentId, deviceId, projectId } = req.body || {};
    if (!turmaId || !studentId || !deviceId) {
        return res.status(400).json({ error: 'turmaId, studentId e deviceId são obrigatórios' });
    }

    let roster;
    try {
        roster = await getClassroomRoster(req.rawToken, req.userId, turmaId);
    } catch (err) {
        console.error('[teacher] HelloYotta error:', err);
        return res.status(502).json({ error: 'Falha ao consultar HelloYotta' });
    }

    if (!roster || !roster.students.some((s) => s.id === studentId)) {
        return res.status(403).json({ error: 'Professor não autorizado para observar este aluno' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { data: active, error: activeErr } = await supabase
            .from('live_sessions')
            .select('id, device_id, student_id')
            .eq('teacher_id', req.userId)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeErr) throw activeErr;

        if (active) {
            const reason = active.device_id !== deviceId ? 'kicked_new_device' : 'switched_student';
            const { error: closeErr } = await supabase
                .from('live_sessions')
                .update({ ended_at: new Date().toISOString(), end_reason: reason })
                .eq('id', active.id);
            if (closeErr) throw closeErr;
        }

        const { data: created, error: insertErr } = await supabase
            .from('live_sessions')
            .insert({
                teacher_id: req.userId,
                student_id: studentId,
                turma_id: turmaId,
                project_id: projectId || null,
                device_id: deviceId,
            })
            .select('id, student_id, turma_id, project_id, device_id, started_at, channel_token')
            .single();

        if (insertErr) throw insertErr;

        res.json(serializeSession(created));
    } catch (err) {
        console.error('[teacher] POST session/start error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/teacher/session/:sessionId/join
 * Chamado pelo lado do ALUNO (não do professor) pra obter o nome do canal
 * da sessão, depois de ser avisado via canal de presença que um professor
 * iniciou uma observação. Só o aluno dono da sessão recebe o channel_token.
 */
router.post('/session/:sessionId/join', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId) return res.status(400).json({ error: 'Invalid sessionId' });

    try {
        const { data: session, error } = await supabase
            .from('live_sessions')
            .select('id, student_id, turma_id, started_at, ended_at, channel_token')
            .eq('id', sessionId)
            .single();

        if (error || !session) return res.status(404).json({ error: 'Sessão não encontrada' });
        if (session.student_id !== req.userId) {
            return res.status(403).json({ error: 'Esta sessão não pertence a este aluno' });
        }
        if (session.ended_at || isExpired(session.started_at)) {
            return res.status(410).json({ error: 'Sessão encerrada ou expirada' });
        }

        res.json({
            sessionId: session.id,
            realtimeChannel: `teacher-session:${session.channel_token}`,
            expiresAt: sessionExpiresAt(session.started_at).toISOString(),
        });
    } catch (err) {
        console.error('[teacher] POST session/join error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/teacher/session/:sessionId/heartbeat
 * Confirma que a sessão ainda existe e está dentro do limite de 50min. Se
 * já expirou, fecha (end_reason='timeout_50min') e devolve 410 — é o único
 * lugar onde a expiração é aplicada no servidor, já que não há timer em
 * background no modelo serverless.
 *
 * Chamada tanto pelo professor (teacher.js) quanto pelo aluno (LiveWatch.js)
 * — os dois batem nesta mesma rota a cada 20s pra manter a sessão viva do
 * seu próprio lado. A checagem de dono por isso aceita QUALQUER um dos
 * dois (teacher_id OU student_id), não só o professor: com a checagem
 * antiga (só teacher_id), todo heartbeat do ALUNO dava 404 sempre — não
 * quebrava nada visivelmente porque o código antigo de LiveWatch.js
 * ignorava esse status e ficava tentando de novo pra sempre, mas depois
 * que esse 404 passou a ser tratado como "sessão morta" (pra parar de
 * bater numa sessão zumbi de verdade), o heartbeat do aluno — que SEMPRE
 * batia 404 aqui — passou a encerrar a sessão sozinho ~20s depois de toda
 * observação começar. Confirmado em produção.
 */
router.post('/session/:sessionId/heartbeat', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId) return res.status(400).json({ error: 'Invalid sessionId' });

    try {
        const { data: session, error } = await supabase
            .from('live_sessions')
            .select('id, teacher_id, student_id, turma_id, project_id, device_id, started_at, ended_at, channel_token')
            .eq('id', sessionId)
            .single();

        const isOwner = session && (session.teacher_id === req.userId || session.student_id === req.userId);
        if (error || !session || !isOwner) {
            return res.status(404).json({ error: 'Sessão não encontrada' });
        }

        if (session.ended_at) {
            return res.status(410).json({ error: 'Sessão encerrada', endReason: session.end_reason });
        }

        if (isExpired(session.started_at)) {
            await supabase
                .from('live_sessions')
                .update({ ended_at: new Date().toISOString(), end_reason: 'timeout_50min' })
                .eq('id', sessionId);
            return res.status(410).json({ error: 'Sessão expirou (50min)', endReason: 'timeout_50min' });
        }

        res.json(serializeSession(session));
    } catch (err) {
        console.error('[teacher] POST session/heartbeat error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/teacher/session/:sessionId/end
 * Body: { reason: 'teacher_left' | 'switched_student' | 'student_disconnected' |
 *                  'teacher_unresponsive' | 'observe_timeout' }
 * Encerramento explícito. Antes só o professor podia chamar (checagem
 * `.eq('teacher_id', req.userId)` direto na query) — mas o aluno também
 * precisa poder encerrar quando a aba do professor trava/some (ver
 * 'teacher_unresponsive' — LiveWatch.js:_forceRecoverControl, recuperação
 * forçada depois de ~90s sem notícia do professor). Mesma checagem de dono
 * (teacher_id OU student_id) já usada em POST .../heartbeat, pelo mesmo
 * motivo: sem aceitar os dois lados, a chamada do aluno sempre dava 404.
 * 'observe_timeout': professor ficou só observando (sem assumir controle)
 * por tempo demais — teacher.js encerra sozinho pra liberar o canal
 * Realtime em vez de deixar uma aba esquecida consumindo conexão à toa.
 */
router.post('/session/:sessionId/end', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId) return res.status(400).json({ error: 'Invalid sessionId' });

    const validReasons = ['teacher_left', 'switched_student', 'student_disconnected', 'teacher_unresponsive', 'observe_timeout'];
    const reason = validReasons.includes(req.body?.reason) ? req.body.reason : 'teacher_left';

    try {
        const { data: session, error: fetchError } = await supabase
            .from('live_sessions')
            .select('id, teacher_id, student_id, ended_at')
            .eq('id', sessionId)
            .maybeSingle();

        if (fetchError) throw fetchError;
        const isOwner = session && (session.teacher_id === req.userId || session.student_id === req.userId);
        if (!session || !isOwner) return res.status(404).json({ error: 'Sessão não encontrada' });
        if (session.ended_at) return res.status(404).json({ error: 'Sessão não encontrada ou já encerrada' });

        const { error: updateError } = await supabase
            .from('live_sessions')
            .update({ ended_at: new Date().toISOString(), end_reason: reason })
            .eq('id', sessionId)
            .is('ended_at', null);

        if (updateError) throw updateError;

        res.json({ success: true });
    } catch (err) {
        console.error('[teacher] POST session/end error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Valida que existe uma live_session ativa, não expirada, pertencente a
 * req.userId (professor) e com projeto associado. Usado pelos dois endpoints
 * abaixo pra autorizar o bypass estreito do filtro de owner do /api/db.
 */
async function getAuthorizedSessionProject(supabase, sessionId, teacherId) {
    const { data: session, error } = await supabase
        .from('live_sessions')
        .select('id, teacher_id, project_id, ended_at, started_at')
        .eq('id', sessionId)
        .single();

    if (error || !session || session.teacher_id !== teacherId) return { error: 404, message: 'Sessão não encontrada' };
    if (session.ended_at || isExpired(session.started_at)) return { error: 410, message: 'Sessão encerrada ou expirada' };
    if (!session.project_id) return { error: 404, message: 'Aluno ainda não tem projeto associado a esta sessão' };
    return { session };
}

/**
 * GET /api/teacher/session/:sessionId/project
 * Bypass estreito do filtro de owner do /api/db — só funciona enquanto a
 * sessão ao vivo estiver ativa e pertencer a este professor. Usa a service
 * role key (mesmo padrão de backend/src/routes/share.js).
 */
router.get('/session/:sessionId/project', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId) return res.status(400).json({ error: 'Invalid sessionId' });

    const auth = await getAuthorizedSessionProject(supabase, sessionId, req.userId);
    if (auth.error) return res.status(auth.error).json({ error: auth.message });

    try {
        const { data: project, error } = await supabase
            .from('projects')
            .select('id, name, json, thumbnail, owner')
            .eq('id', auth.session.project_id)
            .eq('deleted', 'NO')
            .single();

        if (error || !project) return res.status(404).json({ error: 'Projeto não encontrado' });

        res.json(project);
    } catch (err) {
        console.error('[teacher] GET session/project error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/teacher/session/:sessionId/project
 * Body: { json }
 * Mesmo bypass, pro save forçado do professor (ver LiveWatch.js /
 * protocolo de handoff — chamado só no instante de soltar o controle).
 */
router.put('/session/:sessionId/project', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId) return res.status(400).json({ error: 'Invalid sessionId' });

    const { json } = req.body || {};
    if (json === undefined) return res.status(400).json({ error: 'json é obrigatório' });

    const auth = await getAuthorizedSessionProject(supabase, sessionId, req.userId);
    if (auth.error) return res.status(auth.error).json({ error: auth.message });

    try {
        // projects.mtime é TIMESTAMP de verdade no Postgres — precisa de ISO
        // 8601, não da string de epoch em ms que o IO.saveProject legado usa
        // (aquele caminho passa por db.js, que faz essa conversão; esta rota
        // fala direto com o Supabase, sem passar por lá).
        const { error } = await supabase
            .from('projects')
            .update({ json, mtime: new Date().toISOString() })
            .eq('id', auth.session.project_id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('[teacher] PUT session/project error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
