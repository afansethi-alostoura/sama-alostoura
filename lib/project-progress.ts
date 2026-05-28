/**
 * Supabase-backed progress storage.
 * Base project data stays in .projects-data.json (git-committed).
 * Progress updates (%, stage, BOQ sections) are saved here so they
 * survive Vercel serverless deploys (file system is read-only on Vercel).
 *
 * Uses the service-role key (supabaseAdmin) to bypass RLS on the table.
 */
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import type { BOQSection } from '@/lib/projects-store'

export interface ProgressRecord {
  project_id:       string
  progress_percent: number
  current_stage:    string | null
  boq_sections:     BOQSection[] | null
  updated_at:       string
}

/** Fetch all saved progress rows keyed by project_id */
export async function getAllProgress(): Promise<Record<string, ProgressRecord>> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    console.warn('Supabase not configured — skipping getAllProgress')
    return {}
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('project_progress')
      .select('*')
    if (error) {
      console.error('getAllProgress error:', error.message)
      return {}
    }
    if (!data) return {}
    return Object.fromEntries(
      (data as ProgressRecord[]).map(r => [r.project_id, r])
    )
  } catch (err) {
    console.error('getAllProgress fetch failed:', err)
    return {}
  }
}

/** Fetch progress for one project */
export async function getProgress(projectId: string): Promise<ProgressRecord | null> {
  if (!isSupabaseConfigured() || !supabaseAdmin) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('project_progress')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()            // maybeSingle() returns null instead of error when not found
    if (error) {
      console.error('getProgress error:', error.message)
      return null
    }
    return data as ProgressRecord | null
  } catch (err) {
    console.error('getProgress fetch failed:', err)
    return null
  }
}

/** Upsert progress for one project — never throws, logs errors silently */
export async function saveProgress(
  projectId: string,
  progressPercent: number,
  currentStage: string,
  boqSections: BOQSection[],
): Promise<void> {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    console.warn('saveProgress: Supabase not configured — skipping')
    return
  }
  try {
    const { error } = await supabaseAdmin
      .from('project_progress')
      .upsert(
        {
          project_id:       projectId,
          progress_percent: progressPercent,
          current_stage:    currentStage,
          boq_sections:     boqSections,
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      )
    if (error) {
      console.error('saveProgress error:', error.message, error.details)
      // Don't throw — progress save failure should not crash the request
    }
  } catch (err) {
    console.error('saveProgress unexpected error:', err)
  }
}
