#!/usr/bin/env node
/**
 * backend/scripts/backfillHintExpected.js - MIGRAÇÃO da Fase 3: preenche
 * `when.expected` (alinhamento posição a posição, ver shared/hintAlignment.mjs
 * e shared/hintSchema.mjs) nas dicas JÁ SALVAS das missões.
 *
 * Por que existe: só dicas geradas depois da E6b nascem com expected; as
 * missões antigas continuam no caminho legado (conjuntos de tipos/valores,
 * falhas F3..F7). Regenerar as dicas chamaria a LLM de novo, mudaria textos e
 * ids e jogaria fora as edições do professor. Aqui NÃO há LLM: reaproveita
 * services/hintsGeneration.js#buildExpectedForHints com reconcileLegacy:false
 * (o mesmo fallback por tipos que o gerador usa quando a LLM não aponta nada)
 * e a única mudança permitida numa dica é GANHAR when.expected. Texto, ordem,
 * ids, dicas manuais, intro e todos os campos legados ficam bit a bit iguais
 * (garantido por assertOnlyExpectedAdded, testado em
 * backfillHintExpected.test.js) - o cliente antigo continua lendo os mesmos
 * campos, o novo passa a usar o alinhamento.
 *
 * Só TEMPLATES (template_id IS NULL): referências (turmas) não guardam dicas,
 * herdam as do template AO VIVO (services/assignmentResolver.js) - o
 * relatório só conta quantas turmas cada template alimenta.
 *
 * Projeto de referência = mesmo critério de routes/assignments.js#
 * findOwnedTemplateProject: projects.assignment_id = template.id, owner =
 * teacher_id do template, deleted = 'NO' (o exportador de fixtures,
 * exportHintFixture.js, usa o mesmo sem o owner).
 *
 * Missões PULADAS (e relatadas), por decidirMission/planMission:
 *  - no_hints, no_project (apagado/inexistente), unreadable_project (JSON
 *    inválido);
 *  - already_has_expected: alguma dica já tem expected (gerada depois da
 *    E6b) - o gerador já decidiu essa missão, inclusive quais ficaram
 *    legadas; recalcular por cima mudaria a decisão dele;
 *  - project_changed_after_hints: o projeto foi salvo DEPOIS do carimbo das
 *    dicas (projects.mtime, ou updated_at se mtime for nulo > assignments.
 *    hints_updated_at). mtime antes de updated_at de propósito: o RPC de
 *    tempo de tela (increment_project_time em supabase-setup.sql) carimba
 *    updated_at só por o professor ABRIR o projeto, sem mudar nada;
 *  - inconsistent_legacy_hints: quando não dá pra comparar datas
 *    (hints_updated_at NULL = dicas anteriores à coluna) E também quando dá:
 *    alguma dica de tarefa legada ainda está PENDENTE no próprio projeto do
 *    professor (HintEngine.js#hintConditionHolds) - sinal de que o projeto
 *    mudou depois das dicas (ou de dica obsoleta). default_character_present
 *    fica fora dessa checagem: é falha conhecida da geração (a dica nasce
 *    mesmo com o personagem padrão presente - ver KNOWN em
 *    hintInvariants.test.js), não indício de projeto alterado;
 *  - i1_failed (defensivo): depois da mescla, alguma dica com expected não
 *    dá 'done' no projeto do professor.
 *
 * Pendências (missão "pronta" mas que o --write NÃO grava sem revisão):
 *  - legacy:<reason>: alguma dica de bloco ficou sem expected (o report de
 *    buildExpectedForHints diz por quê: no_character, no_script, not_done);
 *  - occurrence: alguma dica caiu num script com gêmeo idêntico do mesmo
 *    personagem (expected.occurrence) - a atribuição dica->gêmeo é por
 *    ordem, sem ponteiro da LLM pra confirmar;
 *  - copies: o personagem tem 2+ cópias na cena e a dica não fixa
 *    characterOccurrence - o fallback ancora na 1ª cópia.
 * "fallback em vez de LLM" vale pra TODA dica migrada (não há ponteiros nas
 * dicas salvas) - aparece como contagem, não como pendência.
 *
 * ---------------------------------------------------------------------------
 * --write e o CARIMBO DAS DISPENSAS (leia antes de pensar em usar)
 * ---------------------------------------------------------------------------
 * O trigger trg_assignments_hints_updated_at (backend/supabase-setup.sql,
 * BEFORE UPDATE OF hints, pg_trigger_depth() = 1) carimba hints_updated_at =
 * now() em QUALQUER update direto de assignments.hints que mude o valor - e
 * GET /api/assignments/:id/hints/dismissed descarta dispensas anteriores ao
 * carimbo. Um update ingênuo faria TODAS as dicas já dispensadas pelos
 * alunos voltarem a aparecer, embora ids/textos não tenham mudado (só
 * ganharam expected). Por isso o --write daqui faz, por missão:
 *   1. UPDATE hints ... WHERE id = X AND hints_updated_at = <lido> (ou IS
 *      NULL) - guarda otimista: se o professor salvou dicas novas desde a
 *      leitura, nada é gravado;
 *   2. UPDATE hints_updated_at = <lido> WHERE id = X - restaura o carimbo
 *      antigo (UPDATE só dessa coluna não dispara o trigger, que é "OF
 *      hints").
 * Entre 1 e 2 há uma janela de milissegundos em que as dispensas daquela
 * missão somem; se 2 falhar, somem até alguém restaurar à mão (o script
 * relata o valor a restaurar). Alternativa sem janela: rodar o mesmo UPDATE
 * no SQL Editor numa transação com o trigger desabilitado (ALTER TABLE
 * assignments DISABLE TRIGGER trg_assignments_hints_updated_at; ...; ENABLE)
 * - decisão de quem opera o banco. Recomendação: revisar o dry-run, e só
 * então decidir entre o --write (2 passos) e o SQL transacional.
 * Protegido por --write E CONFIRM_BACKFILL=yes; só grava missões 'ready'
 * sem pendência.
 *
 * Uso:
 *   node backend/scripts/backfillHintExpected.js [--dry-run] [--assignment <id>]
 *       [--json] [--env <caminho>]          (padrão: dry-run, SOMENTE SELECT)
 *   CONFIRM_BACKFILL=yes node backend/scripts/backfillHintExpected.js --write
 */
