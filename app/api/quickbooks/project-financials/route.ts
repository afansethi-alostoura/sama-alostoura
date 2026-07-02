/**
 * GET /api/quickbooks/project-financials?class_name=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a per-project financial summary filtered to the QB class that matches
 * `class_name`.  Uses the same class-ID resolution logic as /api/quickbooks/classes
 * so every transaction tagged to this class is captured.
 */
import { NextResponse }                                              from 'next/server'
import { supabaseAdmin, isSupabaseConfigured }                       from '@/lib/supabase'
import { loadTokensAsync }                                           from '@/lib/quickbooks/tokens'
import {
  fetchPurchasesInRange,
  fetchBillsInRange,
  fetchVendorCreditsInRange,
}                                                                    from '@/lib/quickbooks/client'
import type { QBClass, QBDeposit, QBPurchase, QBBill, QBVendorCredit } from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300

// ── Only these DetailTypes carry real expense amounts ─────────────────────────
const EXPENSE_LINE_TYPES = new Set([
  'AccountBasedExpenseLineDetail',
  'ItemBasedExpenseLineDetail',
])

// ── Resolve class from line-level ref first, then header-level fallback ───────
function resolveClass(
  lineRef:   { value: string; name: string } | undefined,
  headerRef: { value: string; name: string } | undefined,
): { id: string; name: string } | null {
  const ref = lineRef ?? headerRef
  return ref ? { id: ref.value, name: ref.name } : null
}

