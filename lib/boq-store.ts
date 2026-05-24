'use server'

import { BOQ, BOQItem } from '@/types'
import { readStore, writeStore } from './projects-store'

const BOQS_FILE = '.boq-data.json'

export async function getAllBOQs(): Promise<BOQ[]> {
  const data = await readStore<BOQ[]>(BOQS_FILE, [])
  return data
}

export async function getBOQsByProjectId(projectId: string): Promise<BOQ[]> {
  const all = await getAllBOQs()
  return all.filter(b => b.projectId === projectId)
}

export async function getBOQ(id: string): Promise<BOQ | null> {
  const all = await getAllBOQs()
  return all.find(b => b.id === id) || null
}

export async function createBOQ(boq: Omit<BOQ, 'id' | 'createdAt' | 'updatedAt'>): Promise<BOQ> {
  const all = await getAllBOQs()
  const now = new Date().toISOString()
  const newBOQ: BOQ = {
    ...boq,
    id: `boq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: now,
    updatedAt: now
  }
  all.push(newBOQ)
  await writeStore(BOQS_FILE, all)
  return newBOQ
}

export async function updateBOQ(id: string, updates: Partial<BOQ>): Promise<BOQ | null> {
  const all = await getAllBOQs()
  const index = all.findIndex(b => b.id === id)
  if (index === -1) return null

  const updated: BOQ = {
    ...all[index],
    ...updates,
    id,
    updatedAt: new Date().toISOString()
  }
  all[index] = updated
  await writeStore(BOQS_FILE, all)
  return updated
}

export async function updateBOQItem(boqId: string, itemId: string, updates: Partial<BOQItem>): Promise<BOQ | null> {
  const boq = await getBOQ(boqId)
  if (!boq) return null

  const itemIndex = boq.items.findIndex(i => i.id === itemId)
  if (itemIndex === -1) return null

  const item = boq.items[itemIndex]
  const updated: BOQItem = { ...item, ...updates, id: itemId }

  // Recalculate amount if qty or rate changed
  if (updates.quantity !== undefined || updates.unitRate !== undefined) {
    updated.amount = updated.quantity * updated.unitRate
  }

  boq.items[itemIndex] = updated

  // Recalculate totals
  const totals = calculateTotals(boq.items)
  boq.subtotal = totals.subtotal
  boq.total = totals.total

  return await updateBOQ(boqId, boq)
}

export async function addBOQItem(boqId: string, item: Omit<BOQItem, 'id' | 'amount'>): Promise<BOQ | null> {
  const boq = await getBOQ(boqId)
  if (!boq) return null

  const amount = item.quantity * item.unitRate
  const newItem: BOQItem = {
    ...item,
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount
  }

  boq.items.push(newItem)

  // Recalculate totals
  const totals = calculateTotals(boq.items)
  boq.subtotal = totals.subtotal
  boq.total = totals.total

  return await updateBOQ(boqId, boq)
}

export async function deleteBOQItem(boqId: string, itemId: string): Promise<BOQ | null> {
  const boq = await getBOQ(boqId)
  if (!boq) return null

  boq.items = boq.items.filter(i => i.id !== itemId)

  // Recalculate totals
  const totals = calculateTotals(boq.items)
  boq.subtotal = totals.subtotal
  boq.total = totals.total

  return await updateBOQ(boqId, boq)
}

export async function deleteBOQ(id: string): Promise<boolean> {
  const all = await getAllBOQs()
  const filtered = all.filter(b => b.id !== id)
  if (filtered.length === all.length) return false
  await writeStore(BOQS_FILE, filtered)
  return true
}

export interface TotalsResult {
  subtotal: number
  vat: number
  total: number
}

export function calculateTotals(items: BOQItem[], vatRate: number = 0.05): TotalsResult {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const vat = subtotal * vatRate
  const total = subtotal + vat

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    total: Math.round(total * 100) / 100
  }
}

export function calculateSectionSubtotal(items: BOQItem[], section: string): number {
  return items
    .filter(i => i.section === section)
    .reduce((sum, item) => sum + item.amount, 0)
}

export function groupBySection(items: BOQItem[]): Record<string, BOQItem[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = []
    }
    acc[item.section].push(item)
    return acc
  }, {} as Record<string, BOQItem[]>)
}
