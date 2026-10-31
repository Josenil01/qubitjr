'use strict';

const { readStagePlacements } = require('./stagePlacements');

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
 * @param {{ includeStagePlacements?: boolean }} [options] - com
 *   includeStagePlacements, o retorno ganha também `stagePlacements` (sombra
 *   de posicionamento no palco, ver services/stagePlacements.js), herdado do
 *   MESMO lugar de onde vieram requirements/hints (o template, numa
 *   referência; a própria linha, num template ou quando o template não pôde
 *   ser lido). Opt-in de propósito: só GET /active precisa disso, e a
 *   leitura é uma consulta SEPARADA e tolerante (a coluna nunca entra no
 *   SELECT abaixo - pode ainda não ter sido migrada; nesse caso vem null).
 * @returns {Promise<{ projectName: any, requirements: any, hints: any[], stagePlacements?: any[]|null } | null>}
 */
async function resolveAssignmentFields(supabase, assignmentRow, options) {
    const resolved = await resolveBaseFields(supabase, assignmentRow);
    if (!resolved) return null;
    if (!(options && options.includeStagePlacements)) return resolved.fields;
    return {
        ...resolved.fields,
        stagePlacements: await readStagePlacements(supabase, resolved.sourceId),
    };
}

/**
 * Corpo original de resolveAssignmentFields - devolve {fields, sourceId},
 * onde sourceId é o id da linha de onde os campos efetivamente vieram
 * (usado pra ler stage_placements do mesmo lugar, ver acima).
 */
async function resolveBaseFields(supabase, assignmentRow) {
    if (!assignmentRow) return null;

    // template_id ausente/null/0: esta linha É o template - seus próprios
    // campos já são a resposta certa, sem precisar de outra consulta.
    if (!assignmentRow.template_id) {
        return { sourceId: assignmentRow.id, fields: {
            projectName: assignmentRow.project_name,
            requirements: assignmentRow.requirements,
            hints: assignmentRow.hints || [],
        } };
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
            return { sourceId: assignmentRow.id, fields: {
                projectName: assignmentRow.project_name,
                requirements: assignmentRow.requirements,
                hints: assignmentRow.hints || [],
            } };
        }

        return { sourceId: assignmentRow.template_id, fields: {
            projectName: template.project_name,
            requirements: template.requirements,
            hints: template.hints || [],
        } };
    } catch (err) {
        console.warn(
            '[assignmentResolver] Erro inesperado ao resolver template_id',
            assignmentRow.template_id,
            'da assignment', assignmentRow.id,
            '- degradando para os campos próprios da linha:',
            err.message
        );
        return { sourceId: assignmentRow.id, fields: {
            projectName: assignmentRow.project_name,
            requirements: assignmentRow.requirements,
            hints: assignmentRow.hints || [],
        } };
    }
}

/**
 * Carimbo de "última vez que o professor salvou as dicas" do TEMPLATE de uma
 * missão (assignments.hints_updated_at). Os ids de dica são posicionais
 * (h1..hN), então uma dispensa gravada antes do carimbo pertence a OUTRA
 * geração de dicas e não pode valer pra nova - GET /:id/hints/dismissed usa
 * isto pra descartá-las. Referências herdam as dicas do template ao vivo
 * (ver resolveAssignmentFields), então o carimbo também é o do template.
 *
 * Nunca lança: devolve null (= comportamento legado, sem filtro) se a linha
 * não existe, se o carimbo é NULL (dicas anteriores à coluna) ou se qualquer
 * consulta falha - em especial quando o SQL que cria a coluna ainda não foi
 * aplicado no banco ("column ... does not exist").
 *
 * @returns {Promise<string|null>} timestamp ISO/Postgres ou null.
 */
async function resolveHintsUpdatedAt(supabase, assignmentId) {
    try {
        // Só colunas antigas aqui: esta consulta não pode quebrar por causa
        // da coluna nova.
        const { data: row, error } = await supabase
            .from('assignments')
            .select('id, template_id')
            .eq('id', assignmentId)
            .maybeSingle();
        if (error || !row) return null;

        const templateId = row.template_id || row.id;
        const { data: tpl, error: tplErr } = await supabase
            .from('assignments')
            .select('hints_updated_at')
            .eq('id', templateId)
            .maybeSingle();
        if (tplErr || !tpl) return null;

        return tpl.hints_updated_at || null;
    } catch (err) {
        console.warn('[assignmentResolver] Falha ao ler hints_updated_at (degradando para sem filtro):', err.message);
        return null;
    }
}

module.exports = { resolveAssignmentFields, resolveHintsUpdatedAt };
