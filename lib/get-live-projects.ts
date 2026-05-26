/**
 * SERVER-ONLY helper — the single source of truth for all project data.
 *
 * Returns every project with Supabase progress overlaid on top of the
 * file-based base data, plus DEMO_PROJECTS as fallbacks.
 *
 * Used by:
 *   - GET /api/projects
 *   - All /api/agents/* routes (so AI briefings always use live data)
 *
 * Never import this in a 'use client' component.
 */
import { getAllStoredProjects } from '@/lib/projects-store'
import { getAllProgress }       from '@/lib/project-progress'
import { DEMO_PROJECTS }        from '@/lib/demo-data'

export interface LiveProject {
  id:               string
  name:             string
  client_name:      string
  location:         string
  type:             string
  status:           string   // 'active' | 'on_hold' | 'completed' | 'cancelled'
  contract_value:   number
  received_amount:  number
  progress_percent: number
  current_stage:    string
  start_date:       string
  expected_completion: string
  created_at:       string
  updated_at:       string
  notes:            string
  boq_sections:     unknown[]
  // MBHRE / extra metadata (present on stored projects)
  mbhre_approved_amount?:   number
  mbhre_approved_progress?: number
  plot_number?:             string
}

export async function getLiveProjects(): Promise<LiveProject[]> {
  // 1. Real projects from file store + Supabase progress overrides
  const stored    = getAllStoredProjects()
  const overrides = await getAllProgress()   // {} if Supabase not configured

  const realProjects: LiveProject[] = stored.map(p => {
    const prog = overrides[p.id]
    return {
      id:               p.id,
      name:             p.name,
      client_name:      p.client_name   ?? '',
      location:         p.location      ?? '',
      type:             p.type,
      status:           p.status.replace('-', '_'),   // normalise on-hold → on_hold
      contract_value:   p.contract_value,
      received_amount:  p.received_amount,
      progress_percent: prog?.progress_percent ?? p.progress_percent,
      current_stage:    prog?.current_stage    ?? p.current_stage    ?? '',
      start_date:       p.start_date           ?? '',
      expected_completion: p.expected_completion ?? '',
      created_at:       p.created_at,
      updated_at:       p.updated_at,
      notes:            p.notes ?? '',
      boq_sections:     (prog?.boq_sections ?? (p as any).boq_sections ?? []),
      // pass through any extra fields
      mbhre_approved_amount:   (p as any).mbhre_approved_amount,
      mbhre_approved_progress: (p as any).mbhre_approved_progress,
      plot_number:             (p as any).plot_number,
    }
  })

  // 2. DEMO_PROJECTS as fallbacks (skip if already present by id or name)
  const realIds   = new Set(realProjects.map(p => p.id))
  const realNames = new Set(realProjects.map(p => p.name.toLowerCase()))

  const demoFallbacks: LiveProject[] = DEMO_PROJECTS
    .filter(p => !realIds.has(p.id) && !realNames.has(p.name.toLowerCase()))
    .map(p => ({
      id:               p.id,
      name:             p.name,
      client_name:      p.client?.name   ?? 'Client',
      location:         p.location       ?? '',
      type:             p.type,
      status:           p.status,
      contract_value:   p.contract_value,
      received_amount:  p.received_amount,
      progress_percent: p.progress_percent,
      current_stage:    p.current_stage  ?? '',
      start_date:       p.start_date     ?? '',
      expected_completion: p.expected_completion ?? '',
      created_at:       p.created_at,
      updated_at:       p.updated_at,
      notes:            p.notes          ?? '',
      boq_sections:     [],
    }))

  return [...realProjects, ...demoFallbacks]
}
