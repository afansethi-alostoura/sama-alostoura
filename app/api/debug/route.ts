/**
 * GET /api/debug
 * Diagnostic endpoint — checks Railway PostgreSQL connection and table data.
 */
import { NextResponse } from 'next/server'
import { query, isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const out: Record<string, unknown> = {}

  const dbUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL
  out.env = {
    DATABASE_URL:        dbUrl ? dbUrl.slice(0, 50) + '…' : '❌ MISSING',
    RAILWAY_DATABASE_URL: process.env.RAILWAY_DATABASE_URL ? '✅ set' : '—',
    DATABASE_URL_raw:    process.env.DATABASE_URL        ? '✅ set' : '—',
    isConfigured:        isDbConfigured(),
    provider:            'Railway PostgreSQL',
  }

  if (!isDbConfigured()) {
    out.error = 'DATABASE_URL not set — add it to Vercel environment variables'
    return NextResponse.json(out)
  }

  // stored_projects
  try {
    const rows = await query('SELECT id, data FROM stored_projects ORDER BY created_at ASC')
    out.stored_projects = { count: rows.length, rows }
  } catch (e: any) {
    out.stored_projects = { error: e.message }
  }

  // project_overrides
  try {
    const rows = await query('SELECT project_id FROM project_overrides')
    out.project_overrides = { count: rows.length }
  } catch (e: any) {
    out.project_overrides = { error: e.message }
  }

  // project_progress
  try {
    const rows = await query('SELECT project_id, progress_percent FROM project_progress')
    out.project_progress = { count: rows.length, rows }
  } catch (e: any) {
    out.project_progress = { error: e.message }
  }

  // qb_tokens
  try {
    const rows = await query('SELECT realm_id, created_at FROM qb_tokens')
    out.qb_tokens = { count: rows.length, hasTokens: rows.length > 0 }
  } catch (e: any) {
    out.qb_tokens = { error: e.message }
  }

  // qb_snapshot classes (for debugging class name matching)
  try {
    const snap = await queryOne<{ classes: unknown; synced_at: unknown }>(
      'SELECT synced_at, classes FROM qb_snapshot WHERE id = 1'
    )
    if (snap) {
      const classes = Array.isArray(snap.classes) ? snap.classes as any[] : []
      out.qb_snapshot = {
        synced_at: snap.synced_at,
        class_count: classes.length,
        class_names: classes.map((c: any) => c.FullyQualifiedName ?? c.Name),
      }
    } else {
      out.qb_snapshot = { note: 'no snapshot yet' }
    }
  } catch (e: any) {
    out.qb_snapshot = { error: e.message }
  }

  // project_overrides data (to see received_amount)
  try {
    const rows = await query<{ project_id: string; data: Record<string, unknown> }>(
      'SELECT project_id, data FROM project_overrides'
    )
    out.project_overrides_data = rows.map(r => ({
      project_id: r.project_id,
      received_amount: (r.data as any)?.received_amount ?? 0,
      qb_class_name: (r.data as any)?.qb_class_name ?? null,
    }))
  } catch (e: any) {
    out.project_overrides_data = { error: e.message }
  }

  return NextResponse.json(out)
}
