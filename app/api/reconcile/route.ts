/**
 * POST /api/reconcile
 *
 * Accepts a bank statement file (CSV / XLSX / PDF) + QB bank account ID + date range.
 * Fetches the QB General Ledger for that account, parses the bank file, runs the
 * matching engine, and returns categorised results.
 *
 * READ-ONLY — never writes to QuickBooks or modifies any data.
 */
import { NextRequest, NextResponse }          from 'next/server'
import { fetchGLReport, parseGLReport }       from '@/lib/quickbooks/client'
import { loadTokensAsync }                    from '@/lib/quickbooks/tokens'
import Anthropic                              from '@anthropic-ai/sdk'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ── Shared types ──────────────────────────────────────────────────────────────

export interface NormalizedTxn {
  id:          string
  date:        string   // YYYY-MM-DD
  amount:      number   // positive = credit / money-in, negative = debit / money-out
  description: string
  reference:   string
}

export type MatchStatus =
  | 'MATCHED'
  | 'POSSIBLE_MATCH'
  | 'MISSING_IN_QB'
  | 'MISSING_IN_BANK'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE'

export interface MatchResult {
  id:       string
  status:   MatchStatus
  reason:   string
  bankTxn?: NormalizedTxn
  qbTxn?:   NormalizedTxn
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

function csvLine(line: string): string[] {
  const out: string[] = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"')          inQ = !inQ
    else if (ch === ',' && !inQ) { out.push(cur); cur = '' }
    else                         cur += ch
  }
  out.push(cur)
  return out
}

function col(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => h === c || h.includes(c) || c.includes(h))
    if (i !== -1) return i
  }
  return -1
}

function clean(s: string) { return s.replace(/^["'\s]+|["'\s]+$/g, '').trim() }

function parseAmt(s: string): number {
  return parseFloat(clean(s).replace(/[^-\d.]/g, '')) || 0
}

function normalizeDate(s: string): string {
  s = clean(s)
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  // YYYY/MM/DD
  const m2 = s.match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/)
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return ''
}

function parseCSV(text: string): NormalizedTxn[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Find header row (first row that contains date/amount keywords)
  let headerIdx = 0
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    if (/date|amount|credit|debit|narration|description/i.test(lines[i])) { headerIdx = i; break }
  }

  const headers = csvLine(lines[headerIdx]).map(h => clean(h).toLowerCase())

  const dateIdx = col(headers, ['date','txn date','transaction date','value date','posting date','trans date'])
  const descIdx = col(headers, ['description','narration','particulars','memo','details','transaction details','remarks'])
  const refIdx  = col(headers, ['reference','ref','cheque no','cheque number','check number','transaction ref','trans ref','doc number'])
  const amtIdx  = col(headers, ['amount','transaction amount','net amount','net'])
  const crIdx   = col(headers, ['credit','credit amount','deposits','cr','money in','in'])
  const drIdx   = col(headers, ['debit','debit amount','withdrawals','dr','money out','out'])

  if (dateIdx === -1) return []

  const txns: NormalizedTxn[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = csvLine(lines[i])
    const dateStr = clean(parts[dateIdx] ?? '')
    if (!dateStr) continue
    const date = normalizeDate(dateStr)
    if (!date) continue

    let amount = 0
    if (amtIdx !== -1) {
      amount = parseAmt(parts[amtIdx] ?? '0')
    } else if (crIdx !== -1 || drIdx !== -1) {
      const cr = crIdx !== -1 ? parseAmt(parts[crIdx] ?? '0') : 0
      const dr = drIdx !== -1 ? parseAmt(parts[drIdx] ?? '0') : 0
      amount = cr > 0 ? cr : -dr   // credits positive, debits negative
    }

    txns.push({
      id:          `bank_${i}`,
      date,
      amount,
      description: descIdx !== -1 ? clean(parts[descIdx] ?? '') : '',
      reference:   refIdx  !== -1 ? clean(parts[refIdx]  ?? '') : '',
    })
  }

  return txns.filter(t => t.amount !== 0)
}

// ── XLSX parser ────────────────────────────────────────────────────────────────

async function parseXLSX(buffer: ArrayBuffer): Promise<NormalizedTxn[]> {
  const XLSX = await import('xlsx')
  const wb   = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  const csv  = XLSX.utils.sheet_to_csv(ws)
  return parseCSV(csv)
}

// ── PDF parser (Claude AI) ─────────────────────────────────────────────────────

async function parsePDF(buffer: ArrayBuffer): Promise<NormalizedTxn[]> {
  const base64 = Buffer.from(buffer).toString('base64')

  const pdfClient = new Anthropic({
    apiKey:         process.env.SAMA_AI_KEY || '',
    defaultHeaders: { 'anthropic-beta': 'pdfs-2024-09-25' },
  })

  const msg = await pdfClient.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{
      role:    'user',
      content: [
        {
          type:   'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any,
        {
          type: 'text',
          text: `Extract every bank transaction from this statement.
Return ONLY a JSON array — no explanation, no markdown fences:
[{"date":"YYYY-MM-DD","amount":number,"description":"string","reference":"string"}]

Rules:
- date: always YYYY-MM-DD format
- amount: positive for credits/deposits (money coming IN), negative for debits/withdrawals (money going OUT)
- description: the transaction narration or description line
- reference: cheque number, reference number, or transaction ID if available, otherwise ""
- Exclude opening balance, closing balance, and summary rows
- Exclude column headers`,
        },
      ],
    }],
  })

  const text  = ((msg.content ?? []).find((b: any) => b.type === 'text') as any)?.text as string ?? ''
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return []

  try {
    const rows = JSON.parse(match[0]) as Array<{date:string; amount:number; description:string; reference:string}>
    return rows
      .map((r, i) => ({
        id:          `bank_${i}`,
        date:        normalizeDate(r.date) || r.date,
        amount:      Number(r.amount) || 0,
        description: String(r.description ?? ''),
        reference:   String(r.reference   ?? ''),
      }))
      .filter(t => t.date && t.amount !== 0)
  } catch {
    return []
  }
}

