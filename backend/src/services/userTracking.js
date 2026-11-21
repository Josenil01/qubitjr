/**
 * backend/src/services/userTracking.js
 *
 * Persiste "quem já apareceu e com qual papel" em app_users (ver migração
 * backend/migrations/20261118_analytics.sql) - antes disso não existia
 * nenhum registro de usuário, só a claim efêmera do JWT de cada request.
 * Chamada pelo identityMiddleware (index.js) em toda request autenticada.
 *
 * Best-effort de propósito: trackUserSeen nunca lança. Uma falha aqui
 * (Supabase fora do ar, coluna ainda não migrada, etc.) não pode derrubar
 * a request real que o usuário está esperando.
 */

const { createClient } = require('@supabase/supabase-js');

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
 * role: 'professor' | 'admin' | null (null = aluno, por convenção - ver
 * docblock de app_users na migração). turmaId: só pra referência, não usado
 * por nenhum endpoint hoje.
 */
async function trackUserSeen(userId, role, turmaId) {
  if (!userId) return;
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase
      .from('app_users')
      .upsert(
        { user_id: userId, role: role || null, turma_id: turmaId || null, last_seen_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  } catch (err) {
    console.warn('[userTracking] trackUserSeen failed (non-fatal):', err.message);
  }
}

module.exports = { trackUserSeen };
