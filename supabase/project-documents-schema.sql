-- ============================================================
-- Run this in Supabase SQL Editor: supabase.com > SQL Editor
-- Then create the Storage bucket (see instructions below)
-- ============================================================

-- 1. Project documents metadata table
CREATE TABLE IF NOT EXISTS project_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    TEXT NOT NULL,
  folder        TEXT NOT NULL,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size     BIGINT  DEFAULT 0,
  mime_type     TEXT    DEFAULT '',
  storage_path  TEXT    NOT NULL,
  public_url    TEXT    NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proj_docs_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_docs_folder  ON project_documents(project_id, folder);

-- 2. Disable RLS so the service-role key can read/write freely
ALTER TABLE project_documents DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORAGE BUCKET — do this in Supabase Dashboard UI:
--   Storage > New Bucket
--   Name: project-documents
--   Public: YES (toggle on)
--   Click Create
-- ============================================================
