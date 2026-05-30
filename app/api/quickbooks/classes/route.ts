/**
 * GET /api/quickbooks/classes?from=YYYY-MM-DD&to=YYYY-MM-DD
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
 */
import { NextRequest, NextResponse }                    from 'next/server'
import { supabaseAdmin, isSupabaseConfigured }          from '@/lib/supabase'
import { loadTokensAsync }                              from '@/lib/quickbooks/tokens'
import { fetchPurchasesInRange, fetchBillsInRange }     from '@/lib/quickbooks/client'
import type {
  QBClass, QBPurchase, QBBill,
  QBClassExpenseRow, QBClassGroup, QBTransactionLine,
} from '@/lib/quickbooks/types'

export const dynamic = 'force-dynamic'

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

// ── Build class groups (hierarchical) ────────────────────────────────────────
function buildClassGroups(
  classes:   QBClass[],
  purchases: QBPurchase[],
  bills:     QBBill[],
  from:      string | null,
  to:        string | null,
): QBClassGroup[] {

  // classId → display name
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
    g.total += line.amount
    g.txnCount++
    g.accountTotals[line.accountName] = (g.accountTotals[line.accountName] ?? 0) + line.amount
  }

  let lineSeq = 0

  // ── Process Purchases ────────────────────────────────────────────────────────
  for (const p of purchases) {
    if (!inRange(p.TxnDate, from, to)) continue
    const vendor = p.EntityRef?.name ?? 'Unknown Vendor'
    const note   = p.PrivateNote ?? ''

    for (const line of p.Line ?? []) {
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, p.ClassRef)
      if (!cls) continue

      const className   = classNameById.get(cls.id) ?? cls.name ?? `Class ${cls.id}`
      const accountName = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'
      const lineNote    = line.Description ?? note

      addLine({
        txnId:       p.Id,
        lineId:      `${p.Id}-${++lineSeq}`,
        txnDate:     p.TxnDate,
        vendor,
        accountName,
        amount,
        type:        'purchase',
        paymentType: p.PaymentType ?? 'Purchase',
        note:        lineNote,
      }, cls.id, className)
    }
  }

  // ── Process Bills ────────────────────────────────────────────────────────────
  for (const b of bills) {
    if (!inRange(b.TxnDate, from, to)) continue
    const vendor = b.VendorRef?.name ?? 'Unknown Vendor'
    const note   = b.PrivateNote ?? ''

    for (const line of b.Line ?? []) {
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const abd = line.AccountBasedExpenseLineDetail
      const ibd = line.ItemBasedExpenseLineDetail
      const cls = resolveClass(abd?.ClassRef ?? ibd?.ClassRef, b.ClassRef)
      if (!cls) continue

      const className   = classNameById.get(cls.id) ?? cls.name ?? `Class ${cls.id}`
      const accountName = abd?.AccountRef?.name ?? ibd?.ItemRef?.name ?? 'Uncategorized'
      const lineNote    = line.Description ?? note

      addLine({
        txnId:       b.Id,
        lineId:      `${b.Id}-${++lineSeq}`,
        txnDate:     b.TxnDate,
        vendor,
        accountName,
        amount,
        type:        'bill',
        paymentType: 'Bill',
        note:        lineNote,
      }, cls.id, className)
    }
  }

  // Sort transactions within each group: date desc, then amount desc
  for (const g of groups.values()) {
    g.transactions.sort((a, b) =>
      b.txnDate.localeCompare(a.txnDate) || b.amount - a.amount
    )
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total)
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

    const tokens  = await loadTokensAsync()
    const hasRange = from || to

    if (tokens && hasRange) {
      // Fetch directly from QB API with exact date filter
      console.log(`[QB Classes] Live fetch from QB: from=${from} to=${to}`)
      ;[purchases, bills] = await Promise.all([
        fetchPurchasesInRange(from, to),
        fetchBillsInRange(from, to),
      ])
      source = 'live'
    } else {
      // Fall back to snapshot (no QB connection, or no date range set)
      purchases = (data.purchases ?? []) as QBPurchase[]
      bills     = (data.bills     ?? []) as QBBill[]
      source    = 'snapshot'
      // Apply in-memory date filter if dates were given but QB isn't connected
      // (inRange() is still called inside buildClassGroups so this is handled automatically)
    }

    const classGroups                = buildClassGroups(classes, purchases, bills, from, to)
    const { expenses, accountNames } = buildExpenses(classGroups)

    const allDates = [...purchases.map(p => p.TxnDate), ...bills.map(b => b.TxnDate)]
      .filter(Boolean).sort()

    return NextResponse.json({
      synced:       true,
      synced_at:    data.synced_at,
      source,                         // 'live' | 'snapshot' — useful for debugging
      classes,
      classGroups,
      accountNames,
      expenses,
      dataRange: {
        earliest: allDates[0]                    ?? null,
        latest:   allDates[allDates.length - 1]  ?? null,
      },
      counts: {
        classes:       classes.length,
        purchases:     purchases.length,
        bills:         bills.length,
        classGroups:   classGroups.length,
        account_types: accountNames.length,
      },
    })
  } catch (err) {
    console.error('[QB Classes] error:', err)
    return NextResponse.json({ error: 'Failed to load class data' }, { status: 500 })
  }
}
