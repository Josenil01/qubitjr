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
 * POST /api/assignments/register           — professor cadastra a missão ativa da turma
 * GET  /api/assignments/active              — qualquer usuário autenticado consulta a
 *                                              missão ativa da própria turma (se houver)
 * GET  /api/assignments/official            — professor OU admin (qualquer turma) lista
 *                                              o catálogo de missões marcadas is_official
 *                                              (ver backend/supabase-setup.sql)
 * GET  /api/assignments/authored            — todas as missões próprias do usuário
 *                                              (qualquer turma), com isOfficial/
 *                                              generatedByAi - selo no card do projeto
 * PATCH /api/assignments/:id/official       — admin liga/desliga is_official e/ou
 *                                              generated_by_ai de QUALQUER missão
 * GET  /api/assignments/my-progress         — aluno consulta o próprio progresso na
 *                                              missão ativa (mesma lógica de
 *                                              GET /api/public/students/:id/assignment-score
 *                                              em routes/share.js, só que autenticada
 *                                              via sessão normal em vez da chave da
 *                                              HelloYotta - usada pelo badge flutuante
 *                                              no editor do aluno)
 * GET  /api/assignments/mine                — aluno lista o HISTÓRICO inteiro de
 *                                              missões da própria turma (não só a
 *                                              ativa), cada uma com started/completed
 *                                              - usada pelo menu "Missões" da lobby
 *                                              (lobby/MissionsMenu.js)
 * POST /api/assignments/:id/generate-hints  — professor gera um RASCUNHO de dicas de
 *                                              coaching (LLM) a partir do seu próprio
 *                                              projeto-exemplo vinculado à missão -
 *                                              ver services/hintsGeneration.js. Não
 *                                              persiste nada; é só preview pra revisão.
 * POST /api/assignments/:id/hints           — professor salva o subconjunto de dicas
 *                                              já aprovado (filtrado no cliente),
 *                                              substituindo o que houver antes.
 * POST /api/assignments/:id/hints/:hintId/event — aluno registra "dica mostrada" ou
 *                                              "dica dispensada" (hint_events) - sinal
 *                                              de dificuldade/engajamento por missão,
 *                                              consumido em GET /api/public/students/
 *                                              :id/assignment-score (routes/share.js).
 * GET  /api/assignments/:id/hints/dismissed — ids das dicas que ESTE aluno já
 *                                              dispensou (hint_events) - o cliente
 *                                              recarrega o "já fechei" depois de um F5.
 * GET  /api/assignments/by-project/:projectId — dado um projeto que o professor abriu,
 *                                              diz se é o molde de uma missão sua -
 *                                              deixa o botão "Cadastrar aula" reaparecer
 *                                              ao reabrir pela lobby normal, não só no
 *                                              link de lançamento original da HelloYotta.
 * GET  /api/assignments/:id/project         — admin (qualquer missão) ou professor-autor
 *                                              (só a própria) busca o projeto-exemplo
 *                                              vinculado à missão :id, pra carregar no
 *                                              editor sem passar pelo filtro de owner do
 *                                              /api/db - bypass estreito, mesmo padrão de
 *                                              GET /api/teacher/session/:id/project
 *                                              (routes/teacher.js), usado pelo mesmo patch
 *                                              de IO em entry/editor.js (editAssignmentId).
 * PUT  /api/assignments/:id/project         — mesma autorização, salva o json editado e
 *                                              recalcula requirements/stage_placements -
 *                                              mesmo bypass de PUT /api/teacher/session/
 *                                              :id/project, mas sem exigir uma live_session.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { getTurmaIdFromClaims, getNivelFromClaims, verifyAndDecode } = require('../services/identity');
