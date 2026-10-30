#!/usr/bin/env node
/**
 * backend/scripts/requirementsImpact.js - relatório de impacto da decisão D1
 * ("blocos soltos são ignorados por toda a pontuação", ver docblock de
 * isLooseScript em shared/assignmentScoring.mjs) sobre missões já existentes.
 *
 * COMO OS REQUISITOS SÃO GUARDADOS (investigado em routes/assignments.js,
 * services/assignmentResolver.js, services/completionSnapshot.js e
 * supabase-setup.sql):
 *   - assignments.requirements (JSONB) é GRAVADO no template no momento do
 *     POST /api/assignments/register (computeProjectManifest do projeto de
 *     referência do professor). NÃO é recalculado ao vivo. Linhas de
 *     referência (template_id preenchido) não têm requirements: resolvem ao
 *     vivo o do template. Logo, o backfill (--write) só toca TEMPLATES.
 *   - O projeto de referência do professor é o projects.assignment_id =
 *     template.id com owner = assignments.teacher_id (vínculo do passo 3 de
 *     /register).
 *   - O progresso dos alunos é recalculado AO VIVO (compareManifests de
 *     requirements x computeProjectManifest do projeto do aluno), EXCETO
 *     projetos com projects.assignment_completed_at preenchido: esses têm a
 *     foto congelada (assignment_completion_snapshot) e NUNCA mudam ("uma vez
 *     concluída, fica concluída"). Este script não reescreve snapshots.
 *
 * O QUE O RELATÓRIO FAZ (só SELECT):
 *   1. Por template: recalcula o manifesto do projeto de referência no modo
 *      legado ({includeLooseScripts:true}) e no novo (padrão) e mostra o diff
 *      campo a campo => "o que a D1 muda". Também sinaliza "deriva" (o
 *      requirements armazenado já divergia do legado recalculado - professor
 *      editou o projeto sem recadastrar), pois o backfill gravaria o valor novo.
 *   2. Por aluno (SÓ CONTAGENS, sem nomes/ids): projetos não concluídos
 *      (ao vivo) que mudariam de status (armazenado x legado => novo x novo);
 *      projetos congelados (não mudam; contamos quantos deixariam de valer
 *      sob o requisito novo, só informativo).
 *
 * `includeLooseScripts` existe em computeProjectManifest SÓ para este relatório.
 *
 * Uso: node backend/scripts/requirementsImpact.js [--dry-run] [--json]
 *          [--env <caminho>] [--assignment <id>] [--write]
 *   --dry-run (padrão)  somente leitura.
 *   --write             backfill de assignments.requirements dos templates com
 *                       diferença. EXIGE também CONFIRM_BACKFILL=yes no
 *                       ambiente; sem os dois, aborta sem escrever nada.
 * Usa a SERVICE ROLE KEY do backend/.env => roda SÓ LOCAL.
 */
'use strict';

const path = require('path');

const PAGE_SIZE = 1000;
const PROJECT_PAGE_SIZE = 100; // projects.json é pesado

// ---------------------------------------------------------------------------
// Funções puras (testadas em requirementsImpact.test.js)
// ---------------------------------------------------------------------------

function parseArgs(argv, env) {
    const opts = { write: false, json: false, env: null, assignment: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dry-run') opts.write = false;
        else if (a === '--write') opts.write = true;
        else if (a === '--json') opts.json = true;
        else if (a === '--env') opts.env = argv[++i];
        else if (a === '--assignment') opts.assignment = parseInt(argv[++i], 10);
        else throw new Error('Argumento desconhecido: ' + a);
    }
    if (opts.assignment != null && !Number.isFinite(opts.assignment)) {
        throw new Error('--assignment precisa ser um número');
    }
    if (opts.write && (env || {}).CONFIRM_BACKFILL !== 'yes') {
        throw new Error('--write exige também CONFIRM_BACKFILL=yes no ambiente. Nada foi escrito.');
    }
    return opts;
}

/** Achata um objeto em { 'a.b.c': valor-folha }; arrays viram folha (JSON). */
function flatten(value, prefix, out) {
    out = out || {};
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value);
        if (keys.length === 0 && prefix) out[prefix] = {};
        for (const k of keys) flatten(value[k], prefix ? prefix + '.' + k : k, out);
    } else {
        out[prefix] = value;
    }
    return out;
}

