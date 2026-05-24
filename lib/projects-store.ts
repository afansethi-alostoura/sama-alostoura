/**
 * File-based project store — supplements demo data with real projects.
 * Saved to .projects-data.json in the project root.
 * Upgrade path: swap readStore/writeStore for Supabase calls later.
 */
import fs   from 'fs'
import path from 'path'
import type { Project } from '@/types'

const FILE = path.join(process.cwd(), '.projects-data.json')

export interface StoredProject {
  id:               string
  name:             string
  client_name:      string
  location:         string
  type:             'villa' | 'renovation' | 'commercial'
  status:           'active' | 'completed' | 'on-hold'
  contract_value:   number
  received_amount:  number
  progress_percent: number
  current_stage:    string
  notes:            string
  start_date:       string
  expected_completion: string
  created_at:       string
  updated_at:       string
}

function readStore(): StoredProject[] {
  try {
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as StoredProject[]
  } catch { return [] }
}

function writeStore(data: StoredProject[]) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function getAllStoredProjects(): StoredProject[] {
  return readStore()
}

export function addStoredProject(p: Omit<StoredProject, 'id' | 'created_at' | 'updated_at'>): StoredProject {
  const projects = readStore()
  const now = new Date().toISOString()
  const newProject: StoredProject = {
    ...p,
    id:         crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }
  projects.push(newProject)
  writeStore(projects)
  return newProject
}

export function updateStoredProject(id: string, updates: Partial<StoredProject>): StoredProject | null {
  const projects = readStore()
  const idx = projects.findIndex(p => p.id === id)
  if (idx === -1) return null
  projects[idx] = { ...projects[idx], ...updates, updated_at: new Date().toISOString() }
  writeStore(projects)
  return projects[idx]
}

export function deleteStoredProject(id: string): boolean {
  const projects = readStore()
  const filtered = projects.filter(p => p.id !== id)
  if (filtered.length === projects.length) return false
  writeStore(filtered)
  return true
}

/** Convert StoredProject → Project shape used by the UI */
export function toProject(s: StoredProject): Project {
  const normalizeStatus = (st: string) => st.replace('-', '_') as any
  return {
    id:                 s.id,
    name:               s.name,
    client_id:          s.id,
    type:               s.type as any,
    location:           s.location,
    contract_value:     s.contract_value,
    received_amount:    s.received_amount,
    progress_percent:   s.progress_percent,
    current_stage:      s.current_stage,
    start_date:         s.start_date,
    expected_completion: s.expected_completion,
    status:             normalizeStatus(s.status),
    notes:              s.notes || null,
    created_at:         s.created_at,
    updated_at:         s.updated_at,
    client: {
      id:          s.id,
      name:        s.client_name || 'Client',
      phone:       null,
      email:       null,
      nationality: 'UAE',
      location:    s.location,
      type:        'owner',
      created_at:  s.created_at,
    },
  }
}
