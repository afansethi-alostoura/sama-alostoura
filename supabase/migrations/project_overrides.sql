-- Project editable fields stored in Supabase (Vercel file system is read-only)
-- Any field edited via the UI is saved here and merged on top of the base JSON file.

CREATE TABLE IF NOT EXISTS project_overrides (
  project_id   TEXT PRIMARY KEY,
  data         JSONB NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
