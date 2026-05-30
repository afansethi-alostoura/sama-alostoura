/**
 * GET /api/quickbooks/classes?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns QB Classes with a fully dynamic expense breakdown —
 * every unique QBO Account name that appears in the date range becomes
 * its own column. No pre-set categories.
 *
 * Response:
 *   { synced, synced_at, classes, accountNames, expenses, counts }
 *   expenses[n].accounts = { "Concrete & Aggregates": 12500, "Labour": 8200, … }
 */
import { NextRequest, NextResponse }       from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import type { QBClass, QBPurchase, QBBill, QBClassExpenseRow } from '@/lib/quickbooks/types'

export const dynamic = 'force-dynamic'

// ── Date filter helper ────────────────────────────────────────────────────────
function inRange(txnDate: string, from: string | null, to: string | null): boolean {
  if (from && txnDate < from) return false
  if (to   && txnDate > to)   return false
  return true
}

// ── Resolve class ref: prefer line-level, fall back to header ─────────────────
function resolveClass(
  lineClassRef:   { value: string; name: string } | undefined,
  headerClassRef: { value: string; name: string } | undefined,
): { id: string; name: string } | null {
  const ref = lineClassRef ?? headerClassRef
  return ref ? { id: ref.value, name: ref.name } : null
}

// ── Build dynamic expense breakdown ──────────────────────────────────────────
function buildExpenses(
  classes:   QBClass[],
  purchases: QBPurchase[],
  bills:     QBBill[],
  from:      string | null,
  to:        string | null,
): { expenses: QBClassExpenseRow[]; accountNames: string[] } {

  const rows         = new Map<string, QBClassExpenseRow>()
  const accountNames = new Set<string>()

  // Build a classId → displayName lookup
  const classNameById = new Map<string, string>()
  for (const c of classes) {
    classNameById.set(c.Id, c.FullyQualifiedName ?? c.Name)
  }

  function ensureRow(classId: string, className: string): QBClassExpenseRow {
    if (!rows.has(classId)) {
      rows.set(classId, { classId, className, accounts: {}, total: 0 })
    }
    return rows.get(classId)!
  }

  function addAmount(classId: string, className: string, accountName: string, amount: number) {
    if (amount <= 0) return
    const clean = accountName.trim() || 'Uncategorized'
    accountNames.add(clean)
    const row = ensureRow(classId, className)
    row.accounts[clean] = (row.accounts[clean] ?? 0) + amount
    row.total           += amount
  }

  // ── Purchases ────────────────────────────────────────────────────────────────
  for (const p of purchases) {
    if (!inRange(p.TxnDate, from, to)) continue

    for (const line of p.Line ?? []) {
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail

      // Resolve class (line-level first, then header)
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, p.ClassRef)
      if (!cls) continue

      const className  = classNameById.get(cls.id) ?? cls.name ?? `Class ${cls.id}`
      const accountName = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'

      addAmount(cls.id, className, accountName, amount)
    }
  }

  // ── Bills ────────────────────────────────────────────────────────────────────
  for (const b of bills) {
    if (!inRange(b.TxnDate, from, to)) continue

    for (const line of b.Line ?? []) {
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail

      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, b.ClassRef)
      if (!cls) continue

      const className  = classNameById.get(cls.id) ?? cls.name ?? `Class ${cls.id}`
      const accountName = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'

      addAmount(cls.id, className, accountName, amount)
    }
  }

  // Sort account names alphabetically for stable column order
  const sortedAccounts = Array.from(accountNames).sort((a, b) => a.localeCompare(b))

  // Sort rows by total descending
  const sortedRows = Array.from(rows.values()).sort((a, b) => b.total - a.total)

  return { expenses: sortedRows, accountNames: sortedAccounts }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || null   // YYYY-MM-DD or null
  const to   = searchParams.get('to')   || null

  try {
    const { data, error } = await supabaseAdmin
      .from('qb_snapshot')
      .select('classes, purchases, bills, synced_at')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return NextResponse.json({
        synced: false,
        message: 'No QB data yet — run a sync first.',
        expenses: [],
        accountNames: [],
        classes: [],
      })
    }

    const classes:   QBClass[]    = (data.classes   ?? []) as QBClass[]
    const purchases: QBPurchase[] = (data.purchases ?? []) as QBPurchase[]
    const bills:     QBBill[]     = (data.bills     ?? []) as QBBill[]

    const { expenses, accountNames } = buildExpenses(classes, purchases, bills, from, to)

    // Date range of available data (for UI defaults)
    const allDates = [
      ...purchases.map(p => p.TxnDate),
      ...bills.map(b => b.TxnDate),
    ].filter(Boolean).sort()

    return NextResponse.json({
      synced:       true,
      synced_at:    data.synced_at,
      classes,
      accountNames,
      expenses,
      dataRange: {
        earliest: allDates[0]               ?? null,
        latest:   allDates[allDates.length - 1] ?? null,
      },
      counts: {
        classes:       classes.length,
        purchases:     purchases.length,
        bills:         bills.length,
        expense_rows:  expenses.length,
        account_types: accountNames.length,
      },
    })
  } catch (err) {
    console.error('[QB Classes] error:', err)
    return NextResponse.json({ error: 'Failed to load class data' }, { status: 500 })
  }
}
