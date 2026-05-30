/**
 * GET /api/quickbooks/classes?from=YYYY-MM-DD&to=YYYY-MM-DD[&debug=1]
 *
 * Strategy:
 *  - If QB is connected (valid tokens) AND a date range is supplied →
 *      query QB API directly so the filter is exact and not capped by snapshot size.
 *  - Otherwise → fall back to the cached Supabase snapshot with in-memory filtering.
 *
 * Returns:
 *  - classGroups  — hierarchical: class → individual transaction lines (for tree UI)
 *  - expenses     — aggregated per-class account pivot (for AI agent)
 *  - accountNames — all unique account names in range (for AI agent)
 *  - debug        — raw fetch stats for reconciliation with QB Online
 *
 * ── KEY BUG FIX ──────────────────────────────────────────────────────────────
 *  QB Purchase/Bill Line arrays include SubTotalLineDetail rows whose Amount
 *  equals the sum of all preceding expense lines.  Without filtering by
 *  DetailType those subtotal rows were being counted alongside the individual
 *  lines → 2× totals.  We now only process lines whose DetailType is
 *  "AccountBasedExpenseLineDetail" or "ItemBasedExpenseLineDetail".
 */
import { NextRequest, NextResponse }                from 'next/server'
import { supabaseAdmin, isSupabaseConfigured }      from '@/lib/supabase'
import { loadTokensAsync }                          from '@/lib/quickbooks/tokens'
import { fetchPurchasesInRange, fetchBillsInRange } from '@/lib/quickbooks/client'
import type {
  QBClass, QBPurchase, QBBill,
  QBClassExpenseRow, QBClassGroup, QBTransactionLine,
} from '@/lib/quickbooks/types'

export const dynamic = 'force-dynamic'

// ── Only these DetailTypes carry real expense amounts ─────────────────────────
const EXPENSE_LINE_TYPES = new Set([
  'AccountBasedExpenseLineDetail',
  'ItemBasedExpenseLineDetail',
])

// ── Helpers ───────────────────────────────────────────────────────────────────
function inRange(txnDate: string, from: string | null, to: string | null): boolean {
  if (from && txnDate < from) return false
  if (to   && txnDate > to)   return false
  return true
}

function resolveClass(
  lineRef:   { value: string; name: string } | undefined,
  headerRef: { value: string; name: string } | undefined,
): { id: string; name: string } | null {
  const ref = lineRef ?? headerRef
  return ref ? { id: ref.value, name: ref.name } : null
}

// ── Debug stats ───────────────────────────────────────────────────────────────
export interface QBDebugInfo {
  fetchedAt:       string          // ISO timestamp of this API call
  source:          'live' | 'snapshot'
  dateFilter:      { from: string | null; to: string | null }
  purchases: {
    fetched:        number          // raw count from QB / snapshot
    inRange:        number          // after date filter
    expenseLines:   number          // lines with valid DetailType
    taggedLines:    number          // lines WITH a class tag  ← counted in our total
    untaggedLines:  number          // lines WITHOUT a class tag ← NOT in our total
    qbHeaderTotal:  number          // sum of TotalAmt (QB's own figure)
    ourLineTotal:   number          // sum of tagged expense line amounts
  }
  bills: {
    fetched:        number
    inRange:        number
    expenseLines:   number
    taggedLines:    number
    untaggedLines:  number
    qbHeaderTotal:  number
    ourLineTotal:   number
  }
  combined: {
    qbHeaderTotal:  number          // what QB says the total should be
    ourTotal:       number          // what we are displaying
    untaggedTotal:  number          // expense not shown (no class tag)
    discrepancy:    number          // qbHeaderTotal - ourTotal - untaggedTotal
  }
}

