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

-- ============================================
-- Cole o conteúdo acima no Supabase SQL Editor
-- ============================================
