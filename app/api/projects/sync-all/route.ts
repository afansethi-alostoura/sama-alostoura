/**
 * POST /api/projects/sync-all
 *
 * One-shot sync for all projects:
 *  1. BOQ progress  — for each project with company_boq_id, reads BOQ items
 *     from Supabase, computes weighted progress_percent, and saves it.
 *  2. QB financials — for each project with qb_class_name, fetches
 *     income (Deposits) + expenses (Purchases + Bills) from QuickBooks and
 *     saves received_amount + total_expenses.
 *
 * Called by the "Sync All" button on the CEO Dashboard.
 */
import { NextResponse }                   from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { loadTokensAsync }                from '@/lib/quickbooks/tokens'
import {
  fetchPurchasesInRange,
  fetchBillsInRange,
  fetchVendorCreditsInRange,
}                                         from '@/lib/quickbooks/client'
import { getAllOverrides, saveOverride }   from '@/lib/project-overrides'
import { getAllStoredProjects }            from '@/lib/projects-store'
import { getAllStoredFromSupabase }        from '@/lib/project-overrides'
import { saveProgress }                   from '@/lib/project-progress'
import type { QBClass, QBDeposit, QBPurchase, QBBill, QBVendorCredit } from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ── Helpers ───────────────────────────────────────────────────────────────────
const EXPENSE_LINE_TYPES = new Set(['AccountBasedExpenseLineDetail', 'ItemBasedExpenseLineDetail'])

function resolveClass(
  lineRef:   { value: string; name: string } | undefined,
  headerRef: { value: string; name: string } | undefined,
): { id: string; name: string } | null {
  const ref = lineRef ?? headerRef
  return ref ? { id: ref.value, name: ref.name } : null
}

async function fetchDeposits(t: { access_token: string; realm_id: string }): Promise<QBDeposit[]> {
  const BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
  const PAGE = 1000; const all: QBDeposit[] = []; let pos = 1
  while (true) {
    const q = `SELECT * FROM Deposit ORDERBY TxnDate ASC MAXRESULTS ${PAGE} STARTPOSITION ${pos}`
    const res = await fetch(`${BASE}/${t.realm_id}/query?query=${encodeURIComponent(q)}&minorversion=70`, {
      headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json' },
    })
    if (!res.ok) break
    const data = await res.json()
    const rows = (data?.QueryResponse?.Deposit as QBDeposit[] | undefined) ?? []
    all.push(...rows); if (rows.length < PAGE) break; pos += PAGE
  }
  return all
}

