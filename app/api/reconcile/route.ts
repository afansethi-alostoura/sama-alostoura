/**
 * POST /api/reconcile — AI-powered bank reconciliation
 * Claude reads the bank statement + QB GL and reconciles them.
 * READ-ONLY — never writes to QuickBooks.
 */
import { NextRequest, NextResponse }    from 'next/server'
import { fetchGLReport, parseGLReport } from '@/lib/quickbooks/client'
import { loadTokensAsync }              from '@/lib/quickbooks/tokens'
import { anthropic }                    from '@/lib/anthropic'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300

// ── Shared types ──────────────────────────────────────────────────────────────

export interface NormalizedTxn {
  id:          string
  date:        string
  amount:      number
  description: string
  reference:   string
}

export type MatchStatus =
  | 'MATCHED' | 'POSSIBLE_MATCH' | 'MISSING_IN_QB'
  | 'MISSING_IN_BANK' | 'AMOUNT_MISMATCH' | 'DUPLICATE'

export interface MatchResult {
  id:       string
  status:   MatchStatus
  reason:   string
  bankTxn?: NormalizedTxn
  qbTxn?:   NormalizedTxn
}

// ── CSV normalizer ────────────────────────────────────────────────────────────
// Parses any CSV (including multi-line quoted fields like RAK Bank exports)
// and returns a clean flat table: one transaction per line.