/**
 * Diff campo a campo entre dois requisitos/manifestos.
 * Retorna [{field, before, after}] ordenado por campo; vazio = idênticos.
 * Campo ausente de um lado aparece como undefined (campo sumiu/apareceu).
 */
function diffRequirements(before, after) {
    const a = flatten(before || {}, '');
    const b = flatten(after || {}, '');
    const fields = new Set([...Object.keys(a), ...Object.keys(b)]);
    const diffs = [];
    for (const field of [...fields].sort()) {
        if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) {
            diffs.push({ field, before: a[field], after: b[field] });
        }
    }
    return diffs;
}

/**
 * Impacto num template. deps = {computeProjectManifest, compareManifests}
 * (injetados para o teste não depender de ESM). template: {id, project_name,
 * requirements}; refJson: projectJson parseado do projeto de referência (ou
 * null); students: [{json (parseado ou null), frozen:boolean}].
 */
function computeTemplateImpact(template, refJson, students, deps) {
    const { computeProjectManifest, compareManifests } = deps;
    const res = {
        id: template.id,
        name: template.project_name || null,
        hasReference: !!refJson,
        diffs: [],          // legado recalculado -> novo (efeito da D1)
        drift: false,       // armazenado já divergia do legado recalculado
        newRequirements: null,
        students: { live: 0, frozen: 0, liveChanged: 0, liveChangedVsStored: 0, becameIncomplete: 0, becameComplete: 0, frozenWouldFail: 0, unreadable: 0 },
    };
    if (!refJson) return res;

    const legacyRef = computeProjectManifest(refJson, { includeLooseScripts: true });
    const newRef = computeProjectManifest(refJson);
    res.diffs = diffRequirements(legacyRef, newRef);
    res.drift = diffRequirements(template.requirements, legacyRef).length > 0;
    res.newRequirements = newRef;

    for (const s of students || []) {
        if (!s.json) { res.students.unreadable++; continue; }
        const nowComplete = compareManifests(newRef, computeProjectManifest(s.json)).completed;
        if (s.frozen) {
            res.students.frozen++;
            if (!nowComplete) res.students.frozenWouldFail++;
            continue;
        }
        res.students.live++;
        const legacyStudent = computeProjectManifest(s.json, { includeLooseScripts: true });
        // Mudança "contra o armazenado": inclui a deriva (professor editou o
        // projeto de referência sem recadastrar), não só o efeito da D1.
        if (compareManifests(template.requirements, legacyStudent).completed !== nowComplete) res.students.liveChangedVsStored++;
        // Mudança ISOLADA da D1: requisito legado recalculado x legado, contra novo x novo.
        const wasComplete = compareManifests(legacyRef, legacyStudent).completed;
        if (wasComplete !== nowComplete) {
            res.students.liveChanged++;
            if (wasComplete) res.students.becameIncomplete++; else res.students.becameComplete++;
        }
    }
    return res;
}

function fmtVal(v) {
    return v === undefined ? '(ausente)' : JSON.stringify(v);
}

function formatReport(impacts) {
    const out = [];
    const changed = impacts.filter((i) => i.diffs.length > 0);
    out.push('Impacto da D1 (blocos soltos ignorados) nos requisitos - ' + impacts.length + ' template(s) analisado(s)');
    out.push('Missões com requisitos DIFERENTES: ' + changed.length);
    const sum = { live: 0, frozen: 0, liveChanged: 0, liveChangedVsStored: 0, liveChangedVsStored: 0, becameIncomplete: 0, becameComplete: 0, frozenWouldFail: 0, unreadable: 0 };
    for (const i of impacts) for (const k of Object.keys(sum)) sum[k] += i.students[k];
    for (const i of impacts) {
        if (!i.hasReference) {
            out.push('');
            out.push('Missão ' + i.id + (i.name ? ' - ' + i.name : '') + ': SEM projeto de referência legível (não dá pra recalcular).');
            continue;
        }
        if (i.diffs.length === 0 && i.students.liveChanged === 0 && i.students.liveChangedVsStored === 0 && i.students.frozenWouldFail === 0) continue;
        out.push('');
        out.push('Missão ' + i.id + (i.name ? ' - ' + i.name : '') + (i.drift ? '  [deriva: requirements armazenado já divergia do projeto atual]' : ''));
        for (const d of i.diffs) out.push('  ' + d.field + ': ' + fmtVal(d.before) + ' -> ' + fmtVal(d.after));
        const s = i.students;
        out.push('  alunos: ao vivo ' + s.live + ' (mudam de status só pela D1: ' + s.liveChanged + ', contra o requirements armazenado: ' + s.liveChangedVsStored + '; concluída->não: ' + s.becameIncomplete +
            '; não->concluída: ' + s.becameComplete + '), congelados ' + s.frozen + ' (não valeriam sob o requisito novo: ' + s.frozenWouldFail + ')');
    }
    out.push('');
    out.push('Alunos (total): ao vivo ' + sum.live + ', mudam de status só pela D1 ' + sum.liveChanged + ' (contra o armazenado: ' + sum.liveChangedVsStored + '; concluída->não ' + sum.becameIncomplete +
        ', não->concluída ' + sum.becameComplete + '); congelados ' + sum.frozen + ' (continuam concluídos; ' + sum.frozenWouldFail +
        ' não valeriam sob o requisito novo); ilegíveis ' + sum.unreadable);
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// I/O (SELECT; UPDATE só com --write + CONFIRM_BACKFILL=yes)
// ---------------------------------------------------------------------------

async function fetchAll(buildQuery, pageSize) {
    const size = pageSize || PAGE_SIZE;
    const rows = [];
    for (let from = 0; ; from += size) {
        const { data, error } = await buildQuery().range(from, from + size - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < size) break;
    }
    return rows;
}

function safeParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
}

