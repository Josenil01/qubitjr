/**
 * backend/src/routes/assignments.js
 *
 * Rotas de "missões" (assignments): um professor monta um projeto de exemplo
 * no editor de verdade e cadastra ele como a missão ativa da turma; o
 * ScratchJr computa os requisitos (cenas, personagens, blocos, scores de
 * pensamento computacional) a partir desse projeto e guarda em
 * assignments.requirements (JSONB) — ver backend/supabase-setup.sql.
 *
 * Modelo self-referencing (assignments.template_id): uma linha "template"
 * (template_id nulo) é dona de project_name/requirements; uma linha
 * "referência" (template_id setado, apontando pra um template) delega esses
 * campos ao template através de services/assignmentResolver.js. Isso é o que
 * permite um autor editar seu projeto de exemplo canônico (via /register
 * numa reautoria) e propagar a mudança pra toda turma que referencia esse
 * template, sem duplicar a missão por turma.
 *
 * Todas as rotas aqui passam pelo identityMiddleware (montadas depois dele em
 * index.js, mesmo padrão de routes/teacher.js) — req.userId identifica quem
 * chamou. turma_id/nivel vêm das claims do JWT já decodificado durante o
 * identityMiddleware (req.turmaId já existe; nivel não tinha getter até agora
 * — ver getNivelFromClaims em services/identity.js), então não precisamos
 * rechamar verifyAndDecode aqui.
 *
 * POST /api/assignments/register     — professor cadastra a missão ativa da turma
 * GET  /api/assignments/active        — qualquer usuário autenticado consulta a
 *                                        missão ativa da própria turma (se houver)
 * GET  /api/assignments/my-progress   — aluno consulta o próprio progresso na
 *                                        missão ativa (mesma lógica de
 *                                        GET /api/public/students/:id/assignment-score
 *                                        em routes/share.js, só que autenticada
 *                                        via sessão normal em vez da chave da
 *                                        HelloYotta - usada pelo badge flutuante
 *                                        no editor do aluno)
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { getTurmaIdFromClaims, getNivelFromClaims, verifyAndDecode } = require('../services/identity');
const { notifyAssignmentRegistered } = require('../services/helloyotta');
const { computeProjectManifest, compareManifests } = require('../services/assignmentScoring');
const { resolveAssignmentFields } = require('../services/assignmentResolver');

const router = express.Router();

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
 * req.turmaId já é populado pelo identityMiddleware (index.js) a partir das
 * claims do JWT decodificado ali mesmo. nivel ainda não tem um campo próprio
 * em req, então decodificamos de novo aqui a partir de req.rawToken — mesmo
 * token já verificado no middleware, só reaproveitando pra extrair mais um
 * campo das claims (barato: verifyAndDecode cacheia token de aluno e HMAC de
 * professor é local, sem chamada de rede extra nenhuma das duas vezes).
 */
async function getTurmaAndNivel(req) {
    let claims = null;
    try {
        claims = await verifyAndDecode(req.rawToken);
    } catch (err) {
        console.warn('[assignments] Falha ao redecodificar claims para nivel:', err.message);
    }
    const turmaId = req.turmaId || getTurmaIdFromClaims(claims);
    const nivel = getNivelFromClaims(claims);
    return { turmaId, nivel };
}

/**
 * POST /api/assignments/register
 * Body: { projectId: <int> }
 *
 * Chamado pelo botão flutuante "Cadastrar aula" do professor, depois de ele
 * montar um projeto de exemplo no editor de verdade. Duas sequências
 * possíveis, dependendo de o projeto já ter sido cadastrado antes:
 *
 *   A) Primeira vez (project.assignment_id ainda não setado) — sem
 *      transação real (Supabase JS não suporta multi-statement facilmente,
 *      então seguimos em série e logamos claramente se um passo posterior
 *      falhar depois de um anterior já ter sido aplicado, mesmo estilo
 *      defensivo já usado no UPDATE de db.js):
 *        1. Desativa qualquer missão anterior ativa da turma.
 *        2. Insere a nova missão — linha "template" (active = true,
 *           template_id NULL) — e pega o id.
 *        3. Vincula o projeto de exemplo à nova missão (projects.assignment_id).
 *
 *   B) Reautoria (project.assignment_id já setado de um cadastro anterior
 *      deste MESMO projeto) — o autor está apenas editando seu exemplo
 *      canônico, não criando uma nova missão. Faz UPDATE no MESMO id da
 *      missão-template existente (project_name/requirements/nivel), sem
 *      mexer em active/turma_id. Isso é o que faz a edição propagar pra
 *      toda turma que referencia esse template via assignments.template_id
 *      (ver services/assignmentResolver.js) — sem isso, cada "Cadastrar
 *      aula" criaria um template novo e quebraria as referências existentes.
 *
 * Notificação à HelloYotta é best-effort e não bloqueia a resposta (ver
 * services/helloyotta.js#notifyAssignmentRegistered - vira no-op enquanto a
 * URL real não existir).
 */
