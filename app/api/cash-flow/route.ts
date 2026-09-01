/**
 * GET /api/cash-flow?classId=<QB class ID>
 *
 * Returns a chronological fund-flow timeline for a QB class (project):
 *   IN  — Invoice Payments + direct Deposits tagged to the class
 *   OUT — Purchases + Bills tagged to the class
 *
 * Also returns summary totals, per-category expense breakdown, and
 * the classes list so the client can populate the project selector.
 *
 * Data sources:
 *   - invoices / payments / purchases / bills  → Supabase qb_snapshot
 *   - deposits                                 → QB API live (not in snapshot)
 */
import { NextResponse }                     from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { loadTokensAsync }                  from '@/lib/quickbooks/tokens'
import type {
  QBInvoice, QBPayment, QBPurchase, QBBill, QBDeposit, QBClass,
} from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FundEvent {
  id:             string
  date:           string   // YYYY-MM-DD
  type:           'deposit' | 'payment' | 'purchase' | 'bill'
  direction:      'in' | 'out'
  amount:         number
  party:          string   // customer / vendor name
  category:       string   // account / expense type
  ref:            string   // doc number or payment ref
  bank:           string   // bank account name
  classId:        string
  className:      string
  runningBalance: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const QB_BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com/v3/company'
  : 'https://sandbox-quickbooks.api.intuit.com/v3/company'

async function fetchDeposits(t: { access_token: string; realm_id: string }): Promise<QBDeposit[]> {
  const all: QBDeposit[] = []; let pos = 1
  while (true) {
    const q   = `SELECT * FROM Deposit ORDERBY TxnDate ASC MAXRESULTS 1000 STARTPOSITION ${pos}`
    const res = await fetch(`${QB_BASE}/${t.realm_id}/query?query=${encodeURIComponent(q)}&minorversion=70`, {
      headers: { Authorization: `Bearer ${t.access_token}`, Accept: 'application/json' },
    })
    if (!res.ok) break
    const rows = (await res.json())?.QueryResponse?.Deposit as QBDeposit[] | undefined ?? []
    all.push(...rows); if (rows.length < 1000) break; pos += 1000
  }
  return all
}

const EXPENSE_TYPES = new Set(['AccountBasedExpenseLineDetail', 'ItemBasedExpenseLineDetail'])

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const filterClassId = new URL(req.url).searchParams.get('classId') ?? ''

  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin
    .from('qb_snapshot')
    .select('invoices, payments, purchases, bills, classes, synced_at')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'No QB snapshot found. Run a QB sync first from Accounting → Sync QuickBooks.' },
      { status: 404 },
    )
  }

  const invoices  = (data.invoices  ?? []) as QBInvoice[]
  const payments  = (data.payments  ?? []) as QBPayment[]
  const purchases = (data.purchases ?? []) as QBPurchase[]
  const bills     = (data.bills     ?? []) as QBBill[]
  const classes   = (data.classes   ?? []) as QBClass[]

  // Build invoice ID → class ref map (header first, then line-level fallback)
  const invClassMap = new Map<string, { value: string; name: string }>()
  for (const inv of invoices) {
    let cls = inv.ClassRef ?? null
    if (!cls) {
      for (const line of inv.Line ?? []) {
        cls = line.SalesItemLineDetail?.ClassRef ?? null
        if (cls) break
      }
    }
    if (cls) invClassMap.set(inv.Id, cls)
  }

  const events: Omit<FundEvent, 'runningBalance'>[] = []

  // ── Income: QB Payments (linked to Invoices → class) ─────────────────────
  for (const pmt of payments) {
    let cls: { value: string; name: string } | null = null
    outer: for (const line of pmt.Line ?? []) {
      for (const link of line.LinkedTxn ?? []) {
        if (link.TxnType === 'Invoice') { cls = invClassMap.get(link.TxnId) ?? null; break outer }
      }
    }
    if (!cls) continue
    if (filterClassId && cls.value !== filterClassId) continue
    events.push({
      id:        `pmt-${pmt.Id}`,
      date:      pmt.TxnDate,
      type:      'payment',
      direction: 'in',
      amount:    pmt.TotalAmt ?? 0,
      party:     pmt.CustomerRef?.name ?? '',
      category:  'Invoice Payment',
      ref:       pmt.PaymentRefNum ?? '',
      bank:      pmt.DepositToAccountRef?.name ?? '',
      classId:   cls.value,
      className: cls.name,
    })
  }

  // ── Income: Direct Deposits from QB API ───────────────────────────────────
  const tokens = await loadTokensAsync()
  if (tokens) {
    const deposits = await fetchDeposits(tokens).catch(() => [])
    for (const dep of deposits) {
      for (const line of dep.Line ?? []) {
        if (line.DetailType !== 'DepositLineDetail') continue
        const detail = line.DepositLineDetail
        if (!detail?.ClassRef) continue
        const cls = detail.ClassRef
        if (filterClassId && cls.value !== filterClassId) continue
        const amount = line.Amount ?? 0
        if (amount <= 0) continue
        events.push({
          id:        `dep-${dep.Id}-${line.Id ?? '0'}`,
          date:      dep.TxnDate,
          type:      'deposit',
          direction: 'in',
          amount,
          party:     detail.EntityRef?.name ?? 'Client',
          category:  detail.AccountRef?.name ?? 'Bank Deposit',
          ref:       (dep as any).DocNumber ?? '',
          bank:      dep.DepositToAccountRef?.name ?? '',
          classId:   cls.value,
          className: cls.name,
        })
      }
    }
  }

  // ── Expenses: Purchases (aggregated per transaction × class) ─────────────
  const purMap = new Map<string, Omit<FundEvent, 'runningBalance'>>()
  for (const p of purchases) {
    for (const line of p.Line ?? []) {
      if (!EXPENSE_TYPES.has(line.DetailType)) continue
      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = abd?.ClassRef ?? ibd?.ClassRef ?? p.ClassRef ?? null
      if (!cls) continue
      if (filterClassId && cls.value !== filterClassId) continue
      const amount = line.Amount ?? 0
      if (amount <= 0) continue
      const key = `pur-${p.Id}-${cls.value}`
      const ex  = purMap.get(key)
      if (ex) { ex.amount += amount } else {
        purMap.set(key, {
          id: key, date: p.TxnDate, type: 'purchase', direction: 'out', amount,
          party:     p.EntityRef?.name ?? 'Supplier',
          category:  abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Purchase',
          ref:       (p as any).DocNumber ?? '',
          bank:      p.AccountRef?.name ?? '',
          classId:   cls.value, className: cls.name,
        })
      }
    }
  }
  events.push(...purMap.values())

  // ── Expenses: Bills (aggregated per transaction × class) ─────────────────
  const bilMap = new Map<string, Omit<FundEvent, 'runningBalance'>>()
  for (const b of bills) {
    for (const line of b.Line ?? []) {
      if (!EXPENSE_TYPES.has(line.DetailType)) continue
      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = abd?.ClassRef ?? ibd?.ClassRef ?? b.ClassRef ?? null
      if (!cls) continue
      if (filterClassId && cls.value !== filterClassId) continue
      const amount = line.Amount ?? 0
      if (amount <= 0) continue
      const key = `bil-${b.Id}-${cls.value}`
      const ex  = bilMap.get(key)
      if (ex) { ex.amount += amount } else {
        bilMap.set(key, {
          id: key, date: b.TxnDate, type: 'bill', direction: 'out', amount,
          party:     b.VendorRef?.name ?? 'Vendor',
          category:  abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Bill',
          ref:       (b as any).DocNumber ?? '',
          bank:      '',
          classId:   cls.value, className: cls.name,
        })
      }
    }
  }
  events.push(...bilMap.values())

  // Sort: by date asc, income before expenses on same day
  events.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.direction === 'in' ? -1 : 1) - (b.direction === 'in' ? -1 : 1)
  )

  // Running balance
  let balance = 0
  const eventsWithBalance: FundEvent[] = events.map(e => {
    balance += e.direction === 'in' ? e.amount : -e.amount
    return { ...e, runningBalance: Math.round(balance * 100) / 100 }
  })

  const totalIn  = events.filter(e => e.direction === 'in' ).reduce((s, e) => s + e.amount, 0)
  const totalOut = events.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0)

  // Category breakdown (expenses only, sorted largest first)
  const catMap = new Map<string, number>()
  events.filter(e => e.direction === 'out').forEach(e => {
    const cat = e.category || 'Other'
    catMap.set(cat, (catMap.get(cat) ?? 0) + e.amount)
  })
  const byCategory = [...catMap.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    classId: filterClassId,
    events:  eventsWithBalance,
    summary: {
      totalIn:  Math.round(totalIn  * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      balance:  Math.round(balance  * 100) / 100,
      txnCount: events.length,
    },
    byCategory,
    classes,
    synced_at: data.synced_at ?? null,
  })
}