// ── Matching helpers ───────────────────────────────────────────────────────────

function daysDiff(a: string, b: string): number {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000)
}

function amtEq(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) < 0.02
}

function wordSim(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 2))
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 2))
  if (!wa.size || !wb.size) return 0
  return [...wa].filter(w => wb.has(w)).length / Math.max(wa.size, wb.size)
}

// ── Matching engine ────────────────────────────────────────────────────────────

function matchTransactions(
  bankTxns: NormalizedTxn[],
  qbTxns:   NormalizedTxn[],
): MatchResult[] {
  const results:  MatchResult[] = []
  const usedQB   = new Set<string>()
  const usedBank = new Set<string>()

  for (const bank of bankTxns) {
    // Priority 1 — exact amount + exact date
    const exact = qbTxns.find(q =>
      !usedQB.has(q.id) && amtEq(bank.amount, q.amount) && bank.date === q.date
    )
    if (exact) {
      results.push({ id: `m_${bank.id}`, bankTxn: bank, qbTxn: exact, status: 'MATCHED', reason: 'Exact amount + date' })
      usedQB.add(exact.id); usedBank.add(bank.id); continue
    }

    // Priority 2 — same amount ±3 days
    const loose = qbTxns.find(q =>
      !usedQB.has(q.id) && amtEq(bank.amount, q.amount) && daysDiff(bank.date, q.date) <= 3
    )
    if (loose) {
      const d = Math.round(daysDiff(bank.date, loose.date))
      results.push({ id: `m_${bank.id}`, bankTxn: bank, qbTxn: loose, status: 'MATCHED', reason: `Amount match, ${d} day(s) apart` })
      usedQB.add(loose.id); usedBank.add(bank.id); continue
    }

    // Priority 3 — reference number match
    if (bank.reference) {
      const refM = qbTxns.find(q =>
        !usedQB.has(q.id) && q.reference && bank.reference === q.reference
      )
      if (refM) {
        results.push({ id: `m_${bank.id}`, bankTxn: bank, qbTxn: refM, status: 'MATCHED', reason: 'Reference number match' })
        usedQB.add(refM.id); usedBank.add(bank.id); continue
      }
    }

    // Priority 4 — possible match (close amount within 5% + similar description)
    const possible = qbTxns.find(q => {
      if (usedQB.has(q.id)) return false
      const pct = Math.abs(bank.amount) > 0 ? Math.abs(Math.abs(bank.amount) - Math.abs(q.amount)) / Math.abs(bank.amount) : 1
      return pct < 0.05 && wordSim(bank.description, q.description) > 0.4
    })
    if (possible) {
      results.push({ id: `m_${bank.id}`, bankTxn: bank, qbTxn: possible, status: 'POSSIBLE_MATCH', reason: 'Similar description, close amount' })
      usedQB.add(possible.id); usedBank.add(bank.id); continue
    }

    // Priority 5 — amount mismatch (same date ±1 day, similar description, different amount)
    const mismatch = qbTxns.find(q =>
      !usedQB.has(q.id) && daysDiff(bank.date, q.date) <= 1 && wordSim(bank.description, q.description) > 0.35
    )
    if (mismatch) {
      results.push({
        id: `m_${bank.id}`, bankTxn: bank, qbTxn: mismatch, status: 'AMOUNT_MISMATCH',
        reason: `Bank AED ${Math.abs(bank.amount).toLocaleString()} vs QB AED ${Math.abs(mismatch.amount).toLocaleString()}`,
      })
      usedQB.add(mismatch.id); usedBank.add(bank.id); continue
    }

    // No match
    results.push({ id: `miss_${bank.id}`, bankTxn: bank, status: 'MISSING_IN_QB', reason: 'No matching entry in QuickBooks' })
    usedBank.add(bank.id)
  }

  // QB transactions with no bank match
  for (const qb of qbTxns) {
    if (!usedQB.has(qb.id)) {
      results.push({ id: `qb_${qb.id}`, qbTxn: qb, status: 'MISSING_IN_BANK', reason: 'No matching entry in bank statement' })
    }
  }

  // Flag duplicate bank entries (same amount + date appearing more than once among unmatched)
  const bankSeen = new Map<string, string>()
  for (const r of results) {
    if (!r.bankTxn || r.status === 'MATCHED') continue
    const key = `${r.bankTxn.date}|${r.bankTxn.amount}`
    const first = bankSeen.get(key)
    if (first) {
      r.status = 'DUPLICATE'
      r.reason = `Same date+amount already appears in entry ${first}`
    } else {
      bankSeen.set(key, r.bankTxn.id)
    }
  }

  return results
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    const form        = await req.formData()
    const accountId   = form.get('accountId')   as string | null
    const accountName = form.get('accountName') as string | null
    const from        = form.get('from')        as string | null
    const to          = form.get('to')          as string | null
    const file        = form.get('file')        as File   | null

    if (!accountId || !from || !to || !file) {
      return NextResponse.json({ error: 'accountId, from, to, and file are required.' }, { status: 400 })
    }

    // ── 1. Parse bank statement ──────────────────────────────────────────────
    const ext    = file.name.toLowerCase().split('.').pop() ?? ''
    const buffer = await file.arrayBuffer()
    let bankTxns: NormalizedTxn[] = []

    if (ext === 'csv' || ext === 'txt') {
      bankTxns = parseCSV(new TextDecoder().decode(buffer))
    } else if (ext === 'xlsx' || ext === 'xls') {
      bankTxns = await parseXLSX(buffer)
    } else if (ext === 'pdf') {
      bankTxns = await parsePDF(buffer)
    } else {
      return NextResponse.json({ error: `Unsupported file: .${ext}. Please upload CSV, XLSX, or PDF.` }, { status: 400 })
    }

    // Filter to selected date range
    bankTxns = bankTxns.filter(t => t.date >= from && t.date <= to)

    if (bankTxns.length === 0) {
      return NextResponse.json({
        error: 'No transactions parsed from the bank statement. Check the date range matches the statement, or that the file has the correct columns (Date, Amount / Credit / Debit, Description).',
      }, { status: 400 })
    }

    // ── 2. Fetch QB GL for the selected bank account ─────────────────────────
    const glRaw  = await fetchGLReport(accountId, from, to)
    const glTxns = parseGLReport(glRaw)

    const qbTxns: NormalizedTxn[] = glTxns.map((t, i) => ({
      id:          `qb_${i}_${t.txnId}`,
      date:        t.txnDate,
      amount:      t.amount,
      description: [t.txnType, t.name, t.memo].filter(Boolean).join(' · '),
      reference:   t.txnId ?? '',
    }))

    // ── 3. Match ─────────────────────────────────────────────────────────────
    const results = matchTransactions(bankTxns, qbTxns)

    // ── 4. Summary ───────────────────────────────────────────────────────────
    const matched      = results.filter(r => r.status === 'MATCHED').length
    const missingInQB  = results.filter(r => r.status === 'MISSING_IN_QB').length
    const missingInBnk = results.filter(r => r.status === 'MISSING_IN_BANK').length
    const mismatch     = results.filter(r => r.status === 'AMOUNT_MISMATCH').length
    const possible     = results.filter(r => r.status === 'POSSIBLE_MATCH').length
    const duplicates   = results.filter(r => r.status === 'DUPLICATE').length

    const totalBank = bankTxns.reduce((s, t) => s + t.amount, 0)
    const totalQB   = qbTxns.reduce((s, t) => s + t.amount, 0)

    return NextResponse.json({
      accountName,
      from,
      to,
      summary: {
        bankCount:     bankTxns.length,
        qbCount:       qbTxns.length,
        matched,
        unmatched:     results.length - matched,
        missingInQB,
        missingInBank: missingInBnk,
        mismatch,
        possible,
        duplicates,
        accuracy:      Math.round(matched / Math.max(bankTxns.length, qbTxns.length, 1) * 100),
        totalBankAmt:  Math.round(totalBank * 100) / 100,
        totalQBAmt:    Math.round(totalQB   * 100) / 100,
        difference:    Math.round(Math.abs(totalBank - totalQB) * 100) / 100,
      },
      results,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Reconciliation failed'
    console.error('[Reconcile]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
