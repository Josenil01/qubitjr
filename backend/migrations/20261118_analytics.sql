BEGIN;

-- ============================================
-- app_users: papel (professor/admin/aluno) e primeiro/último acesso por
-- userId, persistidos a partir de agora. Antes desta tabela não existia
-- NENHUM registro de usuário — "professor" vs "aluno" só existia como claim
-- efêmera no JWT de cada request (ver backend/src/services/identity.js),
-- nunca gravada. Alimentada por trackUserSeen() (services/userTracking.js),
-- chamada no identityMiddleware (index.js) em toda request autenticada.
--
-- role: 'professor' | 'admin' | NULL. Só o token de professor/admin carrega
-- a claim `role` (ver identity.js) — token de aluno nunca tem `role`, então
-- NULL aqui significa aluno, por convenção (não há um terceiro valor
-- 'aluno' persistido). Os endpoints de analytics tratam role IS NULL como
-- aluno.
--
-- role pode mudar de NULL pra 'professor' (ou vice-versa) ao longo do tempo
-- se o mesmo userId algum dia logar com os dois tipos de token - de
-- propósito sempre sobrescrevemos com o role mais recente observado
-- (ON CONFLICT DO UPDATE), não acumulamos histórico de papel.
CREATE TABLE IF NOT EXISTS app_users (
  user_id       TEXT    PRIMARY KEY,
  role          TEXT,
  turma_id      TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_first_seen ON app_users(first_seen_at);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_users FROM anon, authenticated;
GRANT ALL ON app_users TO service_role;

-- ============================================
-- usage_events: um registro POR HEARTBEAT aceito (ver
-- increment_project_time abaixo e POST /api/db/project/:id/heartbeat em
-- backend/src/routes/db.js), com o delta JÁ CLAMPADO (0..240s) e quando
-- aconteceu. Antes desta tabela só existia projects.time_spent_seconds, um
-- total acumulado desde sempre por projeto, sem nenhum carimbo de tempo por
-- incremento - impossível responder "quanto tempo de uso teve esta semana",
-- só "quanto tempo este projeto já acumulou, desde a criação dele".
--
-- Gravado DENTRO da mesma função/transação do incremento (não por uma
-- segunda chamada do Node) pra garantir que o delta logado é exatamente o
-- delta aplicado, com a mesma checagem de dono já feita ali.
CREATE TABLE IF NOT EXISTS usage_events (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner         TEXT    NOT NULL,
  delta_seconds INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_owner_created_at ON usage_events(owner, created_at);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON usage_events FROM anon, authenticated;
GRANT ALL ON usage_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE usage_events_id_seq TO service_role;

-- Redefine increment_project_time (já existe em supabase-setup.sql) só pra
-- adicionar o INSERT em usage_events dentro da mesma transação. Mesma
-- assinatura e mesmo comportamento de retorno (NULL quando o projeto não
-- existe/não é do dono/foi apagado) - CREATE OR REPLACE é idempotente,
-- seguro repetir.
CREATE OR REPLACE FUNCTION increment_project_time(
  p_project_id INTEGER,
  p_owner TEXT,
  p_delta_seconds INTEGER
) RETURNS INTEGER AS $$
DECLARE
  new_total INTEGER;
  safe_delta INTEGER := LEAST(GREATEST(p_delta_seconds, 0), 240);
BEGIN
  UPDATE projects
  SET time_spent_seconds = time_spent_seconds + safe_delta,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_project_id AND owner = p_owner AND deleted = 'NO'
  RETURNING time_spent_seconds INTO new_total;

  -- Só loga o evento se o UPDATE acima realmente afetou uma linha (projeto
  -- existe, é do dono, não foi apagado) - mesma condição que faz new_total
  -- deixar de ser NULL.
  IF new_total IS NOT NULL THEN
    INSERT INTO usage_events (project_id, owner, delta_seconds)
    VALUES (p_project_id, p_owner, safe_delta);
  END IF;

  RETURN new_total; -- NULL quando o projeto não existe, não é do aluno, ou foi apagado
END;
$$ LANGUAGE plpgsql;

COMMIT;
