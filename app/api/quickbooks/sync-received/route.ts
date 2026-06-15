/**
 * POST /api/quickbooks/sync-received
 *
 * For each project that has qb_class_name set, pulls from QB:
 *   - Income  : Deposit lines where account = "Project Income" tagged to that class
 *   - Expenses: Purchase + Bill lines tagged to that class
 *
 * Updates received_amount, total_expenses, and last_qb_sync on each project.
 * Projects without qb_class_name are skipped (listed in "unlinked").
 */
import { NextResponse }                from 'next/server'
import { loadTokensAsync }             from '@/lib/quickbooks/tokens'
import { fetchPurchases, fetchBills }  from '@/lib/quickbooks/client'
import { getAllStoredProjects, updateStoredProject } from '@/lib/projects-store'
import { getAllOverrides, saveOverride } from '@/lib/project-overrides'
import type { QBDeposit, QBPurchase, QBBill } from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ── Inline QB paginated query (for Deposit which has no helper yet) ───────────
async function qbGetAll<T>(
  tokens: { access_token: string; realm_id: string },
  sql: string,
  entity: string,
): Promise<T[]> {
  const BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'

  const PAGE = 1000
  const all: T[] = []
  let pos = 1
  while (true) {
    const q   = `${sql} MAXRESULTS ${PAGE} STARTPOSITION ${pos}`
    const url = `${BASE}/${tokens.realm_id}/query?query=${encodeURIComponent(q)}&minorversion=70`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`QB query failed (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const rows = (data?.QueryResponse?.[entity] as T[] | undefined) ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
    pos += PAGE
  }
  return all
}

const EXPENSE_LINE_TYPES = new Set([
  'AccountBasedExpenseLineDetail',
  'ItemBasedExpenseLineDetail',
])

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json(
      { error: 'QuickBooks not connected. Go to Settings → Connect QB.' },
      { status: 401 },
    )
  }

  try {
    const t = { access_token: tokens.access_token, realm_id: tokens.realm_id }

    // Fetch all QB data in parallel
    const [deposits, purchases, bills] = await Promise.all([
      qbGetAll<QBDeposit>(t, 'SELECT * FROM Deposit ORDERBY TxnDate DESC', 'Deposit'),
      fetchPurchases(),
      fetchBills(),
    ])

    // ── Build income map: className → total received ──────────────────────────
    const incomeByClass = new Map<string, number>()
    for (const dep of deposits) {
      for (const line of dep.Line ?? []) {
        if (line.DetailType !== 'DepositLineDetail') continue
        const detail = line.DepositLineDetail
        if (!detail) continue
        if (!detail.AccountRef?.name.toLowerCase().includes('project income')) continue
        const cls = detail.ClassRef?.name
        if (!cls) continue
        incomeByClass.set(cls, (incomeByClass.get(cls) ?? 0) + (line.Amount ?? 0))
      }
    }

    // ── Build expenses map: className → total expenses ────────────────────────
    const expensesByClass = new Map<string, number>()

    for (const p of purchases as QBPurchase[]) {
      for (const line of p.Line ?? []) {
        if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
        const detail = line.AccountBasedExpenseLineDetail ?? line.ItemBasedExpenseLineDetail
        if (!detail) continue
        const cls = (detail as any).ClassRef?.name
        if (!cls) continue
        expensesByClass.set(cls, (expensesByClass.get(cls) ?? 0) + (line.Amount ?? 0))
      }
    }

    for (const b of bills as QBBill[]) {
      for (const line of b.Line ?? []) {
        if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
        const detail = line.AccountBasedExpenseLineDetail ?? line.ItemBasedExpenseLineDetail
        if (!detail) continue
        const cls = (detail as any).ClassRef?.name
        if (!cls) continue
        expensesByClass.set(cls, (expensesByClass.get(cls) ?? 0) + (line.Amount ?? 0))
      }
    }

    // ── Match projects by exact qb_class_name ─────────────────────────────────
    const projects  = getAllStoredProjects()
    const overrides = await getAllOverrides()
    const now       = new Date().toISOString()

    const updated:  Array<{ project: string; class: string; received: number; expenses: number }> = []
    const skipped:  Array<{ project: string; reason: string }> = []
    const unlinked: string[] = []

    for (const project of projects) {
      // qb_class_name may be in file store or in Supabase overrides
      const over = overrides[project.id] ?? {}
      const cls  = ((over.qb_class_name ?? project.qb_class_name) as string | undefined)?.trim()
      if (!cls) {
        unlinked.push(project.name)
        continue
      }

      const received = Math.round((incomeByClass.get(cls) ?? 0) * 100) / 100
      const expenses = Math.round((expensesByClass.get(cls) ?? 0) * 100) / 100

      const currentReceived = (over.received_amount as number | undefined) ?? project.received_amount
      const currentExpenses = (over.total_expenses  as number | undefined) ?? project.total_expenses ?? 0

      if (received === currentReceived && expenses === currentExpenses) {
        skipped.push({ project: project.name, reason: 'no change' })
        continue
      }

      // Save to Supabase (Vercel-safe); also try file in dev
      await saveOverride(project.id, { received_amount: received, total_expenses: expenses, last_qb_sync: now })
      try { updateStoredProject(project.id, { received_amount: received, total_expenses: expenses, last_qb_sync: now }) } catch {}

      updated.push({ project: project.name, class: cls, received, expenses })
    }

    return NextResponse.json({
      ok:        true,
      synced_at: now,
      updated,
      skipped,
      unlinked,
      debug: {
        deposits_fetched:    deposits.length,
        purchases_fetched:   purchases.length,
        bills_fetched:       bills.length,
        income_by_class:     Object.fromEntries([...incomeByClass.entries()].map(([k, v]) => [k, Math.round(v * 100) / 100])),
        expenses_by_class:   Object.fromEntries([...expensesByClass.entries()].map(([k, v]) => [k, Math.round(v * 100) / 100])),
      },
      counts: {
        projects:  projects.length,
        updated:   updated.length,
        skipped:   skipped.length,
        unlinked:  unlinked.length,
      },
    })

  } catch (err) {
    console.error('[QB sync-received]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