// ── Build class groups + collect debug stats ──────────────────────────────────
function buildClassGroups(
  classes:   QBClass[],
  purchases: QBPurchase[],
  bills:     QBBill[],
  from:      string | null,
  to:        string | null,
): { classGroups: QBClassGroup[]; debug: Omit<QBDebugInfo, 'fetchedAt' | 'source' | 'dateFilter'> } {

  const classNameById = new Map<string, string>()
  for (const c of classes) classNameById.set(c.Id, c.FullyQualifiedName ?? c.Name)

  const groups = new Map<string, QBClassGroup>()

  function ensureGroup(classId: string, className: string): QBClassGroup {
    if (!groups.has(classId)) {
      groups.set(classId, { classId, className, total: 0, txnCount: 0, accountTotals: {}, transactions: [] })
    }
    return groups.get(classId)!
  }

  function addLine(line: QBTransactionLine, classId: string, className: string) {
    const g = ensureGroup(classId, className)
    g.transactions.push(line)
    g.total    += line.amount
    g.txnCount++
    g.accountTotals[line.accountName] = (g.accountTotals[line.accountName] ?? 0) + line.amount
  }

  let lineSeq = 0

  // ── Debug counters ─────────────────────────────────────────────────────────
  const pd = { fetched: purchases.length, inRange: 0, expenseLines: 0, taggedLines: 0, untaggedLines: 0, qbHeaderTotal: 0, ourLineTotal: 0, untaggedLineAmt: 0 }
  const bd = { fetched: bills.length,     inRange: 0, expenseLines: 0, taggedLines: 0, untaggedLines: 0, qbHeaderTotal: 0, ourLineTotal: 0, untaggedLineAmt: 0 }

  // ── Process Purchases ──────────────────────────────────────────────────────
  for (const p of purchases) {
    if (!inRange(p.TxnDate, from, to)) continue
    pd.inRange++
    pd.qbHeaderTotal += p.TotalAmt ?? 0

    const vendor = p.EntityRef?.name ?? 'Unknown Vendor'
    const note   = p.PrivateNote ?? ''

    for (const line of p.Line ?? []) {
      // ▶ CRITICAL FIX: skip SubTotalLineDetail and any other non-expense types
      if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue

      const amount = line.Amount ?? 0
      if (amount <= 0) continue
      pd.expenseLines++

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, p.ClassRef)

      if (!cls) {
        pd.untaggedLines++
        pd.untaggedLineAmt += amount
        continue
      }

      pd.taggedLines++
      pd.ourLineTotal += amount

      const className   = classNameById.get(cls.id) ?? cls.name ?? `Class ${cls.id}`
      const accountName = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'

      addLine({
        txnId:       p.Id,
        lineId:      `${p.Id}-${++lineSeq}`,
        txnDate:     p.TxnDate,
        vendor,
        accountName,
        amount,
        type:        'purchase',
        paymentType: p.PaymentType ?? 'Purchase',
        note:        line.Description ?? note,
      }, cls.id, className)
    }
  }

  // ── Process Bills ──────────────────────────────────────────────────────────
  for (const b of bills) {
    if (!inRange(b.TxnDate, from, to)) continue
    bd.inRange++
    bd.qbHeaderTotal += b.TotalAmt ?? 0

    const vendor = b.VendorRef?.name ?? 'Unknown Vendor'
    const note   = b.PrivateNote ?? ''

    for (const line of b.Line ?? []) {
      // ▶ CRITICAL FIX: skip SubTotalLineDetail and any other non-expense types
      if (!EXPENSE_LINE_TYPES.has(line.DetailType)) continue

      const amount = line.Amount ?? 0
      if (amount <= 0) continue
      bd.expenseLines++

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, b.ClassRef)

      if (!cls) {
        bd.untaggedLines++
        bd.untaggedLineAmt += amount
        continue
      }

      bd.taggedLines++
      bd.ourLineTotal += amount

      const className   = classNameById.get(cls.id) ?? cls.name ?? `Class ${cls.id}`
      const accountName = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'

      addLine({
        txnId:       b.Id,
        lineId:      `${b.Id}-${++lineSeq}`,
        txnDate:     b.TxnDate,
        vendor,
        accountName,
        amount,
        type:        'bill',
        paymentType: 'Bill',
        note:        line.Description ?? note,
      }, cls.id, className)
    }
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  for (const g of groups.values()) {
    g.transactions.sort((a, b) =>
      b.txnDate.localeCompare(a.txnDate) || b.amount - a.amount
    )
  }

  const classGroups = Array.from(groups.values()).sort((a, b) => b.total - a.total)

  const ourTotal       = pd.ourLineTotal    + bd.ourLineTotal
  const qbHeaderTotal  = pd.qbHeaderTotal   + bd.qbHeaderTotal
  const untaggedTotal  = pd.untaggedLineAmt + bd.untaggedLineAmt
  // discrepancy: anything we still can't account for (tax on header, rounding, etc.)
  const discrepancy    = Math.round((qbHeaderTotal - ourTotal - untaggedTotal) * 100) / 100

  return {
    classGroups,
    debug: {
      purchases: {
        fetched:       pd.fetched,
        inRange:       pd.inRange,
        expenseLines:  pd.expenseLines,
        taggedLines:   pd.taggedLines,
        untaggedLines: pd.untaggedLines,
        qbHeaderTotal: Math.round(pd.qbHeaderTotal * 100) / 100,
        ourLineTotal:  Math.round(pd.ourLineTotal  * 100) / 100,
      },
      bills: {
        fetched:       bd.fetched,
        inRange:       bd.inRange,
        expenseLines:  bd.expenseLines,
        taggedLines:   bd.taggedLines,
        untaggedLines: bd.untaggedLines,
        qbHeaderTotal: Math.round(bd.qbHeaderTotal * 100) / 100,
        ourLineTotal:  Math.round(bd.ourLineTotal  * 100) / 100,
      },
      combined: {
        qbHeaderTotal: Math.round(qbHeaderTotal * 100) / 100,
        ourTotal:      Math.round(ourTotal      * 100) / 100,
        untaggedTotal: Math.round(untaggedTotal * 100) / 100,
        discrepancy,
      },
    },
  }
}

