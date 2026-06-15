/**
 * Supabase-backed project field overrides.
 * When a user edits a project on Vercel (read-only file system),
 * changes are saved here and merged on top of the base .projects-data.json.
 */
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

export type ProjectOverride = Record<string, unknown>

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
    // Merge with existing override so partial updates don't wipe other fields
    const existing = await getOverride(projectId) ?? {}
    const { error } = await supabaseAdmin
      .from('project_overrides')
      .upsert(
        {
          project_id: projectId,
          data:       { ...existing, ...fields },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' },
      )
    if (error) console.error('saveOverride error:', error.message)
  } catch (err) {
    console.error('saveOverride failed:', err)
  }
}
