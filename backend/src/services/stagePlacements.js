'use strict';

/**
 * stagePlacements.js
 *
 * Leitura/gravação de assignments.stage_placements - onde o professor deixou
 * cada personagem no projeto de referência, usado pela sombra de
 * posicionamento no palco do aluno (ver shared/detailedManifest.mjs#
 * buildStagePlacements e src/app/src/editor/ui/StagePlacementGhost.js).
 *
 * A coluna é adicionada via ALTER TABLE...IF NOT EXISTS (ver
 * backend/supabase-setup.sql) e pode ainda não existir num banco que não
 * rodou a migração - MESMO padrão de tolerância de completionSnapshot.js:
 * consulta SEPARADA (a coluna nunca entra no SELECT/UPDATE/INSERT principal
 * de nenhuma rota), coluna inexistente vira "sem sombra"/"não persistiu" e
 * nada aqui lança. Sem isso, aplicar a migração DEPOIS do deploy derrubaria
 * GET /api/assignments/active (aluno) e POST /register (professor) até
 * alguém rodar o SQL - a mesma família de apagão que já aconteceu uma vez
 * em produção (ver CLAUDE.md, "Armadilhas conhecidas (backend/produção)").
 *
 * Códigos de "coluna inexistente": 42703 é o do Postgres (SELECT de coluna
 * que não existe); PGRST204 é o do PostgREST quando um UPDATE/INSERT manda
 * uma coluna que não está no cache de schema dele.
 */

function isMissingColumnError(error) {
    return !!error && (error.code === '42703' || error.code === 'PGRST204');
}

/**
 * stage_placements da linha `assignmentId` (o chamador já resolveu qual
 * linha - a do TEMPLATE, ver assignmentResolver.js#resolveAssignmentFields).
 * Devolve o array por cena ou null (nunca calculado, migração não rodada,
 * erro de rede - tudo vira "sem sombra").
 */
async function readStagePlacements(supabase, assignmentId) {
    if (!assignmentId) return null;
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('stage_placements')
            .eq('id', assignmentId)
            .maybeSingle();
        if (error) {
            if (isMissingColumnError(error)) return null;
            throw error;
        }
        return (data && Array.isArray(data.stage_placements)) ? data.stage_placements : null;
    } catch (err) {
        console.warn('[stagePlacements] readStagePlacements falhou (não-fatal):', err && err.message);
        return null;
    }
}

/**
 * Grava stage_placements na linha `assignmentId` - UPDATE separado, rodado
 * DEPOIS do UPDATE/INSERT principal de POST /register (que grava
 * requirements), pra que uma coluna ainda não migrada nunca impeça o
 * professor de cadastrar a missão. Retorna {persisted, reason?}; nunca lança.
 */
async function persistStagePlacements(supabase, assignmentId, placements) {
    if (!assignmentId) return { persisted: false, reason: 'no_assignment' };
    try {
        const { error } = await supabase
            .from('assignments')
            .update({ stage_placements: Array.isArray(placements) ? placements : null })
            .eq('id', assignmentId);
        if (error) {
            if (isMissingColumnError(error)) return { persisted: false, reason: 'not_migrated' };
            throw error;
        }
        return { persisted: true };
    } catch (err) {
        console.warn('[stagePlacements] persistStagePlacements falhou (não-fatal):', err && err.message);
        return { persisted: false, reason: err && err.message };
    }
}

module.exports = { readStagePlacements, persistStagePlacements, isMissingColumnError };
