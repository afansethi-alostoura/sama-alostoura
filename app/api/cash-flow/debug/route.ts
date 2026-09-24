/**
 * GET /api/cash-flow/debug
 * Diagnostic endpoint — checks QB connection and RAK Bank account lookup.
 * Remove or protect this route before sharing the URL publicly.
 */
import { NextResponse }           from 'next/server'
import { loadTokensAsync }        from '@/lib/quickbooks/tokens'
import { fetchAccounts, fetchGLReport, parseGLReport } from '@/lib/quickbooks/client'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const result: Record<string, unknown> = {}

  // 1. Token status
  const tokens = await loadTokensAsync()
  result.qb_connected = !!tokens
  if (!tokens) {
    result.error = 'No QB tokens found — QuickBooks is not connected.'
    return NextResponse.json(result)
  }

  const issuedAt  = new Date(tokens.created_at).toISOString()
  const expiresAt = new Date(tokens.created_at + tokens.expires_in * 1000).toISOString()
  result.token = { realm_id: tokens.realm_id, issued_at: issuedAt, expires_at: expiresAt }

  // 2. Account list
  try {
    const accounts = await fetchAccounts(500)
    const banks = accounts.filter(a => a.AccountType === 'Bank')
    result.all_bank_accounts = banks.map(a => ({ Id: a.Id, Name: a.Name, Balance: a.CurrentBalance }))

    // Attempt exact match
    const exact = banks.find(a =>
      a.Name.toLowerCase().replace(/\s+/g, ' ').includes('rak bank')
    )
    // Broader fallback
    const broad = !exact
      ? banks.find(a => a.Name.toLowerCase().includes('rak') && !a.Name.toLowerCase().includes('credit'))
      : null

    const matched = exact ?? broad
    result.matched_account = matched
      ? { id: matched.Id, name: matched.Name, match_type: exact ? 'exact' : 'broad' }
      : null

    if (!matched) {
      result.error = 'No RAK Bank account matched. Check all_bank_accounts above for the correct name.'
      return NextResponse.json(result)
    }

    // 3. GL transaction count for last 2 years
    const to   = new Date().toISOString().slice(0, 10)
    const from = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d.toISOString().slice(0, 10) })()
    result.date_range = { from, to }

    const gl   = await fetchGLReport(matched.Id, from, to)
    const txns = parseGLReport(gl)

    result.transaction_count = txns.length
    result.credits = txns.filter(t => t.amount > 0).length
    result.debits  = txns.filter(t => t.amount < 0).length
    result.sample_transactions = txns.slice(0, 5).map(t => ({
      date: t.txnDate, type: t.txnType, name: t.name, amount: t.amount, balance: t.balance,
    }))
  } catch (err: any) {
    result.error = err.message
  }

  return NextResponse.json(result, { status: 200 })
}
