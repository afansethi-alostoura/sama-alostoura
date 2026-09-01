/**
 * GET /api/cash-flow?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * RAK Bank General Ledger — company-wide cash-flow tracker.
 *
 * Returns:
 *   - transactions  : every GL line for the RAK Bank account in the date range
 *   - groups        : credits (incoming client deposits) with the debits that
 *                     followed until the next deposit — "fund allocation" view
 *   - monthly       : per-month summary (credits / debits / closing balance)
 *   - summary       : period totals + opening / closing balance
 *
 * Data source: QB GeneralLedger report for the account whose name contains
 * "RAK Bank" and is of type "Bank" (falls back to any "RAK" bank account).
 */
import { NextRequest, NextResponse }                from 'next/server'
import { supabaseAdmin, isSupabaseConfigured }      from '@/lib/supabase'
import { loadTokensAsync }                          from '@/lib/quickbooks/tokens'
import {
  fetchAccounts, fetchGLReport, parseGLReport, buildMonthSummaries,
} from '@/lib/quickbooks/client'
import type { QBAlostouraTransaction } from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

// ── Types ─────────────────────────────────────────────────────────────────────
export interface FundGroup {
  depositId:   string           // txnId of the credit that opened this period
  depositDate: string           // YYYY-MM-DD
  depositor:   string           // customer / party name
  memo:        string
  depositAmt:  number           // amount received (positive)
  endDate:     string | null    // date of next deposit (null = open)
  debits:      QBAlostouraTransaction[]  // outgoing payments in this period
  totalDebits: number
  remaining:   number           // depositAmt that was NOT spent (may go negative)
  byCategory:  Array<{ name: string; amount: number }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function defaultFrom() {
  const d = new Date(); d.setFullYear(d.getFullYear() - 2)
  return d.toISOString().slice(0, 10)
}
function defaultTo() { return new Date().toISOString().slice(0, 10) }

function categorise(split: string): string {
  const s = split.toLowerCase()
  if (s.includes('loan') || s.includes('mortgage'))           return 'Loan / Finance'
  if (s.includes('credit card') || s.includes('rak credit'))  return 'Credit Card'
  if (s.includes('salary') || s.includes('wage') || s.includes('payroll')) return 'Salaries'
  if (s.includes('petty cash'))                               return 'Petty Cash'
  if (s.includes('project cost') || s.includes('building materials')) return 'Project Costs'
  if (s.includes('accounts payable') || s.includes('a/p'))   return 'Vendor Bills'
  if (s.includes('accounts receivable') || s.includes('a/r')) return 'Client Payments (internal)'
  if (s.includes('transfer'))                                 return 'Bank Transfer'
  if (s.includes('tax') || s.includes('vat'))                 return 'Tax / VAT'
  if (split.trim() === '' || split === '-Split-')             return 'Multiple Accounts'
  return split   // keep as-is if no match
}

function buildGroups(txns: QBAlostouraTransaction[]): FundGroup[] {
  const sorted = [...txns].sort((a, b) => a.txnDate.localeCompare(b.txnDate))
  const groups: FundGroup[] = []
  let current: FundGroup | null = null

  // Collect debits that arrive BEFORE the first credit into an "opening" bucket
  const preDebits: QBAlostouraTransaction[] = []

  for (const t of sorted) {
    if (t.amount > 0) {
      // A new incoming deposit — close the previous group
      if (current) {
        current.endDate     = t.txnDate
        current.totalDebits = current.debits.reduce((s, d) => s + Math.abs(d.amount), 0)
        current.remaining   = current.depositAmt - current.totalDebits
        current.byCategory  = summariseByCategory(current.debits)
        groups.push(current)
      } else if (preDebits.length) {
        // Flush pre-deposit debits as a synthetic "Opening Balance" group
        const totalD = preDebits.reduce((s, d) => s + Math.abs(d.amount), 0)
        groups.push({
          depositId:   'opening',
          depositDate: preDebits[0].txnDate,
          depositor:   'Opening / Prior Period',
          memo:        '',
          depositAmt:  0,
          endDate:     t.txnDate,
          debits:      preDebits,
          totalDebits: totalD,
          remaining:   -totalD,
          byCategory:  summariseByCategory(preDebits),
        })
      }
      current = {
        depositId:   t.txnId || `dep-${t.txnDate}`,
        depositDate: t.txnDate,
        depositor:   t.name || 'Client',
        memo:        t.memo,
        depositAmt:  t.amount,
        endDate:     null,
        debits:      [],
        totalDebits: 0,
        remaining:   t.amount,
        byCategory:  [],
      }
    } else if (t.amount < 0) {
      if (current) {
        current.debits.push(t)
      } else {
        preDebits.push(t)
      }
    }
  }

  // Close the last open group
  if (current) {
    current.totalDebits = current.debits.reduce((s, d) => s + Math.abs(d.amount), 0)
    current.remaining   = current.depositAmt - current.totalDebits
    current.byCategory  = summariseByCategory(current.debits)
    groups.push(current)
  }

  return groups
}

function summariseByCategory(debits: QBAlostouraTransaction[]): Array<{ name: string; amount: number }> {
  const map = new Map<string, number>()
  for (const d of debits) {
    const cat = categorise(d.split)
    map.set(cat, (map.get(cat) ?? 0) + Math.abs(d.amount))
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp   = new URL(req.url).searchParams
  const from = sp.get('from') || defaultFrom()
  const to   = sp.get('to')   || defaultTo()

  const tokens = await loadTokensAsync()
  if (!tokens) {
    // Try snapshot fallback
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json({ found: false, message: 'QuickBooks not connected.' }, { status: 401 })
    }
    const { data } = await supabaseAdmin.from('qb_snapshot').select('rak_bank, synced_at').eq('id', 1).single()
    const cached = (data as any)?.rak_bank as { transactions: QBAlostouraTransaction[]; account: unknown; summary: unknown } | null
    if (!cached) {
      return NextResponse.json({ found: false, message: 'QuickBooks not connected. Connect QB and run a sync to see RAK Bank data.' })
    }
    const txns = cached.transactions.filter(t => t.txnDate >= from && t.txnDate <= to)
    return buildResponse(txns, cached.account, from, to, 'snapshot', (data as any)?.synced_at)
  }

  try {
    const accounts = await fetchAccounts()

    // Find the RAK Bank account — prefer an exact Bank-type account named "RAK Bank"
    let rakAccount = accounts.find(a =>
      a.AccountType === 'Bank' &&
      a.Name.toLowerCase().replace(/\s+/g, ' ').includes('rak bank')
    )
    // Broader fallback: any active Bank account with "RAK" in the name
    if (!rakAccount) {
      rakAccount = accounts.find(a =>
        a.AccountType === 'Bank' &&
        a.Name.toLowerCase().includes('rak') &&
        !a.Name.toLowerCase().includes('credit')
      )
    }

    if (!rakAccount) {
      return NextResponse.json({
        found:   false,
        message: `No RAK Bank account found in your QuickBooks Chart of Accounts. ` +
                 `Available bank accounts: ${accounts.filter(a => a.AccountType === 'Bank').map(a => a.Name).join(', ') || 'none found'}.`,
        accounts: accounts.filter(a => a.AccountType === 'Bank').map(a => ({ Id: a.Id, Name: a.Name })),
      })
    }

    const glReport   = await fetchGLReport(rakAccount.Id, from, to)
    const txns       = parseGLReport(glReport)

    return buildResponse(
      txns,
      { id: rakAccount.Id, name: rakAccount.Name, balance: rakAccount.CurrentBalance },
      from, to, 'live', new Date().toISOString()
    )
  } catch (err: any) {
    console.error('[RAK Bank GL] Error:', err.message)
    return NextResponse.json({ found: false, message: `QB error: ${err.message}` }, { status: 500 })
  }
}

function buildResponse(
  txns:     QBAlostouraTransaction[],
  account:  unknown,
  from:     string,
  to:       string,
  source:   string,
  fetchedAt: string,
) {
  const sorted      = [...txns].sort((a, b) => a.txnDate.localeCompare(b.txnDate))
  const monthly     = buildMonthSummaries(sorted)
  const groups      = buildGroups(sorted)

  const totalIn  = sorted.filter(t => t.amount >  0).reduce((s, t) => s + t.amount,         0)
  const totalOut = sorted.filter(t => t.amount <  0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const closing  = sorted.length ? sorted[sorted.length - 1].balance : 0

  return NextResponse.json({
    found:        true,
    source,
    fetched_at:   fetchedAt,
    account,
    dateFilter:   { from, to },
    transactions: [...sorted].reverse(),   // newest first for timeline tab
    groups,                                // oldest first for allocation tab
    monthly,
    summary: {
      totalIn:        Math.round(totalIn  * 100) / 100,
      totalOut:       Math.round(totalOut * 100) / 100,
      net:            Math.round((totalIn - totalOut) * 100) / 100,
      closingBalance: Math.round(closing  * 100) / 100,
      txnCount:       sorted.length,
    },
  })
}
