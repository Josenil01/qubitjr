BEGIN;

-- [2026-11-20] A HelloYotta apontou (e-mail "ajuste necessário: concorrência
-- multi-plataforma") que um débito ATÔMICO NO NOSSO BANCO (a função abaixo,
-- criada na migração anterior) não serializa corretamente quando VÁRIAS
-- plataformas - não só o QubitJr - debitam do MESMO saldo do MESMO
-- professor ao mesmo tempo: cada uma decide "tem saldo?" sobre a própria
-- cópia local, sem nenhum ponto único de verdade no momento da decisão.
-- Corrigido: a decisão agora é SEMPRE da HelloYotta, via chamada síncrona e
-- bloqueante (POST /api/credits/teachers/:teacherId/debit, ver
-- services/helloyotta.js#debitTeacherCredits) ANTES de qualquer geração -
-- esta função local não decide mais nada.
DROP FUNCTION IF EXISTS debit_teacher_credits(TEXT, INTEGER);

-- credit_transactions passa a ser só um LOG local (auditoria/consulta de
-- tentativas falhadas, pedido do usuário) - correlacionado pelo mesmo
-- idempotencyKey que vai no corpo de cada chamada de débito à HelloYotta
-- (não mais por um id de transação nosso, que não existe mais nesse papel -
-- ver services/credits.js#markGenerationFailed). UNIQUE pra este log não
-- duplicar se o mesmo idempotencyKey for reenviado (ex. retry de uma
-- function serverless que relançou depois de um timeout de rede).
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_idempotency_key
  ON credit_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- teacher_credits.balance deixa de ser decidido por nós - agora é só um
-- CACHE de leitura do último saldo que a HelloYotta devolveu (GET
-- /api/teacher/credits pra exibir na UI, ou a resposta de cada débito).
COMMENT ON COLUMN teacher_credits.balance IS
  'Cache de leitura - a decisão de saldo é sempre da HelloYotta (POST /api/credits/teachers/:teacherId/debit). Nunca usar esta coluna para bloquear uma geração.';

COMMIT;
