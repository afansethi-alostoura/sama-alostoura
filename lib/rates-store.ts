import fs from 'fs'
import path from 'path'
import { RateLibraryItem } from '@/types'

const RATES_FILE = path.join(process.cwd(), '.rates-data.json')
const USE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

// File-based storage (fallback for local dev)
function readRates(): RateLibraryItem[] {
  try {
    if (!fs.existsSync(RATES_FILE)) {
      return []
    }
    const data = fs.readFileSync(RATES_FILE, 'utf-8')
    return JSON.parse(data) as RateLibraryItem[]
  } catch {
    return []
  }
}

function writeRates(data: RateLibraryItem[]): void {
  fs.writeFileSync(RATES_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// Supabase functions
async function getSupabaseClient() {
  if (!USE_SUPABASE) {
    throw new Error('Supabase not configured')
  }
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase credentials')
  return createClient(url, key)
}

async function getAllRatesFromSupabase(): Promise<RateLibraryItem[]> {
  try {
    const supabase = await getSupabaseClient()
    const { data, error } = await supabase
      .from('rate_library')
      .select('*')

    if (error) throw error
    return (data || []).map(r => ({
      id: r.id,
      description: r.description,
      unit: r.unit,
      unitRate: r.unit_rate,
      category: r.category,
      notes: r.notes
    }))
  } catch (error) {
    console.error('Error fetching rates from Supabase:', error)
    console.log('Falling back to file storage')
    return readRates()
  }
}

export async function getAllRates(): Promise<RateLibraryItem[]> {
  if (USE_SUPABASE) {
    return getAllRatesFromSupabase()
  }
  return readRates()
}

export async function getRatesByCategory(category: string): Promise<RateLibraryItem[]> {
  const all = await getAllRates()
  return all.filter(r => r.category.toLowerCase() === category.toLowerCase())
}

export async function getRateByDescription(description: string): Promise<RateLibraryItem | undefined> {
  const all = await getAllRates()
  return all.find(r => r.description.toLowerCase() === description.toLowerCase())
}

export async function addRate(rate: Omit<RateLibraryItem, 'id'>): Promise<RateLibraryItem> {
  const newRate: RateLibraryItem = {
    ...rate,
    id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  if (USE_SUPABASE) {
    try {
      const supabase = await getSupabaseClient()
      await supabase.from('rate_library').insert({
        id: newRate.id,
        description: newRate.description,
        unit: newRate.unit,
        unit_rate: newRate.unitRate,
        category: newRate.category,
        notes: newRate.notes
      })
    } catch (error) {
      console.error('Error adding rate to Supabase:', error)
      // Fall back to file storage
    }
  } else {
    const all = await getAllRates()
    all.push(newRate)
    writeRates(all)
  }
  return newRate
}

export async function updateRate(id: string, updates: Partial<RateLibraryItem>): Promise<RateLibraryItem | null> {
  const all = await getAllRates()
  const existing = all.find(r => r.id === id)
  if (!existing) return null

  const updated = { ...existing, ...updates, id }

  if (USE_SUPABASE) {
    try {
      const supabase = await getSupabaseClient()
      await supabase.from('rate_library').update({
        description: updated.description,
        unit: updated.unit,
        unit_rate: updated.unitRate,
        category: updated.category,
        notes: updated.notes
      }).eq('id', id)
    } catch (error) {
      console.error('Error updating rate in Supabase:', error)
    }
  } else {
    const index = all.findIndex(r => r.id === id)
    if (index !== -1) {
      all[index] = updated
      writeRates(all)
    }
  }
  return updated
}

export async function deleteRate(id: string): Promise<boolean> {
  if (USE_SUPABASE) {
    try {
      const supabase = await getSupabaseClient()
      const { error } = await supabase.from('rate_library').delete().eq('id', id)
      return !error
    } catch (error) {
      console.error('Error deleting rate from Supabase:', error)
      return false
    }
  } else {
    const all = await getAllRates()
    const filtered = all.filter(r => r.id !== id)
    if (filtered.length === all.length) return false
    writeRates(filtered)
    return true
  }
}

export async function getCategoriesList(): Promise<string[]> {
  const all = await getAllRates()
  const categories = [...new Set(all.map(r => r.category))]
  return categories.sort()
}

// Seed rates from array (useful for initialization)
export async function seedRates(rates: Omit<RateLibraryItem, 'id'>[]): Promise<void> {
  const existing = await getAllRates()
  if (existing.length > 0) {
    console.log('Rates already exist, skipping seed')
    return
  }

  const newRates: RateLibraryItem[] = rates.map(r => ({
    ...r,
    id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }))

  if (USE_SUPABASE) {
    try {
      const supabase = await getSupabaseClient()
      await supabase.from('rate_library').insert(
        newRates.map(r => ({
          id: r.id,
          description: r.description,
          unit: r.unit,
          unit_rate: r.unitRate,
          category: r.category,
          notes: r.notes
        }))
      )
    } catch (error) {
      console.error('Error seeding rates to Supabase:', error)
      writeRates(newRates)
    }
  } else {
    writeRates(newRates)
  }
}