'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const { buildExpectedForHints } = require('../src/services/hintsGeneration');
const { computeDetailedManifest } = require('../src/services/detailedManifest');
const { evaluateExpectedHints, hasExpected } = require('../src/services/hintAlignment');
const { toMs } = require('./hintHealth');

const PAGE_SIZE = 1000;
const BLOCK_TYPE = 'character_missing_block_type';
// Tipos legados que NÃO entram na checagem de consistência (ver docblock).
const NOT_CHECKED_TYPES = new Set(['mission_intro', 'manual', 'default_character_present']);

// ---------------------------------------------------------------------------
// Funções puras (testadas em backfillHintExpected.test.js)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const opts = { write: false, assignment: null, json: false, env: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dry-run') opts.write = false;
        else if (a === '--write') opts.write = true;
        else if (a === '--json') opts.json = true;
        else if (a === '--assignment') opts.assignment = parseInt(argv[++i], 10);
        else if (a === '--env') opts.env = argv[++i];
        else throw new Error('Argumento desconhecido: ' + a);
    }
    if (opts.assignment != null && !Number.isFinite(opts.assignment)) {
        throw new Error('--assignment precisa ser um número');
    }
    return opts;
}

/** Cópia de `hint` sem when.expected (pra comparar "todo o resto"). */
function withoutExpected(hint) {
    const copy = JSON.parse(JSON.stringify(hint));
    if (copy && copy.when && typeof copy.when === 'object') delete copy.when.expected;
    return copy;
}

/**
 * Lança se `after` difere de `before` em QUALQUER coisa além de when.expected
 * ADICIONADO (mesmo tamanho, mesma ordem, todo o resto deep-equal; dica que
 * já tinha expected não pode ter mudado). Guarda de segurança da mescla.
 */
function assertOnlyExpectedAdded(before, after) {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) {
        throw new Error('backfill: a lista de dicas mudou de tamanho');
    }
    before.forEach(function (b, i) {
        const a = after[i];
        if (JSON.stringify(withoutExpected(b)) !== JSON.stringify(withoutExpected(a))) {
            throw new Error('backfill: a dica ' + i + ' mudou além de when.expected');
        }
        const hadExpected = !!(b && b.when && b.when.expected !== undefined);
        if (hadExpected && JSON.stringify(b.when.expected) !== JSON.stringify(a.when.expected)) {
            throw new Error('backfill: a dica ' + i + ' já tinha expected e ele mudou');
        }
    });
}