router.post('/register', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const projectId = parseInt(req.body && req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

    try {
        const { data: project, error: fetchErr } = await supabase
            .from('projects')
            .select('id, name, json, owner, assignment_id')
            .eq('id', projectId)
            .eq('owner', req.userId)
            .single();

        if (fetchErr || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }

        const { turmaId, nivel } = await getTurmaAndNivel(req);
        if (!turmaId) {
            return res.status(400).json({ error: 'turma_id ausente nas claims do token' });
        }

        let projectJson;
        try {
            projectJson = JSON.parse(project.json);
        } catch (parseErr) {
            console.error('[assignments] projeto com json inválido:', projectId, parseErr.message);
            return res.status(500).json({ error: 'Projeto com json inválido' });
        }

        const requirements = computeProjectManifest(projectJson);

        let assignmentId = null;
        let updatedExistingTemplate = false;

        // Reautoria: este projeto já está vinculado a uma missão de uma
        // chamada anterior a /register. Se essa missão for de fato um
        // template (template_id nulo — o caso normal, já que um projeto só
        // ganha assignment_id pela primeira vez através do caminho B abaixo,
        // que sempre cria um template, nunca uma referência), atualiza ela
        // no lugar em vez de criar uma missão nova.
        if (project.assignment_id) {
            const { data: existingAssignment, error: existingErr } = await supabase
                .from('assignments')
                .select('id, template_id')
                .eq('id', project.assignment_id)
                .maybeSingle();

            if (existingErr) {
                console.error('[assignments] Falha ao buscar missão existente', project.assignment_id, 'do projeto', projectId, ':', existingErr);
                return res.status(500).json({ error: 'Falha ao buscar missão existente: ' + existingErr.message });
            }

            if (existingAssignment && !existingAssignment.template_id) {
                const { error: updateErr } = await supabase
                    .from('assignments')
                    .update({
                        project_name: project.name,
                        requirements,
                        nivel,
                    })
                    .eq('id', existingAssignment.id);

                if (updateErr) {
                    console.error('[assignments] Falha ao atualizar template existente', existingAssignment.id, ':', updateErr);
                    return res.status(500).json({ error: 'Falha ao atualizar missão existente: ' + updateErr.message });
                }

                assignmentId = existingAssignment.id;
                updatedExistingTemplate = true;
            } else if (existingAssignment && existingAssignment.template_id) {
                // Defensivo, não esperado na prática: projects.assignment_id de um
                // projeto de professor apontando pra uma linha "referência" (que
                // tem template_id setado) em vez de um template. Cai pro caminho
                // de primeiro cadastro abaixo como fallback seguro.
                console.warn('[assignments] projects.assignment_id', project.assignment_id, 'do projeto', projectId, 'aponta para uma missão com template_id setado (uma referência, não um template) — tratando como primeiro cadastro.');
            } else {
                // Órfão: assignment_id aponta pra uma linha que não existe (mais).
                // Mesmo fallback seguro do caso acima.
                console.warn('[assignments] projects.assignment_id', project.assignment_id, 'do projeto', projectId, 'não corresponde a nenhuma missão existente — tratando como primeiro cadastro.');
            }
        }

        if (!updatedExistingTemplate) {
            // 1. Desativa a missão anterior da turma, se houver.
            const { error: deactivateErr } = await supabase
                .from('assignments')
                .update({ active: false })
                .eq('turma_id', turmaId)
                .eq('active', true);

            if (deactivateErr) {
                console.error('[assignments] Falha ao desativar missão anterior da turma', turmaId, ':', deactivateErr);
                return res.status(500).json({ error: 'Falha ao desativar missão anterior: ' + deactivateErr.message });
            }

            // 2. Insere a nova missão (linha template: template_id fica nulo).
            const { data: inserted, error: insertErr } = await supabase
                .from('assignments')
                .insert({
                    turma_id: turmaId,
                    nivel,
                    teacher_id: req.userId,
                    project_name: project.name,
                    requirements,
                    active: true,
                })
                .select('id')
                .single();

            if (insertErr || !inserted) {
                // A missão anterior da turma já foi desativada no passo 1 — loga alto
                // pra ficar claro que a turma pode ter ficado sem NENHUMA missão ativa.
                console.error('[assignments] INSERT falhou APÓS desativar a missão anterior da turma', turmaId, '— turma ficou sem missão ativa. Erro:', insertErr);
                return res.status(500).json({ error: 'Falha ao criar nova missão: ' + (insertErr ? insertErr.message : 'unknown') });
            }

            assignmentId = inserted.id;

            // 3. Vincula o projeto de exemplo à nova missão.
            const { error: linkErr } = await supabase
                .from('projects')
                .update({ assignment_id: assignmentId })
                .eq('id', projectId)
                .eq('owner', req.userId);

            if (linkErr) {
                // A missão já existe e está ativa nesse ponto — só o vínculo com o
                // projeto de exemplo do professor falhou. Não é fatal para o fluxo
                // do aluno (a missão em si está registrada), então loga e segue.
                console.error('[assignments] Missão', assignmentId, 'criada, mas falha ao vincular projects.assignment_id no projeto', projectId, ':', linkErr);
            }
        }

        // Notificação best-effort, fire-and-forget — nunca deve bloquear nem
        // derrubar a resposta HTTP ao professor (mesmo padrão do sync de
        // mídia em WebInterface.js's io_setmedia). turmaId/nivel vêm das
        // claims (fixos nesta chamada) e projectName/requirements são os
        // valores recém-computados acima — válidos nos dois ramos (update ou
        // insert), já que num update eles são exatamente o que acabou de ser
        // gravado na linha existente.
        notifyAssignmentRegistered({
            turmaId,
            nivel,
            activityId: assignmentId,
            projectName: project.name,
            requirements,
            createdAt: new Date().toISOString(),
        }).catch((err) => {
            console.warn('[assignments] notifyAssignmentRegistered falhou (não-fatal):', err.message);
        });

        res.json({ success: true, assignmentId, projectName: project.name, requirements });
    } catch (err) {
        console.error('[assignments] POST /register error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/assignments/active
 * Consulta a missão ativa da turma do usuário autenticado (professor ou
 * aluno). Sem turma_id nas claims não é erro - mesmo "no-op silencioso" já
 * aplicado em entry/editor.js pro LiveWatch.js quando o aluno não está num
 * contexto HelloYotta.
 */
router.get('/active', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { turmaId } = await getTurmaAndNivel(req);
        if (!turmaId) {
            return res.json({ assignment: null });
        }

        const { data: assignment, error: assignmentErr } = await supabase
            .from('assignments')
            .select('id, project_name, requirements, nivel, turma_id, template_id')
            .eq('turma_id', turmaId)
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (assignmentErr) throw assignmentErr;
        if (!assignment) return res.json({ assignment: null });

        const { data: existingProject, error: projectErr } = await supabase
            .from('projects')
            .select('id')
            .eq('owner', req.userId)
            .eq('assignment_id', assignment.id)
            .eq('deleted', 'NO')
            .limit(1)
            .maybeSingle();

        if (projectErr) throw projectErr;

        // Resolve project_name/requirements EFETIVOS: se esta linha for uma
        // referência (template_id setado), busca os valores do template —
        // é assim que edições no template propagam pras turmas que o
        // referenciam. Ver services/assignmentResolver.js.
        const resolved = (await resolveAssignmentFields(supabase, assignment)) || {
            projectName: assignment.project_name,
            requirements: assignment.requirements,
        };

        res.json({
            assignment: {
                id: assignment.id,
                projectName: resolved.projectName,
                requirements: resolved.requirements,
                nivel: assignment.nivel,
                turmaId: assignment.turma_id,
                existingProjectId: existingProject ? existingProject.id : null,
            },
        });
    } catch (err) {
        console.error('[assignments] GET /active error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/assignments/my-progress
 * Mesma lógica de GET /api/public/students/:studentId/assignment-score
 * (routes/share.js), só trocando o studentId de path param pelo req.userId
 * da sessão autenticada normal - usada pelo badge flutuante do aluno, que
 * não tem (nem deveria ter) a chave da HelloYotta no navegador.
 */
router.get('/my-progress', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { data: rows, error } = await supabase
            .from('projects')
            .select('id, json, assignment_id, assignments!inner(id, project_name, requirements, active, template_id)')
            .eq('owner', req.userId)
            .eq('deleted', 'NO')
            .eq('assignments.active', true)
            .not('assignment_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        const project = rows && rows[0];
        if (!project || !project.assignments) {
            return res.json({ hasAssignment: false });
        }

        const assignment = project.assignments;

        let projectJson;
        try {
            projectJson = JSON.parse(project.json);
        } catch (parseErr) {
            console.error('[assignments] my-progress: projeto', project.id, 'com json inválido:', parseErr.message);
            return res.status(500).json({ error: 'Projeto com json inválido' });
        }

        // Resolve project_name/requirements EFETIVOS através do template,
        // igual GET /active — ver services/assignmentResolver.js.
        const resolved = (await resolveAssignmentFields(supabase, assignment)) || {
            projectName: assignment.project_name,
            requirements: assignment.requirements,
        };

        const actualManifest = computeProjectManifest(projectJson);
        const comparison = compareManifests(resolved.requirements, actualManifest);

        res.json({
            hasAssignment: true,
            projectName: resolved.projectName,
            ...comparison,
        });
    } catch (err) {
        console.error('[assignments] GET /my-progress error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
