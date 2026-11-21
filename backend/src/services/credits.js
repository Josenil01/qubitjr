/**
 * backend/src/services/credits.js
 *
 * Créditos de IA do professor (gerar atividade ou dicas).
 *
 * [2026-11-20] A HelloYotta rejeitou o design original (débito local
 * atômico no nosso banco + aviso best-effort depois) - identificaram que
 * ele não serializa débitos concorrentes quando VÁRIAS plataformas (não só
 * o QubitJr) debitam do MESMO saldo do MESMO professor ao mesmo tempo, já
 * que cada uma decide "tem saldo?" sobre a própria cópia local, sem nenhum
 * ponto único de verdade. O débito agora é uma chamada SÍNCRONA E
 * BLOQUEANTE à HelloYotta (debitCredits abaixo chama
 * services/helloyotta.js#debitTeacherCredits) ANTES de qualquer chamada de
 * LLM - só segue se vier {success:true}. O custo de cada ação também não é
 * mais decidido por nós (ver `reason`, nunca `amount`) - a HelloYotta
 * resolve isso numa tabela própria, ajustável sem deploy do lado deles.
 *
 * teacher_credits/credit_transactions continuam existindo, mas agora só
 * como CACHE de leitura (GET /api/teacher/credits, pra exibir saldo na UI -
 * NUNCA pra decidir se uma geração pode rodar) e LOG de auditoria local
 * (pedido do usuário: poder consultar quantas tentativas falharam). Linhas
 * de log são correlacionadas pelo mesmo idempotencyKey enviado à HelloYotta,
 * não por um id de transação nosso.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { getTeacherCredits, debitTeacherCredits } = require('./helloyotta');

const REASON_ACTIVITY = 'activities.generate';
const REASON_HINTS = 'hints.generate';

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
 * Busca o saldo mais recente da HelloYotta e grava no cache local. Chamado
 * uma vez por sessão (GET /api/teacher/credits em routes/teacher.js), não
 * em todo request - só pra exibir na UI, nunca decide se uma geração pode
 * rodar (isso é sempre debitCredits abaixo). Se a HelloYotta não devolver
 * saldo (endpoint ainda não configurado/indisponível), mantém o cache local
 * como está em vez de zerar o professor na tela.
 */
async function syncBalance(teacherToken, teacherId) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Database not configured');

    const remoteBalance = await getTeacherCredits(teacherToken, teacherId);
    if (remoteBalance === null) {
        return getBalance(teacherId);
    }

    const { data, error } = await supabase
        .from('teacher_credits')
        .upsert(
            { teacher_id: teacherId, balance: remoteBalance, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { onConflict: 'teacher_id' }
        )
        .select('balance')
        .single();
    if (error) throw error;
    return data.balance;
}

async function getBalance(teacherId) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Database not configured');
    const { data, error } = await supabase.from('teacher_credits').select('balance').eq('teacher_id', teacherId).maybeSingle();
    if (error) throw error;
    return data ? data.balance : 0;
}

/**
 * Debita via HelloYotta (síncrono, bloqueante) ANTES de qualquer chamada de
 * LLM. Gera um idempotencyKey novo por tentativa (cada chamada desta função
 * É uma tentativa nova) e grava o log local ANTES de devolver o controle -
 * importante pra markGenerationFailed (chamado depois, se a geração em si
 * falhar) sempre achar a linha pelo idempotencyKey.
 *
 * Lança erro com `code: 'INSUFFICIENT_CREDITS'` quando a HelloYotta
 * responde 402 - rota chamadora deve responder 402 também, ANTES de chamar
 * a LLM, nunca depois.
 *
 * @returns {Promise<{balance: number, debited: number, idempotencyKey: string}>}
 */
async function debitCredits(teacherId, reason, meta = {}) {
    const idempotencyKey = crypto.randomUUID();
    const result = await debitTeacherCredits(teacherId, reason, idempotencyKey);

    await logTransaction(teacherId, reason, idempotencyKey, result, meta);

    if (!result.success) {
        const err = new Error('Saldo de créditos insuficiente');
        err.code = 'INSUFFICIENT_CREDITS';
        err.balance = result.balance;
        throw err;
    }

    return { balance: result.balance, debited: result.debited, idempotencyKey };
}

