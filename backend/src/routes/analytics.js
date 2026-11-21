/**
 * backend/src/routes/analytics.js
 *
 * Endpoints agregados ("quantos projetos essa semana", "bloco mais usado"
 * etc.) pensados pra alimentar um dashboard/integração da plataforma
 * parceira (HelloYotta) - não é usado pelo próprio editor ScratchJr.
 *
 * Servidor-a-servidor, mesmo padrão já usado pelas rotas pull de
 * routes/share.js: protegido pela chave estática HELLOYOTTA_INBOUND_API_KEY
 * (Authorization: Bearer <key>), comparada em tempo constante. NÃO passa
 * pelo identityMiddleware normal (ver index.js) - por isso é montado em
 * /api/public/analytics, registrado ANTES desse middleware.
 *
 * Rotas:
 *   GET /api/public/analytics/overview          -> totais atuais (sem recorte de tempo)
 *   GET /api/public/analytics/projects/new       -> projetos criados por período, por papel
 *   GET /api/public/analytics/users/new          -> usuários novos por período, por papel
 *   GET /api/public/analytics/assignments/new    -> missões/adoções novas por período
 *   GET /api/public/analytics/blocks/most-used   -> bloco mais usado (geral e por categoria)
 *   GET /api/public/analytics/usage-time         -> tempo de uso por período
 *
 * "Período" em todas as rotas de série temporal = janela corrida a partir de
 * agora (não calendário): semana=7d, quinzena=15d, mes=30d, ano=365d. Cada
 * resposta sempre traz as quatro janelas juntas, a não ser que ?period=
 * restrinja a uma só (week|fortnight|month|year).
 */

const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { computeProjectManifest } = require('../services/assignmentScoring');

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

function timingSafeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

// Mesmo padrão de autenticação das rotas pull de routes/share.js (ver
// docblock de GET /api/public/students/:studentId/time-spent lá) - uma
// única chave estática protege todo este router.
router.use((req, res, next) => {
    const expectedKey = process.env.HELLOYOTTA_INBOUND_API_KEY;
    if (!expectedKey) return res.status(503).json({ error: 'Endpoint not configured' });

    const auth = req.headers.authorization || '';
    const providedKey = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
});

// ============================================
// Janelas de tempo
// ============================================

const PERIODS = {
    week: { label: 'week', days: 7 },
    fortnight: { label: 'fortnight', days: 15 },
    month: { label: 'month', days: 30 },
    year: { label: 'year', days: 365 },
};

function periodsFromQuery (req) {
    const requested = typeof req.query.period === 'string' ? req.query.period.trim() : '';
    if (requested && PERIODS[requested]) return { [requested]: PERIODS[requested] };
    return PERIODS;
}

function windowStartIso (days) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString();
}

// role persistido em app_users: 'professor' | 'admin' | null. null = aluno,
// por convenção (token de aluno nunca carrega a claim `role` - ver
// services/identity.js). 'desconhecido' = owner que nunca passou pelo
// identityMiddleware desde que app_users existe (dado anterior à migração,
// ou id que só apareceu num INSERT direto no banco).
function roleLabel (role) {
    if (role === 'professor') return 'professor';
    if (role === 'admin') return 'admin';
    if (role === null || role === undefined) return 'aluno';
    return role;
}

/**
 * Pagina por .range() sobre um factory que recria o query builder a cada
 * chamada (supabase-js não permite reexecutar o mesmo builder - ver
 * docblock sobre PostgrestBuilder em routes/db.js). hardCap evita uma janela
 * grande (ex.: ano inteiro numa plataforma com muito uso) de puxar uma
 * quantidade ilimitada de linhas pra memória do processo; `truncated` avisa
 * o chamador que o número pode estar subcontado.
 */
async function fetchAllPaginated (buildQuery, hardCap = 20000, batchSize = 1000) {
    const rows = [];
    let from = 0;
    while (rows.length < hardCap) {
        const { data, error } = await buildQuery().range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
    }
    return { rows: rows.slice(0, hardCap), truncated: rows.length >= hardCap };
}

/**
 * Mapa estático bloco -> categoria, espelhando o agrupamento por cor de
 * BlockSpecs.js#setupBlocksSpecs (src/app/src/editor/blocks/BlockSpecs.js) -
 * yellowStart/yellowCmd = Começar, blueCmd = Movimento, orangeCmd/cShape =
 * Fluxo, pinkCmd = Aparência, limeCmd = Som, redEnd/redEndLong = Final.
 * BlockSpecs.js não pode ser importado aqui (depende do DOM pra montar
 * ícones), por isso a duplicação - se um bloco novo for adicionado lá,
 * replicar a categoria aqui também.
 */
