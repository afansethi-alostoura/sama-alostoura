/**
 * Railway PostgreSQL-backed progress storage.
 * Table: project_progress
 */
import { query, queryOne, isDbConfigured } from '@/lib/db'
import type { BOQSection } from '@/lib/projects-store'

export interface ProgressRecord {
  project_id:       string
  progress_percent: number
  current_stage:    string | null
  boq_sections:     BOQSection[] | null
  updated_at:       string
}

export async function getAllProgress(): Promise<Record<string, ProgressRecord>> {
  if (!isDbConfigured()) return {}
  try {
    const rows = await query<ProgressRecord>('SELECT * FROM project_progress')
    return Object.fromEntries(rows.map(r => [r.project_id, r]))
  } catch (err) {
    console.error('getAllProgress failed:', err)
    return {}
  }
}

export async function getProgress(projectId: string): Promise<ProgressRecord | null> {
  if (!isDbConfigured()) return null
  try {
    return await queryOne<ProgressRecord>(
      'SELECT * FROM project_progress WHERE project_id = $1',
      [projectId],
    )
  } catch (err) {
    console.error('getProgress failed:', err)
    return null
  }
}

export async function saveProgress(
  projectId:       string,
  progressPercent: number,
  currentStage:    string,
  boqSections:     BOQSection[],
): Promise<void> {
  if (!isDbConfigured()) return
  try {
    await query(
      `INSERT INTO project_progress (project_id, progress_percent, current_stage, boq_sections, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (project_id) DO UPDATE
         SET progress_percent = $2, current_stage = $3, boq_sections = $4, updated_at = NOW()`,
      [projectId, progressPercent, currentStage, JSON.stringify(boqSections)],
    )
  } catch (err) {
    console.error('saveProgress failed:', err)
  }
}
