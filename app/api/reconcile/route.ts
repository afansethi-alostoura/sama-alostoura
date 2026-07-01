/**
 * POST /api/reconcile
 *
 * Accepts TWO uploaded files:
 *   qbFile   — QuickBooks export (CSV / XLSX)
 *   bankFile — Bank statement   (CSV / XLSX / PDF)
 *
 * Claude reads both files, compares every transaction, and returns:
 *   - A plain-English analysis summary
 *   - Structured results (matched, missing, mismatched, duplicates)
 *
 * READ-ONLY — no QB API calls, no OAuth required, no data is written anywhere.
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic }                 from '@/lib/anthropic'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300

// ── Shared types ──────────────────────────────────────────────────────────────

export interface NormalizedTxn {
  id:          string
  date:        string   // YYYY-MM-DD
  amount:      number   // positive = money in, negative = money out
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

// ── CSV normalizer ────────────────────────────────────────────────────────────
// Handles quoted multi-line fields (RAK Bank, QB exports, etc.)
// Returns a clean flat table — one transaction per line.

function normalizeCSV(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Tokenise respecting quoted fields (multi-line descriptions collapse to one line)
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
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
      field += ' '   // flatten newlines inside quoted fields
    } else {
      field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }

  // Find header row (first row mentioning date + an amount column)
  let headerIdx = -1
  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const j = rows[r].join(' ').toLowerCase()
    if (
      (j.includes('date') || j.includes('txn')) &&
      (j.includes('amount') || j.includes('debit') || j.includes('credit') ||
       j.includes('withdrawal') || j.includes('deposit'))
    ) { headerIdx = r; break }
  }
  if (headerIdx === -1) return raw  // unknown format — send raw

  const headers = rows[headerIdx].map(h => h.toLowerCase().replace(/\s+/g, ' ').trim())
  const idx = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.findIndex(h => h === c || h.startsWith(c) || h.includes(c))
      if (i !== -1) return i
    }
    return -1
  }

  const dateCol = idx('date', 'txn date', 'transaction date', 'value date', 'posting date')
  const descCol = idx('description', 'narration', 'particulars', 'memo', 'name', 'payee')
  const dtlCol  = idx('details')
  const addCol  = idx('additional')
  const refCol  = idx('transaction id', 'ref', 'no.', 'cheque', 'check', 'num', 'reference')
  const wdCol   = idx('withdrawal', 'debit', 'dr', 'money out', 'out')
  const depCol  = idx('deposit', 'credit', 'cr', 'money in', 'in')
  const amtCol  = idx('amount', 'net amount', 'net', 'total')

  if (dateCol === -1) return raw

  const parseNum = (s: string) =>
    parseFloat((s ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0

  const lines: string[] = ['Date       | Amount       | Description                                      | Ref']

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const c = rows[r]
    if (!c || c.length < 2) continue
    const dateRaw = (c[dateCol] ?? '').trim()
    if (!dateRaw || !/\d{2}/.test(dateRaw)) continue

    const descParts = [
      descCol >= 0 ? c[descCol] : '',
      dtlCol  >= 0 && dtlCol !== descCol  ? c[dtlCol]  : '',
      addCol  >= 0 && addCol  !== descCol && addCol !== dtlCol ? c[addCol] : '',
    ].map(s => (s ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const desc = [...new Set(descParts)].join(' | ').slice(0, 90)

    const ref = (c[refCol] ?? '').trim().slice(0, 25)

    let amount: number
    if (amtCol >= 0) {
      amount = parseNum(c[amtCol])
    } else {
      const wd  = parseNum(wdCol  >= 0 ? c[wdCol]  : '')
      const dep = parseNum(depCol >= 0 ? c[depCol] : '')
      amount = dep > 0 ? dep : (wd > 0 ? -wd : 0)
    }
    if (amount === 0) continue

    const sign = amount >= 0 ? '+' : ''
    lines.push(`${dateRaw.padEnd(10)} | ${(sign + amount.toFixed(2)).padStart(12)} | ${desc.padEnd(50)} | ${ref}`)
  }

  return lines.join('\n')
}

// ── XLSX → CSV ────────────────────────────────────────────────────────────────

async function xlsxToText(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb   = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  return XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
}

// ── Prepare file text ─────────────────────────────────────────────────────────

async function fileToTable(file: File): Promise<{ table: string; isPDF: boolean; base64?: string }> {
  const ext    = file.name.toLowerCase().split('.').pop() ?? ''
  const buffer = await file.arrayBuffer()

  if (ext === 'pdf') {
    return {
      table:  '',
      isPDF:  true,
      base64: Buffer.from(buffer).toString('base64'),
    }
  }

  const raw = (ext === 'xlsx' || ext === 'xls')
    ? await xlsxToText(buffer)
    : new TextDecoder().decode(buffer)

  return { table: normalizeCSV(raw), isPDF: false }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial reconciliation AI agent. You have been given two files:

FILE 1: QuickBooks Export — transactions recorded in QuickBooks accounting software
FILE 2: Bank Statement   — actual transactions that occurred at the bank

Both files are presented as clean tables with columns: Date | Amount | Description | Ref
Positive amounts = money IN (deposit, receipt, credit).
Negative amounts = money OUT (payment, withdrawal, debit).

─────────────────────────────────────────────────
YOUR JOB: RECONCILE THE TWO FILES
─────────────────────────────────────────────────

STEP 1 — Parse both files carefully. Identify every transaction in each file.

STEP 2 — Match transactions between the two files using these rules (in priority order):
  1. MATCHED        — same amount (within 0.02 AED) AND date within 3 days
  2. MATCHED        — same reference/cheque number (even if date differs slightly)
  3. POSSIBLE_MATCH — amount within 5% AND similar description words
  4. AMOUNT_MISMATCH— same date + similar description but amounts differ
  5. MISSING_IN_QB  — transaction is IN THE BANK but NOT in QuickBooks (needs to be recorded)
  6. MISSING_IN_BANK— transaction is IN QUICKBOOKS but NOT in the bank (possible ghost entry)
  7. DUPLICATE      — exact same date+amount appears more than once in the same file

STEP 3 — Write a short, clear analysis (3-5 sentences) summarising:
  - How many transactions matched
  - Key discrepancies found (missing entries, mismatches)
  - Any patterns (e.g. many small fees missing, large transactions unrecorded)
  - Your recommendation for the accountant

RULES:
- Every transaction from BOTH files must appear in the results
- "description" and "reason" fields must be single-line (no newlines)
- "date" must be YYYY-MM-DD format (convert DD/MM/YYYY if needed)
- "amount" is a plain number, no commas, no currency symbols
- "id" fields: use "b1", "b2"... for bank, "q1", "q2"... for QB

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON:
{
  "analysis": "Plain English summary for the accountant here.",
  "results": [
    {
      "id": "r1",
      "status": "MATCHED",
      "reason": "Exact amount, 1 day apart",
      "bankTxn": {"id":"b1","date":"2025-01-31","amount":1282.46,"description":"INWARD TT NETWORK INTL","reference":"S40411268"},
      "qbTxn":   {"id":"q1","date":"2025-01-31","amount":1282.46,"description":"Payment received","reference":"S40411268"}
    },
    {
      "id": "r2",
      "status": "MISSING_IN_QB",
      "reason": "No matching QuickBooks entry",
      "bankTxn": {"id":"b2","date":"2025-01-30","amount":-5000.00,"description":"ATM CASH WITHDRAWAL","reference":"S40186326"},
      "qbTxn": null
    }
  ]
}`

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    try {
      const form     = await req.formData()
      const qbFile   = form.get('qbFile')   as File   | null
      const bankFile = form.get('bankFile') as File   | null
      const from     = form.get('from')     as string | null
      const to       = form.get('to')       as string | null

      if (!qbFile || !bankFile) {
        return NextResponse.json(
          { error: 'Please upload both a QuickBooks export file and a bank statement.' },
          { status: 400 }
        )
      }

      // Process both files in parallel
      const [qb, bank] = await Promise.all([fileToTable(qbFile), fileToTable(bankFile)])

      // Build Claude message content
      const userContent: any[] = []

      const dateNote = from && to ? ` (period: ${from} to ${to})` : ''

      if (bank.isPDF) {
        // PDF bank statement → document block
        userContent.push({
          type:   'document',
          source: { type: 'base64', media_type: 'application/pdf', data: bank.base64 },
        })
        userContent.push({
          type: 'text',
          text: [
            `FILE 2 above is the Bank Statement PDF${dateNote}.`,
            ``,
            `FILE 1 — QuickBooks Export${dateNote}:`,
            qb.table,
            ``,
            `Reconcile FILE 1 (QuickBooks) against FILE 2 (Bank Statement) and return the JSON.`,
          ].join('\n'),
        })
      } else {
        userContent.push({
          type: 'text',
          text: [
            `FILE 1 — QuickBooks Export (${qbFile.name})${dateNote}:`,
            qb.table,
            ``,
            `${'─'.repeat(60)}`,
            ``,
            `FILE 2 — Bank Statement (${bankFile.name})${dateNote}:`,
            bank.table,
            ``,
            `Reconcile FILE 1 (QuickBooks) against FILE 2 (Bank Statement) and return the JSON.`,
          ].join('\n'),
        })
      }

      // Call Claude
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 16000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userContent }],
      })

      if (msg.stop_reason === 'max_tokens') {
        console.warn('[Reconcile] Response truncated — too many transactions for one pass')
      }

      const rawText = ((msg.content ?? []).find((b: any) => b.type === 'text') as any)?.text as string ?? ''

      // Extract JSON (strip any accidental markdown fences)
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const jStart  = cleaned.indexOf('{')
      const jEnd    = cleaned.lastIndexOf('}')
      if (jStart === -1 || jEnd === -1) {
        throw new Error('AI did not return valid JSON. Please try again.')
      }

      let parsed: { analysis?: string; results: MatchResult[] }
      try {
        parsed = JSON.parse(cleaned.slice(jStart, jEnd + 1))
      } catch {
        throw new Error('AI returned malformed JSON. Please try again.')
      }

      const results  = parsed.results ?? []
      const analysis = parsed.analysis ?? ''

      // Compute summary
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
        qbFileName:   qbFile.name,
        bankFileName: bankFile.name,
        from, to,
        analysis,
        summary: {
          bankCount, qbCount, matched,
          unmatched:     results.length - matched,
          missingInQB, missingInBank: missingInBnk,
          mismatch, possible, duplicates,
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
