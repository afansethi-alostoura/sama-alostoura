/**
 * GET /api/quickbooks/project-financials?class_name=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a per-project financial summary grouped by QB account/category.
 * Income  = Deposit lines tagged to the QB class
 * Expenses = Purchase + Bill lines tagged to the QB class (vendor credits subtract)
 */
import { NextResponse }                from 'next/server'
import { loadTokensAsync }             from '@/lib/quickbooks/tokens'
import {
  fetchPurchasesInRange,
  fetchBillsInRange,
  fetchVendorCreditsInRange,
} from '@/lib/quickbooks/client'
import type { QBDeposit } from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 60

// ── QB paginated query (reused from sync-received) ────────────────────────────
async function qbGetAll<T>(
  tokens: { access_token: string; realm_id: string },
  sql:    string,
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

const EXPENSE_DETAIL_TYPES = new Set([
  'AccountBasedExpenseLineDetail',
  'ItemBasedExpenseLineDetail',
])

// ── Types returned to client ───────────────────────────────────────────────────
export interface IncomeTransaction {
  id:          string
  date:        string
  description: string
  reference:   string
  amount:      number
  account:     string
}

export interface ExpenseTransaction {
  id:          string
  date:        string
  vendor:      string
  description: string
  reference:   string
  amount:      number
  type:        'purchase' | 'bill' | 'vendor_credit'
  account:     string
}

export interface CategoryGroup {
  total:        number
  transactions: ExpenseTransaction[]
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const className = searchParams.get('class_name')
  const from      = searchParams.get('from') || null
  const to        = searchParams.get('to')   || null

  if (!className) {
    return NextResponse.json({ error: 'class_name is required' }, { status: 400 })
  }

  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected. Go to Settings → Connect QB.' }, { status: 401 })
  }

  const t = { access_token: tokens.access_token, realm_id: tokens.realm_id }

  // Fetch all transaction types in parallel
  const [deposits, purchases, bills, vendorCredits] = await Promise.all([
    qbGetAll<QBDeposit>(t, 'SELECT * FROM Deposit ORDERBY TxnDate ASC', 'Deposit'),
    fetchPurchasesInRange(from, to),
    fetchBillsInRange(from, to),
    fetchVendorCreditsInRange(from, to),
  ])

  // ── Income: Deposit lines tagged to this class ─────────────────────────────
  const incomeTransactions: IncomeTransaction[] = []

  for (const dep of deposits) {
    for (const line of dep.Line ?? []) {
      if (line.DetailType !== 'DepositLineDetail') continue
      const detail = line.DepositLineDetail
      if (!detail) continue
      const lineClass = detail.ClassRef?.name ?? ''
      if (lineClass !== className) continue

      incomeTransactions.push({
        id:          `${dep.Id}_${line.Id ?? ''}`,
        date:        dep.TxnDate,
        description: detail.AccountRef?.name ?? 'Project Income',
        reference:   dep.Id,
        amount:      line.Amount,
        account:     detail.AccountRef?.name ?? 'Project Income',
      })
    }
  }

  const totalIncome = incomeTransactions.reduce((s, tx) => s + tx.amount, 0)

  // ── Expenses: Purchases + Bills grouped by account/category ───────────────
  const expensesByCategory: Record<string, CategoryGroup> = {}

  function addExpense(
    date:    string,
    vendor:  string,
    desc:    string,
    ref:     string,
    amount:  number,
    account: string,
    type:    'purchase' | 'bill' | 'vendor_credit',
  ) {
    const cat = account || 'Other'
    if (!expensesByCategory[cat]) expensesByCategory[cat] = { total: 0, transactions: [] }
    expensesByCategory[cat].total += amount
    expensesByCategory[cat].transactions.push({
      id: `${ref}_${cat}_${date}`,
      date, vendor, description: desc, reference: ref, amount, type, account: cat,
    })
  }

  for (const p of purchases) {
    const headerClass = p.ClassRef?.name ?? ''
    for (const line of (p.Line ?? [])) {
      if (!EXPENSE_DETAIL_TYPES.has((line as any).DetailType ?? '')) continue
      const detail = (line as any).AccountBasedExpenseLineDetail ?? (line as any).ItemBasedExpenseLineDetail
      if (!detail) continue
      const lineClass = detail.ClassRef?.name ?? headerClass
      if (lineClass !== className) continue
      const account = detail.AccountRef?.name ?? detail.ItemRef?.name ?? 'Other'
      addExpense(
        p.TxnDate,
        (p as any).EntityRef?.name ?? '',
        (line as any).Description ?? (p as any).PrivateNote ?? '',
        p.Id,
        (line as any).Amount ?? 0,
        account,
        'purchase',
      )
    }
  }

  for (const b of bills) {
    const headerClass = (b as any).ClassRef?.name ?? ''
    for (const line of (b.Line ?? [])) {
      if (!EXPENSE_DETAIL_TYPES.has((line as any).DetailType ?? '')) continue
      const detail = (line as any).AccountBasedExpenseLineDetail ?? (line as any).ItemBasedExpenseLineDetail
      if (!detail) continue
      const lineClass = detail.ClassRef?.name ?? headerClass
      if (lineClass !== className) continue
      const account = detail.AccountRef?.name ?? detail.ItemRef?.name ?? 'Other'
      addExpense(
        b.TxnDate,
        b.VendorRef?.name ?? '',
        (line as any).Description ?? (b as any).PrivateNote ?? '',
        b.Id,
        (line as any).Amount ?? 0,
        account,
        'bill',
      )
    }
  }

  for (const vc of vendorCredits) {
    const headerClass = (vc as any).ClassRef?.name ?? ''
    for (const line of ((vc as any).Line ?? [])) {
      if (!EXPENSE_DETAIL_TYPES.has((line as any).DetailType ?? '')) continue
      const detail = (line as any).AccountBasedExpenseLineDetail ?? (line as any).ItemBasedExpenseLineDetail
      if (!detail) continue
      const lineClass = detail.ClassRef?.name ?? headerClass
      if (lineClass !== className) continue
      const account = detail.AccountRef?.name ?? detail.ItemRef?.name ?? 'Other'
      // Vendor credits are negative (they reduce the expense total)
      addExpense(
        vc.TxnDate,
        vc.VendorRef?.name ?? '',
        (line as any).Description ?? (vc as any).PrivateNote ?? '',
        vc.Id,
        -((line as any).Amount ?? 0),
        account,
        'vendor_credit',
      )
    }
  }

  // Sort categories by total descending, sort transactions by date ascending
  const sortedCategories = Object.fromEntries(
    Object.entries(expensesByCategory)
      .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
      .map(([k, v]) => [k, {
        total: v.total,
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
}
