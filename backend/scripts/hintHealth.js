#!/usr/bin/env node
/**
 * backend/scripts/hintHealth.js - "exame de saúde" do sistema de dicas.
 *
 * Responde, a partir da tabela hint_events (ver backend/supabase-setup.sql),
 * a pergunta que as métricas de 'shown'/'dismissed' soltas não respondem:
 * DEPOIS que o aluno dispensa a dica de introdução da missão, ele chega a
 * receber alguma dica proativa (um 'shown' de dica que não é a intro)? Se a
 * porcentagem é ~0, o motor de dicas está "morto" depois da intro - o bug que
 * motivou esta ferramenta.
 *
 * Mede, por missão (TEMPLATE - linhas de referência herdam as dicas do template,
 * ver services/assignmentResolver.js, então eventos de assignment_id de
 * referência são agrupados no template_id deles) e por dia (UTC, dia em que o
 * aluno dispensou a intro):
 *   - alunos que dispensaram a intro;
 *   - quantos (n e %) receberam QUALQUER 'shown' de dica não-intro depois disso;
 *   - alertas por tipo (wrong_value, wrong_trigger, wrong_order, wrong_confirm,
 *     wrong_fill - os nomes reais de HINT_EVENT_TYPES em routes/assignments.js);
 *   - totais de shown/dismissed.
 * Linha "ALERTA" quando % proativa-após-intro < 5% com >= 5 alunos
 * (exit code 2 com --strict).
 *
 * SOMENTE LEITURA: só SELECT via supabase-js. Usa a SERVICE ROLE KEY do
 * backend/.env (ou --env <caminho>) => roda SÓ LOCAL, NUNCA no CI/Vercel.
 * Não imprime nomes/ids de alunos - só contagens.
 *
 * Uso: node backend/scripts/hintHealth.js [--since YYYY-MM-DD] [--assignment <id>]
 *                                         [--json] [--strict] [--env <caminho>]
 *   --since       padrão: 14 dias atrás (UTC)
 *   --assignment  restringe a um id de missão (template ou referência)
 */
'use strict';

const path = require('path');

const ALERT_EVENT_TYPES = ['wrong_value', 'wrong_trigger', 'wrong_order', 'wrong_confirm', 'wrong_fill'];
const ALERT_MIN_STUDENTS = 5;
const ALERT_MAX_PCT = 5;
const PAGE_SIZE = 1000; // limite do PostgREST/Supabase por requisição

// ---------------------------------------------------------------------------
// Funções puras (testadas em hintHealth.test.js)
// ---------------------------------------------------------------------------

function parseArgs(argv, now) {
    const opts = { since: null, assignment: null, json: false, strict: false, env: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') opts.json = true;
        else if (a === '--strict') opts.strict = true;
        else if (a === '--since') opts.since = argv[++i];
        else if (a === '--assignment') opts.assignment = parseInt(argv[++i], 10);
        else if (a === '--env') opts.env = argv[++i];
        else throw new Error('Argumento desconhecido: ' + a);
    }
    if (opts.since != null && !/^\d{4}-\d{2}-\d{2}$/.test(opts.since)) {
        throw new Error('--since precisa ser YYYY-MM-DD');
    }
    if (opts.assignment != null && !Number.isFinite(opts.assignment)) {
        throw new Error('--assignment precisa ser um número');
    }
    if (!opts.since) {
        const d = new Date((now || new Date()).getTime() - 14 * 24 * 3600 * 1000);
        opts.since = d.toISOString().slice(0, 10);
    }
    return opts;
}

/** Normaliza o created_at (TIMESTAMP sem tz do Postgres) para ms UTC. */
function toMs(createdAt) {
    const s = String(createdAt);
    return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
}

