BEGIN;

-- ============================================
-- teacher_credits: saldo de créditos de IA (gerar projeto/dicas) por
-- professor. Fonte da verdade do saldo "de negócio" é a HelloYotta -
-- sincronizado aqui no início da sessão do professor (ver
-- GET /api/teacher/credits em routes/teacher.js e
-- services/helloyotta.js#getTeacherCredits), não a cada request. Esta
-- tabela é a cópia local usada pra decidir ATOMICAMENTE (debit_teacher_credits
-- abaixo) se uma geração por IA pode rodar, sem depender de um round-trip
-- síncrono até a HelloYotta a cada chamada de LLM.
--
-- FK pra app_users (ver migração 20261118_analytics.sql) - mesma ancoragem
-- de identidade de professor já usada ali, não uma tabela de usuários
-- própria nova.
CREATE TABLE IF NOT EXISTS teacher_credits (
  teacher_id  TEXT PRIMARY KEY REFERENCES app_users(user_id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0,
  synced_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teacher_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON teacher_credits FROM anon, authenticated;
GRANT ALL ON teacher_credits TO service_role;

-- ============================================
-- credit_transactions: auditoria de toda tentativa de débito - sucesso,
-- geração que falhou DEPOIS de já ter debitado, ou bloqueio por saldo
-- insuficiente (pedido do usuário: "quero poder consultar quantas
-- tentativas falharam", mesmo sem reembolso automático - decisão do
-- usuário: débito nunca fica negativo e é aplicado ANTES de chamar a LLM,
-- então 'failed' aqui é sempre a geração em si dando erro depois, não o
-- débito).
--
-- amount sempre negativo hoje (débito) - a coluna não impede um futuro
-- registro positivo (ex.: estorno manual) sem precisar de migração nova.
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            SERIAL PRIMARY KEY,
  teacher_id    TEXT    NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  reason        TEXT    NOT NULL, -- 'project_generation' | 'hint_generation' | 'project_and_hint_generation'
  status        TEXT    NOT NULL, -- 'succeeded' | 'failed' | 'insufficient_balance'
  assignment_id INTEGER,
  draft_id      INTEGER,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_teacher_id ON credit_transactions(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON credit_transactions(status);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credit_transactions FROM anon, authenticated;
GRANT ALL ON credit_transactions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE credit_transactions_id_seq TO service_role;

-- ============================================
-- Débito ATOMICAMENTE no banco (mesmo padrão de increment_project_time em
-- supabase-setup.sql) - evita duas gerações simultâneas do mesmo professor
-- (duas abas, duplo-clique) debitarem acima do saldo disponível. A condição
-- "balance >= p_amount" fica no próprio WHERE: se não afetar nenhuma linha,
-- saldo insuficiente é decidido pelo banco, não por um "ler, comparar,
-- escrever" no Node que teria a mesma corrida que esta função existe pra
-- evitar. NULL de retorno cobre os dois casos (sem linha de saldo ainda, ou
-- saldo insuficiente) - quem chama trata os dois como "bloqueado".
CREATE OR REPLACE FUNCTION debit_teacher_credits(
  p_teacher_id TEXT,
  p_amount INTEGER
) RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE teacher_credits
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE teacher_id = p_teacher_id AND balance >= p_amount
  RETURNING balance INTO new_balance;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ai_activity_drafts ganhou dono: decisão de produto mudou (ver
-- routes/share.js, POST /api/public/activities/generate) - a HelloYotta
-- agora é OBRIGADA a mandar qual professor debitar (teacherId no corpo do
-- request), porque sem identidade de professor não há de quem descontar
-- créditos. A tabela nasceu de propósito "sem dono" (ver comentário original
-- em supabase-setup.sql) - esta coluna não contradiz aquele histórico, só
-- reflete a decisão nova. Nullable porque rascunhos antigos (antes desta
-- migração) não têm teacher_id.
ALTER TABLE ai_activity_drafts ADD COLUMN IF NOT EXISTS teacher_id TEXT REFERENCES app_users(user_id);

COMMIT;
