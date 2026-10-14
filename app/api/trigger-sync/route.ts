/**
 * ONE-TIME public trigger — runs QB sync + sync-all to populate received amounts.
 * DELETE this file after running.
 */
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const base = new URL(req.url).origin
  const results: Record<string, unknown> = {}

  // Step 1: QB Sync (POST) — saves classes + invoices to Railway qb_snapshot
  try {
    const syncRes = await fetch(`${base}/api/quickbooks/sync`, {
      method: 'POST',
      headers: { Cookie: req.headers.get('cookie') ?? '' },
    })
    results.qb_sync = await syncRes.json()
  } catch (e: any) {
    results.qb_sync = { error: e.message }
  }

  // Step 2: sync-all (POST) — calculates received_amount from QB and saves to project_overrides
  try {
    const allRes = await fetch(`${base}/api/projects/sync-all`, {
      method: 'POST',
      headers: { Cookie: req.headers.get('cookie') ?? '' },
    })
    results.sync_all = await allRes.json()
  } catch (e: any) {
    results.sync_all = { error: e.message }
  }

  return NextResponse.json({ ok: true, results })
}
