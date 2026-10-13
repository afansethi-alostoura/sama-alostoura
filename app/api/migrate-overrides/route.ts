/**
 * ONE-TIME migration — reads project_progress (BOQ) from Supabase → Railway.
 * DELETE after running.
 */
import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env vars not found' })
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }

  // Fetch project_progress (has boq_sections)
  const progressRes = await fetch(`${supabaseUrl}/rest/v1/project_progress?select=*`, { headers })
  const progress: any[] = progressRes.ok ? await progressRes.json() : []

  const results: any = { progress_count: progress.length, migrated: [], errors: [] }

  for (const row of progress) {
    try {
      await query(
        `INSERT INTO project_progress (project_id, progress_percent, current_stage, boq_sections, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (project_id) DO UPDATE
           SET progress_percent = $2, current_stage = $3, boq_sections = $4, updated_at = $5`,
        [
          row.project_id,
          row.progress_percent ?? 0,
          row.current_stage ?? '',
          row.boq_sections ? JSON.stringify(row.boq_sections) : null,
          row.updated_at ?? new Date().toISOString(),
        ],
      )
      results.migrated.push(row.project_id)
    } catch (err: any) {
      results.errors.push(`${row.project_id}: ${err.message}`)
    }
  }

  // Also show current Railway state
  const railwayProgress = await query('SELECT project_id, progress_percent, current_stage FROM project_progress')
  results.railway_after = railwayProgress

  return NextResponse.json(results)
}
