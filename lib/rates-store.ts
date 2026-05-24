import { RateLibraryItem } from '@/types'
import { readStore, writeStore } from './projects-store'

const RATES_FILE = '.rates-data.json'

export async function getAllRates(): Promise<RateLibraryItem[]> {
  const data = await readStore<RateLibraryItem[]>(RATES_FILE, [])
  return data
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
  const all = await getAllRates()
  const newRate: RateLibraryItem = {
    ...rate,
    id: `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  all.push(newRate)
  await writeStore(RATES_FILE, all)
  return newRate
}

export async function updateRate(id: string, updates: Partial<RateLibraryItem>): Promise<RateLibraryItem | null> {
  const all = await getAllRates()
  const index = all.findIndex(r => r.id === id)
  if (index === -1) return null

  const updated = { ...all[index], ...updates, id }
  all[index] = updated
  await writeStore(RATES_FILE, all)
  return updated
}

export async function deleteRate(id: string): Promise<boolean> {
  const all = await getAllRates()
  const filtered = all.filter(r => r.id !== id)
  if (filtered.length === all.length) return false
  await writeStore(RATES_FILE, filtered)
  return true
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

  await writeStore(RATES_FILE, newRates)
}
