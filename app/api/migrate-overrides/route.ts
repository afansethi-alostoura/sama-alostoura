/**
 * ONE-TIME migration endpoint — reads project_overrides from Supabase
 * and writes them to Railway PostgreSQL.
 * DELETE THIS FILE after migration is confirmed.
 */
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env vars not found in Vercel' })
  }

  // Fetch project_overrides from Supabase via REST API
  const overridesRes = await fetch(`${supabaseUrl}/rest/v1/project_overrides?select=*`, {
    headers: {
      apikey:        serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })

  if (!overridesRes.ok) {
    const txt = await overridesRes.text()
    return NextResponse.json({ error: `Supabase fetch failed: ${txt}` })
  }

  const overrides: Array<{ project_id: string; data: Record<string, unknown> }> = await overridesRes.json()

  // Also fetch stored_projects overrides (the original stored data with real received amounts)
  const storedRes = await fetch(`${supabaseUrl}/rest/v1/stored_projects?select=*`, {
    headers: {
      apikey:        serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })

  const stored: Array<{ id: string; data: Record<string, unknown> }> = storedRes.ok
    ? await storedRes.json()
    : []

  const results: Record<string, unknown> = {
    supabase_overrides_count: overrides.length,
    supabase_stored_count:    stored.length,
    migrated: [],
    stored_updated: [],
    errors: [],
  }

  // Migrate project_overrides → Railway
  for (const row of overrides) {
    try {
      await query(
        `INSERT INTO project_overrides (project_id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (project_id) DO UPDATE SET data = $2, updated_at = NOW()`,
        [row.project_id, JSON.stringify(row.data)],
      )
      ;(results.migrated as string[]).push(row.project_id)
    } catch (err: any) {
      ;(results.errors as string[]).push(`override ${row.project_id}: ${err.message}`)
    }
  }

  // Update stored_projects in Railway with the real Supabase data (which has correct received_amount etc.)
  for (const row of stored) {
    try {
      await query(
        `INSERT INTO stored_projects (id, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = $4`,
        [row.id, JSON.stringify(row.data), (row.data.created_at as string) ?? new Date().toISOString(), (row.data.updated_at as string) ?? new Date().toISOString()],
      )
      ;(results.stored_updated as string[]).push((row.data as any).name ?? row.id)
    } catch (err: any) {
      ;(results.errors as string[]).push(`stored ${row.id}: ${err.message}`)
    }
  }

  return NextResponse.json(results)
}
