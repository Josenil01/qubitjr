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

-- ============================================
-- Cole o conteúdo acima no Supabase SQL Editor
-- ============================================