function computeBOQProgress(items: any[]): number {
  const totalAmt = items.reduce((s: number, i: any) => s + (i.qty || 0) * (i.rate || 0), 0)
  if (totalAmt === 0) return 0
  const done = items.reduce((s: number, i: any) => s + (i.qty || 0) * (i.rate || 0) * ((i.progress || 0) / 100), 0)
  return Math.round((done / totalAmt) * 100)
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST() {
  const results: { boqSynced: string[]; qbSynced: string[]; errors: string[] } = {
    boqSynced: [], qbSynced: [], errors: [],
  }

  // ── Load all projects (file + Supabase) ───────────────────────────────────
  const [fileProjects, supabaseProjects, overrides] = await Promise.all([
    Promise.resolve(getAllStoredProjects()),
    getAllStoredFromSupabase(),
    getAllOverrides(),
  ])
  const fileIds = new Set(fileProjects.map((p: any) => p.id))
  const allProjects = [
    ...fileProjects,
    ...supabaseProjects.filter((p: any) => !fileIds.has(p.id)),
  ].map((p: any) => ({ ...p, ...(overrides[p.id] ?? {}) }))

  // ── 1. BOQ Progress sync ──────────────────────────────────────────────────
  if (isSupabaseConfigured() && supabaseAdmin) {
    const boqProjects = allProjects.filter((p: any) => p.company_boq_id)
    if (boqProjects.length > 0) {
      const boqIds = boqProjects.map((p: any) => p.company_boq_id)
      const { data: boqRows } = await supabaseAdmin
        .from('company_boq')
        .select('id, items')
        .in('id', boqIds)

      for (const row of (boqRows ?? [])) {
        const project = boqProjects.find((p: any) => p.company_boq_id === row.id)
        if (!project) continue
        try {
          const items = Array.isArray(row.items) ? row.items : []
          const newPct = computeBOQProgress(items)
          await saveProgress(project.id, newPct, project.current_stage ?? '', [])
          results.boqSynced.push(`${project.name} → ${newPct}%`)
        } catch (e) {
          results.errors.push(`BOQ ${project.name}: ${e}`)
        }
      }
    }
  }

  // ── 2. QB Financials sync ─────────────────────────────────────────────────
  const tokens = await loadTokensAsync()
  if (tokens) {
    const t = { access_token: tokens.access_token, realm_id: tokens.realm_id }

    // Load QB classes list for ID resolution
    let classNameById = new Map<string, string>()
    const classIdByName = new Map<string, string>()
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data } = await supabaseAdmin.from('qb_snapshot').select('classes').eq('id', 1).single()
      const classes: QBClass[] = (data?.classes ?? []) as QBClass[]
      for (const c of classes) {
        const fullName = c.FullyQualifiedName ?? c.Name
        classNameById.set(c.Id, fullName)
        classIdByName.set(fullName.toLowerCase(), c.Id)
        classIdByName.set(c.Name.toLowerCase(), c.Id)
      }
    }

    // Fetch all QB data once
    const [deposits, purchases, bills, vendorCredits] = await Promise.all([
      fetchDeposits(t),
      fetchPurchasesInRange(null, null),
      fetchBillsInRange(null, null),
      fetchVendorCreditsInRange(null, null),
    ])

    // Build income map: classId → total income
    const incomeByClassId  = new Map<string, number>()
    const expenseByClassId = new Map<string, number>()

    for (const dep of deposits) {
      for (const line of dep.Line ?? []) {
        if (line.DetailType !== 'DepositLineDetail') continue
        const detail = line.DepositLineDetail
        if (!detail) continue
        const cls = resolveClass(detail.ClassRef, undefined)
        if (!cls) continue
        incomeByClassId.set(cls.id, (incomeByClassId.get(cls.id) ?? 0) + (line.Amount ?? 0))
      }
    }

    for (const p of purchases as QBPurchase[]) {
      for (const line of p.Line ?? []) {
        if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
        const amount = line.Amount ?? 0; if (amount <= 0) continue
        const abd = line.AccountBasedExpenseLineDetail; const ibd = line.ItemBasedExpenseLineDetail
        const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, p.ClassRef)
        if (!cls) continue
        expenseByClassId.set(cls.id, (expenseByClassId.get(cls.id) ?? 0) + amount)
      }
    }
    for (const b of bills as QBBill[]) {
      for (const line of b.Line ?? []) {
        if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
        const amount = line.Amount ?? 0; if (amount <= 0) continue
        const abd = line.AccountBasedExpenseLineDetail; const ibd = line.ItemBasedExpenseLineDetail
        const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, b.ClassRef)
        if (!cls) continue
        expenseByClassId.set(cls.id, (expenseByClassId.get(cls.id) ?? 0) + amount)
      }
    }
    for (const vc of vendorCredits as QBVendorCredit[]) {
      for (const line of vc.Line ?? []) {
        if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
        const amount = line.Amount ?? 0; if (amount <= 0) continue
        const abd = line.AccountBasedExpenseLineDetail; const ibd = line.ItemBasedExpenseLineDetail
        const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, vc.ClassRef)
        if (!cls) continue
        // Credits reduce expenses
        expenseByClassId.set(cls.id, (expenseByClassId.get(cls.id) ?? 0) - amount)
      }
    }

    // Save per-project
    const qbProjects = allProjects.filter((p: any) => p.qb_class_name)
    for (const project of qbProjects) {
      const cls      = (project as any).qb_class_name as string
      const classId  = classIdByName.get(cls.toLowerCase())
      if (!classId) continue

      const received = Math.round((incomeByClassId.get(classId)  ?? 0) * 100) / 100
      const expenses = Math.round((expenseByClassId.get(classId) ?? 0) * 100) / 100

      try {
        await saveOverride(project.id, { received_amount: received, total_expenses: expenses, last_qb_sync: new Date().toISOString() })
        results.qbSynced.push(`${project.name} → Income: AED ${received}, Expenses: AED ${expenses}`)
      } catch (e) {
        results.errors.push(`QB ${project.name}: ${e}`)
      }
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
