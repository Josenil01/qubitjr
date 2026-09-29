'use strict';

/**
 * completionSnapshot.js
 *
 * "Uma vez concluída, a missão fica concluída" (decisão explícita do
 * usuário) - projects.assignment_completed_at/assignment_completion_snapshot
 * (ver backend/supabase-setup.sql) guardam a FOTO do momento em que o aluno
 * cumpriu os requisitos pela primeira vez. Depois disso, todo endpoint que
 * reporta progresso (GET /active, /my-progress, /public/students/:id/
 * assignment-score) devolve essa foto congelada em vez de recalcular do
 * projeto atual - editar o projeto depois de concluído (inclusive apagar o
 * que cumpria o requisito) não desfaz a conquista nem confunde o professor
 * com um "voltou a não estar completo".
 *
 * As duas colunas são adicionadas via ALTER TABLE...IF NOT EXISTS (ver
 * supabase-setup.sql) - podem ainda não existir num banco que não rodou essa
 * migração. Todo helper aqui é tolerante a isso (Postgres 42703 - "undefined
 * column"): trata como "ainda não concluída"/"não persistiu" e nunca derruba
 * o endpoint chamador, mesmo sem a migração rodada.
 */

function isMissingColumnError(error) {
    return !!error && error.code === '42703';
}

/**
 * Lê a foto congelada do projeto projectId, se houver. Retorna
 * {completedAt, snapshot} ou null (nunca concluído, ou migração não
 * rodada, ou erro de rede - todos tratados como "sem foto ainda", o chamador
 * cai pro cálculo ao vivo de sempre).
 */
async function readCompletionSnapshot(supabase, projectId) {
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('assignment_completed_at, assignment_completion_snapshot')
            .eq('id', projectId)
            .maybeSingle();
        if (error) {
            if (isMissingColumnError(error)) return null;
            throw error;
        }
        if (!data || !data.assignment_completed_at) return null;
        return { completedAt: data.assignment_completed_at, snapshot: data.assignment_completion_snapshot };
    } catch (err) {
        console.warn('[completionSnapshot] readCompletionSnapshot falhou (não-fatal):', err && err.message);
        return null;
    }
}

/**
 * Grava a foto congelada pra projectId, uma única vez - o filtro
 * .is(assignment_completed_at, null) no WHERE garante isso mesmo sob corrida
 * (duas abas do mesmo aluno completando quase ao mesmo tempo): só a primeira
 * UPDATE encontra a linha (ainda null) e escreve; a segunda não casa
 * nenhuma linha e cai no re-select abaixo, que devolve a foto que a primeira
 * gravou. Nunca sobrescreve uma foto existente.
 */
async function persistCompletion(supabase, projectId, comparison) {
    try {
        const { data, error } = await supabase
            .from('projects')
            .update({
                assignment_completed_at: new Date().toISOString(),
                assignment_completion_snapshot: comparison,
            })
            .eq('id', projectId)
            .is('assignment_completed_at', null)
            .select('assignment_completed_at, assignment_completion_snapshot')
            .maybeSingle();

        if (error) {
            if (isMissingColumnError(error)) return { persisted: false, reason: 'not_migrated' };
            throw error;
        }
        if (data) {
            return { persisted: true, completedAt: data.assignment_completed_at, snapshot: data.assignment_completion_snapshot };
        }
        // UPDATE não casou nenhuma linha - ou já tinha completed_at (outra
        // requisição ganhou a corrida), ou o id não existe. Relê pra saber qual.
        const existing = await readCompletionSnapshot(supabase, projectId);
        return existing ? { persisted: true, completedAt: existing.completedAt, snapshot: existing.snapshot } : { persisted: false, reason: 'not_found' };
    } catch (err) {
        console.warn('[completionSnapshot] persistCompletion falhou (não-fatal):', err && err.message);
        return { persisted: false, reason: err.message };
    }
}

/**
 * Versão em lote de readCompletionSnapshot, só o "sim/não" (sem a foto
 * inteira) - usada pela tela de live do professor (GET /teacher/classroom/
 * :turmaId/students, routes/teacher.js) pra marcar, num único round-trip,
 * quais dos projetos já exibidos nos cards (um por aluno) já concluíram a
 * missão vinculada. Retorna um Set com os ids de projeto concluídos; nunca
 * lança - migração não rodada (42703), lista vazia ou erro de rede viram
 * Set vazio (nenhum card marcado), igual à tolerância dos outros helpers
 * deste módulo.
 */
async function readCompletionFlags (supabase, projectIds) {
    if (!Array.isArray(projectIds) || !projectIds.length) return new Set();
    try {
        const { data, error } = await supabase
            .from('projects')
            .select('id, assignment_completed_at')
            .in('id', projectIds)
            .not('assignment_completed_at', 'is', null);
        if (error) {
            if (isMissingColumnError(error)) return new Set();
            throw error;
        }
        return new Set((data || []).map((row) => row.id));
    } catch (err) {
        console.warn('[completionSnapshot] readCompletionFlags falhou (não-fatal):', err && err.message);
        return new Set();
    }
}

module.exports = { readCompletionSnapshot, persistCompletion, readCompletionFlags };
