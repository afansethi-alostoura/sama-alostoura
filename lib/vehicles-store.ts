import fs   from 'fs'
import path from 'path'

export interface StoredVehicle {
  id:                   string
  plate_number:         string
  make:                 string        // Toyota, Ford, etc.
  model:                string        // Hilux, Ranger, etc.
  year:                 number | null
  color:                string | null
  type:                 string        // Pickup, Van, Car, Heavy Equipment
  registration_expiry:  string | null // Mulkiya — YYYY-MM-DD
  insurance_expiry:     string | null // YYYY-MM-DD
  rta_test_expiry:      string | null // RTA periodic inspection — YYYY-MM-DD
  status:               'active' | 'inactive'
  notes:                string | null
  created_at:           string
  updated_at:           string
}

const FILE = path.join(process.cwd(), '.vehicles-data.json')

function readStore(): StoredVehicle[] {
  try {
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as StoredVehicle[]
  } catch { return [] }
}

function writeStore(v: StoredVehicle[]): void {
  fs.writeFileSync(FILE, JSON.stringify(v, null, 2), 'utf-8')
}

export function getAllVehicles(): StoredVehicle[] {
  return readStore().sort((a, b) => a.plate_number.localeCompare(b.plate_number))
}

export function createVehicle(data: Omit<StoredVehicle, 'id' | 'created_at' | 'updated_at'>): StoredVehicle {
  const all = readStore()
  const now  = new Date().toISOString()
  const v: StoredVehicle = { ...data, id: `veh-${Date.now()}`, created_at: now, updated_at: now }
  all.push(v)
  writeStore(all)
  return v
}

export function updateVehicle(id: string, updates: Partial<StoredVehicle>): StoredVehicle | null {
  const all = readStore()
  const idx  = all.findIndex(v => v.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...updates, id, updated_at: new Date().toISOString() }
  writeStore(all)
  return all[idx]
}

export function deleteVehicle(id: string): boolean {
  const all      = readStore()
  const filtered = all.filter(v => v.id !== id)
  if (filtered.length === all.length) return false
  writeStore(filtered)
  return true
}