function dayOf(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Índice id-de-assignment -> { templateId, introIds:Set } a partir das linhas
 * de assignments. Referências (template_id preenchido) usam as dicas do
 * template; o intro é a dica com when.type === 'mission_intro' (hints[0]).
 */
function buildAssignmentIndex(rows) {
    const byId = new Map();
    for (const r of rows) byId.set(r.id, r);
    const index = new Map();
    for (const r of rows) {
        const templateId = r.template_id || r.id;
        const tpl = byId.get(templateId) || r;
        const hints = Array.isArray(tpl.hints) ? tpl.hints : [];
        const introIds = new Set();
        hints.forEach((h, i) => {
            if (h && h.id != null && ((h.when && h.when.type === 'mission_intro') || i === 0 && !(h.when && h.when.type))) {
                introIds.add(String(h.id));
            }
        });
        index.set(r.id, { templateId, introIds, name: tpl.project_name || null });
    }
    return index;
}

function emptyBucket() {
    const b = { introDismissed: 0, proactiveAfterIntro: 0, shown: 0, dismissed: 0, alerts: {} };
    for (const t of ALERT_EVENT_TYPES) b.alerts[t] = 0;
    return b;
}

function pct(n, d) {
    return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

/** true se a taxa de proativa-após-intro é suspeitamente ~0. */
function isAlarming(bucket) {
    if (bucket.introDismissed < ALERT_MIN_STUDENTS) return false;
    return pct(bucket.proactiveAfterIntro, bucket.introDismissed) < ALERT_MAX_PCT;
}

/**
 * Agrega eventos sintéticos/reais. events: {student_id, assignment_id,
 * hint_id, event_type, created_at}. Retorna
 * { templates: [{templateId, name, days:[{day,...bucket}], total}], total }.
 * Coorte: (aluno, template); o dia é o da PRIMEIRA dispensa da intro.
 */
function aggregate(events, assignmentIndex) {
    const perTpl = new Map(); // templateId -> { name, days: Map, cohorts: Map }
    const get = (tid, name) => {
        if (!perTpl.has(tid)) perTpl.set(tid, { name, days: new Map(), cohorts: new Map() });
        return perTpl.get(tid);
    };
    const dayBucket = (t, day) => {
        if (!t.days.has(day)) t.days.set(day, emptyBucket());
        return t.days.get(day);
    };

    for (const ev of events) {
        const meta = assignmentIndex.get(ev.assignment_id);
        if (!meta) continue; // assignment apagado/desconhecido
        const t = get(meta.templateId, meta.name);
        const ms = toMs(ev.created_at);
        const isIntro = meta.introIds.has(String(ev.hint_id));
        const day = dayOf(ms);
        const b = dayBucket(t, day);

        if (ev.event_type === 'shown') b.shown++;
        else if (ev.event_type === 'dismissed') b.dismissed++;
        else if (b.alerts[ev.event_type] != null) b.alerts[ev.event_type]++;

        const key = String(ev.student_id);
        const c = t.cohorts.get(key) || { introAt: null, shownAfter: [] };
        t.cohorts.set(key, c);
        if (ev.event_type === 'dismissed' && isIntro) {
            if (c.introAt == null || ms < c.introAt) c.introAt = ms;
        } else if (ev.event_type === 'shown' && !isIntro) {
            c.shownAfter.push(ms);
        }
    }

    const templates = [];
    const grand = emptyBucket();
    const addTo = (dst, src) => {
        dst.introDismissed += src.introDismissed;
        dst.proactiveAfterIntro += src.proactiveAfterIntro;
        dst.shown += src.shown;
        dst.dismissed += src.dismissed;
        for (const k of ALERT_EVENT_TYPES) dst.alerts[k] += src.alerts[k];
    };

    for (const [templateId, t] of perTpl) {
        for (const c of t.cohorts.values()) {
            if (c.introAt == null) continue;
            const b = dayBucket(t, dayOf(c.introAt));
            b.introDismissed++;
            if (c.shownAfter.some((ms) => ms > c.introAt)) b.proactiveAfterIntro++;
        }
        const total = emptyBucket();
        const days = [...t.days.keys()].sort().map((day) => {
            addTo(total, t.days.get(day));
            return Object.assign({ day }, t.days.get(day));
        });
        addTo(grand, total);
        templates.push({ templateId, name: t.name, days, total });
    }
    templates.sort((a, b) => a.templateId - b.templateId);
    return { templates, total: grand };
}

function fmtPct(b) {
    const p = pct(b.proactiveAfterIntro, b.introDismissed);
    return p == null ? '-' : p.toFixed(1) + '%';
}

function formatRow(label, b) {
    const al = ALERT_EVENT_TYPES.map((t) => String(b.alerts[t]).padStart(5)).join(' ');
    return label.padEnd(14) + String(b.introDismissed).padStart(7) + String(b.proactiveAfterIntro).padStart(8) +
        fmtPct(b).padStart(8) + String(b.shown).padStart(8) + String(b.dismissed).padStart(8) + '  ' + al;
}

/** Tabela de texto em PT-BR. */
function formatReport(result, opts) {
    const out = [];
    const header = 'Dia/Total'.padEnd(14) + 'Intro'.padStart(7) + 'Proat.'.padStart(8) + '%Proat'.padStart(8) +
        'Shown'.padStart(8) + 'Dismis'.padStart(8) + '  ' +
        ALERT_EVENT_TYPES.map((t) => t.replace('wrong_', 'w_').slice(0, 7).padStart(5)).join(' ');
    out.push('Saúde das dicas - desde ' + opts.since + (opts.assignment ? ' - missão ' + opts.assignment : '') + ' (dias em UTC)');
    out.push('Intro = alunos que dispensaram a intro; Proat. = destes, quantos receberam dica proativa depois.');
    out.push('Colunas de alerta: ' + ALERT_EVENT_TYPES.join(', '));
    for (const t of result.templates) {
        out.push('');
        out.push('Missão (template) ' + t.templateId + (t.name ? ' - ' + t.name : ''));
        out.push(header);
        for (const d of t.days) out.push(formatRow(d.day, d));
        out.push(formatRow('TOTAL', t.total));
        if (isAlarming(t.total)) {
            out.push('ALERTA: missão ' + t.templateId + ' - só ' + fmtPct(t.total) + ' dos ' + t.total.introDismissed +
                ' alunos receberam dica proativa depois da intro (limite ' + ALERT_MAX_PCT + '%).');
        }
    }
    out.push('');
    out.push('Geral');
    out.push(header);
    out.push(formatRow('TOTAL', result.total));
    if (isAlarming(result.total)) {
        out.push('ALERTA: GERAL - só ' + fmtPct(result.total) + ' dos ' + result.total.introDismissed +
            ' alunos receberam dica proativa depois da intro (limite ' + ALERT_MAX_PCT + '%).');
    }
    return out.join('\n');
}

function anyAlarm(result) {
    return isAlarming(result.total) || result.templates.some((t) => isAlarming(t.total));
}

// ---------------------------------------------------------------------------
// I/O (só SELECT)
// ---------------------------------------------------------------------------

async function fetchAll(buildQuery) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
    }
    return rows;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const envPath = opts.env ? path.resolve(opts.env) : path.join(__dirname, '..', '.env');
    require('dotenv').config({ path: envPath });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em ' + envPath);
    const supabase = require('@supabase/supabase-js').createClient(url, key);

    const assignments = await fetchAll(() =>
        supabase.from('assignments').select('id, template_id, project_name, hints').order('id'));
    const index = buildAssignmentIndex(assignments);

    const events = await fetchAll(() => {
        let q = supabase.from('hint_events')
            .select('id, student_id, assignment_id, hint_id, event_type, created_at')
            .gte('created_at', opts.since + 'T00:00:00Z').order('id');
        if (opts.assignment != null) {
            const meta = index.get(opts.assignment);
            const tid = meta ? meta.templateId : opts.assignment;
            const ids = assignments.filter((a) => (a.template_id || a.id) === tid).map((a) => a.id);
            q = q.in('assignment_id', ids.length ? ids : [opts.assignment]);
        }
        return q;
    });

    const result = aggregate(events, index);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(formatReport(result, opts));
    if (opts.strict && anyAlarm(result)) process.exitCode = 2;
}

if (require.main === module) {
    main().catch((err) => {
        console.error('hintHealth falhou:', err.message);
        process.exitCode = 1;
    });
}

module.exports = { parseArgs, buildAssignmentIndex, aggregate, isAlarming, anyAlarm, formatReport, toMs, ALERT_EVENT_TYPES };
