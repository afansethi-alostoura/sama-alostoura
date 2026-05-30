/**
 * QuickBooks Online OAuth 2.0 + API client
 * Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
 */
import {
  loadTokens, loadTokensAsync, saveTokens, clearTokens,
  isAccessTokenFresh, isRefreshTokenValid,
} from './tokens'
import type { QBTokens, QBInvoice, QBPayment, QBCustomer, QBCompanyInfo, QBQueryResponse, QBClass, QBPurchase, QBBill, QBAccount, QBAlostouraTransaction, QBAlostouraMonthSummary } from './types'

// ── Config ──────────────────────────────────────────────────
const CLIENT_ID     = process.env.QUICKBOOKS_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET ?? ''
const REDIRECT_URI  = process.env.QUICKBOOKS_REDIRECT_URI  ?? 'http://localhost:3000/api/quickbooks/callback'
const ENVIRONMENT   = process.env.QUICKBOOKS_ENVIRONMENT   ?? 'sandbox'

const AUTH_URL      = 'https://appcenter.intuit.com/connect/oauth2'
const TOKEN_URL     = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const REVOKE_URL    = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
const API_BASE      = ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com/v3/company'
  : 'https://sandbox-quickbooks.api.intuit.com/v3/company'
const MINOR_VERSION = '70'
const SCOPES        = 'com.intuit.quickbooks.accounting'

// ── OAuth helpers ────────────────────────────────────────────
function basicAuth(): string {
  return 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
}

/** Generate the Intuit OAuth 2.0 authorization URL */
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

/** Exchange authorization code for access + refresh tokens */
export async function exchangeCode(code: string, realmId: string): Promise<QBTokens> {
  console.log('[QB] Exchanging code for tokens...')
  console.log('[QB] Config:', {
    clientId: CLIENT_ID?.substring(0, 10) + '...',
    redirectUri: REDIRECT_URI,
    environment: ENVIRONMENT
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  console.log('[QB] Token exchange response:', res.status, res.statusText)

  if (!res.ok) {
    const err = await res.text()
    console.error('[QB] Token exchange error:', err)
    throw new Error(`Token exchange failed (${res.status}): ${err}`)
  }

  try {
    const data = await res.json()
    console.log('[QB] Token received, saving to Supabase...')
    const tokens: QBTokens = { ...data, realm_id: realmId, created_at: Date.now() }
    await saveTokens(tokens)
    console.log('[QB] Tokens saved successfully!')
    return tokens
  } catch (err) {
    console.error('[QB] Error parsing or saving tokens:', err)
    throw err
  }
}

/** Refresh the access token using the refresh token */
export async function refreshAccessToken(tokens: QBTokens): Promise<QBTokens> {
  if (!isRefreshTokenValid(tokens)) {
    clearTokens()
    throw new Error('Refresh token has expired. Please reconnect QuickBooks.')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  const refreshed: QBTokens = { ...tokens, ...data, created_at: Date.now() }
  await saveTokens(refreshed)
  return refreshed
}

/** Revoke tokens and clear local storage */
export async function revokeTokens(): Promise<void> {
  const tokens = await loadTokensAsync()
  if (!tokens) return

  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: {
      Authorization:  basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
    body: new URLSearchParams({ token: tokens.refresh_token }),
  }).catch(() => {}) // ignore revoke errors, still clear local

  await clearTokens()
}

// ── Authenticated API call (with auto-refresh) ───────────────
async function qbFetch(path: string): Promise<Response> {
  let tokens = await loadTokensAsync()
  if (!tokens) throw new Error('QuickBooks not connected')

  if (!isAccessTokenFresh(tokens)) {
    tokens = await refreshAccessToken(tokens)
  }

  const url = `${API_BASE}/${tokens.realm_id}/${path}&minorversion=${MINOR_VERSION}`
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept:        'application/json',
    },
  })
}

