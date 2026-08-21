-- ============================================
-- ScratchJr Database Schema
-- Para ser executado no Supabase SQL Editor
-- ============================================

-- Tabela: projects (projetos do usuário)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  ctime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  mtime TIMESTAMP,
  altmd5 TEXT,
  pos INTEGER,
  name TEXT NOT NULL,
  json TEXT,
  thumbnail TEXT,
  owner TEXT,
  gallery TEXT,
  isgift TEXT DEFAULT '0',
  deleted TEXT DEFAULT 'NO',
  version TEXT DEFAULT 'iOSv01',
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: usershapes (formas/costumes customizados)
CREATE TABLE IF NOT EXISTS usershapes (
  id SERIAL PRIMARY KEY,
  ctime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  md5 TEXT UNIQUE,
  altmd5 TEXT,
  width TEXT,
  height TEXT,
  ext TEXT,
  name TEXT,
  owner TEXT,
  scale TEXT,
  version TEXT DEFAULT 'iOSv01',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: userbkgs (fundos customizados)
CREATE TABLE IF NOT EXISTS userbkgs (
  id SERIAL PRIMARY KEY,
  ctime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  md5 TEXT UNIQUE,
  altmd5 TEXT,
  width TEXT,
  height TEXT,
  ext TEXT,
  owner TEXT,
  version TEXT DEFAULT 'iOSv01',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: projectfiles (arquivos dos projetos)
CREATE TABLE IF NOT EXISTS projectfiles (
  md5 TEXT PRIMARY KEY,
  contents TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela: media (mídia dos projetos)
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT,
  data BYTEA,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted);
CREATE INDEX IF NOT EXISTS idx_usershapes_owner ON usershapes(owner);
CREATE INDEX IF NOT EXISTS idx_userbkgs_owner ON userbkgs(owner);
CREATE INDEX IF NOT EXISTS idx_media_project_id ON media(project_id);

-- Migração: adicionar coluna isgift (caso a tabela já exista no Supabase)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS isgift TEXT DEFAULT '0';

-- Migração: token de compartilhamento por projeto
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT NULL;

-- Migração: tempo (em segundos) que o aluno passou editando este projeto.
-- Alimentado por heartbeats do editor (ver POST /api/db/project/:id/heartbeat
-- em backend/src/routes/db.js) via a função increment_project_time abaixo.
-- "Tempo total na plataforma" de um aluno = SUM(time_spent_seconds) sobre
-- todos os projetos dele - não precisa de coluna/tabela separada pra isso.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0;

-- Incremento atômico do tempo de um projeto, feito no banco pra não perder
-- heartbeats concorrentes de abas/dispositivos diferentes do mesmo aluno
-- (um simples "ler, somar, escrever" no backend teria essa corrida).
-- A checagem de dono (owner) fica DENTRO da função, já que uma chamada RPC
-- não passa pelo filtro .eq('owner', ...) que db.js aplica nas queries
-- normais - sem isso, qualquer aluno autenticado poderia inflar o tempo de
-- um projeto de outro aluno.
-- p_delta_seconds é limitado a [0, 240] (heartbeat é a cada ~60s; a folga
-- cobre heartbeats atrasados sem permitir um valor absurdo de um cliente
-- malicioso ou uma aba que ficou suspensa e "acordou" horas depois).
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

  RETURN new_total; -- NULL quando o projeto não existe, não é do aluno, ou foi apagado
END;
$$ LANGUAGE plpgsql;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;

-- Tabela: reactions (reações emoji por projeto compartilhado)
CREATE TABLE IF NOT EXISTS reactions (
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  emoji       TEXT    NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, emoji)
);

-- Tabela: live_sessions (auditoria de sessões de observação professor→aluno)
-- Autorização (quem pode ver qual turma/aluno) vive na HelloYotta; esta tabela
-- é só o registro local de quando cada sessão ao vivo aconteceu e por quê terminou.
--
-- channel_token: UUID aleatório que vira o nome do canal Realtime da sessão
-- (teacher-session:<channel_token>). Canal Realtime é público (anon key, sem
-- RLS) — a proteção é o UUID ser impossível de adivinhar, mesmo padrão já
-- usado em projects.share_token. Decidido depois de esbarrar num limite real
-- do Supabase: projetos no sistema novo de chaves assimétricas não permitem
-- importar uma chave de assinatura própria nem extrair o secret legado, o
-- que inviabilizava canal privado com RLS via auth.jwt().
CREATE TABLE IF NOT EXISTS live_sessions (
  id             SERIAL PRIMARY KEY,
  teacher_id     TEXT    NOT NULL,
  student_id     TEXT    NOT NULL,
  turma_id       TEXT    NOT NULL,
  project_id     INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  device_id      TEXT    NOT NULL, -- identifica a conexão/aba do professor (regra de 1 dispositivo por vez)
  channel_token  UUID    NOT NULL DEFAULT gen_random_uuid(),
  started_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at       TIMESTAMP,
  end_reason     TEXT, -- 'teacher_left' | 'switched_student' | 'student_disconnected' | 'timeout_50min' | 'kicked_new_device' | null (ainda ativa)
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Migração: caso live_sessions já exista de uma tentativa anterior sem esta coluna.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS channel_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_live_sessions_teacher_active ON live_sessions(teacher_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_live_sessions_student ON live_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_turma ON live_sessions(turma_id);

-- Tabela: assignments (missões/atividades atribuídas pelo professor a uma turma)
-- Criadas pela HelloYotta (área do professor) via API; o ScratchJr web só lê
-- essas linhas pra saber os requisitos da missão ativa de uma turma e, no
-- futuro, validar o projeto do aluno contra eles.
--
-- requirements (JSONB): formato livre, versionado pela aplicação e não pelo
-- schema do banco. Shape esperado, por exemplo:
-- {
--   "scenes":     { "count": 3, "used": ["Farm.svg", "Park.svg"] },
--   "characters": { "count": 2, "used": ["HY-Ruby.svg", "HY-Allan.svg"] },
--   "blocks":     { "count": 15, "byType": { "forward": 3, "repeat": 2 } },
--   "ctScores":   { "parallelism": 2, "flowControl": 1, "synchronization": 1,
--                   "userInteractivity": 1, "abstraction": 1, "dataRepresentation": 0 }
-- }
--
-- "Uma assignment ativa por turma_id de cada vez" é invariante de APLICAÇÃO,
-- não do banco: o backend desativa (active = false) a assignment anterior da
-- turma antes de inserir a nova. Não há constraint/trigger garantindo isso
-- aqui - mesmo estilo de outras regras deste arquivo que vivem no código, não
-- no schema (ex.: autorização de live_sessions vive na HelloYotta).
CREATE TABLE IF NOT EXISTS assignments (
  id            SERIAL PRIMARY KEY,
  turma_id      TEXT    NOT NULL,
  nivel         TEXT,                    -- ano/série (ex.: "3" para 3º Ano); vem da HelloYotta como campo próprio, não é extraído de turma_id
  teacher_id    TEXT    NOT NULL,
  project_name  TEXT    NOT NULL,
  requirements  JSONB   NOT NULL,        -- ver shape explicado acima
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_turma ON assignments(turma_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_nivel ON assignments(teacher_id, nivel);
CREATE INDEX IF NOT EXISTS idx_assignments_active ON assignments(active) WHERE active = true;

-- Migração: projeto vinculado a uma assignment (missão). NULL para projetos
-- livres, criados fora de qualquer missão. ON DELETE SET NULL porque apagar
-- a assignment não deve apagar os projetos que os alunos já entregaram nela.
-- (Fica aqui, junto da tabela assignments, e não ao lado das outras migrações
-- de projects acima, porque a FK exige que assignments já exista antes desta
-- linha rodar - este script é executado de cima pra baixo no SQL Editor.)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_assignment_id ON projects(assignment_id);

-- ============================================
-- Cole o conteúdo acima no Supabase SQL Editor
-- ============================================
