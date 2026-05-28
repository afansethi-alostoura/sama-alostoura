-- ============================================================
-- project_documents table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS project_documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    TEXT        NOT NULL,
  folder        TEXT        NOT NULL,
  filename      TEXT        NOT NULL,
  original_name TEXT        NOT NULL,
  file_size     BIGINT      NOT NULL DEFAULT 0,
  mime_type     TEXT        NOT NULL DEFAULT '',
  storage_path  TEXT        NOT NULL,
  public_url    TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups by project and folder
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id
  ON project_documents(project_id);

CREATE INDEX IF NOT EXISTS idx_project_documents_folder
  ON project_documents(folder);

-- Row-level security (allow all — server uses service role key anyway)
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all" ON project_documents;
CREATE POLICY "Allow all"
  ON project_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);
