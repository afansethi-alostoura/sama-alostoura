/**
 * File-based staff store — same pattern as projects-store.ts
 * Saved to .staff-data.json in the project root.
 */
import fs   from 'fs'
import path from 'path'

export interface StoredEmployee {
  id:                    string
  name:                  string
  role:                  string
  nationality:           string
  phone:                 string | null
  email:                 string | null
  salary:                number
  join_date:             string | null       // YYYY-MM-DD
  visa_expiry:           string | null       // YYYY-MM-DD
  emirates_id_expiry:    string | null       // YYYY-MM-DD
  passport_expiry:       string | null       // YYYY-MM-DD
  labour_card_expiry:    string | null       // YYYY-MM-DD
  status:                'active' | 'inactive'
  notes:                 string | null
  created_at:            string
  updated_at:            string
}

const FILE = path.join(process.cwd(), '.staff-data.json')

function readStore(): StoredEmployee[] {
  try {
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as StoredEmployee[]
  } catch { return [] }
}

function writeStore(employees: StoredEmployee[]): void {
  fs.writeFileSync(FILE, JSON.stringify(employees, null, 2), 'utf-8')
}

export function getAllEmployees(): StoredEmployee[] {
  return readStore().sort((a, b) => a.name.localeCompare(b.name))
}

export function getEmployee(id: string): StoredEmployee | null {
  return readStore().find(e => e.id === id) ?? null
}

export function createEmployee(data: Omit<StoredEmployee, 'id' | 'created_at' | 'updated_at'>): StoredEmployee {
  const employees = readStore()
  const now       = new Date().toISOString()
  const emp: StoredEmployee = {
    ...data,
    id:         `emp-${Date.now()}`,
    created_at: now,
    updated_at: now,
  }
  employees.push(emp)
  writeStore(employees)
  return emp
}

export function updateEmployee(id: string, updates: Partial<StoredEmployee>): StoredEmployee | null {
  const employees = readStore()
  const idx       = employees.findIndex(e => e.id === id)
  if (idx === -1) return null
  employees[idx] = { ...employees[idx], ...updates, id, updated_at: new Date().toISOString() }
  writeStore(employees)
  return employees[idx]
}

export function deleteEmployee(id: string): boolean {
  const employees = readStore()
  const filtered  = employees.filter(e => e.id !== id)
  if (filtered.length === employees.length) return false
  writeStore(filtered)
  return true
}