/**
 * Mescla: cópia de `original` em que cada dica de bloco SEM expected recebe
 * o when.expected calculado (built[i]), se houver. Nada mais é copiado de
 * `built` (buildExpectedForHints apaga ponteiros soltos da LLM etc. - essas
 * diferenças NÃO podem vazar pra cá).
 */
function mergeExpected(original, built) {
    const out = JSON.parse(JSON.stringify(original));
    out.forEach(function (hint, i) {
        const when = hint && hint.when;
        if (!when || when.type !== BLOCK_TYPE || when.expected !== undefined) return;
        const src = built[i] && built[i].when;
        if (src && src.expected) when.expected = JSON.parse(JSON.stringify(src.expected));
    });
    assertOnlyExpectedAdded(original, out);
    return out;
}

/** ms do último save de CONTEÚDO do projeto (mtime; updated_at se nulo). */
function projectSavedMs(project) {
    const raw = project.mtime || project.updated_at;
    if (!raw) return null;
    const ms = toMs(raw);
    return Number.isFinite(ms) ? ms : null;
}

/** Cópias de cada characterMd5 por cena (sceneMd5+ocorrência) no manifesto. */
function copiesIndex(detailed) {
    const index = new Map();
    (detailed.scenes || []).forEach(function (scene) {
        (scene.characters || []).forEach(function (c) {
            const key = JSON.stringify([scene.sceneMd5, scene.sceneOccurrence || 1, c.characterMd5]);
            index.set(key, (index.get(key) || 0) + 1);
        });
    });
    return index;
}

/**
 * Decide UMA missão (template). Entrada:
 *   assignment: {id, hints, hints_updated_at?}
 *   project: {json, mtime?, updated_at?} | null  (já filtrado: dono, não apagado)
 *   legacyHolds(hint, detailed) -> bool: true = dica legada ainda PENDENTE
 *     (HintEngine.js#hintConditionHolds; injetado pra este módulo não
 *     depender do código do cliente).
 * Saída: {id, status: 'ready'|'nothing'|'skip', reason?, detail?, hints?
 *   (mescladas, só em 'ready'), stats: {hints, blockHints, gained,
 *   fallback, legacy: {reason: n}}, pending: string[], writable: bool}
 */
function planMission({ assignment, project, legacyHolds }) {
    const hints = Array.isArray(assignment.hints) ? assignment.hints : [];
    const stats = { hints: hints.length, blockHints: 0, gained: 0, fallback: 0, legacy: {} };
    const plan = { id: assignment.id, status: 'skip', stats, pending: [], writable: false };
    const skip = function (reason, detail) {
        plan.reason = reason;
        if (detail !== undefined) plan.detail = detail;
        return plan;
    };
    stats.blockHints = hints.filter(function (h) {
        return h && h.when && h.when.type === BLOCK_TYPE;
    }).length;

    if (!hints.length) return skip('no_hints');
    if (!project) return skip('no_project');
    let projectJson;
    try {
        projectJson = typeof project.json === 'string' ? JSON.parse(project.json) : project.json;
        if (!projectJson || typeof projectJson !== 'object') throw new Error('vazio');
    } catch (err) {
        return skip('unreadable_project');
    }
    if (hints.some(hasExpected)) return skip('already_has_expected');

    const hintsMs = assignment.hints_updated_at ? toMs(assignment.hints_updated_at) : null;
    const savedMs = projectSavedMs(project);
    // Registrado no plano: sem carimbo, a única defesa contra projeto
    // alterado é a checagem de consistência abaixo (o relatório conta isso).
    plan.datesComparable = Number.isFinite(hintsMs) && savedMs !== null;
    if (Number.isFinite(hintsMs) && savedMs !== null && savedMs > hintsMs) {
        return skip('project_changed_after_hints', {
            projectSavedAt: new Date(savedMs).toISOString(), hintsUpdatedAt: new Date(hintsMs).toISOString(),
        });
    }

    const detailed = computeDetailedManifest(projectJson);
    const stale = [];
    hints.forEach(function (h, i) {
        const type = h && h.when && h.when.type;
        if (!type || NOT_CHECKED_TYPES.has(type)) return;
        if (legacyHolds(h, detailed)) stale.push({ index: i, id: h.id, type });
    });
    if (stale.length) return skip('inconsistent_legacy_hints', stale);

    const { hints: built, report } = buildExpectedForHints(hints, projectJson, { manifest: detailed, reconcileLegacy: false });
    const merged = mergeExpected(hints, built);
    const copies = copiesIndex(detailed);
    report.forEach(function (r) {
        if (r.status === 'expected') {
            stats.gained++;
            if (r.source === 'fallback') stats.fallback++;
            const when = merged[r.index].when;
            if (when.expected.occurrence) plan.pending.push('occurrence:' + (merged[r.index].id || r.index));
            const key = JSON.stringify([when.sceneMd5, when.sceneOccurrence || 1, when.characterMd5]);
            if (!when.characterOccurrence && (copies.get(key) || 0) > 1) plan.pending.push('copies:' + (merged[r.index].id || r.index));
        } else {
            stats.legacy[r.reason] = (stats.legacy[r.reason] || 0) + 1;
            plan.pending.push('legacy:' + r.reason + ':' + (hints[r.index].id || r.index));
        }
    });
    if (!stats.gained) {
        plan.status = 'nothing';
        return plan;
    }

    // I1 da mescla (defensivo - buildExpectedForHints já valida).
    const evalHints = merged.map(function (h, i) {
        return Object.assign({}, h, { id: '__' + i });
    });
    const notDone = [];
    evaluateExpectedHints(evalHints, detailed).forEach(function (r, id) {
        if (r.state !== 'done') notDone.push({ index: Number(id.slice(2)), state: r.state, reason: r.reason });
    });
    if (notDone.length) return skip('i1_failed', notDone);

    plan.status = 'ready';
    plan.hints = merged;
    plan.writable = plan.pending.length === 0;
    return plan;
}

