/**
 * File-based Company BOQ store — fallback when Supabase is not configured.
 * Saved to .company-boq-data.json in the project root.
 */
import fs   from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), '.company-boq-data.json')

export interface CompanyBOQRecord {
  id:                   string
  project_number:       string
  project_name:         string
  area:                 string
  owner:                string
  contractor:           string
  items:                any[]
  created_at:           string
  updated_at:           string
}

function readStore(): CompanyBOQRecord[] {
  try {
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as CompanyBOQRecord[]
  } catch { return [] }
}

function writeStore(data: CompanyBOQRecord[]) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8')
}

export function listCompanyBOQs(): Omit<CompanyBOQRecord, 'items'>[] {
  return readStore().map(({ items: _items, ...rest }) => rest).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function getCompanyBOQ(id: string): CompanyBOQRecord | null {
  return readStore().find(r => r.id === id) ?? null
}

export function createCompanyBOQ(data: Omit<CompanyBOQRecord, 'id' | 'created_at' | 'updated_at'>): CompanyBOQRecord {
  const records = readStore()
  const now = new Date().toISOString()
  const record: CompanyBOQRecord = { ...data, id: crypto.randomUUID(), created_at: now, updated_at: now }
  records.push(record)
  writeStore(records)
  return record
}

export function updateCompanyBOQ(id: string, data: Partial<Omit<CompanyBOQRecord, 'id' | 'created_at'>>): CompanyBOQRecord | null {
  const records = readStore()
  const idx = records.findIndex(r => r.id === id)
  if (idx === -1) return null
  records[idx] = { ...records[idx], ...data, updated_at: new Date().toISOString() }
  writeStore(records)
  return records[idx]
}

export function deleteCompanyBOQ(id: string): boolean {
  const records = readStore()
  const filtered = records.filter(r => r.id !== id)
  if (filtered.length === records.length) return false
  writeStore(filtered)
  return true
}
