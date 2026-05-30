/**
 * GET /api/quickbooks/alostoura?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns General Ledger data for the QB account named 'Alostoura':
 *   - account      — the QB Account entity
 *   - transactions — every GL line in the requested date range
 *   - monthly      — per-month credits / debits / net / closing balance
 *   - summary      — overall period totals + opening/closing balance
 *
 * Strategy:
 *   1. Query QB for an Account whose name contains 'Alostoura'
 *   2. Call GeneralLedger report for that account
 *   3. Parse + aggregate
 *
 * Falls back to a cached snapshot (alostoura column) when QB is offline.
 */
import { NextRequest, NextResponse }                         from 'next/server'
import { supabaseAdmin, isSupabaseConfigured }               from '@/lib/supabase'
import { loadTokensAsync }                                   from '@/lib/quickbooks/tokens'
import {
  fetchAccounts, fetchGLReport, parseGLReport, buildMonthSummaries,
} from '@/lib/quickbooks/client'
import type { QBAlostouraTransaction, QBAlostouraMonthSummary } from '@/lib/quickbooks/types'

export const dynamic  = 'force-dynamic'
export const maxDuration = 30

// ── Default date range: start of 3 years ago → today ─────────────────────────
function defaultFrom(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 3)
  return d.toISOString().slice(0, 10)
}
function defaultTo(): string { return new Date().toISOString().slice(0, 10) }

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || defaultFrom()
  const to   = searchParams.get('to')   || defaultTo()

  // ── Try live QB first ────────────────────────────────────────────────────────
  const tokens = await loadTokensAsync()
  if (tokens) {
    try {
      // 1. Find the Alostoura account
      const accounts = await fetchAccounts()
      const account  = accounts.find(a =>
        a.Name.toLowerCase().includes('alostoura') ||
        a.FullyQualifiedName.toLowerCase().includes('alostoura')
      )

      if (!account) {
        return NextResponse.json({
          found:   false,
          message: "No account matching 'Alostoura' found in your QuickBooks Chart of Accounts. " +
                   "Check the account name in QB: Settings → Chart of Accounts.",
        })
      }

      // 2. Fetch General Ledger report for that account
      const glReport = await fetchGLReport(account.Id, from, to)

      // 3. Parse
      const transactions  = parseGLReport(glReport)
      const monthly       = buildMonthSummaries(transactions)

      // Period totals
      const totalCredits  = transactions.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount,         0)
      const totalDebits   = transactions.filter(t => t.amount <  0).reduce((s, t) => s + Math.abs(t.amount), 0)
      const closingBal    = transactions.length ? transactions[transactions.length - 1].balance : account.CurrentBalance ?? 0
      const openingBal    = closingBal - (totalCredits - totalDebits)

      return NextResponse.json({
        found:        true,
        source:       'live',
        fetched_at:   new Date().toISOString(),
        account: {
          id:          account.Id,
          name:        account.Name,
          type:        account.AccountType,
          subType:     account.AccountSubType,
          balance:     account.CurrentBalance,
        },
        dateFilter:   { from, to },
        transactions: transactions.reverse(),   // newest first for the UI table
        monthly,                                // oldest first for the chart
        summary: {
          totalCredits:  Math.round(totalCredits  * 100) / 100,
          totalDebits:   Math.round(totalDebits   * 100) / 100,
          netChange:     Math.round((totalCredits - totalDebits) * 100) / 100,
          openingBalance: Math.round(openingBal   * 100) / 100,
          closingBalance: Math.round(closingBal   * 100) / 100,
          txnCount:      transactions.length,
        },
      })
    } catch (err) {
      console.error('[Alostoura] Live fetch failed:', err)
      // Fall through to snapshot
    }
  }

  // ── Fall back to cached snapshot ──────────────────────────────────────────────
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ found: false, message: 'QuickBooks not connected and Supabase not configured.' })
  }

  try {
    const { data } = await supabaseAdmin
      .from('qb_snapshot')
      .select('alostoura, synced_at')
      .eq('id', 1)
      .single()

    const syncedAt = (data as any)?.synced_at as string | undefined
    const cached = (data as any)?.alostoura as {
      account:      unknown
      transactions: QBAlostouraTransaction[]
      monthly:      QBAlostouraMonthSummary[]
      summary:      unknown
    } | null

    if (!cached) {
      return NextResponse.json({
        found:   false,
        message: 'QuickBooks not connected. Connect QB and run a sync to see Alostoura account data.',
      })
    }

    // In-memory date filter on cached data
    const txns = (cached.transactions ?? []).filter(t =>
      (!from || t.txnDate >= from) && (!to || t.txnDate <= to)
    )
    const monthly = buildMonthSummaries([...txns].reverse())

    const totalCredits = txns.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0)
    const totalDebits  = txns.filter(t => t.amount <  0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const closingBal   = txns.length ? txns[0].balance : 0

    return NextResponse.json({
      found:        true,
      source:       'snapshot',
      fetched_at:   syncedAt,
      account:      cached.account,
      dateFilter:   { from, to },
      transactions: txns,
      monthly,
      summary: {
        totalCredits:  Math.round(totalCredits * 100) / 100,
        totalDebits:   Math.round(totalDebits  * 100) / 100,
        netChange:     Math.round((totalCredits - totalDebits) * 100) / 100,
        closingBalance: Math.round(closingBal  * 100) / 100,
        txnCount:      txns.length,
      },
    })
  } catch (err) {
    console.error('[Alostoura] Snapshot read failed:', err)
    return NextResponse.json({ found: false, message: 'Failed to read cached data.' }, { status: 500 })
  }
}