function normalizeCSV(raw: string): string {
  // ── Step 1: tokenise the raw CSV properly (handle quoted multi-line fields)
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ   = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { field += '"'; i++; continue }
      inQ = !inQ
    } else if (ch === ',' && !inQ) {
      row.push(field.trim()); field = ''
    } else if (ch === '\n' && !inQ) {
      row.push(field.trim()); rows.push(row); row = []; field = ''
    } else if (ch === '\n' && inQ) {
      field += ' '          // flatten newlines inside quoted fields → single space
    } else {
      field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }

  // ── Step 2: find the header row
  let headerIdx = -1
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const joined = rows[r].join(' ').toLowerCase()
    if (
      (joined.includes('date') || joined.includes('txn')) &&
      (joined.includes('withdrawal') || joined.includes('debit') ||
       joined.includes('deposit')    || joined.includes('credit') ||
       joined.includes('amount'))
    ) { headerIdx = r; break }
  }
  if (headerIdx === -1) return raw   // fallback: send raw text

  // ── Step 3: map column indices
  const headers = rows[headerIdx].map(h => h.toLowerCase().replace(/\s+/g, ' ').trim())
  const idx = (candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.findIndex(h => h === c || h.startsWith(c) || h.includes(c))
      if (i !== -1) return i
    }
    return -1
  }

  const dateCol = idx(['date','txn date','transaction date','value date','posting date'])
  const descCol = idx(['description','narration','particulars','memo','details','transaction details'])
  const dtlCol  = idx(['details'])           // secondary details column
  const addCol  = idx(['additional'])        // additional details column
  const refCol  = idx(['transaction id','ref','cheque','check','reference'])
  const wdCol   = idx(['withdrawal','debit','dr','money out','out'])
  const depCol  = idx(['deposit','credit','cr','money in','in'])
  const amtCol  = idx(['amount','net amount','net'])

  if (dateCol === -1) return raw

  // ── Step 4: build clean flat table
  const lines: string[] = [
    'Date       | Amount      | Description                              | Ref'
  ]

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const cells = rows[r]
    if (!cells || cells.length < 2) continue

    const dateRaw = cells[dateCol] ?? ''
    if (!dateRaw || !/\d{2}/.test(dateRaw)) continue   // skip blank / total rows

    // Combine description columns, deduplicate, clean whitespace
    const descParts = [
      descCol >= 0 ? cells[descCol] : '',
      dtlCol  >= 0 && dtlCol !== descCol ? cells[dtlCol]  : '',
      addCol  >= 0 && addCol !== descCol && addCol !== dtlCol ? cells[addCol]  : '',
    ].map(s => (s ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const desc = [...new Set(descParts)].join(' | ').slice(0, 80)

    const ref = (cells[refCol] ?? '').trim().slice(0, 20)

    // Parse amount
    const parseNum = (s: string) => parseFloat((s ?? '0').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0
    let amount: number
    if (amtCol >= 0) {
      amount = parseNum(cells[amtCol])
    } else {
      const wd  = parseNum(wdCol  >= 0 ? cells[wdCol]  : '0')
      const dep = parseNum(depCol >= 0 ? cells[depCol] : '0')
      amount = dep > 0 ? dep : (wd > 0 ? -wd : 0)
    }

    if (amount === 0) continue   // skip zero-amount / header-like rows

    const sign  = amount >= 0 ? '+' : ''
    const amtStr = `${sign}${amount.toFixed(2)}`.padStart(12)
    lines.push(`${dateRaw.padEnd(10)} | ${amtStr} | ${desc.padEnd(40)} | ${ref}`)
  }

  return lines.join('\n')
}

// ── XLSX → CSV ────────────────────────────────────────────────────────────────

async function xlsxToCsv(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb   = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  return XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
}

// ── Format QB GL as flat text table ──────────────────────────────────────────

function formatQBForClaude(
  glTxns: ReturnType<typeof parseGLReport>,
  accountName: string,
  from: string,
  to:   string,
): string {
  const lines = [
    `QuickBooks GL — ${accountName} (${from} to ${to})`,
    'Date       | Amount      | Description                              | Ref',
    ...glTxns.map((t, i) => {
      const desc = [t.txnType, t.name, t.memo].filter(Boolean).join(' · ').slice(0, 80)
      const sign = t.amount >= 0 ? '+' : ''
      return `${t.txnDate.padEnd(10)} | ${(sign + t.amount.toFixed(2)).padStart(12)} | ${desc.padEnd(40)} | ${(t.txnId ?? '').slice(0, 20)}`
    }),
    `\nTotal QB transactions: ${glTxns.length}`,
  ]
  return lines.join('\n')
}

// ── Claude reconciliation prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a bank reconciliation expert. You will receive two tables:

TABLE 1 — BANK STATEMENT
A clean table with columns: Date | Amount | Description | Ref
Positive amounts = money IN (deposits, credits).
Negative amounts = money OUT (withdrawals, debits).

TABLE 2 — QUICKBOOKS GL
Same format. Positive = credit, negative = debit.

YOUR JOB: Compare every row from both tables and produce one result entry per transaction.

MATCHING RULES (in priority order):
1. MATCHED — amount matches within 0.02 AND date within 3 days
2. MATCHED — same Ref/cheque number (even if dates differ)
3. POSSIBLE_MATCH — amount within 5% AND similar description
4. AMOUNT_MISMATCH — same date+similar description but amounts differ
5. MISSING_IN_QB — bank row with no QB match
6. MISSING_IN_BANK — QB row with no bank match
7. DUPLICATE — same date+amount appears more than once in one source

IMPORTANT:
- Every bank row and every QB row must appear in the results
- Keep "reason" under 60 characters
- "description" in JSON must be a single line (no newlines)
- Use "date" format YYYY-MM-DD (convert DD/MM/YYYY if needed)
- "amount" is a plain number (no currency symbols, no commas)

Return ONLY valid JSON — no explanation, no markdown fences:
{"results":[{"id":"r1","status":"MATCHED","reason":"Exact amount and date","bankTxn":{"id":"b1","date":"2025-01-31","amount":1282.46,"description":"INWARD TT NETWORK INTL","reference":"S40411268"},"qbTxn":{"id":"q1","date":"2025-01-31","amount":1282.46,"description":"Deposit Network Intl","reference":"S40411268"}},...]}`

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
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

      const ext    = file.name.toLowerCase().split('.').pop() ?? ''
      const buffer = await file.arrayBuffer()

      if (!['csv','txt','xlsx','xls','pdf'].includes(ext)) {
        return NextResponse.json({ error: `Unsupported file: .${ext}` }, { status: 400 })
      }

      // ── Prepare bank text and fetch QB GL in parallel ────────────────────────
      async function getBankTable(): Promise<string | null> {
        if (ext === 'pdf') return null
        const raw = (ext === 'xlsx' || ext === 'xls')
          ? await xlsxToCsv(buffer)
          : new TextDecoder().decode(buffer)
        return normalizeCSV(raw)
      }

      async function getQBTable(): Promise<string> {
        try {
          const glRaw  = await fetchGLReport(accountId!, from!, to!)
          const glTxns = parseGLReport(glRaw)
          return formatQBForClaude(glTxns, accountName ?? accountId!, from!, to!)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          throw new Error(`QuickBooks GL fetch failed: ${msg.slice(0, 120)}`)
        }
      }

      const [bankTable, qbTable] = await Promise.all([getBankTable(), getQBTable()])

      // ── Build Claude message ─────────────────────────────────────────────────
      const userContent: any[] = []

      if (ext === 'pdf') {
        const base64 = Buffer.from(buffer).toString('base64')
        userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
        userContent.push({ type: 'text', text: `Above is the bank statement PDF.\n\nTABLE 2 — QUICKBOOKS GL:\n${qbTable}\n\nReconcile and return JSON.` })
      } else {
        userContent.push({
          type: 'text',
          text: `TABLE 1 — BANK STATEMENT (${file.name}):\n${bankTable}\n\n---\n\nTABLE 2 — QUICKBOOKS GL:\n${qbTable}\n\nReconcile these two tables and return the JSON.`,
        })
      }

      // ── Call Claude ──────────────────────────────────────────────────────────
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 16000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userContent }],
      })

      if (msg.stop_reason === 'max_tokens') {
        console.warn('[Reconcile] Claude hit max_tokens — response may be truncated')
      }

      const rawText = ((msg.content ?? []).find((b: any) => b.type === 'text') as any)?.text as string ?? ''

      // Strip markdown fences if present, then extract outermost JSON object
      const cleaned   = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
      const jsonStart = cleaned.indexOf('{')
      const jsonEnd   = cleaned.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('AI did not return valid JSON. Please try again.')
      }
      const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1)

      let parsed: { results: MatchResult[] }
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        throw new Error('AI returned malformed JSON. Please try again.')
      }

      const results = parsed.results ?? []

      // ── Compute summary ──────────────────────────────────────────────────────
      const matched      = results.filter(r => r.status === 'MATCHED').length
      const missingInQB  = results.filter(r => r.status === 'MISSING_IN_QB').length
      const missingInBnk = results.filter(r => r.status === 'MISSING_IN_BANK').length
      const mismatch     = results.filter(r => r.status === 'AMOUNT_MISMATCH').length
      const possible     = results.filter(r => r.status === 'POSSIBLE_MATCH').length
      const duplicates   = results.filter(r => r.status === 'DUPLICATE').length

      const allBank = results.filter(r => r.bankTxn).map(r => r.bankTxn!)
      const allQB   = results.filter(r => r.qbTxn  ).map(r => r.qbTxn!)

      const totalBank = allBank.reduce((s, t) => s + (t.amount ?? 0), 0)
      const totalQB   = allQB.reduce((s, t)   => s + (t.amount ?? 0), 0)
      const bankCount = new Set(allBank.map(t => t.id)).size
      const qbCount   = new Set(allQB.map(t => t.id)).size

      return NextResponse.json({
        accountName,
        from,
        to,
        summary: {
          bankCount,
          qbCount,
          matched,
          unmatched:     results.length - matched,
          missingInQB,
          missingInBank: missingInBnk,
          mismatch,
          possible,
          duplicates,
          accuracy:      Math.round(matched / Math.max(bankCount, qbCount, 1) * 100),
          totalBankAmt:  Math.round(totalBank * 100) / 100,
          totalQBAmt:    Math.round(totalQB   * 100) / 100,
          difference:    Math.round(Math.abs(totalBank - totalQB) * 100) / 100,
        },
        results,
      })

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reconciliation failed'
      console.error('[Reconcile] inner:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected server error'
    console.error('[Reconcile] outer:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