/**
 * Log local best-effort (nunca lança, nunca bloqueia a decisão de
 * saldo/geração - essa já foi tomada por debitTeacherCredits, e já é
 * irreversível do lado da HelloYotta antes desta função ser chamada).
 * Também atualiza o cache de saldo em teacher_credits quando o débito teve
 * sucesso, pra GET /api/teacher/credits não mostrar um valor desatualizado
 * até a próxima sincronização.
 *
 * [2026-11-20] Achado testando contra produção real: o insert em
 * credit_transactions depende de teacher_id já existir em app_users (FK).
 * Isso É garantido nos dois chamadores de debitCredits hoje
 * (identityMiddleware em backend/src/index.js roda trackUserSeen antes de
 * qualquer rota de routes/assignments.js; routes/share.js chama
 * trackUserSeen explicitamente antes de debitCredits) - mas se isso
 * mudar, ou outro caminho futuro chamar debitCredits sem essa garantia, o
 * resultado é um débito que JÁ aconteceu de verdade do lado da HelloYotta
 * (o professor já perdeu o crédito, sem nenhum mecanismo de estorno) e
 * fica SEM NENHUM registro local - exatamente o cenário que o usuário
 * pediu pra poder consultar ("quantas tentativas falharam"). Por isso,
 * quando result.success é true, uma falha aqui sai como console.error com
 * todo o contexto pra reconciliação manual (teacherId, reason,
 * idempotencyKey, valor debitado, saldo retornado) - nunca mais um
 * console.warn engolido. Quando result.success é false (saldo
 * insuficiente - nada foi debitado de verdade), a falha de log continua
 * best-effort de baixa severidade, porque não há nenhum fato financeiro
 * real em risco de se perder.
 */
async function logTransaction(teacherId, reason, idempotencyKey, result, meta) {
    const supabase = getSupabase();
    if (!supabase) {
        if (result.success) {
            console.error('[credits] AUDITORIA PERDIDA: débito confirmado pela HelloYotta mas Supabase não está configurado - sem log local deste débito.', {
                teacherId, reason, idempotencyKey, debited: result.debited, balance: result.balance,
            });
        }
        return;
    }

    try {
        const { error } = await supabase.from('credit_transactions').insert({
            teacher_id: teacherId,
            amount: result.success ? -(result.debited || 0) : 0,
            reason,
            status: result.success ? 'succeeded' : 'insufficient_balance',
            idempotency_key: idempotencyKey,
            assignment_id: meta.assignmentId || null,
            draft_id: meta.draftId || null,
        });
        if (error) throw error;
    } catch (err) {
        if (result.success) {
            console.error('[credits] AUDITORIA PERDIDA: débito confirmado pela HelloYotta, mas falhou gravar credit_transactions localmente - sem registro deste débito real.', {
                teacherId, reason, idempotencyKey, debited: result.debited, balance: result.balance, error: err.message,
            });
        } else {
            console.warn('[credits] log de tentativa com saldo insuficiente falhou (non-fatal, nenhum débito real aconteceu):', err.message);
        }
    }

    if (!result.success) return;

    try {
        const { error } = await supabase.from('teacher_credits').upsert(
            { teacher_id: teacherId, balance: result.balance, updated_at: new Date().toISOString() },
            { onConflict: 'teacher_id' }
        );
        if (error) throw error;
    } catch (err) {
        // Só o cache de exibição ficou desatualizado - a próxima syncBalance
        // (login/sessão) busca o saldo real na HelloYotta de novo, por isso
        // continua warn, não error.
        console.warn('[credits] cache de saldo (teacher_credits) não atualizado (non-fatal):', err.message);
    }
}

/**
 * Marca a transação (achada pelo idempotencyKey devolvido por debitCredits)
 * como 'failed' - a geração em si deu erro DEPOIS do débito já confirmado
 * pela HelloYotta (chamada de LLM falhou, timeout, resposta inválida).
 * Nunca reembolsa (decisão do usuário, e a HelloYotta não expõe nenhum
 * mecanismo de estorno) - só registra pra auditoria/consulta de tentativas
 * falhadas. Best-effort: nunca lança.
 */
async function markGenerationFailed(idempotencyKey, errorMessage) {
    if (!idempotencyKey) return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
        await supabase
            .from('credit_transactions')
            .update({ status: 'failed', error: errorMessage ? String(errorMessage).slice(0, 500) : null })
            .eq('idempotency_key', idempotencyKey);
    } catch (err) {
        console.warn('[credits] markGenerationFailed failed (non-fatal):', err.message);
    }
}

module.exports = {
    REASON_ACTIVITY,
    REASON_HINTS,
    syncBalance,
    getBalance,
    debitCredits,
    markGenerationFailed,
};
