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
  if (!url || !key) return { rows: [] as Record<string, unknown>[], error: 'Supabase env vars missing' }

  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=500`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) {
    const txt = await res.text()
    return { rows: [] as Record<string, unknown>[], error: `${res.status}: ${txt.slice(0, 120)}` }
  }
  const rows = await res.json()
  return { rows: Array.isArray(rows) ? rows as Record<string, unknown>[] : [], error: null }
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

    // ── 2. company_boq ───────────────────────────────────────────────────
    {
      const { rows, error } = await sbFetch('company_boq')
      if (error) {
        results.company_boq = { error }
      } else {
        let ok = 0, fail = 0
        for (const row of rows) {
          try {
            const items = row.items
            await client.query(
              `INSERT INTO company_boq (id, project_number, project_name, area, owner, contractor, items, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
               ON CONFLICT (id) DO UPDATE SET
                 project_number=EXCLUDED.project_number, project_name=EXCLUDED.project_name,
                 area=EXCLUDED.area, owner=EXCLUDED.owner, contractor=EXCLUDED.contractor,
                 items=EXCLUDED.items, updated_at=EXCLUDED.updated_at`,
              [
                row.id, row.project_number, row.project_name,
                row.area, row.owner, row.contractor,
                typeof items === 'string' ? items : JSON.stringify(items ?? []),
                row.created_at ?? new Date().toISOString(),
                row.updated_at ?? new Date().toISOString(),
              ],
            )
            ok++
          } catch (e: any) {
            console.error('company_boq row error:', e.message, JSON.stringify(row).slice(0, 100))
            fail++
          }
        }
        results.company_boq = { migrated: ok, failed: fail, total: rows.length }
      }
    }

    // ── 3. renovation_boq ────────────────────────────────────────────────
    {
      const { rows, error } = await sbFetch('renovation_boq')
      if (error) {
        results.renovation_boq = { error }
      } else {
        let ok = 0, fail = 0
        for (const row of rows) {
          try {
            const sections = row.sections
            await client.query(
              `INSERT INTO renovation_boq (id, project_number, project_name, area, owner, contractor, project_location, client_name, sections, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
               ON CONFLICT (id) DO UPDATE SET
                 project_number=EXCLUDED.project_number, project_name=EXCLUDED.project_name,
                 area=EXCLUDED.area, owner=EXCLUDED.owner, contractor=EXCLUDED.contractor,
                 project_location=EXCLUDED.project_location, client_name=EXCLUDED.client_name,
                 sections=EXCLUDED.sections, updated_at=EXCLUDED.updated_at`,
              [
                row.id, row.project_number, row.project_name,
                row.area ?? row.project_location, row.owner ?? row.client_name,
                row.contractor, row.project_location ?? row.area,
                row.client_name ?? row.owner,
                typeof sections === 'string' ? sections : JSON.stringify(sections ?? []),
                row.created_at ?? new Date().toISOString(),
                row.updated_at ?? new Date().toISOString(),
              ],
            )
            ok++
          } catch (e: any) {
            console.error('renovation_boq row error:', e.message)
            fail++
          }
        }
        results.renovation_boq = { migrated: ok, failed: fail, total: rows.length }
      }
    }

    // ── 4. mbhre_boq ─────────────────────────────────────────────────────
    {
      const { rows, error } = await sbFetch('mbhre_boq')
      if (error) {
        results.mbhre_boq = { error }
      } else if (!rows.length) {
        results.mbhre_boq = { migrated: 0, note: 'empty in Supabase' }
      } else {
        let ok = 0, fail = 0
        for (const row of rows) {
          try {
            const items = row.items
            await client.query(
              `INSERT INTO mbhre_boq (id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, items, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (id) DO UPDATE SET
                 date_field=EXCLUDED.date_field, file_no=EXCLUDED.file_no,
                 contract_value_text=EXCLUDED.contract_value_text, owner_name=EXCLUDED.owner_name,
                 contractor=EXCLUDED.contractor, consultant=EXCLUDED.consultant,
                 items=EXCLUDED.items, updated_at=EXCLUDED.updated_at`,
              [
                row.id, row.date_field, row.file_no, row.contract_value_text,
                row.owner_name, row.contractor, row.consultant,
                typeof items === 'string' ? items : JSON.stringify(items ?? []),
                row.created_at ?? new Date().toISOString(),
                row.updated_at ?? new Date().toISOString(),
              ],
            )
            ok++
          } catch (e: any) {
            console.error('mbhre_boq row error:', e.message)
            fail++
          }
        }
        results.mbhre_boq = { migrated: ok, failed: fail, total: rows.length }
      }
    }

    // ── 5. mbhre_breakdown_boq ───────────────────────────────────────────
    // (table might not exist in Supabase — skip gracefully)
    {
      const { rows, error } = await sbFetch('mbhre_breakdown_boq')
      if (error && error.includes('404')) {
        results.mbhre_breakdown_boq = { note: 'table does not exist in Supabase (skipped)' }
      } else if (error) {
        results.mbhre_breakdown_boq = { error }
      } else {
        let ok = 0, fail = 0
        for (const row of rows) {
          try {
            const items = row.items
            await client.query(
              `INSERT INTO mbhre_breakdown_boq (id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, items, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
               ON CONFLICT (id) DO UPDATE SET items=EXCLUDED.items, updated_at=EXCLUDED.updated_at`,
              [
                row.id, row.date_field, row.file_no, row.contract_value_text,
                row.owner_name, row.contractor, row.consultant,
                typeof items === 'string' ? items : JSON.stringify(items ?? []),
                row.created_at ?? new Date().toISOString(),
                row.updated_at ?? new Date().toISOString(),
              ],
            )
            ok++
          } catch (e: any) { fail++ }
        }
        results.mbhre_breakdown_boq = { migrated: ok, failed: fail, total: rows.length }
      }
    }

    // ── 6. whatsapp_messages (only copy the columns we have) ─────────────
    {
      const { rows, error } = await sbFetch('whatsapp_messages')
      if (error) {
        results.whatsapp_messages = { error }
      } else {
        let ok = 0, fail = 0
        for (const row of rows) {
          try {
            await client.query(
              `INSERT INTO whatsapp_messages (project_id, project_name, sender_name, action_type, ai_summary, auto_applied, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [
                row.project_id ?? null,
                row.project_name ?? null,
                row.sender_name ?? row.profile_name ?? null,
                row.action_type ?? 'note',
                row.ai_summary ?? row.message_body ?? null,
                row.auto_applied ?? false,
                row.created_at ?? new Date().toISOString(),
              ],
            )
            ok++
          } catch (e: any) {
            console.error('whatsapp_messages row error:', e.message)
            fail++
          }
        }
        results.whatsapp_messages = { migrated: ok, failed: fail, total: rows.length }
      }
    }

    // ── 7. Final counts ───────────────────────────────────────────────────
    const tableNames = ['company_boq', 'renovation_boq', 'mbhre_boq', 'mbhre_breakdown_boq', 'whatsapp_messages']
    const counts: Record<string, number> = {}
    for (const t of tableNames) {
      try {
        const { rows } = await client.query(`SELECT COUNT(*) FROM ${t}`)
        counts[t] = parseInt(rows[0].count)
      } catch {}
    }
    results.railway_counts = counts

  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true, results })
}
