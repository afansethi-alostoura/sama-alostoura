/**
 * ONE-TIME migration: Supabase → Railway for all BOQ tables.
 * DELETE this file after running.
 */
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function sbFetch(table: string) {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { rows: [], error: 'Supabase env vars missing' }

  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    const txt = await res.text()
    return { rows: [], error: `${res.status}: ${txt.slice(0, 100)}` }
  }
  const rows = await res.json()
  return { rows: Array.isArray(rows) ? rows : [], error: null }
}

export async function GET() {
  const pool = getPool()
  const client = await pool.connect()
  const results: Record<string, unknown> = {}

  try {
    // ── 1. Create tables ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_boq (
        id               TEXT PRIMARY KEY,
        project_number   TEXT,
        project_name     TEXT,
        area             TEXT,
        owner            TEXT,
        contractor       TEXT,
        items            JSONB DEFAULT '[]',
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS renovation_boq (
        id               TEXT PRIMARY KEY,
        project_number   TEXT,
        project_name     TEXT,
        area             TEXT,
        owner            TEXT,
        contractor       TEXT,
        project_location TEXT,
        client_name      TEXT,
        sections         JSONB DEFAULT '[]',
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mbhre_boq (
        id                    TEXT PRIMARY KEY,
        date_field            TEXT,
        file_no               TEXT,
        contract_value_text   TEXT,
        owner_name            TEXT,
        contractor            TEXT,
        consultant            TEXT,
        items                 JSONB DEFAULT '[]',
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS mbhre_breakdown_boq (
        id                    TEXT PRIMARY KEY,
        date_field            TEXT,
        file_no               TEXT,
        contract_value_text   TEXT,
        owner_name            TEXT,
        contractor            TEXT,
        consultant            TEXT,
        items                 JSONB DEFAULT '[]',
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id           BIGSERIAL PRIMARY KEY,
        project_id   TEXT,
        project_name TEXT,
        sender_name  TEXT,
        action_type  TEXT,
        ai_summary   TEXT,
        auto_applied BOOLEAN DEFAULT FALSE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `)
    results.tables = 'created ✅'

    // ── 2. Migrate each table ─────────────────────────────────────────────
    const tables = [
      { name: 'company_boq',        jsonbCols: ['items'] },
      { name: 'renovation_boq',     jsonbCols: ['sections'] },
      { name: 'mbhre_boq',          jsonbCols: ['items'] },
      { name: 'mbhre_breakdown_boq',jsonbCols: ['items'] },
      { name: 'whatsapp_messages',  jsonbCols: [], skipPk: true },
    ]

    for (const t of tables) {
      const { rows, error } = await sbFetch(t.name)
      if (error) { results[t.name] = { error }; continue }
      if (!rows.length) { results[t.name] = { migrated: 0, note: 'empty in Supabase' }; continue }

      let ok = 0, fail = 0
      for (const row of rows) {
        try {
          const cols = Object.keys(row).filter(c => t.skipPk ? c !== 'id' : true)
          const vals = cols.map((c) => {
            const v = row[c]
            return (t.jsonbCols.includes(c) && v !== null && typeof v !== 'string')
              ? JSON.stringify(v)
              : v
          })
          const placeholders = cols.map((_, i) => `$${i + 1}`)
          if (t.skipPk) {
            await client.query(
              `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
              vals,
            )
          } else {
            const updates = cols.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`)
            await client.query(
              `INSERT INTO ${t.name} (${cols.join(', ')}) VALUES (${placeholders.join(', ')})
               ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
              vals,
            )
          }
          ok++
        } catch (err: any) {
          console.error(`${t.name} row error:`, err.message)
          fail++
        }
      }
      results[t.name] = { migrated: ok, failed: fail, total: rows.length }
    }

    // ── 3. Counts ─────────────────────────────────────────────────────────
    const counts: Record<string, number> = {}
    for (const t of tables) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) FROM ${t.name}`)
        counts[t.name] = parseInt(rows[0].count)
      } catch {}
    }
    results.railway_counts = counts

  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true, results })
}
