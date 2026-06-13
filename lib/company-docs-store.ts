import fs   from 'fs'
import path from 'path'

export interface StoredCompanyDoc {
  id:                 string
  name:               string   // "Trade License", "ISO 9001", etc.
  category:           string   // "License" | "Insurance" | "Certificate" | "Permit" | "Other"
  issuing_authority:  string   // "DED", "Dubai Municipality", etc.
  doc_number:         string | null
  issue_date:         string | null  // YYYY-MM-DD
  expiry_date:        string | null  // YYYY-MM-DD  (null = no expiry)
  reminder_days:      number         // highlight this many days before expiry
  notes:              string | null
  created_at:         string
  updated_at:         string
}

const FILE = path.join(process.cwd(), '.company-docs-data.json')

const DEFAULTS: Omit<StoredCompanyDoc, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Trade License',                  category: 'License',     issuing_authority: 'DED',                   doc_number: null, issue_date: null, expiry_date: null, reminder_days: 60, notes: null },
  { name: 'Chamber of Commerce',            category: 'Certificate', issuing_authority: 'Dubai Chamber',         doc_number: null, issue_date: null, expiry_date: null, reminder_days: 60, notes: null },
  { name: 'Contractor Classification',      category: 'License',     issuing_authority: 'Dubai Municipality',    doc_number: null, issue_date: null, expiry_date: null, reminder_days: 90, notes: null },
  { name: 'Civil Defence Certificate',      category: 'Certificate', issuing_authority: 'Civil Defence',         doc_number: null, issue_date: null, expiry_date: null, reminder_days: 60, notes: null },
  { name: 'Workers Compensation Insurance', category: 'Insurance',   issuing_authority: 'Insurance Company',     doc_number: null, issue_date: null, expiry_date: null, reminder_days: 30, notes: null },
  { name: 'General Liability Insurance',    category: 'Insurance',   issuing_authority: 'Insurance Company',     doc_number: null, issue_date: null, expiry_date: null, reminder_days: 30, notes: null },
]

function readStore(): StoredCompanyDoc[] {
  try {
    if (!fs.existsSync(FILE)) return []
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as StoredCompanyDoc[]
  } catch { return [] }
}

function writeStore(docs: StoredCompanyDoc[]): void {
  fs.writeFileSync(FILE, JSON.stringify(docs, null, 2), 'utf-8')
}

export function getAllCompanyDocs(): StoredCompanyDoc[] {
  const stored = readStore()
  if (stored.length === 0) {
    // seed defaults on first load
    const now  = new Date().toISOString()
    const seeded = DEFAULTS.map((d, i) => ({ ...d, id: `cdoc-${i + 1}`, created_at: now, updated_at: now }))
    writeStore(seeded)
    return seeded
  }
  return stored.sort((a, b) => a.name.localeCompare(b.name))
}

export function createCompanyDoc(data: Omit<StoredCompanyDoc, 'id' | 'created_at' | 'updated_at'>): StoredCompanyDoc {
  const all = readStore()
  const now  = new Date().toISOString()
  const doc: StoredCompanyDoc = { ...data, id: `cdoc-${Date.now()}`, created_at: now, updated_at: now }
  all.push(doc)
  writeStore(all)
  return doc
}

export function updateCompanyDoc(id: string, updates: Partial<StoredCompanyDoc>): StoredCompanyDoc | null {
  const all = readStore()
  const idx  = all.findIndex(d => d.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...updates, id, updated_at: new Date().toISOString() }
  writeStore(all)
  return all[idx]
}

export function deleteCompanyDoc(id: string): boolean {
  const all      = readStore()
  const filtered = all.filter(d => d.id !== id)
  if (filtered.length === all.length) return false
  writeStore(filtered)
  return true
}
