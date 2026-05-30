/**
 * GET /api/quickbooks/classes
 *
 * Returns QB Classes mapped to projects with expense breakdown by category.
 * Reads from the cached qb_snapshot (includes classes, purchases, bills).
 *
 * Expense categories are derived from QBO Account names:
 *   Materials      — Material*, Supplies*, Equipment*, Hardware*, Stock*
 *   Labor          — Labor*, Labour*, Wages*, Salary*, Payroll*, Manpower*
 *   Subcontractors — Subcontract*, Sub-contract*, Contract Service*, Specialist*
 *   Overhead       — Overhead*, Utilities*, Rent*, Office*, Admin*, Insurance*
 *   Other          — everything else
 */
import { NextResponse }                    from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import type { QBClass, QBPurchase, QBBill, QBClassExpenseRow } from '@/lib/quickbooks/types'

// ── Category classifier ────────────────────────────────────────────────────────
const CATEGORY_PATTERNS: Array<{ key: keyof Omit<QBClassExpenseRow, 'classId' | 'className' | 'total'>; patterns: RegExp[] }> = [
  {
    key: 'materials',
    patterns: [
      /material/i, /supplies/i, /equipment/i, /hardware/i, /stock/i,
      /concrete/i, /steel/i, /cement/i, /timber/i, /tiles/i, /paint/i,
      /plumbing/i, /electrical supply/i, /cost of goods/i, /cogs/i,
    ],
  },
  {
    key: 'labor',
    patterns: [
      /labour/i, /labor/i, /wages/i, /salary/i, /payroll/i, /manpower/i,
      /salaries/i, /staff/i, /workforce/i, /employee/i,
    ],
  },
  {
    key: 'subcontractors',
    patterns: [
      /subcontract/i, /sub-contract/i, /sub contract/i, /contract service/i,
      /specialist/i, /outsource/i, /third.party/i,
    ],
  },
  {
    key: 'overhead',
    patterns: [
      /overhead/i, /utilities/i, /rent/i, /office/i, /admin/i, /insurance/i,
      /vehicle/i, /transport/i, /fuel/i, /depreciation/i, /maintenance/i,
      /professional fee/i, /legal/i, /accounting/i,
    ],
  },
]

function classifyAccount(accountName: string): keyof Omit<QBClassExpenseRow, 'classId' | 'className' | 'total'> {
  for (const { key, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(accountName))) return key
  }
  return 'other'
}

// ── Resolve class from a line item (line-level then header-level) ─────────────
function resolveClassId(
  lineClassRef: { value: string; name: string } | undefined,
  headerClassRef: { value: string; name: string } | undefined,
): string | null {
  return lineClassRef?.value ?? headerClassRef?.value ?? null
}

// ── Build expense breakdown from purchases and bills ─────────────────────────
function buildClassExpenses(
  classes:   QBClass[],
  purchases: QBPurchase[],
  bills:     QBBill[],
): QBClassExpenseRow[] {
  // Initialize row map keyed by class ID
  const rows = new Map<string, QBClassExpenseRow>()

  function ensureRow(classId: string, className: string) {
    if (!rows.has(classId)) {
      rows.set(classId, {
        classId, className,
        materials: 0, labor: 0, subcontractors: 0, overhead: 0, other: 0, total: 0,
      })
    }
    return rows.get(classId)!
  }

  // ── Process Purchases ────────────────────────────────────────────────────────
  for (const p of purchases) {
    for (const line of p.Line ?? []) {
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const detail =
        line.AccountBasedExpenseLineDetail ??
        line.ItemBasedExpenseLineDetail ??
        null

      const classRef = resolveClassId(
        (detail as { ClassRef?: { value: string; name: string } })?.ClassRef,
        p.ClassRef,
      )
      if (!classRef) continue  // skip unclassified

      // Find the class name from our classes list
      const cls = classes.find(c => c.Id === classRef)
      const className = cls?.FullyQualifiedName ?? cls?.Name ?? `Class ${classRef}`

      const accountName =
        (line.AccountBasedExpenseLineDetail?.AccountRef?.name) ??
        (line.ItemBasedExpenseLineDetail?.ItemRef?.name) ??
        ''

      const category = classifyAccount(accountName)
      const row = ensureRow(classRef, className)
      row[category] += amount
      row.total     += amount
    }
  }

  // ── Process Bills ────────────────────────────────────────────────────────────
  for (const b of bills) {
    for (const line of b.Line ?? []) {
      const amount = line.Amount ?? 0
      if (amount <= 0) continue

      const detail =
        line.AccountBasedExpenseLineDetail ??
        line.ItemBasedExpenseLineDetail ??
        null

      const classRef = resolveClassId(
        (detail as { ClassRef?: { value: string; name: string } })?.ClassRef,
        b.ClassRef,
      )
      if (!classRef) continue

      const cls = classes.find(c => c.Id === classRef)
      const className = cls?.FullyQualifiedName ?? cls?.Name ?? `Class ${classRef}`

      const accountName =
        (line.AccountBasedExpenseLineDetail?.AccountRef?.name) ??
        (line.ItemBasedExpenseLineDetail?.ItemRef?.name) ??
        ''

      const category = classifyAccount(accountName)
      const row = ensureRow(classRef, className)
      row[category] += amount
      row.total     += amount
    }
  }

  // Return sorted by total descending
  return Array.from(rows.values()).sort((a, b) => b.total - a.total)
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET() {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

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
        classes: [],
      })
    }

    const classes:   QBClass[]   = (data.classes   ?? []) as QBClass[]
    const purchases: QBPurchase[] = (data.purchases ?? []) as QBPurchase[]
    const bills:     QBBill[]    = (data.bills     ?? []) as QBBill[]

    const expenses = buildClassExpenses(classes, purchases, bills)

    return NextResponse.json({
      synced:    true,
      synced_at: data.synced_at,
      classes,
      expenses,
      counts: {
        classes:   classes.length,
        purchases: purchases.length,
        bills:     bills.length,
        expense_rows: expenses.length,
      },
    })
  } catch (err) {
    console.error('[QB Classes] error:', err)
    return NextResponse.json({ error: 'Failed to load class data' }, { status: 500 })
  }
}
