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

// ── stored_projects (new projects created on Vercel) ─────────────────────────

export async function getAllStoredFromSupabase(): Promise<StoredProject[]> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return []
  try {
    const { data, error } = await supabaseAdmin
      .from('stored_projects')
      .select('id, data')
      .order('created_at', { ascending: true })
    if (error) { console.error('getAllStoredFromSupabase:', error.message); return [] }
    return (data ?? []).map((r: any) => ({ id: r.id, ...r.data })) as StoredProject[]
  } catch (err) {
    console.error('getAllStoredFromSupabase failed:', err)
    return []
  }
}

export async function saveNewProjectToSupabase(project: StoredProject): Promise<void> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return
  try {
    const { id, ...data } = project
    const { error } = await supabaseAdmin
      .from('stored_projects')
      .upsert({ id, data, created_at: project.created_at, updated_at: project.updated_at }, { onConflict: 'id' })
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