// ── Build pivot (for AI agent) ────────────────────────────────────────────────
function buildExpenses(
  classGroups: QBClassGroup[],
): { expenses: QBClassExpenseRow[]; accountNames: string[] } {
  const accountSet = new Set<string>()
  const expenses: QBClassExpenseRow[] = classGroups.map(g => {
    for (const acc of Object.keys(g.accountTotals)) accountSet.add(acc)
    return { classId: g.classId, className: g.className, accounts: g.accountTotals, total: g.total }
  })
  return { expenses, accountNames: Array.from(accountSet).sort((a, b) => a.localeCompare(b)) }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || null
  const to   = searchParams.get('to')   || null

  const fetchedAt = new Date().toISOString()

  try {
    // ── Always load classes list + synced_at from snapshot ────────────────────
    const { data, error } = await supabaseAdmin
      .from('qb_snapshot')
      .select('classes, purchases, bills, synced_at')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return NextResponse.json({
        synced: false, message: 'No QB data yet — run a sync first.',
        classGroups: [], expenses: [], accountNames: [], classes: [],
      })
    }

    const classes: QBClass[] = (data.classes ?? []) as QBClass[]

    // ── Decide data source: live QB API vs snapshot ────────────────────────────
    let purchases: QBPurchase[]
    let bills:     QBBill[]
    let source:    'live' | 'snapshot'

    const tokens   = await loadTokensAsync()
    const hasRange = from || to

    if (tokens && hasRange) {
      console.log(`[QB Classes] Live fetch from QB: from=${from} to=${to}`)
      ;[purchases, bills] = await Promise.all([
        fetchPurchasesInRange(from, to),
        fetchBillsInRange(from, to),
      ])
      source = 'live'
    } else {
      purchases = (data.purchases ?? []) as QBPurchase[]
      bills     = (data.bills     ?? []) as QBBill[]
      source    = 'snapshot'
    }

    const { classGroups, debug }     = buildClassGroups(classes, purchases, bills, from, to)
    const { expenses, accountNames } = buildExpenses(classGroups)

    const allDates = [
      ...purchases.filter(p => inRange(p.TxnDate, from, to)).map(p => p.TxnDate),
      ...bills.filter(b => inRange(b.TxnDate, from, to)).map(b => b.TxnDate),
    ].filter(Boolean).sort()

    const fullDebug: QBDebugInfo = {
      fetchedAt,
      source,
      dateFilter: { from, to },
      ...debug,
    }

    console.log('[QB Classes] debug:', JSON.stringify(fullDebug.combined))

    return NextResponse.json({
      synced:       true,
      synced_at:    data.synced_at,
      fetched_at:   fetchedAt,          // when this request hit QB / snapshot
      source,
      classes,
      classGroups,
      accountNames,
      expenses,
      debug: fullDebug,
      dataRange: {
        earliest: allDates[0]                    ?? null,
        latest:   allDates[allDates.length - 1]  ?? null,
      },
      counts: {
        classes:       classes.length,
        purchases:     debug.purchases.inRange,
        bills:         debug.bills.inRange,
        classGroups:   classGroups.length,
        account_types: accountNames.length,
      },
    })
  } catch (err) {
    console.error('[QB Classes] error:', err)
    return NextResponse.json({ error: 'Failed to load class data' }, { status: 500 })
  }
}