async function qbQuery<T>(sql: string, entityName: string): Promise<T[]> {
  const res  = await qbFetch(`query?query=${encodeURIComponent(sql)}`)
  // Capture intuit_tid for support/debugging (recommended by Intuit)
  const intuitTid = res.headers.get('intuit_tid')
  if (intuitTid) console.log(`[QB] intuit_tid=${intuitTid} entity=${entityName}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`QBO query failed (${res.status}) tid=${intuitTid ?? 'n/a'}: ${err}`)
  }
  const data: QBQueryResponse<T> = await res.json()
  return (data.QueryResponse?.[entityName] as T[] | undefined) ?? []
}

// ── Data fetch functions ─────────────────────────────────────
export async function fetchInvoices(maxResults = 200): Promise<QBInvoice[]> {
  return qbQuery<QBInvoice>(
    `SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`,
    'Invoice'
  )
}

export async function fetchPayments(maxResults = 200): Promise<QBPayment[]> {
  return qbQuery<QBPayment>(
    `SELECT * FROM Payment ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`,
    'Payment'
  )
}

export async function fetchCustomers(maxResults = 100): Promise<QBCustomer[]> {
  return qbQuery<QBCustomer>(
    `SELECT * FROM Customer WHERE Active = true ORDERBY DisplayName MAXRESULTS ${maxResults}`,
    'Customer'
  )
}

export async function fetchCompanyInfo(): Promise<QBCompanyInfo | null> {
  const tokens = await loadTokensAsync()
  if (!tokens) return null
  const res  = await qbFetch(`companyinfo/${tokens.realm_id}?`)
  if (!res.ok) return null
  const data = await res.json()
  return data.CompanyInfo ?? null
}

export async function fetchClasses(maxResults = 100): Promise<QBClass[]> {
  return qbQuery<QBClass>(
    `SELECT * FROM Class WHERE Active = true MAXRESULTS ${maxResults}`,
    'Class'
  )
}

export async function fetchPurchases(maxResults = 300): Promise<QBPurchase[]> {
  return qbQuery<QBPurchase>(
    `SELECT * FROM Purchase ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`,
    'Purchase'
  )
}

export async function fetchBills(maxResults = 300): Promise<QBBill[]> {
  return qbQuery<QBBill>(
    `SELECT * FROM Bill ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`,
    'Bill'
  )
}

/**
 * Fetch purchases filtered to a specific date range directly from QB API.
 * Uses QB IDS SQL WHERE clause — no result-count cap surprises.
 */
export async function fetchPurchasesInRange(
  from: string | null,
  to:   string | null,
  maxResults = 1000,
): Promise<QBPurchase[]> {
  const conditions: string[] = []
  if (from) conditions.push(`TxnDate >= '${from}'`)
  if (to)   conditions.push(`TxnDate <= '${to}'`)
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return qbQuery<QBPurchase>(
    `SELECT * FROM Purchase${where} ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`,
    'Purchase'
  )
}

/**
 * Fetch bills filtered to a specific date range directly from QB API.
 */
export async function fetchBillsInRange(
  from: string | null,
  to:   string | null,
  maxResults = 1000,
): Promise<QBBill[]> {
  const conditions: string[] = []
  if (from) conditions.push(`TxnDate >= '${from}'`)
  if (to)   conditions.push(`TxnDate <= '${to}'`)
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return qbQuery<QBBill>(
    `SELECT * FROM Bill${where} ORDERBY TxnDate DESC MAXRESULTS ${maxResults}`,
    'Bill'
  )
}

/**
 * Fetch all Chart of Accounts entries.
 */
export async function fetchAccounts(maxResults = 300): Promise<QBAccount[]> {
  return qbQuery<QBAccount>(
    `SELECT * FROM Account WHERE Active = true MAXRESULTS ${maxResults}`,
    'Account'
  )
}

/**
 * Fetch the General Ledger report for a specific account.
 * Returns the raw QB report JSON — parse with parseGLReport().
 * QB path: reports/GeneralLedger?account={id}&start_date={from}&end_date={to}
 */
export async function fetchGLReport(
  accountId: string,
  from:      string,
  to:        string,
): Promise<unknown> {
  const path = `reports/GeneralLedger?account=${encodeURIComponent(accountId)}&start_date=${from}&end_date=${to}`
  const res  = await qbFetch(path)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GeneralLedger report failed (${res.status}): ${err}`)
  }
  return res.json()
}

/**
 * Parse a raw QB GeneralLedger report into an array of QBAlostouraTransaction.
 * Handles QB's nested Section→Data row structure and dynamic column ordering.
 */