const BLOCK_CATEGORIES = {
    onflag: 'comecar', onmessage: 'comecar', onclick: 'comecar', ontouch: 'comecar', message: 'comecar',
    forward: 'movimento', back: 'movimento', up: 'movimento', down: 'movimento',
    right: 'movimento', left: 'movimento', home: 'movimento', hop: 'movimento',
    repeat: 'fluxo', wait: 'fluxo', setspeed: 'fluxo', stopmine: 'fluxo',
    say: 'aparencia', show: 'aparencia', hide: 'aparencia', grow: 'aparencia',
    shrink: 'aparencia', same: 'aparencia', setcostume: 'aparencia',
    playsnd: 'som', playusersnd: 'som',
    endstack: 'final', forever: 'final', gotopage: 'final', stopall: 'final',
};

// ============================================
// GET /overview
// ============================================

router.get('/overview', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const [usersCount, projectsCount, assignmentsCount, activeAssignmentsCount] = await Promise.all([
            supabase.from('app_users').select('*', { count: 'exact', head: true }),
            supabase.from('projects').select('*', { count: 'exact', head: true }).eq('deleted', 'NO'),
            supabase.from('assignments').select('*', { count: 'exact', head: true }).is('template_id', null),
            supabase.from('assignments').select('*', { count: 'exact', head: true }).is('template_id', null).eq('active', true),
        ]);

        const { data: roleRows, error: roleErr } = await supabase.from('app_users').select('role');
        if (roleErr) throw roleErr;
        const usersByRole = { professor: 0, admin: 0, aluno: 0 };
        (roleRows || []).forEach((r) => { usersByRole[roleLabel(r.role)] = (usersByRole[roleLabel(r.role)] || 0) + 1; });

        res.json({
            totalUsers: usersCount.count || 0,
            usersByRole,
            totalProjects: projectsCount.count || 0,
            totalAssignmentTemplates: assignmentsCount.count || 0,
            activeAssignmentTemplates: activeAssignmentsCount.count || 0,
        });
    } catch (err) {
        console.error('[analytics] GET /overview error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /projects/new
// ============================================

router.get('/projects/new', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const periods = periodsFromQuery(req);
        const maxDays = Math.max(...Object.values(periods).map((p) => p.days));

        const { data: roleRows, error: roleErr } = await supabase.from('app_users').select('user_id, role');
        if (roleErr) throw roleErr;
        const roleByOwner = new Map((roleRows || []).map((r) => [r.user_id, r.role]));

        // "Criados" = created_at, independente de terem sido apagados depois -
        // contagem de criação, não de inventário atual.
        const { rows, truncated } = await fetchAllPaginated(() =>
            supabase.from('projects').select('owner, created_at').gte('created_at', windowStartIso(maxDays))
        );

        const result = {};
        for (const [key, period] of Object.entries(periods)) {
            const start = windowStartIso(period.days);
            const byRole = { professor: 0, admin: 0, aluno: 0 };
            let total = 0;
            for (const row of rows) {
                if (!row.created_at || row.created_at < start) continue;
                total += 1;
                byRole[roleLabel(roleByOwner.get(row.owner))] = (byRole[roleLabel(roleByOwner.get(row.owner))] || 0) + 1;
            }
            result[key] = { days: period.days, totalCreated: total, byRole };
        }

        res.json({ periods: result, truncated });
    } catch (err) {
        console.error('[analytics] GET /projects/new error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /users/new
// ============================================

router.get('/users/new', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const periods = periodsFromQuery(req);
        const maxDays = Math.max(...Object.values(periods).map((p) => p.days));

        const { rows, truncated } = await fetchAllPaginated(() =>
            supabase.from('app_users').select('role, first_seen_at').gte('first_seen_at', windowStartIso(maxDays))
        );

        const result = {};
        for (const [key, period] of Object.entries(periods)) {
            const start = windowStartIso(period.days);
            const byRole = { professor: 0, admin: 0, aluno: 0 };
            let total = 0;
            for (const row of rows) {
                if (!row.first_seen_at || row.first_seen_at < start) continue;
                total += 1;
                byRole[roleLabel(row.role)] = (byRole[roleLabel(row.role)] || 0) + 1;
            }
            result[key] = { days: period.days, totalNewUsers: total, byRole };
        }

        res.json({ periods: result, truncated, note: 'Baseado em app_users.first_seen_at, persistido a partir de 2026-11-18 - não há histórico de usuários anterior a essa data.' });
    } catch (err) {
        console.error('[analytics] GET /users/new error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /assignments/new
// ============================================

router.get('/assignments/new', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const periods = periodsFromQuery(req);
        const maxDays = Math.max(...Object.values(periods).map((p) => p.days));

        const { rows, truncated } = await fetchAllPaginated(() =>
            supabase.from('assignments').select('template_id, created_at').gte('created_at', windowStartIso(maxDays))
        );

        const result = {};
        for (const [key, period] of Object.entries(periods)) {
            const start = windowStartIso(period.days);
            let newMissions = 0; // template_id IS NULL - missão de verdade cadastrada por um professor
            let newClassroomAdoptions = 0; // template_id NOT NULL - turma adotando um molde existente
            for (const row of rows) {
                if (!row.created_at || row.created_at < start) continue;
                if (row.template_id == null) newMissions += 1;
                else newClassroomAdoptions += 1;
            }
            result[key] = { days: period.days, newMissions, newClassroomAdoptions };
        }

        res.json({ periods: result, truncated });
    } catch (err) {
        console.error('[analytics] GET /assignments/new error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /blocks/most-used
// ============================================

router.get('/blocks/most-used', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const requestedPeriod = typeof req.query.period === 'string' ? req.query.period.trim() : '';
        const period = PERIODS[requestedPeriod] || null;

        // Filtra por mtime (última edição), não created_at: reflete o estado
        // ATUAL/recente dos projetos, que é o que "bloco mais usado" quer
        // dizer - não só o que existia no instante da criação do projeto.
        const { rows, truncated } = await fetchAllPaginated(() => {
            let q = supabase.from('projects').select('json, mtime').eq('deleted', 'NO').not('json', 'is', null);
            if (period) q = q.gte('mtime', windowStartIso(period.days));
            return q;
        }, 5000);

        const byType = {};
        const byCategory = {};
        let analyzed = 0;
        for (const row of rows) {
            let parsed;
            try {
                parsed = JSON.parse(row.json);
            } catch (_) {
                continue; // projeto com json corrompido/ilegível - ignora, não derruba o relatório
            }
            const manifest = computeProjectManifest(parsed);
            analyzed += 1;
            for (const [type, count] of Object.entries(manifest.blocks.byType)) {
                byType[type] = (byType[type] || 0) + count;
                const category = BLOCK_CATEGORIES[type] || 'outro';
                byCategory[category] = (byCategory[category] || 0) + count;
            }
        }

        const topBlocks = Object.entries(byType)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
        const categoryRanking = Object.entries(byCategory)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);

        res.json({
            period: period ? period.label : 'all',
            projectsAnalyzed: analyzed,
            truncated, // true = existem mais projetos que o teto de 5000 analisados; use ?period= pra reduzir o recorte
            topBlocks,
            byCategory: categoryRanking,
        });
    } catch (err) {
        console.error('[analytics] GET /blocks/most-used error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET /usage-time
// ============================================

router.get('/usage-time', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });

    try {
        const periods = periodsFromQuery(req);
        const maxDays = Math.max(...Object.values(periods).map((p) => p.days));

        const [{ rows: events, truncated }, { data: roleRows, error: roleErr }] = await Promise.all([
            fetchAllPaginated(() =>
                supabase.from('usage_events').select('owner, delta_seconds, created_at').gte('created_at', windowStartIso(maxDays))
            ),
            supabase.from('app_users').select('user_id, role'),
        ]);
        if (roleErr) throw roleErr;
        const roleByOwner = new Map((roleRows || []).map((r) => [r.user_id, r.role]));

        const result = {};
        for (const [key, period] of Object.entries(periods)) {
            const start = windowStartIso(period.days);
            let totalSeconds = 0;
            const activeOwners = new Set();
            const secondsByRole = { professor: 0, admin: 0, aluno: 0 };
            for (const ev of events) {
                if (!ev.created_at || ev.created_at < start) continue;
                totalSeconds += ev.delta_seconds || 0;
                activeOwners.add(ev.owner);
                const role = roleLabel(roleByOwner.get(ev.owner));
                secondsByRole[role] = (secondsByRole[role] || 0) + (ev.delta_seconds || 0);
            }
            const activeUsers = activeOwners.size;
            result[key] = {
                days: period.days,
                totalSeconds,
                activeUsers,
                averageSecondsPerActiveUser: activeUsers > 0 ? Math.round(totalSeconds / activeUsers) : 0,
                secondsByRole,
            };
        }

        res.json({
            periods: result,
            truncated,
            note: 'Baseado em usage_events (um registro por heartbeat do editor), existente a partir de 2026-11-18 - sem histórico de tempo de uso anterior a essa data.',
        });
    } catch (err) {
        console.error('[analytics] GET /usage-time error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