// ── Inline QB paginated query for Deposit (no helper in client.ts) ────────────
async function fetchDeposits(
  tokens: { access_token: string; realm_id: string },
): Promise<QBDeposit[]> {
  const BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
  const PAGE = 1000
  const all: QBDeposit[] = []
  let pos = 1
  while (true) {
    const q   = `SELECT * FROM Deposit ORDERBY TxnDate ASC MAXRESULTS ${PAGE} STARTPOSITION ${pos}`
    const url = `${BASE}/${tokens.realm_id}/query?query=${encodeURIComponent(q)}&minorversion=70`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`QB Deposit query failed (${res.status}): ${await res.text()}`)
    const data = await res.json()
    const rows = (data?.QueryResponse?.Deposit as QBDeposit[] | undefined) ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
    pos += PAGE
  }
  return all
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
  const { searchParams } = new URL(req.url)
  const rawClass  = searchParams.get('class_name')?.trim()
  const from      = searchParams.get('from') || null
  const to        = searchParams.get('to')   || null

  if (!rawClass) {
    return NextResponse.json({ error: 'class_name is required' }, { status: 400 })
  }
  const className: string = rawClass

  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json(
      { error: 'QuickBooks not connected. Go to Settings → Connect QB.' },
      { status: 401 },
    )
  }

  // ── Load classes list from Supabase snapshot (needed for ID→name lookup) ─────
  let classNameById = new Map<string, string>()
  let targetClassId: string | null = null

  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('qb_snapshot')
      .select('classes')
      .eq('id', 1)
      .single()

    const classes: QBClass[] = (data?.classes ?? []) as QBClass[]
    for (const c of classes) {
      const fullName = c.FullyQualifiedName ?? c.Name
      classNameById.set(c.Id, fullName)
      // Find the ID for the requested class name
      if (
        fullName === className ||
        c.Name   === className ||
        fullName.toLowerCase() === className.toLowerCase() ||
        c.Name.toLowerCase()  === className.toLowerCase()
      ) {
        targetClassId = c.Id
      }
    }
  }

  const t = { access_token: tokens.access_token, realm_id: tokens.realm_id }

  // Fetch all transaction types in parallel
  const [deposits, purchases, bills, vendorCredits] = await Promise.all([
    fetchDeposits(t),
    fetchPurchasesInRange(from, to),
    fetchBillsInRange(from, to),
    fetchVendorCreditsInRange(from, to),
  ])

  // ── Helper: does a resolved class match our target? ───────────────────────────
  function isTargetClass(cls: { id: string; name: string } | null): boolean {
    if (!cls) return false
    // Match by ID (most reliable) if we found the target ID
    if (targetClassId && cls.id === targetClassId) return true
    // Fallback: match by resolved name (case-insensitive)
    const resolvedName = classNameById.get(cls.id) ?? cls.name
    return (
      resolvedName === className ||
      resolvedName.toLowerCase() === className.toLowerCase()
    )
  }

  // ── Income: Deposit lines tagged to this class ─────────────────────────────
  interface IncomeTransaction {
    id: string; date: string; description: string; reference: string; amount: number; account: string
  }
  const incomeTransactions: IncomeTransaction[] = []

  for (const dep of deposits) {
    for (const line of dep.Line ?? []) {
      if (line.DetailType !== 'DepositLineDetail') continue
      const detail = line.DepositLineDetail
      if (!detail) continue

      // Deposits tag class on the DepositLineDetail.ClassRef
      const cls = resolveClass(detail.ClassRef, undefined)
      if (!isTargetClass(cls)) continue

      incomeTransactions.push({
        id:          `${dep.Id}_${line.Id ?? ''}`,
        date:        dep.TxnDate,
        description: detail.AccountRef?.name ?? 'Project Income',
        reference:   dep.Id,
        amount:      line.Amount ?? 0,
        account:     detail.AccountRef?.name ?? 'Project Income',
      })
    }
  }

  const totalIncome = incomeTransactions.reduce((s, tx) => s + tx.amount, 0)

  // ── Expenses: Purchases + Bills grouped by account/category ───────────────
  interface ExpenseTransaction {
    id: string; date: string; vendor: string; description: string; reference: string; amount: number; type: string; account: string
  }
  interface CategoryGroup { total: number; transactions: ExpenseTransaction[] }
  const expensesByCategory: Record<string, CategoryGroup> = {}

  function addExpense(
    date: string, vendor: string, desc: string, ref: string,
    amount: number, account: string, type: string,
  ) {
    const cat = account || 'Uncategorized'
    if (!expensesByCategory[cat]) expensesByCategory[cat] = { total: 0, transactions: [] }
    expensesByCategory[cat].total += amount
    expensesByCategory[cat].transactions.push({
      id: `${ref}_${cat}_${date}_${Math.random()}`,
      date, vendor, description: desc, reference: ref, amount, type, account: cat,
    })
  }

  // Purchases
  for (const p of purchases as QBPurchase[]) {
    for (const line of p.Line ?? []) {
      if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, p.ClassRef)
      if (!isTargetClass(cls)) continue

      const account = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'
      addExpense(
        p.TxnDate,
        p.EntityRef?.name ?? '',
        line.Description ?? p.PrivateNote ?? '',
        p.Id,
        amount,
        account,
        'purchase',
      )
    }
  }

  // Bills
  for (const b of bills as QBBill[]) {
    for (const line of b.Line ?? []) {
      if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, b.ClassRef)
      if (!isTargetClass(cls)) continue

      const account = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'
      addExpense(
        b.TxnDate,
        b.VendorRef?.name ?? '',
        line.Description ?? b.PrivateNote ?? '',
        b.Id,
        amount,
        account,
        'bill',
      )
    }
  }

  // Vendor Credits (subtract from totals)
  for (const vc of vendorCredits as QBVendorCredit[]) {
    for (const line of vc.Line ?? []) {
      if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, vc.ClassRef)
      if (!isTargetClass(cls)) continue

      const account = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'
      addExpense(
        vc.TxnDate,
        vc.VendorRef?.name ?? '',
        line.Description ?? vc.PrivateNote ?? '',
        vc.Id,
        -amount,   // negative — reduces category total
        account,
        'vendor_credit',
      )
    }
  }

  // Sort categories by absolute total descending; sort transactions by date
  const sortedCategories = Object.fromEntries(
    Object.entries(expensesByCategory)
      .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
      .map(([k, v]) => [k, {
        ...v,
        transactions: v.transactions.sort((a, b) => a.date.localeCompare(b.date)),
      }]),
  )

  const totalExpenses = Object.values(expensesByCategory).reduce((s, g) => s + g.total, 0)

  return NextResponse.json({
    class_name: className,
    income: {
      total:        totalIncome,
      transactions: incomeTransactions.sort((a, b) => a.date.localeCompare(b.date)),
    },
    expenses: {
      total:      totalExpenses,
      byCategory: sortedCategories,
    },
    summary: {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
    },
    fetchedAt: new Date().toISOString(),
  })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[project-financials]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