export function parseGLReport(report: unknown): QBAlostouraTransaction[] {
  const r = report as any

  // Discover column positions from the Columns block
  const rawCols: any[] = r?.Columns?.Column ?? []
  const colIdx: Record<string, number> = {}
  rawCols.forEach((c: any, i: number) => { colIdx[c.ColType] = i })

  const dateIdx  = colIdx['tx_date']         ?? 0
  const typeIdx  = colIdx['txn_type']        ?? 1
  const memoIdx  = colIdx['memo']            ?? 4
  const splitIdx = colIdx['split_acc']       ?? 5
  const amtIdx   = colIdx['subt_net_amount'] ?? 6
  const balIdx   = colIdx['rbal_nat_amount'] ?? 7
  // entity_name is col 3 in most minorversions
  const nameIdx  = colIdx['entity_name']     ?? 3

  const txns: QBAlostouraTransaction[] = []

  const outerRows: any[] = r?.Rows?.Row ?? []
  for (const section of outerRows) {
    // Top-level Section represents the account; inner Rows are transactions
    const innerRows: any[] = section?.Rows?.Row ?? []
    for (const row of innerRows) {
      if (row.type !== 'Data') continue
      const cols: any[] = row.ColData ?? []
      const date = cols[dateIdx]?.value ?? ''
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue   // skip totals/blank rows

      const amount  = parseFloat(cols[amtIdx]?.value ?? '0') || 0
      const balance = parseFloat(cols[balIdx]?.value ?? '0') || 0

      txns.push({
        txnDate: date,
        txnType: cols[typeIdx]?.value ?? '',
        txnId:   cols[dateIdx]?.id    ?? '',
        name:    cols[nameIdx]?.value ?? '',
        memo:    cols[memoIdx]?.value ?? '',
        split:   cols[splitIdx]?.value ?? '',
        amount,
        balance,
      })
    }
  }

  return txns.sort((a, b) => a.txnDate.localeCompare(b.txnDate))
}

/**
 * Aggregate transactions into per-month summaries with running balance.
 */
export function buildMonthSummaries(
  txns: QBAlostouraTransaction[],
): QBAlostouraMonthSummary[] {
  const map: Record<string, { credits: number; debits: number; balance: number }> = {}

  for (const tx of txns) {
    const m = tx.txnDate.slice(0, 7)
    if (!map[m]) map[m] = { credits: 0, debits: 0, balance: 0 }
    if (tx.amount >= 0) map[m].credits += tx.amount
    else                map[m].debits  += Math.abs(tx.amount)
    map[m].balance = tx.balance   // last transaction in month = closing balance
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => {
      const [y, mo] = month.split('-').map(Number)
      const label = new Date(y, mo - 1, 1).toLocaleString('en-AE', { month: 'short', year: 'numeric' })
      return {
        month,
        label,
        credits:   Math.round(d.credits   * 100) / 100,
        debits:    Math.round(d.debits    * 100) / 100,
        netChange: Math.round((d.credits - d.debits) * 100) / 100,
        balance:   Math.round(d.balance   * 100) / 100,
      }
    })
}

// ── Status check ─────────────────────────────────────────────
export interface QBStatus {
  connected: boolean
  realm_id?: string
  company_name?: string
  access_token_valid?: boolean
  refresh_token_valid?: boolean
  synced_at?: string
  environment: string
  client_configured: boolean
}

export async function getStatus(): Promise<QBStatus> {
  const configured = !!(CLIENT_ID && CLIENT_SECRET)
  const tokens     = await loadTokensAsync()

  if (!tokens) {
    return { connected: false, client_configured: configured, environment: ENVIRONMENT }
  }

  // Check for cached company name
  let companyName: string | undefined
  let syncedAt: string | undefined
  try {
    const fs   = require('fs')  as typeof import('fs')
    const path = require('path') as typeof import('path')
    const snap = path.join(process.cwd(), '.qb-data.json')
    if (fs.existsSync(snap)) {
      const d = JSON.parse(fs.readFileSync(snap, 'utf8'))
      companyName = d.company_name
      syncedAt    = d.synced_at
    }
  } catch {}

  return {
    connected:           true,
    realm_id:            tokens.realm_id,
    company_name:        companyName,
    access_token_valid:  isAccessTokenFresh(tokens),
    refresh_token_valid: isRefreshTokenValid(tokens),
    synced_at:           syncedAt,
    environment:         ENVIRONMENT,
    client_configured:   configured,
  }
}
