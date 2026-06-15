/**
 * File-based project store — supplements demo data with real projects.
 * Saved to .projects-data.json in the project root.
 * Upgrade path: swap readStore/writeStore for Supabase calls later.
 *
 * @server Server-only module - only runs on Node.js runtime
 */
import fs   from 'fs'
import path from 'path'
import type { Project } from '@/types'

const FILE = path.join(process.cwd(), '.projects-data.json')

export interface BOQSection {
  section:    string
  amount:     number
  percentage: number   // % of total contract value
  progress:   number   // 0–100 completion %
}

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
  // QuickBooks class mapping — set once per project; used for all QB syncs
  qb_class_name?:   string   // exact QB class name, e.g. "Fahad Bin Rashed Bin Essa Bin Abdullatif Alserkal"
  total_expenses?:  number   // total project costs pulled from QB (Purchases + Bills)
  last_qb_sync?:    string   // ISO timestamp of last successful QB sync
  // Optional extended fields
  boq_sections?:        BOQSection[]
  // Extra metadata stored in JSON but not typed strictly
  mbhre_approved_amount?:    number
  mbhre_approved_progress?:  number
  plot_number?:              string
  consultant?:               string
  owner_share?:              number
  retention_percent?:        number
  file_number?:              string
  owner_paid?:               number
  mbhre_payment_1?:          number
  mbhre_payment_1_retention?: number
  mbhre_payment_2?:          number
  mbhre_payment_2_retention?: number
  total_retention_held?:     number
  outstanding_to_collect?:   number
  next_payment_claimable?:   number
  completed_works?:          string[]
  partial_works?:            Array<{ name: string; progress: number }>
  pending_works?:            string[]
  scope_changes?:            string
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
