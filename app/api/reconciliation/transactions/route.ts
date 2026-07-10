/**
 * GET /api/reconciliation/transactions?accountId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * accountId = QB account ID  → fetches GL for that single account
 * accountId = "__ALL__"      → fetches TransactionList across the whole company file
 *
 * Returns normalised transaction objects including `split` (the Chart of Accounts category)
 * and, in global mode, `accountName` (which QB account the transaction was posted to).
 */
import { NextRequest, NextResponse }                        from 'next/server'
import { loadTokensAsync, isAccessTokenFresh }              from '@/lib/quickbooks/tokens'
import { fetchGLReport, parseGLReport, refreshAccessToken } from '@/lib/quickbooks/client'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300

// Sentinel value that triggers cross-account global search
const GLOBAL_ID = '__ALL__'

// ── QB base URL helper ────────────────────────────────────────────────────────
function qbBase() {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
}

// ── TransactionList report (all accounts) ────────────────────────────────────

async function fetchTransactionList(
  tokens: { access_token: string; realm_id: string },
  from:   string,
  to:     string,
): Promise<unknown> {
  const url = `${qbBase()}/${tokens.realm_id}/reports/TransactionList?start_date=${from}&end_date=${to}&minorversion=70`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`TransactionList report failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

interface TLRow {
  id:          string
  date:        string
  amount:      number
  txnType:     string
  name:        string
  memo:        string
  accountName: string   // which QB account the transaction is posted to
  split:       string   // the contra-account / category
  reference:   string
}

function parseTransactionList(report: unknown): TLRow[] {
  const r    = report as any
  const cols: any[] = r?.Columns?.Column ?? []

  // Locate column indices by ColType (QB uses different ColType strings per report version)
  const find = (...types: string[]) => {
    for (const t of types) {
      const i = cols.findIndex((c: any) => c.ColType === t)
      if (i !== -1) return i
    }
    return -1
  }

  const typeIdx  = find('TxnType')
  const dateIdx  = find('tx_date', 'TxnDate', 'date')
  const numIdx   = find('doc_num', 'TxnNum', 'num')
  const nameIdx  = find('entity_name', 'name', 'EntityName')
  const memoIdx  = find('memo', 'Memo', 'description')
  const acctIdx  = find('account_name', 'account', 'Account')
  const splitIdx = find('split_acc', 'split', 'Split')
  const amtIdx   = find('subt_nat_amount', 'amount', 'Amount')

  const results: TLRow[] = []

  for (const row of r?.Rows?.Row ?? []) {
    if (row.type !== 'Data') continue
    const d: any[] = row.ColData ?? []

    const date = (d[dateIdx]?.value ?? '').trim()
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

    const rawAmt = (d[amtIdx]?.value ?? '0').replace(/,/g, '')
    const amount = parseFloat(rawAmt) || 0
    if (amount === 0) continue

    results.push({
      id:          `tl_${row.id ?? results.length}`,
      date,
      amount,
      txnType:     (d[typeIdx]?.value  ?? '').trim(),
      name:        (d[nameIdx]?.value  ?? '').trim(),
      memo:        (d[memoIdx]?.value  ?? '').trim(),
      accountName: (d[acctIdx]?.value  ?? '').trim(),
      split:       (d[splitIdx]?.value ?? '').trim(),
      reference:   (d[numIdx]?.value   ?? '').trim(),
    })
  }

  return results
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

    // Auto-refresh stale access token
    const fresh = isAccessTokenFresh(tokens) ? tokens : await refreshAccessToken(tokens)
    Object.assign(tokens, fresh)   // keep module-level cache in sync for qbFetch
    const t = { access_token: fresh.access_token, realm_id: fresh.realm_id }

    // ── Global search: TransactionList across all accounts ────────────────────
    if (accountId === GLOBAL_ID) {
      const report = await fetchTransactionList(t, from, to)
      const rows   = parseTransactionList(report)

      const transactions = rows.map(r => ({
        id:          r.id,
        date:        r.date,
        amount:      r.amount,
        description: [r.txnType, r.name, r.memo].filter(Boolean).join(' · '),
        reference:   r.reference,
        txnType:     r.txnType,
        name:        r.name,
        memo:        r.memo,
        split:       r.split,
        accountName: r.accountName,   // which QB account — key field for global search
        balance:     0,
      }))

      return NextResponse.json({ transactions, count: transactions.length, isGlobalSearch: true })
    }

    // ── Single-account: GeneralLedger for the chosen account ─────────────────
    const report = await fetchGLReport(accountId, from, to)
    const rows   = parseGLReport(report)

    const transactions = rows.map((r, i) => ({
      id:          `qb_${i}_${r.txnId || i}`,
      date:        r.txnDate,
      amount:      r.amount,
      description: [r.txnType, r.name, r.memo].filter(Boolean).join(' · '),
      reference:   r.txnId ?? '',
      txnType:     r.txnType ?? '',
      name:        r.name    ?? '',
      memo:        r.memo    ?? '',
      split:       r.split   ?? '',
      accountName: '',   // not meaningful in single-account GL mode
      balance:     r.balance ?? 0,
    }))

    return NextResponse.json({ transactions, count: transactions.length, isGlobalSearch: false })
  } catch (e) {
    const msg    = e instanceof Error ? e.message : 'Failed to fetch QB transactions'
    const isAuth = msg.includes('invalid_grant') || msg.includes('401') || msg.includes('token')
    console.error('[reconciliation/transactions]', msg)
    return NextResponse.json(
      { error: msg, requiresReconnect: isAuth },
      { status: isAuth ? 401 : 500 },
    )
  }
}
