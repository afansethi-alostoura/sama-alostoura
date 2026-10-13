/**
 * Railway PostgreSQL-backed project storage.
 * Tables: stored_projects, project_overrides
 */
import { query, queryOne, isDbConfigured } from '@/lib/db'
import type { StoredProject } from '@/lib/projects-store'

export type ProjectOverride = Record<string, unknown>

// ── project_overrides ─────────────────────────────────────────────────────────

export async function getAllOverrides(): Promise<Record<string, ProjectOverride>> {
  if (!isDbConfigured()) return {}
  try {
    const rows = await query<{ project_id: string; data: ProjectOverride }>(
      'SELECT project_id, data FROM project_overrides',
    )
    return Object.fromEntries(rows.map(r => [r.project_id, r.data]))
  } catch (err) {
    console.error('getAllOverrides failed:', err)
    return {}
  }
}

export async function getOverride(projectId: string): Promise<ProjectOverride | null> {
  if (!isDbConfigured()) return null
  try {
    const row = await queryOne<{ data: ProjectOverride }>(
      'SELECT data FROM project_overrides WHERE project_id = $1',
      [projectId],
    )
    return row?.data ?? null
  } catch (err) {
    console.error('getOverride failed:', err)
    return null
  }
}

export async function saveOverride(projectId: string, fields: ProjectOverride): Promise<void> {
  if (!isDbConfigured()) return
  try {
    const existing = await getOverride(projectId) ?? {}
    const merged   = { ...existing, ...fields }
    await query(
      `INSERT INTO project_overrides (project_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (project_id) DO UPDATE SET data = $2, updated_at = NOW()`,
      [projectId, JSON.stringify(merged)],
    )
  } catch (err) {
    console.error('saveOverride failed:', err)
  }
}

// ── stored_projects ───────────────────────────────────────────────────────────

export async function getAllStoredFromSupabase(): Promise<StoredProject[]> {
  if (!isDbConfigured()) return []
  try {
    const rows = await query<{ id: string; data: Record<string, unknown> }>(
      'SELECT id, data FROM stored_projects ORDER BY created_at ASC',
    )
    return rows.map(r => ({ id: r.id, ...r.data } as StoredProject))
  } catch (err) {
    console.error('getAllStoredFromSupabase failed:', err)
    return []
  }
}

export async function saveNewProjectToSupabase(project: StoredProject): Promise<void> {
  if (!isDbConfigured()) return
  try {
    const { id, ...data } = project
    await query(
      `INSERT INTO stored_projects (id, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = $4`,
      [id, JSON.stringify(data), project.created_at ?? new Date().toISOString(), project.updated_at ?? new Date().toISOString()],
    )
  } catch (err) {
    console.error('saveNewProjectToSupabase failed:', err)
  }
}

export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  if (!isDbConfigured()) return
  try {
    await query('DELETE FROM stored_projects    WHERE id         = $1', [projectId])
    await query('DELETE FROM project_overrides  WHERE project_id = $1', [projectId])
    await query('DELETE FROM project_progress   WHERE project_id = $1', [projectId])
  } catch (err) {
    console.error('deleteProjectFromSupabase failed:', err)
  }
}
