/**
 * GET /api/reconciliation/transactions?accountId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns QB General Ledger transactions for a specific bank account in the
 * given date range.  Used by the Reconciliation Dashboard for client-side matching.
 */
import { NextRequest, NextResponse }               from 'next/server'
import { loadTokensAsync, isAccessTokenFresh }     from '@/lib/quickbooks/tokens'
import { fetchGLReport, parseGLReport, refreshAccessToken } from '@/lib/quickbooks/client'

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    const from      = searchParams.get('from')
    const to        = searchParams.get('to')

    if (!accountId || !from || !to) {
      return NextResponse.json(
        { error: 'accountId, from, and to are required' },
        { status: 400 },
      )
    }

    const tokens = await loadTokensAsync()
    if (!tokens) {
      return NextResponse.json(
        { error: 'QuickBooks not connected. Go to Settings → Connect QB.' },
        { status: 401 },
      )
    }

    // Auto-refresh access token if stale
    const fresh = isAccessTokenFresh(tokens) ? tokens : await refreshAccessToken(tokens)
    // Swap live tokens into the module-level cache so qbFetch uses the fresh token
    Object.assign(tokens, fresh)

    const report = await fetchGLReport(accountId, from, to)
    const rows   = parseGLReport(report)

    const transactions = rows.map((r, i) => ({
      id:          `qb_${i}_${r.txnId || i}`,
      date:        r.txnDate,
      amount:      r.amount,   // positive = money IN, negative = money OUT
      description: [r.txnType, r.name, r.memo].filter(Boolean).join(' · '),
      reference:   r.txnId ?? '',
      txnType:     r.txnType ?? '',
      name:        r.name     ?? '',
      memo:        r.memo     ?? '',
      split:       r.split    ?? '',   // contra-account = where $$ is categorised in Chart of Accounts
      balance:     r.balance  ?? 0,
    }))

    return NextResponse.json({ transactions, count: transactions.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch QB transactions'
    const isAuth = msg.includes('invalid_grant') || msg.includes('401') || msg.includes('token')
    console.error('[reconciliation/transactions]', msg)
    return NextResponse.json(
      { error: msg, requiresReconnect: isAuth },
      { status: isAuth ? 401 : 500 },
    )
  }
}
