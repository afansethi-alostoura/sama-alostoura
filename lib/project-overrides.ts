/**
 * Supabase-backed project storage.
 * - New projects created on Vercel are saved to stored_projects table.
 * - Field edits are saved to project_overrides table (merged on top of base data).
 * - Local .projects-data.json is used as seed/fallback in dev only.
 */
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import type { StoredProject } from '@/lib/projects-store'

export type ProjectOverride = Record<string, unknown>

// ── project_overrides (edits to existing projects) ───────────────────────────

export async function getAllOverrides(): Promise<Record<string, ProjectOverride>> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return {}
  try {
    const { data, error } = await supabaseAdmin
      .from('project_overrides')
      .select('project_id, data')
    if (error) { console.error('getAllOverrides:', error.message); return {} }
    return Object.fromEntries((data ?? []).map((r: any) => [r.project_id, r.data]))
  } catch (err) {
    console.error('getAllOverrides failed:', err)
    return {}
  }
}

export async function getOverride(projectId: string): Promise<ProjectOverride | null> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('project_overrides')
      .select('data')
      .eq('project_id', projectId)
      .maybeSingle()
    if (error) { console.error('getOverride:', error.message); return null }
    return (data as any)?.data ?? null
  } catch (err) {
    console.error('getOverride failed:', err)
    return null
  }
}

export async function saveOverride(projectId: string, fields: ProjectOverride): Promise<void> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    console.warn('saveOverride: Supabase not configured')
    return
  }
  try {
    const existing = await getOverride(projectId) ?? {}
    const { error } = await supabaseAdmin
      .from('project_overrides')
      .upsert(
        { project_id: projectId, data: { ...existing, ...fields }, updated_at: new Date().toISOString() },
        { onConflict: 'project_id' },
      )
    if (error) console.error('saveOverride error:', error.message)
  } catch (err) {
    console.error('saveOverride failed:', err)
  }
}

// ── projects table (canonical source — seeded via schema.sql + seed.sql) ──────

export async function getAllStoredFromSupabase(): Promise<StoredProject[]> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return []

  const results: StoredProject[] = []
  const seenIds = new Set<string>()

  // Primary source: the `projects` table (joined with clients for client_name)
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*, clients(name)')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('getAllStoredFromSupabase [projects]:', error.message)
    } else {
      for (const r of data ?? []) {
        seenIds.add(r.id)
        results.push({
          id:                  r.id,
          name:                r.name,
          client_name:         (r as any).clients?.name ?? '',
          location:            r.location ?? '',
          type:                r.type,
          status:              r.status,
          contract_value:      Number(r.contract_value  ?? 0),
          received_amount:     Number(r.received_amount ?? 0),
          progress_percent:    Number(r.progress_percent ?? 0),
          current_stage:       r.current_stage       ?? '',
          notes:               r.notes               ?? '',
          start_date:          r.start_date           ?? '',
          expected_completion: r.expected_completion  ?? '',
          created_at:          r.created_at,
          updated_at:          r.updated_at,
        } as StoredProject)
      }
    }
  } catch (err) {
    console.error('getAllStoredFromSupabase [projects] failed:', err)
  }

  // Secondary source: `stored_projects` (projects added via the app UI)
  try {
    const { data, error } = await supabaseAdmin
      .from('stored_projects')
      .select('id, data')
      .order('created_at', { ascending: true })
    if (!error) {
      for (const r of data ?? []) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id)
          results.push({ id: r.id, ...(r as any).data } as StoredProject)
        }
      }
    }
  } catch {
    // stored_projects table may not exist yet — that is fine
  }

  return results
}

export async function saveNewProjectToSupabase(project: StoredProject): Promise<void> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return
  try {
    // Save into the canonical `projects` table
    const { error } = await supabaseAdmin
      .from('projects')
      .upsert({
        id:                  project.id,
        name:                project.name,
        type:                project.type || 'villa',
        location:            project.location,
        contract_value:      project.contract_value,
        received_amount:     project.received_amount,
        progress_percent:    project.progress_percent,
        current_stage:       project.current_stage,
        notes:               project.notes,
        start_date:          project.start_date || null,
        expected_completion: project.expected_completion || null,
        status:              project.status,
        created_at:          project.created_at,
        updated_at:          project.updated_at,
      }, { onConflict: 'id' })
    if (error) console.error('saveNewProjectToSupabase error:', error.message)
  } catch (err) {
    console.error('saveNewProjectToSupabase failed:', err)
  }
}

export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return
  try {
    await supabaseAdmin.from('stored_projects').delete().eq('id', projectId)
    await supabaseAdmin.from('project_overrides').delete().eq('project_id', projectId)
    await supabaseAdmin.from('project_progress').delete().eq('project_id', projectId)
  } catch (err) {
    console.error('deleteProjectFromSupabase failed:', err)
  }
}