/** Resumo agregado (o que o dry-run imprime). */
function summarize(plans) {
    const s = { missions: plans.length, ready: 0, writable: 0, nothing: 0, skipped: {}, gainedHints: 0,
        blockHints: 0, legacy: {}, pendingKinds: {}, references: 0, datesUnknown: 0 };
    plans.forEach(function (p) {
        if (p.status === 'skip') {
            s.skipped[p.reason] = (s.skipped[p.reason] || 0) + 1;
            return;
        }
        if (p.datesComparable === false) s.datesUnknown++;
        if (p.status === 'nothing') s.nothing++;
        if (p.status === 'ready') {
            s.ready++;
            if (p.writable) s.writable++;
            s.gainedHints += p.stats.gained;
            s.references += p.references || 0;
        }
        s.blockHints += p.stats.blockHints;
        Object.keys(p.stats.legacy).forEach(function (r) {
            s.legacy[r] = (s.legacy[r] || 0) + p.stats.legacy[r];
        });
        p.pending.forEach(function (tag) {
            const kind = tag.split(':').slice(0, tag.startsWith('legacy:') ? 2 : 1).join(':');
            s.pendingKinds[kind] = (s.pendingKinds[kind] || 0) + 1;
        });
    });
    return s;
}

function formatReport(plans, summary, opts) {
    const out = [];
    out.push('Backfill de when.expected - ' + (opts.write ? 'WRITE' : 'DRY-RUN (somente leitura)'));
    out.push('');
    out.push('id'.padStart(5) + '  status   dicas  bloco  ganham  legado  turmas  motivo/pendências');
    plans.forEach(function (p) {
        const legacyN = Object.values(p.stats.legacy).reduce(function (a, b) { return a + b; }, 0);
        let note = p.status === 'skip' ? p.reason : (p.pending.length ? p.pending.join(', ') : (p.status === 'ready' ? 'ok' : '-'));
        if (p.status === 'skip' && p.detail) note += ' ' + JSON.stringify(p.detail);
        out.push(String(p.id).padStart(5) + '  ' + p.status.padEnd(7) + String(p.stats.hints).padStart(6) +
            String(p.stats.blockHints).padStart(7) + String(p.stats.gained).padStart(8) + String(legacyN).padStart(8) +
            String(p.references || 0).padStart(8) + '  ' + note);
    });
    out.push('');
    out.push('Missões (templates com dicas): ' + summary.missions);
    out.push('  prontas (ganham expected): ' + summary.ready + ' (sem pendência, graváveis: ' + summary.writable + ')');
    out.push('  nada a ganhar: ' + summary.nothing);
    out.push('  puladas: ' + JSON.stringify(summary.skipped));
    out.push('Dicas de bloco (missões não puladas): ' + summary.blockHints + '; ganhariam expected: ' + summary.gainedHints +
        ' (todas pelo fallback por tipos, sem LLM)');
    out.push('Ficariam legadas, por motivo: ' + JSON.stringify(summary.legacy));
    out.push('Pendências por tipo: ' + JSON.stringify(summary.pendingKinds));
    out.push('Missões não puladas SEM datas comparáveis (só a checagem de consistência as protege): ' + summary.datesUnknown);
    out.push('Turmas (referências) que herdam as missões prontas: ' + summary.references);
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// I/O
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

/** Templates com dicas; degrada se hints_updated_at ainda não existir no banco. */
async function loadTemplates(supabase, opts) {
    const query = (cols) => () => {
        let q = supabase.from('assignments').select(cols).is('template_id', null).not('hints', 'is', null).order('id');
        if (opts.assignment != null) q = q.eq('id', opts.assignment);
        return q;
    };
    try {
        return await fetchAll(query('id, teacher_id, hints, hints_updated_at'));
    } catch (err) {
        if (!/hints_updated_at/.test(err.message)) throw err;
        return fetchAll(query('id, teacher_id, hints'));
    }
}

/**
 * --write de UMA missão (ver docblock: guarda otimista + restauração do
 * carimbo). Exportada pra teste com cliente falso - NUNCA rodada contra o
 * banco por quem escreveu este script.
 */
async function writeMission(supabase, assignment, newHints) {
    const old = assignment.hints_updated_at === undefined ? undefined : assignment.hints_updated_at;
    let q = supabase.from('assignments').update({ hints: newHints }).eq('id', assignment.id);
    if (old === null) q = q.is('hints_updated_at', null);
    else if (old !== undefined) q = q.eq('hints_updated_at', old);
    const { data, error } = await q.select('id');
    if (error) throw new Error('missão ' + assignment.id + ': ' + error.message);
    if (!data || !data.length) return { id: assignment.id, written: false, reason: 'changed_since_read' };
    if (old === undefined) return { id: assignment.id, written: true, stampRestored: 'n/a (coluna ausente)' };
    const { error: restoreErr } = await supabase.from('assignments').update({ hints_updated_at: old }).eq('id', assignment.id);
    if (restoreErr) {
        return { id: assignment.id, written: true, stampRestored: false, restoreTo: old, error: restoreErr.message };
    }
    return { id: assignment.id, written: true, stampRestored: true };
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.write && process.env.CONFIRM_BACKFILL !== 'yes') {
        throw new Error('--write exige CONFIRM_BACKFILL=yes (leia o docblock sobre hints_updated_at antes)');
    }
    const envPath = opts.env ? path.resolve(opts.env) : path.join(__dirname, '..', '.env');
    require('dotenv').config({ path: envPath });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em ' + envPath);
    const supabase = require('@supabase/supabase-js').createClient(url, key);
    // Código do cliente (ESM puro, só importa shared/*.mjs): a checagem de
    // consistência usa EXATAMENTE a regra que o aluno vê.
    const engineUrl = pathToFileURL(path.join(__dirname, '../../src/app/src/editor/ui/HintEngine.js')).href;
    const { hintConditionHolds } = await import(engineUrl);
    const legacyHolds = (hint, detailed) => hintConditionHolds(hint, detailed);

    const templates = (await loadTemplates(supabase, opts)).filter((t) => Array.isArray(t.hints) && t.hints.length);
    const ids = templates.map((t) => t.id);
    const projects = ids.length ? await fetchAll(() => supabase.from('projects')
        .select('id, assignment_id, owner, json, mtime, updated_at').in('assignment_id', ids).eq('deleted', 'NO').order('id')) : [];
    const refs = ids.length ? await fetchAll(() => supabase.from('assignments').select('id, template_id').in('template_id', ids).order('id')) : [];

    const plans = templates.map((t) => {
        const project = projects.find((p) => p.assignment_id === t.id && p.owner === t.teacher_id) || null;
        const plan = planMission({ assignment: t, project, legacyHolds });
        plan.references = refs.filter((r) => r.template_id === t.id).length;
        return plan;
    });
    const summary = summarize(plans);

    if (opts.json) {
        console.log(JSON.stringify({ summary, plans: plans.map(({ hints, ...rest }) => rest) }, null, 2));
    } else {
        console.log(formatReport(plans, summary, opts));
    }

    if (opts.write) {
        for (const plan of plans.filter((p) => p.status === 'ready' && p.writable)) {
            const assignment = templates.find((t) => t.id === plan.id);
            console.log(JSON.stringify(await writeMission(supabase, assignment, plan.hints)));
        }
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('backfillHintExpected falhou:', err.message);
        process.exitCode = 1;
    });
}

module.exports = {
    parseArgs, planMission, mergeExpected, assertOnlyExpectedAdded, summarize, formatReport, writeMission, projectSavedMs,
};
