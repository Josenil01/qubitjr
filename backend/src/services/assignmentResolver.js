'use strict';

/**
 * assignmentResolver.js
 *
 * Resolve os campos "efetivos" (project_name/requirements/hints) de uma
 * linha da tabela `assignments`, respeitando o split template/referência
 * descrito em backend/supabase-setup.sql:
 *
 * - Uma linha de TEMPLATE (template_id IS NULL) já traz seus próprios
 *   project_name/requirements/hints - são a fonte da verdade.
 * - Uma linha de REFERÊNCIA (template_id aponta pra um template) não guarda
 *   project_name/requirements/hints próprios: eles são resolvidos AO VIVO a
 *   partir do template referenciado, então editar o template (ou regerar/
 *   reaprovar as dicas, via POST /api/assignments/:id/hints) propaga pra
 *   toda turma que o referencia, sem precisar "readotar" nada.
 *
 * hints (JSONB, ver backend/supabase-setup.sql e services/hintsGeneration.js)
 * é null até o professor gerar e aprovar as dicas pela primeira vez - por
 * isso o default aqui é sempre `[]`, nunca null, pro consumidor (rota
 * GET /api/assignments/active) não precisar reimplementar esse fallback.
 *
 * Este módulo é intencionalmente pequeno e sem dependências (ao contrário de
 * assignmentScoring.js, que é 100% puro, este precisa fazer uma consulta
 * condicional ao banco - por isso recebe o cliente `supabase` já conectado
 * como parâmetro, em vez de importar @supabase/supabase-js e abrir sua
 * própria conexão. Ver getSupabase() em backend/src/routes/assignments.js
 * para como o chamador monta esse cliente.
 */

/**
 * @param {object} supabase - cliente Supabase já conectado (ver módulo acima).
 * @param {object|null|undefined} assignmentRow - linha (ou trecho de linha)
 *   já buscada pelo chamador na tabela `assignments`, com pelo menos os
 *   campos id/template_id/project_name/requirements/hints.
 * @returns {Promise<{ projectName: any, requirements: any, hints: any[] } | null>}
 */
async function resolveAssignmentFields(supabase, assignmentRow) {
    if (!assignmentRow) return null;

    // template_id ausente/null/0: esta linha É o template - seus próprios
    // campos já são a resposta certa, sem precisar de outra consulta.
    if (!assignmentRow.template_id) {
        return {
            projectName: assignmentRow.project_name,
            requirements: assignmentRow.requirements,
            hints: assignmentRow.hints || [],
        };
    }

    // template_id presente: esta linha é uma referência - busca os campos
    // atuais do template apontado. Qualquer falha aqui (erro do Supabase,
    // exceção de rede, template apagado) degrada pros campos da própria
    // linha (provavelmente vazios/null) em vez de derrubar o chamador.
    try {
        const { data: template, error } = await supabase
            .from('assignments')
            .select('project_name, requirements, hints')
            .eq('id', assignmentRow.template_id)
            .maybeSingle();

        if (error || !template) {
            console.warn(
                '[assignmentResolver] Falha ao resolver template_id',
                assignmentRow.template_id,
                'da assignment', assignmentRow.id,
                '- degradando para os campos próprios da linha:',
                error ? error.message : 'template não encontrado (possivelmente apagado)'
            );
            return {
                projectName: assignmentRow.project_name,
                requirements: assignmentRow.requirements,
                hints: assignmentRow.hints || [],
            };
        }

        return {
            projectName: template.project_name,
            requirements: template.requirements,
            hints: template.hints || [],
        };
    } catch (err) {
        console.warn(
            '[assignmentResolver] Erro inesperado ao resolver template_id',
            assignmentRow.template_id,
            'da assignment', assignmentRow.id,
            '- degradando para os campos próprios da linha:',
            err.message
        );
        return {
            projectName: assignmentRow.project_name,
            requirements: assignmentRow.requirements,
            hints: assignmentRow.hints || [],
        };
    }
}

module.exports = { resolveAssignmentFields };
