/**
 * Supabase-backed progress storage.
 * Base project data stays in .projects-data.json (git-committed).
 * Progress updates (%, stage, BOQ sections) are saved here so they
 * survive Vercel serverless deploys (file system is read-only on Vercel).
 */
import { supabase } from '@/lib/supabase'
import type { BOQSection } from '@/lib/projects-store'

export interface ProgressRecord {
  project_id:      string
  progress_percent: number
  current_stage:   string | null
  boq_sections:    BOQSection[] | null
  updated_at:      string
}

/** Fetch all saved progress rows keyed by project_id */
export async function getAllProgress(): Promise<Record<string, ProgressRecord>> {
  try {
    const { data, error } = await supabase
      .from('project_progress')
      .select('*')
    if (error || !data) return {}
    return Object.fromEntries(data.map((r: ProgressRecord) => [r.project_id, r]))
  } catch {
    return {}
  }
}

/** Fetch progress for one project */
export async function getProgress(projectId: string): Promise<ProgressRecord | null> {
  try {
    const { data, error } = await supabase
      .from('project_progress')
      .select('*')
      .eq('project_id', projectId)
      .single()
    if (error || !data) return null
    return data as ProgressRecord
  } catch {
    return null
  }
}

/** Upsert progress for one project */
export async function saveProgress(
  projectId: string,
  progressPercent: number,
  currentStage: string,
  boqSections: BOQSection[],
): Promise<void> {
  const { error } = await supabase
    .from('project_progress')
    .upsert({
      project_id:       projectId,
      progress_percent: progressPercent,
      current_stage:    currentStage,
      boq_sections:     boqSections,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'project_id' })
  if (error) throw new Error(error.message)
}
