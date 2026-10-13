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

  return NextResponse.json(out)
}
