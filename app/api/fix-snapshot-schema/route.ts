/**
 * ONE-TIME: Add missing columns to qb_snapshot and re-trigger QB sync.
 * DELETE after running.
 */
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const pool = getPool()
  const results: Record<string, unknown> = {}

  // Add missing columns to qb_snapshot
  const cols = ['classes', 'purchases', 'bills', 'payments', 'customers']
  for (const col of cols) {
    try {
      await pool.query(`ALTER TABLE qb_snapshot ADD COLUMN IF NOT EXISTS ${col} JSONB DEFAULT '[]'`)
      results[`add_${col}`] = 'ok'
    } catch (e: any) {
      results[`add_${col}`] = e.message
    }
  }

  // Re-run QB sync to populate the new columns
  try {
    const base = new URL(req.url).origin
    const syncRes = await fetch(`${base}/api/quickbooks/sync`, { method: 'POST' })
    results.qb_sync = await syncRes.json()
  } catch (e: any) {
    results.qb_sync = { error: e.message }
  }

  return NextResponse.json({ ok: true, results })
}