async function main() {
    const opts = parseArgs(process.argv.slice(2), process.env);
    const envPath = opts.env ? path.resolve(opts.env) : path.join(__dirname, '..', '.env');
    require('dotenv').config({ path: envPath });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em ' + envPath);
    const supabase = require('@supabase/supabase-js').createClient(url, key);
    const deps = require('../src/services/assignmentScoring');

    const all = await fetchAll(() => supabase.from('assignments')
        .select('id, template_id, teacher_id, project_name, requirements').order('id'));
    const templates = all.filter((a) => !a.template_id && (opts.assignment == null || a.id === opts.assignment));
    const templateOf = new Map(all.map((a) => [a.id, a.template_id || a.id]));

    // Projetos vinculados a missões. Colunas de conclusão podem não existir
    // (42703) num banco sem a migração - então tenta sem elas.
    let withFrozen = true;
    let projects;
    const cols = (f) => 'id, owner, assignment_id, json, mtime' + (f ? ', assignment_completed_at' : '');
    const linked = () => supabase.from('projects').select(cols(withFrozen)).not('assignment_id', 'is', null)
        .neq('deleted', 'YES').order('id');
    try {
        projects = await fetchAll(linked, PROJECT_PAGE_SIZE);
    } catch (err) {
        if (err && err.code === '42703') {
            withFrozen = false;
            projects = await fetchAll(linked, PROJECT_PAGE_SIZE);
        } else throw err;
    }

    const impacts = [];
    for (const t of templates) {
        const mine = projects.filter((p) => templateOf.get(p.assignment_id) === t.id);
        const refs = mine.filter((p) => p.assignment_id === t.id && p.owner === t.teacher_id)
            .sort((a, b) => String(b.mtime || '').localeCompare(String(a.mtime || '')));
        const refJson = refs.length ? safeParse(refs[0].json) : null;
        const students = mine.filter((p) => p.owner !== t.teacher_id)
            .map((p) => ({ json: safeParse(p.json), frozen: !!p.assignment_completed_at }));
        impacts.push(computeTemplateImpact(t, refJson, students, deps));
    }

    if (opts.json) {
        console.log(JSON.stringify(impacts.map((i) => Object.assign({}, i, { newRequirements: undefined })), null, 2));
    } else {
        console.log(formatReport(impacts));
    }

    if (opts.write) {
        // Backfill: só templates COM diferença (efeito da D1). Linhas de
        // referência herdam do template. Snapshots congelados NÃO são tocados.
        for (const i of impacts.filter((x) => x.diffs.length > 0 && x.newRequirements)) {
            const { error } = await supabase.from('assignments').update({ requirements: i.newRequirements }).eq('id', i.id);
            if (error) throw error;
            console.log('Backfill gravado: missão ' + i.id);
        }
    } else {
        console.log('\n(dry-run: nada foi escrito)');
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('requirementsImpact falhou:', err && err.message);
        process.exitCode = 1;
    });
}

module.exports = { parseArgs, flatten, diffRequirements, computeTemplateImpact, formatReport };
