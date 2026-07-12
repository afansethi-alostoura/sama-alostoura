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

interface TLParseResult {
  rows:         TLRow[]
  debug: {
    colTypes:     string[]
    dataRowCount: number
    parsedCount:  number
    amtColIdx:    number
    dateColIdx:   number
    sampleValues: string[]
  }
}

function parseTransactionList(report: unknown): TLParseResult {
  const r    = report as any
  const cols: any[] = r?.Columns?.Column ?? []

  // Case-insensitive ColType lookup with multiple fallback names
  const find = (...types: string[]) => {
    for (const t of types) {
      const lo = t.toLowerCase()
      const i  = cols.findIndex((c: any) =>
        c.ColType === t || c.ColType?.toLowerCase() === lo ||
        c.ColTitle?.toLowerCase() === lo
      )
      if (i !== -1) return i
    }
    return -1
  }

  const dateIdx  = find('tx_date',  'txndate',   'date',           'txn_date')
  const typeIdx  = find('TxnType',  'txn_type',  'transactiontype','transaction_type')
  const numIdx   = find('doc_num',  'txnnum',    'num',            'reference', 'doc_number')
  const nameIdx  = find('entity_name','name',    'entityname',     'vendor_name', 'payee')
  const memoIdx  = find('memo',     'Memo',      'description',    'memo_descr', 'narration')
  const acctIdx  = find('account_name','account','acct',           'Account')
  const splitIdx = find('split_acc','split',     'Split',          'split_account', 'category')
  // QB GL uses 'subt_net_amount'; TransactionList uses 'subt_nat_amount' — try both
  const amtIdx   = find('subt_nat_amount','subt_net_amount','amount','Amount','nat_amount','net_amount','net_amount_home')

  // Log column discovery so server logs reveal parsing issues
  console.log('[TxnList] cols:', cols.map((c: any, i: number) => `${i}:${c.ColType}`).join(' | '))
  console.log('[TxnList] idx →', { dateIdx, typeIdx, numIdx, nameIdx, memoIdx, acctIdx, splitIdx, amtIdx })

  // Collect all Data rows — handle both flat structure and nested Section→Data (like GL)
  const dataRows: any[] = []
  const collect = (rows: any[]) => {
    for (const row of rows) {
      if (row.type === 'Data') {
        dataRows.push(row)
      } else if (row.Rows?.Row) {
        collect(row.Rows.Row)
      }
    }
  }
  collect(r?.Rows?.Row ?? [])
  console.log(`[TxnList] data rows found: ${dataRows.length}`)
  if (dataRows.length > 0) {
    const sample = dataRows[0].ColData?.map((c: any) => c?.value).join(' | ')
    console.log('[TxnList] first row values:', sample)
  }

  const results: TLRow[] = []

  for (const row of dataRows) {
    const d: any[] = row.ColData ?? []

    // Parse date — accept YYYY-MM-DD, MM/DD/YYYY, or ISO datetime
    let isoDate: string | null = null
    const rawDate = dateIdx >= 0 ? (d[dateIdx]?.value ?? '').trim() : ''
    if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
      isoDate = rawDate.slice(0, 10)
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const [m, day, y] = rawDate.split('/')
      isoDate = `${y}-${m.padStart(2,'0')}-${day.padStart(2,'0')}`
    }
    if (!isoDate) continue

    const rawAmt = amtIdx >= 0 ? (d[amtIdx]?.value ?? '').replace(/,/g, '') : ''
    const amount = parseFloat(rawAmt) || 0
    if (amount === 0) continue

    results.push({
      id:          `tl_${row.id ?? results.length}`,
      date:        isoDate,
      amount,
      txnType:     typeIdx  >= 0 ? (d[typeIdx]?.value  ?? '').trim() : '',
      name:        nameIdx  >= 0 ? (d[nameIdx]?.value  ?? '').trim() : '',
      memo:        memoIdx  >= 0 ? (d[memoIdx]?.value  ?? '').trim() : '',
      accountName: acctIdx  >= 0 ? (d[acctIdx]?.value  ?? '').trim() : '',
      split:       splitIdx >= 0 ? (d[splitIdx]?.value ?? '').trim() : '',
      reference:   numIdx   >= 0 ? (d[numIdx]?.value   ?? '').trim() : '',
    })
  }

  console.log(`[TxnList] parsed ${results.length} transactions with non-zero amounts`)
  return {
    rows: results,
    debug: {
      colTypes:     cols.map((c: any) => `${c.ColType}(${c.ColTitle})`),
      dataRowCount: dataRows.length,
      parsedCount:  results.length,
      amtColIdx:    amtIdx,
      dateColIdx:   dateIdx,
      sampleValues: dataRows[0]?.ColData?.map((c: any) => c?.value ?? '') ?? [],
    },
  }
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
      const report            = await fetchTransactionList(t, from, to)
      const { rows, debug }   = parseTransactionList(report)

      const transactions = rows.map((r: TLRow) => ({
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

      return NextResponse.json({
        transactions,
        count: transactions.length,
        isGlobalSearch: true,
        // Debug info helps diagnose 0-transaction situations without needing server logs
        debug: transactions.length === 0 ? debug : undefined,
      })
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
