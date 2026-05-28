/**
 * One-time setup endpoint — call once to initialize Supabase resources.
 * GET /api/setup → checks and creates: storage bucket, project_documents table
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const BUCKET = 'project-documents'

export async function GET() {
  const results: Record<string, string> = {}

  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured — check env vars' }, { status: 503 })
  }

  // ── 1. Storage bucket ────────────────────────────────────────────────────
  try {
    const { data: existing } = await supabaseAdmin.storage.getBucket(BUCKET)
    if (existing) {
      results.bucket = 'exists'
    } else {
      const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 52428800,
      })
      results.bucket = error ? `error: ${error.message}` : 'created'
    }
  } catch (e) {
    results.bucket = `exception: ${String(e)}`
  }

  // ── 2. project_documents table ───────────────────────────────────────────
  // Try to query the table; if it fails we provide the SQL to create it
  try {
    const { error } = await supabaseAdmin
      .from('project_documents')
      .select('id')
      .limit(1)

    if (error) {
      results.table = `missing or error: ${error.message}`
      results.table_sql = `
-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS project_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    TEXT NOT NULL,
  folder        TEXT NOT NULL,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size     BIGINT NOT NULL DEFAULT 0,
  mime_type     TEXT NOT NULL DEFAULT '',
  storage_path  TEXT NOT NULL,
  public_url    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_folder ON project_documents(folder);
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON project_documents FOR ALL USING (true) WITH CHECK (true);
`.trim()
    } else {
      results.table = 'exists'
    }
  } catch (e) {
    results.table = `exception: ${String(e)}`
  }

  return NextResponse.json({ ok: true, results })
}