const { notifyAssignmentRegistered } = require('../services/helloyotta');
const { computeProjectManifest, compareManifests } = require('../services/assignmentScoring');
const { resolveAssignmentFields, resolveHintsUpdatedAt } = require('../services/assignmentResolver');
const { generateHints } = require('../services/hintsGeneration');
const { readCompletionSnapshot, persistCompletion, readCompletionFlags } = require('../services/completionSnapshot');
const { buildStagePlacements } = require('../services/detailedManifest');
const { persistStagePlacements } = require('../services/stagePlacements');
const { generateActivityPlan } = require('../services/activityGeneration');
const { buildProjectFromPlan } = require('../services/activityProjectBuilder');

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
 * POST /api/assignments/generate-from-theme
 * Body: { theme: string, level?: 1|2|3 }
 *
 * `level` (1º/2º/3º ano - ver LEVEL_PROFILES em activityProjectBuilder.js)
 * ajusta a complexidade da atividade gerada (nº de cenas/personagens,
 * gatilhos permitidos, uso de loop/mensagens, tamanho dos scripts) -
 * escolhido manualmente pelo professor na tela (ver GenerateActivityModal.js,
 * pré-selecionado a partir do `nivel`/série da turma quando disponível nas
 * claims, mas sempre editável). Ausente/inválido cai no default (nível 2)
 * dentro de generateActivityPlan - nunca rejeitado aqui.
 *
 * Cria um projeto NOVO a partir só de um tema em texto livre (ex.: "A lenda
 * do Saci Pererê"), usando o mesmo agente de geração por IA do endpoint
 * servidor-a-servidor da HelloYotta (POST /api/public/activities/generate,
 * ver routes/share.js) - aqui, porém, é o PRÓPRIO professor logado quem
 * dispara e espera a resposta (sem callback/polling): SÍNCRONO, com um
 * spinner do lado do cliente (ver GenerateActivityModal.js) - decisão
 * diferente da rota da HelloYotta porque lá ninguém fica "sentado esperando"
 * numa aba de navegador.
 *
 * De propósito NÃO gera dicas aqui (só o projeto) - dicas já são geradas de
 * novo, a partir do projeto salvo de verdade, quando o professor clicar
 * "Cadastrar aula" no editor (AssignmentAuthorBar.js → POST
 * /assignments/:id/generate-hints, fluxo já existente) - gerar aqui TAMBÉM
 * seria uma segunda chamada de LLM inteira pra um resultado descartado, já
 * que só as dicas geradas em cima do projeto REGISTRADO como missão contam.
 *
 * O projeto criado é um projeto normal (mesma tabela/shape de sempre,
 * owner = professor logado) - não vira uma missão sozinho; o professor abre
 * no editor (ver GenerateActivityModal.js) e usa o fluxo de "Cadastrar aula"
 * já existente pra revisar/ajustar os blocos e publicar, exatamente como se
 * tivesse montado o projeto à mão.
 *
 * Só professores podem chamar (req.role, populado pelas claims do JWT em
 * index.js) - alunos autenticados não têm motivo pra gerar uma atividade.
 */
router.post('/generate-from-theme', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });
    if (req.role !== 'professor' && req.role !== 'admin') return res.status(403).json({ error: 'Só professores ou administradores podem gerar atividades por IA' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const rawTheme = req.body && req.body.theme;
    const theme = typeof rawTheme === 'string' ? rawTheme.trim() : '';
    if (!theme || theme.length > 200) {
        return res.status(400).json({ error: 'theme é obrigatório (texto de 1 a 200 caracteres)' });
    }
    // Nível 1/2/3 (1º/2º/3º ano - ver LEVEL_PROFILES em
    // activityProjectBuilder.js). Ausente/inválido cai no default dentro de
    // generateActivityPlan - nunca rejeitado aqui, só repassado como veio.
    const level = req.body && req.body.level;

    try {
        const { projectName, teacherDescription, assetGapNote, plan, level: resolvedLevel, levelLabel } =
            await generateActivityPlan(theme, level);
        const { projectJson } = buildProjectFromPlan(plan);

        const now = new Date().toISOString();
        const { data: inserted, error: insertErr } = await supabase
            .from('projects')
            .insert({
                name: projectName,
                json: JSON.stringify(projectJson),
                owner: req.userId,
                deleted: 'NO',
                version: 'iOSv01',
                ctime: now,
                mtime: now,
                // Única rota que sabe de verdade que este projeto nasceu de
                // IA (ver migração em supabase-setup.sql) - POST /register
                // copia isso pra assignments.generated_by_ai quando a missão
                // é cadastrada, que é o que o catálogo oficial (GET /official,
                // OfficialCatalog.js) de fato lê.
                created_via: 'ai',
            })
            .select('id')
            .single();

        if (insertErr || !inserted) {
            console.error('[assignments] generate-from-theme: falha ao criar projeto:', insertErr);
            return res.status(500).json({ error: 'Falha ao criar projeto: ' + (insertErr ? insertErr.message : 'unknown') });
        }

        res.json({
            success: true,
            projectId: inserted.id,
            projectName,
            description: teacherDescription,
            assetGapNote,
            level: resolvedLevel,
            levelLabel,
        });
    } catch (err) {
        if (err.code === 'NOT_CONFIGURED') {
            return res.status(503).json({ error: 'Geração de atividade por IA não configurada' });
        }
        console.error('[assignments] POST /generate-from-theme error:', err);
        res.status(500).json({ error: err.message || 'Falha ao gerar atividade' });
    }
});

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
 *      mexer em turma_id. Isso é o que faz a edição propagar pra toda turma
 *      que referencia esse template via assignments.template_id (ver
 *      services/assignmentResolver.js) — sem isso, cada "Cadastrar aula"
 *      criaria um template novo e quebraria as referências existentes.
 *      TAMBÉM reativa esta missão (active=true), desativando qualquer OUTRA
 *      ativa da MESMA turma primeiro - achado em teste real: sem isso, uma
 *      missão que tinha sido desativada por uma mais recente da mesma
 *      turma continuava invisível pra HelloYotta (GET /teachers/:teacherId/
 *      activities só é consumido mostrando active=true de cada turma) mesmo
 *      depois do professor "cadastrar a aula" de novo nela - mesma regra de
 *      "só uma ativa por turma" do primeiro cadastro (passo 1 acima),
 *      agora consistente nos dois caminhos.
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
            .select('id, name, json, owner, assignment_id, created_via')
            .eq('id', projectId)
            .eq('owner', req.userId)
            .single();

        if (fetchErr || !project) {
            return res.status(404).json({ error: 'Project not found or access denied' });
        }
        // Ver docblock de projects.created_via/assignments.generated_by_ai
        // em supabase-setup.sql - só POST /generate-from-theme marca 'ai',
        // propagado pra missão agora (nos dois ramos abaixo, criação e
        // reautoria) porque é só aqui que o projeto VIRA uma missão de fato.
        const generatedByAi = project.created_via === 'ai';

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
        // Onde o professor deixou cada personagem, cena a cena - sombra de
        // posicionamento no palco do aluno (ver shared/detailedManifest.mjs#
        // buildStagePlacements). Gravado abaixo, depois dos dois ramos.
        const stagePlacements = buildStagePlacements(projectJson);

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
                .select('id, template_id, turma_id')
                .eq('id', project.assignment_id)
                .maybeSingle();

            if (existingErr) {
                console.error('[assignments] Falha ao buscar missão existente', project.assignment_id, 'do projeto', projectId, ':', existingErr);
                return res.status(500).json({ error: 'Falha ao buscar missão existente: ' + existingErr.message });
            }

            if (existingAssignment && !existingAssignment.template_id) {
                // Achado em teste real (urgente) - reautoria nunca tocava em
                // `active`, então uma missão desativada por uma OUTRA mais
                // recente da MESMA turma (ver passo 1 do primeiro cadastro
                // abaixo) continuava inativa mesmo depois do professor
                // "cadastrar a aula" de novo nela - a HelloYotta (que só
                // mostra active=true pro professor escolher, ver
                // GET /teachers/:teacherId/activities) nunca via ela voltar.
                // Mesma regra de "só uma missão ativa por turma" do primeiro
                // cadastro: desativa qualquer OUTRA ativa da mesma turma
                // antes de reativar esta.
                const { error: deactivateSiblingsErr } = await supabase
                    .from('assignments')
                    .update({ active: false })
                    .eq('turma_id', existingAssignment.turma_id)
                    .eq('active', true)
                    .neq('id', existingAssignment.id);

                if (deactivateSiblingsErr) {
                    console.error('[assignments] Falha ao desativar outras missões da turma', existingAssignment.turma_id, 'ao reautorar', existingAssignment.id, ':', deactivateSiblingsErr);
                    return res.status(500).json({ error: 'Falha ao desativar outras missões da turma: ' + deactivateSiblingsErr.message });
                }

                const { error: updateErr } = await supabase
                    .from('assignments')
                    .update({
                        project_name: project.name,
                        requirements,
                        nivel,
                        active: true,
                        generated_by_ai: generatedByAi,
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
                    generated_by_ai: generatedByAi,
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

        // stage_placements nos DOIS ramos acima (reautoria = update do
        // template; primeiro cadastro = linha recém-inserida), num UPDATE À
        // PARTE e tolerante - NÃO dentro do update/insert principal: a coluna
        // vem de uma migração manual (supabase-setup.sql) e, enquanto ela não
        // for aplicada, o PostgREST rejeitaria o comando inteiro (PGRST204) e
        // o professor não conseguiria mais cadastrar missão nenhuma. Aqui, sem
        // a coluna, só não há sombra. Ver services/stagePlacements.js.
        await persistStagePlacements(supabase, assignmentId, stagePlacements);

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
            .select('id, project_name, requirements, hints, nivel, turma_id, template_id')
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

        // Foto congelada de conclusão (ver services/completionSnapshot.js) -
        // consulta separada e tolerante, pra nunca derrubar /active inteiro
        // se a migração da coluna ainda não rodou.
        const completion = existingProject ? await readCompletionSnapshot(supabase, existingProject.id) : null;

        // Resolve project_name/requirements/hints EFETIVOS: se esta linha for
        // uma referência (template_id setado), busca os valores do template —
        // é assim que edições no template (e reaprovações de dicas) propagam
        // pras turmas que o referenciam. Ver services/assignmentResolver.js.
        // includeStagePlacements: stage_placements (sombra de posicionamento)
        // vem do mesmo lugar, numa consulta SEPARADA e tolerante - de
        // propósito fora do SELECT acima, pra que a coluna ainda não migrada
        // nunca derrube /active (ver services/stagePlacements.js).
        const resolved = (await resolveAssignmentFields(supabase, assignment, { includeStagePlacements: true })) || {
            projectName: assignment.project_name,
            requirements: assignment.requirements,
            hints: assignment.hints || [],
            stagePlacements: null,
        };

        res.json({
            assignment: {
                id: assignment.id,
                projectName: resolved.projectName,
                requirements: resolved.requirements,
                hints: resolved.hints,
                // Array por cena (ordem de project.pages) de {characterMd5,
                // characterOccurrence, homex, homey, homescale}, ou null (missão
                // anterior ao recurso / coluna não migrada) - ver
                // src/app/src/editor/ui/StagePlacementGhost.js.
                stagePlacements: resolved.stagePlacements || null,
                nivel: assignment.nivel,
                turmaId: assignment.turma_id,
                existingProjectId: existingProject ? existingProject.id : null,
                // Ver services/completionSnapshot.js - presente (não-null) só
                // depois que o aluno cumpriu os requisitos pela primeira vez.
                // O cliente (AssignmentBadge.js) usa isto pra travar a
                // conclusão como conquista permanente, mesmo entre sessões.
                completedAt: completion ? completion.completedAt : null,
                completionSnapshot: completion ? completion.snapshot : null,
            },
        });
    } catch (err) {
        console.error('[assignments] GET /active error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/assignments/official
 *
 * Catálogo de missões "oficiais" (ver migração is_official em
 * backend/supabase-setup.sql) - por contrato com a HelloYotta, QUALQUER
 * professor ou admin autenticado (req.role, vindo das claims do JWT - ver
 * index.js/identity.js) pode consultar, independente de turma/roster. Ao
 * contrário de GET /active (que resolve a missão ATIVA da turma do próprio
 * usuário via getClassroomRoster), esta rota não depende da HelloYotta nem
 * do turma_id do token - lista todo o catálogo curado de uma vez.
 *
 * Só TEMPLATES (template_id IS NULL): uma linha de referência não guarda
 * project_name/requirements próprios, então nunca é marcada is_official (ver
 * docblock da coluna) - o filtro aqui é defensivo, pro caso de alguém marcar
 * uma referência direto no banco por engano.
 */
router.get('/official', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });
    if (req.role !== 'professor' && req.role !== 'admin') {
        return res.status(403).json({ error: 'Só professores ou administradores podem consultar o catálogo oficial' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { data: rows, error } = await supabase
            .from('assignments')
            .select('id, teacher_id, project_name, requirements, nivel, created_at, generated_by_ai')
            .eq('is_official', true)
            .is('template_id', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            missions: (rows || []).map((row) => ({
                id: row.id,
                name: row.project_name,
                teacherId: row.teacher_id,
                requirements: row.requirements,
                nivel: row.nivel,
                createdAt: row.created_at,
                generatedByAi: !!row.generated_by_ai,
            })),
        });
    } catch (err) {
        console.error('[assignments] GET /official error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/assignments/authored
 * TODAS as missões (template_id IS NULL) que o usuário autenticado autorou
 * (teacher_id === req.userId), em QUALQUER turma - diferente de GET /mine
 * (escopado só pela turma_id do próprio token) e de GET /official (só as
 * marcadas is_official, de qualquer autor). Usada pelo selo/botão "🏅" no
 * próprio card do projeto na lobby (ver lobby/Home.js#addProjectLink) -
 * precisa saber, pra CADA projeto que o usuário já vê na própria lista,
 * se a missão vinculada já está no catálogo oficial, sem depender de estar
 * olhando a turma "certa" no token (um professor/admin pode ter missões em
 * várias turmas diferentes).
 */
router.get('/authored', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { data: rows, error } = await supabase
            .from('assignments')
            .select('id, project_name, is_official, generated_by_ai')
            .eq('teacher_id', req.userId)
            .is('template_id', null);

        if (error) throw error;

        res.json({
            missions: (rows || []).map((row) => ({
                id: row.id,
                name: row.project_name,
                isOfficial: !!row.is_official,
                generatedByAi: !!row.generated_by_ai,
            })),
        });
    } catch (err) {
        console.error('[assignments] GET /authored error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/assignments/:id/official
 * Body: { isOfficial?: boolean, generatedByAi?: boolean }
 *
 * Admin-only (não dono - diferente de GET/PUT /:id/project acima, curadoria
 * do catálogo é decisão de plataforma, não do professor-autor): liga/desliga
 * a tag "oficial" de QUALQUER missão, e corrige manualmente o selo "feito
 * com IA" quando a detecção automática de POST /register errar ou faltar
 * (ex.: missão antiga, cadastrada antes desta coluna existir). Pelo menos
 * um dos dois campos precisa vir no corpo - um PATCH vazio não faz sentido.
 * Mesmo filtro `template_id IS NULL` do GET /official - marcar uma
 * referência não teria efeito nenhum na leitura (ver docblock da coluna em
 * supabase-setup.sql), então nem deixa tentar.
 */
router.patch('/:id/official', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });
    if (req.role !== 'admin') {
        return res.status(403).json({ error: 'Só administradores podem curar o catálogo oficial' });
    }

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const body = req.body || {};
    const update = {};
    if (typeof body.isOfficial === 'boolean') update.is_official = body.isOfficial;
    if (typeof body.generatedByAi === 'boolean') update.generated_by_ai = body.generatedByAi;
    if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'Informe isOfficial e/ou generatedByAi (boolean)' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { data: assignment, error: fetchErr } = await supabase
            .from('assignments')
            .select('id, template_id')
            .eq('id', assignmentId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!assignment) return res.status(404).json({ error: 'Missão não encontrada' });
        if (assignment.template_id) {
            return res.status(400).json({ error: 'Não é possível marcar uma referência - só o molde (template) original da missão.' });
        }

        const { error: updateErr } = await supabase
            .from('assignments')
            .update(update)
            .eq('id', assignmentId);
        if (updateErr) throw updateErr;

        res.json({ success: true, ...update });
    } catch (err) {
        console.error('[assignments] PATCH /:id/official error:', err);
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

        // Ver services/completionSnapshot.js - missão já concluída (mesmo que
        // o projeto tenha mudado desde então) devolve a FOTO congelada, nunca
        // recalcula do estado atual.
        const frozen = await readCompletionSnapshot(supabase, project.id);
        if (frozen) {
            const resolvedName = (await resolveAssignmentFields(supabase, assignment)) || {};
            return res.json({
                hasAssignment: true,
                projectName: resolvedName.projectName || assignment.project_name,
                completedAt: frozen.completedAt,
                ...frozen.snapshot,
            });
        }

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
            completedAt: null,
            ...comparison,
        });
    } catch (err) {
        console.error('[assignments] GET /my-progress error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/assignments/mine
 * Lista TODAS as missões já atribuídas à turma do aluno (histórico completo -
 * template OU referência, ativa OU já substituída por outra mais recente,
 * ver docblock do topo do arquivo sobre o modelo self-referencing), cada uma
 * com o status de conclusão DESTE aluno especificamente - usado pelo menu
 * "Missões" da lobby (lobby/MissionsMenu.js), que mostra a lista inteira (não
 * só a ativa, ao contrário de GET /active) pra o aluno ver seu progresso
 * através de todas as missões que já teve, mesmo as antigas.
 *
 * Por missão: `started` (o aluno já tem um projeto vinculado a ela) e
 * `completed` (foto congelada de conclusão desse projeto - ver
 * services/completionSnapshot.js#readCompletionFlags, mesma fonte da verdade
 * usada por GET /active e pela tela de live do professor). `projectId`
 * presente só quando started=true - o menu usa pra navegar direto pro
 * projeto (pmd5=) em vez de arriscar criar um duplicado.
 */
router.get('/mine', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { turmaId } = await getTurmaAndNivel(req);
        if (!turmaId) {
            return res.json({ missions: [] }); // mesmo no-op silencioso de GET /active
        }

        const { data: rows, error } = await supabase
            .from('assignments')
            .select('id, project_name, template_id, active, created_at, teacher_id, is_official')
            .eq('turma_id', turmaId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        if (!rows || !rows.length) {
            return res.json({ missions: [] });
        }

        const { data: myProjects, error: projErr } = await supabase
            .from('projects')
            .select('id, assignment_id')
            .eq('owner', req.userId)
            .eq('deleted', 'NO')
            .in('assignment_id', rows.map((row) => row.id));

        if (projErr) throw projErr;

        // Um projeto por missão (o aluno não pode ter mais de um vinculado à
        // mesma missão - dedup já garantido no lado da criação) - primeiro
        // encontrado é o único esperado.
        const projectByAssignment = new Map();
        (myProjects || []).forEach((p) => {
            if (!projectByAssignment.has(p.assignment_id)) {
                projectByAssignment.set(p.assignment_id, p.id);
            }
        });

        const completedProjectIds = await readCompletionFlags(
            supabase,
            Array.from(projectByAssignment.values())
        );

        const missions = await Promise.all(rows.map(async (row) => {
            const resolved = (await resolveAssignmentFields(supabase, row)) ||
                { projectName: row.project_name };
            const projectId = projectByAssignment.get(row.id) || null;
            return {
                id: row.id,
                projectName: resolved.projectName,
                active: !!row.active,
                started: !!projectId,
                completed: !!(projectId && completedProjectIds.has(projectId)),
                projectId: projectId,
                // Pro admin decidir se mostra "🏅 Marcar como oficial"
                // (MissionsMenu.js) - só TEMPLATES podem ser marcados (ver
                // PATCH /:id/official, que rejeita referências com 400), e só
                // faz sentido oferecer o botão se o admin for de fato o autor
                // (teacherId) - admin pode editar qualquer missão, mas
                // "oficial" é curadoria sobre um exemplo que existe de
                // verdade, então o botão só aparece onde há template.
                teacherId: row.teacher_id,
                isTemplate: !row.template_id,
                isOfficial: !!row.is_official,
            };
        }));

        res.json({ missions });
    } catch (err) {
        console.error('[assignments] GET /mine error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/assignments/:id/complete
 * Chamada pelo cliente (AssignmentBadge.js) assim que detecta LOCALMENTE que
 * o aluno acabou de cumprir os requisitos da missão pela 1ª vez nesta sessão
 * - registra a foto congelada (ver services/completionSnapshot.js) pra ela
 * valer entre sessões e pro professor ver o retrato daquele momento, mesmo
 * que o projeto mude depois. Idempotente: chamar de novo (aba recarregada,
 * corrida entre duas abas) nunca sobrescreve uma foto já gravada, só devolve
 * a que já existe. RECALCULA o comparativo aqui no servidor a partir do
 * projeto salvo - nunca confia no "completed" que o cliente afirma, é só o
 * gatilho pra checar agora.
 */
router.post('/:id/complete', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { data: project, error: projectErr } = await supabase
            .from('projects')
            .select('id, json')
            .eq('owner', req.userId)
            .eq('assignment_id', assignmentId)
            .eq('deleted', 'NO')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (projectErr) throw projectErr;
        if (!project) return res.status(404).json({ error: 'Project not found for this assignment' });

        const already = await readCompletionSnapshot(supabase, project.id);
        if (already) {
            return res.json({ completed: true, completedAt: already.completedAt, snapshot: already.snapshot });
        }

        const { data: assignment, error: assignmentErr } = await supabase
            .from('assignments')
            .select('id, template_id, project_name, requirements')
            .eq('id', assignmentId)
            .maybeSingle();
        if (assignmentErr) throw assignmentErr;
        if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

        const resolved = (await resolveAssignmentFields(supabase, assignment)) || {
            requirements: assignment.requirements,
        };

        let projectJson;
        try {
            projectJson = JSON.parse(project.json);
        } catch (parseErr) {
            return res.status(500).json({ error: 'Projeto com json inválido: ' + parseErr.message });
        }

        const comparison = compareManifests(resolved.requirements, computeProjectManifest(projectJson));
        if (!comparison.completed) {
            // Divergiu do que o cliente achou (ex.: projeto mudou entre o
            // cliente detectar e esta chamada chegar) - não persiste nada,
            // best-effort. O cliente tenta de novo na próxima vez que
            // detectar conclusão ao vivo.
            return res.json({ completed: false });
        }

        const result = await persistCompletion(supabase, project.id, comparison);
        if (!result.persisted) {
            // Migração não rodada, ou erro de rede - o estado sticky do
            // cliente já vale localmente nesta sessão de qualquer forma.
            return res.json({ completed: true, persisted: false });
        }
        res.json({ completed: true, completedAt: result.completedAt, snapshot: result.snapshot });
    } catch (err) {
        console.error('[assignments] POST /:id/complete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// wrong_order: bloco de uma dica POSTERIOR montado antes de uma anterior ainda pendente.
// wrong_value/wrong_trigger: o alerta "quase!" (bloco existe mas com valor/gatilho
// errado) - gravado ALÉM de shown/dismissed, pra dar pra medir quantas vezes o
// aluno errou sem mexer nas contagens de shown/dismissed que share.js já soma.
// wrong_extra (Fase 3 - alinhamento): alerta de bloco A MAIS no script que
// corresponde ao do professor (estado extra_block de shared/hintAlignment.mjs).
// wrong_missing: alerta de bloco do combo que ainda FALTA no script que o
// aluno já começou (ex.: colocou "andar" mas não "velocidade") - ver
// alignmentInfo() kind 'missing' em HintEngine.js.
// wrong_value/wrong_order também são gravados pelo caminho de alinhamento.
const HINT_EVENT_TYPES = new Set(['shown', 'dismissed', 'wrong_value', 'wrong_trigger', 'wrong_order', 'wrong_confirm', 'wrong_fill', 'wrong_extra', 'wrong_missing']);

/**
 * POST /api/assignments/:id/hints/:hintId/event
 * Body: { eventType: 'shown' | 'dismissed' }
 *
 * Chamada pelo badge flutuante do aluno (AssignmentBadge.js#_evaluateHints)
 * nos dois momentos reais de "o sistema decidiu que essa dica importa agora":
 * quando o modal automático de coach é aberto pra ela (shown) e quando o
 * aluno o fecha (dismissed). Navegar solto pelo painel de dicas
 * (Anterior/Próxima) NÃO chama esta rota - ver docblock da tabela hint_events
 * em backend/supabase-setup.sql pro racional completo.
 *
 * Fire-and-forget do lado do cliente (nunca bloqueia o fluxo do aluno) - e
 * aqui, tolerante à tabela hint_events ainda não existir (42P01 do Postgres,
 * "undefined_table") até a migração em supabase-setup.sql ser rodada, mesmo
 * espírito de selectAssignmentTolerantOfMissingHintContext acima: descarta o
 * evento e responde sucesso mesmo assim, em vez de devolver 500 por causa de
 * telemetria opcional.
 */
router.post('/:id/hints/:hintId/event', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const { hintId } = req.params;
    const eventType = req.body && req.body.eventType;
    if (!hintId || !HINT_EVENT_TYPES.has(eventType)) {
        return res.status(400).json({ error: 'Invalid hintId/eventType' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { turmaId } = await getTurmaAndNivel(req);

        const { error } = await supabase.from('hint_events').insert({
            student_id: req.userId,
            assignment_id: assignmentId,
            turma_id: turmaId || null,
            hint_id: hintId,
            event_type: eventType,
        });

        if (error) {
            if (error.code === '42P01') {
                console.warn('[assignments] Tabela hint_events ainda não existe - rode a migração em backend/supabase-setup.sql. Evento descartado.');
                return res.json({ success: true });
            }
            throw error;
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[assignments] POST /:id/hints/:hintId/event error:', err);
        res.status(500).json({ error: 'Falha ao processar dicas' });
    }
});

/**
 * GET /api/assignments/:id/hints/dismissed
 * Ids (hint_id) das dicas que o próprio usuário autenticado já dispensou
 * nesta missão. Existe porque o cliente só guardava isso em memória
 * (dismissedHintIds em AssignmentBadge.js) - um F5 zerava tudo e a dica de
 * introdução reaparecia toda vez. Tolerante à tabela hint_events ainda não
 * existir (42P01): devolve lista vazia, o cliente segue como antes.
 */
router.get('/:id/hints/dismissed', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        // Ids de dica são posicionais (h1..hN): dispensas anteriores à última
        // vez que o professor salvou as dicas (carimbo do TEMPLATE) são de
        // outra geração e não valem. null = legado/coluna ausente = sem filtro.
        const hintsUpdatedAt = await resolveHintsUpdatedAt(supabase, assignmentId);

        let query = supabase
            .from('hint_events')
            .select('hint_id')
            .eq('student_id', req.userId)
            .eq('assignment_id', assignmentId)
            .eq('event_type', 'dismissed');
        if (hintsUpdatedAt) query = query.gte('created_at', hintsUpdatedAt);
        const { data, error } = await query;

        if (error) {
            if (error.code === '42P01') return res.json({ dismissed: [] });
            throw error;
        }

        res.json({ dismissed: Array.from(new Set((data || []).map((row) => row.hint_id))) });
    } catch (err) {
        console.error('[assignments] GET /:id/hints/dismissed error:', err);
        res.status(500).json({ error: 'Falha ao processar dicas' });
    }
});

/**
 * GET /api/assignments/by-project/:projectId
 *
 * Dado um projeto que o professor está abrindo pela lobby normal (sem o
 * teacherMode=author da URL de lançamento original da HelloYotta - ver
 * AssignmentAuthorBar.js), diz se esse projeto É o exemplo-molde de alguma
 * missão que ele mesmo autorou, pra decidir se mostra o botão "Cadastrar
 * aula" de novo (reautoria) mesmo fora do fluxo de lançamento original.
 * Achado em teste real: Home.gotoEditor (abrir projeto normal da lobby)
 * NUNCA inclui teacherMode=author - então, sem esta rota, o professor
 * perdia acesso ao botão (e à regeneração de dicas) pra sempre assim que
 * fechava e reabria o próprio projeto-exemplo.
 *
 * `{ assignment: null }` (nunca erro) pra qualquer caso "não é uma missão
 * minha" - projeto sem assignment_id, projeto de outro dono, vinculado a
 * uma linha de REFERÊNCIA (template_id setado), OU (checagem que importa de
 * verdade aqui) assignment.teacher_id != req.userId. Essa última é
 * obrigatória e não pode ser substituída só pelo filtro de template_id: hoje
 * NENHUMA linha de assignments tem template_id setado (a feature de
 * "referenciar template de outra turma" está no modelo mas nunca é
 * exercitada por /register), então o projeto de MISSÃO DE UM ALUNO também
 * bate template_id=null - sem o teacher_id, um aluno abrindo o próprio
 * projeto (project.owner=si mesmo, passa no primeiro filtro) veria o botão
 * "Cadastrar aula" aparecer indevidamente.
 */
/**
 * SELECT de uma linha de assignments incluindo hint_context, tolerante a
 * essa coluna ainda não existir no banco (código 42703 do Postgres,
 * "undefined_column") - deploys do CÓDIGO e da MIGRAÇÃO SQL
 * (backend/supabase-setup.sql) não são atômicos neste projeto (a migração é
 * colada manualmente no SQL Editor do Supabase, sem runner automático - ver
 * comentário no topo daquele arquivo), então existe uma janela real entre
 * "código novo no ar" e "coluna criada" onde um SELECT que já pede
 * hint_context quebraria toda a rota com 500 - inclusive a de reaparecer o
 * botão "Cadastrar aula" ao reabrir (GET /by-project/:projectId), que NADA
 * tem a ver com contexto e não devia ficar refém disso. Refaz a consulta sem
 * hint_context nesse caso específico (hint_context: null no resultado);
 * qualquer outro erro continua sendo propagado normalmente.
 */
async function selectAssignmentTolerantOfMissingHintContext(supabase, assignmentId) {
    const { data, error } = await supabase
        .from('assignments')
        .select('id, template_id, teacher_id, project_name, hint_context, hints')
        .eq('id', assignmentId)
        .maybeSingle();

    if (!error) return data;
    if (error.code !== '42703') throw error;

    console.warn('[assignments] Coluna hint_context ainda não existe no banco - rode a migração em backend/supabase-setup.sql. Seguindo sem ela por enquanto.');
    const { data: fallbackData, error: fallbackErr } = await supabase
        .from('assignments')
        .select('id, template_id, teacher_id, project_name, hints')
        .eq('id', assignmentId)
        .maybeSingle();

    if (fallbackErr) throw fallbackErr;
    return fallbackData ? { ...fallbackData, hint_context: null } : null;
}

router.get('/by-project/:projectId', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const projectId = parseInt(req.params.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid projectId' });

    try {
        const { data: project, error: projectErr } = await supabase
            .from('projects')
            .select('id, assignment_id')
            .eq('id', projectId)
            .eq('owner', req.userId)
            .eq('deleted', 'NO')
            .maybeSingle();

        if (projectErr) throw projectErr;
        if (!project || !project.assignment_id) {
            return res.json({ assignment: null });
        }

        const assignment = await selectAssignmentTolerantOfMissingHintContext(supabase, project.assignment_id);
        if (!assignment || assignment.template_id || assignment.teacher_id !== req.userId) {
            return res.json({ assignment: null }); // referência, ou não fui eu quem autorou - não é o dono/autor
        }

        res.json({
            assignment: {
                id: assignment.id,
                projectName: assignment.project_name,
                // Pré-preenche a caixa de contexto na tela do professor (ver
                // AssignmentAuthorBar.js/_showContextPrompt) com o que ele
                // escreveu da última vez, se houver.
                hintContext: assignment.hint_context || '',
                // Dicas JÁ salvas desta missão (assignments.hints, ver docblock
                // daquela coluna em supabase-setup.sql) - permite ao cliente
                // oferecer um botão "Editar dicas" que abre a mesma tela de
                // revisão (AssignmentAuthorBar.js#_showHintReview) direto sobre
                // o que já está publicado, sem precisar regenerar via IA
                // primeiro. [] quando a missão nunca teve dicas aprovadas.
                hints: Array.isArray(assignment.hints) ? assignment.hints : [],
            },
        });
    } catch (err) {
        console.error('[assignments] GET /by-project/:projectId error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Autorização comum a todas as rotas abaixo que tocam o projeto-exemplo de
 * uma missão que já existe: admin edita QUALQUER missão, professor só a
 * própria (assignment.teacher_id === req.userId) - decisão confirmada com o
 * usuário. `role` vem das claims do JWT (index.js/identity.js) - mesmo
 * campo já usado por GET /official e POST /generate-from-theme, nunca
 * forjável sem o segredo compartilhado com a HelloYotta.
 */
function canEditAssignment(req, assignment) {
    return req.role === 'admin' || assignment.teacher_id === req.userId;
}

/**
 * Busca a missão :id e valida as duas regras comuns às rotas de dicas
 * abaixo e às de GET/PUT /:id/project: (1) só se mexe no projeto/dicas do
 * MOLDE (template_id IS NULL) — uma linha de referência nunca guarda
 * project_name/requirements/dicas próprios, eles vêm do template via
 * services/assignmentResolver.js, então editar/gerar nela não faria
 * sentido; (2) quem chama precisa poder editar esta missão (ver
 * canEditAssignment acima - dono original OU admin).
 *
 * O projeto é sempre buscado pelo OWNER DA MISSÃO (assignment.teacher_id),
 * nunca por req.userId - para o professor-autor os dois são o mesmo id; para
 * o admin editando a missão de outra pessoa, são diferentes de propósito (o
 * admin está editando o projeto do AUTOR, não criando uma cópia sua).
 *
 * Retorna `{ project }` em caso de sucesso, ou `{ httpError: { status, body } }`
 * pro chamador responder direto e parar. Nunca lança - erros do Supabase em
 * si (não "não encontrado") ainda são propagados via throw, pro try/catch da
 * rota tratar como 500 igual ao resto do arquivo.
 */
async function findOwnedTemplateProject(supabase, assignmentId, req) {
    const { data: assignment, error: assignmentErr } = await supabase
        .from('assignments')
        .select('id, template_id, teacher_id')
        .eq('id', assignmentId)
        .maybeSingle();

    if (assignmentErr) throw assignmentErr;
    if (!assignment) {
        return { httpError: { status: 404, body: { error: 'Missão não encontrada' } } };
    }

    if (assignment.template_id) {
        return {
            httpError: {
                status: 400,
                body: { error: 'Não é possível gerar/salvar dicas numa referência, só no molde (template) original da missão.' },
            },
        };
    }

    if (!canEditAssignment(req, assignment)) {
        return { httpError: { status: 403, body: { error: 'Você não tem permissão para editar esta missão.' } } };
    }

    const { data: project, error: projectErr } = await supabase
        .from('projects')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('owner', assignment.teacher_id)
        .eq('deleted', 'NO')
        .limit(1)
        .maybeSingle();

    if (projectErr) throw projectErr;
    if (!project) {
        return {
            httpError: {
                status: 404,
                body: { error: 'Nenhum projeto de exemplo vinculado a esta missão foi encontrado - cadastre a aula primeiro.' },
            },
        };
    }

    return { project };
}

/**
 * GET /api/assignments/:id/project
 * Devolve o projeto-exemplo vinculado à missão :id (id, name, json,
 * thumbnail, owner) pro editor carregar - usado pelo patch de IO em
 * entry/editor.js (editAssignmentId), nunca pelo /api/db normal (que
 * filtraria por owner e bloquearia o admin). Mesma autorização de
 * findOwnedTemplateProject acima.
 */
router.get('/:id/project', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { project, httpError } = await findOwnedTemplateProject(supabase, assignmentId, req);
        if (httpError) return res.status(httpError.status).json(httpError.body);

        res.json({ id: project.id, name: project.name, json: project.json, thumbnail: project.thumbnail, owner: project.owner });
    } catch (err) {
        console.error('[assignments] GET /:id/project error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/assignments/:id/project
 * Body: { json: <string> }
 * Salva o json editado no MESMO projeto (nunca cria um novo/reatribui dono -
 * diferente de POST /register) e recalcula requirements/stage_placements a
 * partir do conteúdo salvo, pra GET /active e o selo de progresso do aluno
 * continuarem refletindo o estado real do exemplo. Mesma autorização de
 * findOwnedTemplateProject acima.
 */
router.put('/:id/project', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const rawJson = req.body && req.body.json;
    if (typeof rawJson !== 'string' || !rawJson) {
        return res.status(400).json({ error: 'json (string) é obrigatório' });
    }

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const { project, httpError } = await findOwnedTemplateProject(supabase, assignmentId, req);
        if (httpError) return res.status(httpError.status).json(httpError.body);

        let projectJson;
        try {
            projectJson = JSON.parse(rawJson);
        } catch (parseErr) {
            return res.status(400).json({ error: 'json inválido: ' + parseErr.message });
        }

        const { error: updateErr } = await supabase
            .from('projects')
            .update({ json: rawJson, mtime: new Date().toISOString() })
            .eq('id', project.id);
        if (updateErr) throw updateErr;

        const requirements = computeProjectManifest(projectJson);
        const stagePlacements = buildStagePlacements(projectJson);

        const { error: assignmentUpdateErr } = await supabase
            .from('assignments')
            .update({ project_name: project.name, requirements })
            .eq('id', assignmentId);
        if (assignmentUpdateErr) throw assignmentUpdateErr;

        await persistStagePlacements(supabase, assignmentId, stagePlacements);

        res.json({ success: true, requirements });
    } catch (err) {
        console.error('[assignments] PUT /:id/project error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/assignments/:id/generate-hints
 * Body opcional: { hintContext: "<texto livre escrito pelo professor>" }
 *
 * Gera um RASCUNHO de dicas de coaching (LLM, ver services/hintsGeneration.js)
 * a partir do projeto-exemplo do professor vinculado à missão :id. NÃO
 * persiste nada em assignments.hints - é só preview, pro professor revisar/
 * editar/aprovar antes de decidir o que salvar via POST /:id/hints.
 *
 * `hintContext`, se vier, É persistido aqui mesmo (assignments.hint_context) -
 * ao contrário das dicas em si, o contexto é escrito pelo PROFESSOR, não pela
 * IA, então não precisa de revisão/aprovação separada; salvar já nesta rota
 * garante que ele sobrevive mesmo se o professor acabar rejeitando todas as
 * dicas geradas depois (ver AssignmentAuthorBar.js/_showContextPrompt - é
 * pré-preenchido com isso na próxima vez que ele reabrir esta missão). Nunca
 * bloqueia a geração de dicas se o UPDATE falhar - best-effort, só loga.
 * Truncado em 1000 caracteres (mesmo limite do <textarea maxlength> no
 * cliente) - contexto é pra um resumo curto, não um texto livre gigante
 * competindo por atenção com a transcrição estruturada no prompt.
 */
router.post('/:id/generate-hints', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const rawContext = req.body && req.body.hintContext;
    const hintContext = typeof rawContext === 'string' ? rawContext.trim().slice(0, 1000) : '';

    try {
        const { project, httpError } = await findOwnedTemplateProject(supabase, assignmentId, req);
        if (httpError) return res.status(httpError.status).json(httpError.body);

        if (hintContext) {
            const { error: contextErr } = await supabase
                .from('assignments')
                .update({ hint_context: hintContext })
                .eq('id', assignmentId);
            if (contextErr) {
                console.warn('[assignments] Falha ao salvar hint_context (best-effort, não bloqueia a geração):', contextErr.message);
            }
        }

        let projectJson;
        try {
            projectJson = JSON.parse(project.json);
        } catch (parseErr) {
            console.error('[assignments] generate-hints: projeto', project.id, 'com json inválido:', parseErr.message);
            return res.status(500).json({ error: 'Projeto com json inválido' });
        }

        const { hints } = await generateHints(projectJson, hintContext, project.name);
        res.json({ success: true, hints });
    } catch (err) {
        if (err.code === 'NOT_CONFIGURED') {
            return res.status(503).json({ error: 'Geração de dicas não configurada' });
        }
        console.error('[assignments] POST /:id/generate-hints error:', err);
        res.status(500).json({ error: err.message || 'Falha ao gerar dicas' });
    }
});

/**
 * POST /api/assignments/:id/hints
 * Body: { hints: [{ id, text, when }, ...] }
 *
 * Salva o subconjunto de dicas já APROVADO pelo professor (filtrado no
 * cliente a partir do rascunho de POST /:id/generate-hints), substituindo
 * INTEIRAMENTE o que houver antes em assignments.hints - mesma semântica já
 * combinada de "regenera toda vez que Cadastrar aula reroda", sem merge/append.
 */
router.post('/:id/hints', async (req, res) => {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    const assignmentId = parseInt(req.params.id, 10);
    if (!Number.isFinite(assignmentId)) return res.status(400).json({ error: 'Invalid assignment id' });

    const hints = req.body && req.body.hints;
    const isValidHintShape = (h) =>
        h && typeof h === 'object' &&
        typeof h.id === 'string' && h.id.length > 0 &&
        typeof h.text === 'string' && h.text.length > 0 &&
        h.when && typeof h.when === 'object' && typeof h.when.type === 'string' && h.when.type.length > 0;

    if (!Array.isArray(hints) || !hints.every(isValidHintShape)) {
        return res.status(400).json({ error: 'Corpo inválido: esperado { hints: [{ id, text, when: { type, ... } }, ...] }' });
    }

    try {
        // Só a checagem de posse/template importa aqui - o conteúdo do
        // projeto em si não é usado por esta rota (ver findOwnedTemplateProject).
        const { httpError } = await findOwnedTemplateProject(supabase, assignmentId, req);
        if (httpError) return res.status(httpError.status).json(httpError.body);

        // NÃO envia hints_updated_at daqui de propósito: o carimbo é posto
        // pelo trigger BEFORE UPDATE OF hints (backend/supabase-setup.sql)
        // com now() do BANCO - supabase-js não expressa now() num update, e o
        // relógio do Node poderia divergir do DEFAULT de hint_events.created_at.
        // Bônus: se o SQL ainda não foi aplicado, este update segue funcionando.
        const { error: updateErr } = await supabase
            .from('assignments')
            .update({ hints })
            .eq('id', assignmentId);

        if (updateErr) throw updateErr;

        res.json({ success: true });
    } catch (err) {
        console.error('[assignments] POST /:id/hints error:', err);
        res.status(500).json({ error: 'Falha ao salvar dicas' });
    }
});

module.exports = router;
