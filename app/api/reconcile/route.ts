/**
 * POST /api/reconcile
 *
 * Uploads a bank statement (CSV / XLSX / PDF) + QB bank account + date range.
 * Claude reads BOTH the bank statement and QuickBooks GL data, then performs
 * intelligent reconciliation and returns categorised results.
 *
 * READ-ONLY — never writes to QuickBooks or modifies any data.
 */
import { NextRequest, NextResponse }    from 'next/server'
import { fetchGLReport, parseGLReport } from '@/lib/quickbooks/client'
import { loadTokensAsync }              from '@/lib/quickbooks/tokens'
import { anthropic }                    from '@/lib/anthropic'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300

// ── Shared types (used by ReconcileModal.tsx) ─────────────────────────────────

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

// ── XLSX → CSV (server-side fallback if client didn't convert) ────────────────

async function xlsxToCsv(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx')
  const wb   = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  return XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
}

// ── Format QB GL as a readable text table for Claude ─────────────────────────

function formatQBForClaude(
  glTxns: ReturnType<typeof parseGLReport>,
  accountName: string,
  from: string,
  to:   string,
): string {
  const header = `QuickBooks General Ledger — ${accountName} (${from} to ${to})\n` +
                 `${'Date'.padEnd(12)} ${'Type'.padEnd(20)} ${'Name'.padEnd(30)} ${'Memo'.padEnd(30)} ${'Amount'.padStart(12)} ${'Ref'.padEnd(15)}\n` +
                 '─'.repeat(120) + '\n'

  const rows = glTxns.map((t, i) =>
    `${t.txnDate.padEnd(12)} ${(t.txnType ?? '').slice(0,20).padEnd(20)} ${(t.name ?? '').slice(0,30).padEnd(30)} ${(t.memo ?? '').slice(0,30).padEnd(30)} ${t.amount.toFixed(2).padStart(12)} ${(t.txnId ?? '').slice(0,15).padEnd(15)}`
  ).join('\n')

  return header + rows + `\n\nTotal QB transactions: ${glTxns.length}`
}

// ── Claude reconciliation prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert bank reconciliation analyst.

You will receive two data sources:
1. A bank statement — either as a raw CSV/text file or as a PDF document
2. QuickBooks General Ledger (GL) transactions for the same bank account and date range

STEP 1 — READ THE BANK STATEMENT
Parse every transaction row from the bank statement. Identify the date, amount, description, and any reference/cheque number columns automatically. Ignore header rows, summary rows, opening/closing balance rows, and blank rows.

STEP 2 — READ THE QUICKBOOKS DATA
The QB GL is provided as a formatted text table with columns: Date, Type, Name, Memo, Amount, Ref.

STEP 3 — RECONCILE
Compare every bank transaction against every QB transaction. For each transaction from either source, produce one result entry.

AMOUNT SIGN CONVENTION:
- Positive = money coming IN (deposit, credit, receipt)
- Negative = money going OUT (withdrawal, debit, payment)
If the bank statement uses separate Credit/Debit columns, combine them: credit is positive, debit is negative.

MATCHING RULES (apply in this order):
1. MATCHED — same amount (within 0.02) AND date within 3 days
2. MATCHED — matching reference/cheque number even if date differs slightly
3. POSSIBLE_MATCH — amount within 5% AND similar description words, or date within 7 days
4. AMOUNT_MISMATCH — same date and similar description but amounts differ by more than 0.02
5. MISSING_IN_QB — bank transaction with no QB counterpart
6. MISSING_IN_BANK — QB transaction with no bank counterpart
7. DUPLICATE — same date+amount appears more than once in the same source

Be thorough: every bank row AND every QB row must appear at least once in the results.

Return ONLY a raw JSON object — no explanation, no markdown code fences, nothing else:
{
  "results": [
    {
      "id": "r1",
      "status": "MATCHED" | "POSSIBLE_MATCH" | "MISSING_IN_QB" | "MISSING_IN_BANK" | "AMOUNT_MISMATCH" | "DUPLICATE",
      "reason": "one-line plain English explanation",
      "bankTxn": { "id": "b_1", "date": "YYYY-MM-DD", "amount": -1500.00, "description": "VENDOR PAYMENT", "reference": "CHQ001" },
      "qbTxn":   { "id": "q_1", "date": "YYYY-MM-DD", "amount": -1500.00, "description": "Bill Payment · Vendor Name · Invoice 001", "reference": "CHQ001" }
    }
  ]
}

For MISSING_IN_QB entries set qbTxn to null.
For MISSING_IN_BANK entries set bankTxn to null.`

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
        return NextResponse.json({ error: `Unsupported file: .${ext}. Please upload CSV, XLSX, or PDF.` }, { status: 400 })
      }

      // ── Fetch QB GL and prepare bank statement text in parallel ─────────────
      async function getQBText(): Promise<string> {
        try {
          const glRaw  = await fetchGLReport(accountId!, from!, to!)
          const glTxns = parseGLReport(glRaw)
          return formatQBForClaude(glTxns, accountName ?? accountId!, from!, to!)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          throw new Error(
            `QuickBooks did not return valid data. Try a different date range. (${msg.slice(0, 120)})`
          )
        }
      }

      async function getBankText(): Promise<string | null> {
        if (ext === 'pdf') return null  // PDF sent as document block
        if (ext === 'xlsx' || ext === 'xls') return xlsxToCsv(buffer)
        return new TextDecoder().decode(buffer)
      }

      const [qbText, bankText] = await Promise.all([getQBText(), getBankText()])

      // ── Build Claude message ─────────────────────────────────────────────────
      type ContentBlock = {
        type: string
        text?: string
        source?: { type: string; media_type: string; data: string }
      }

      const userContent: ContentBlock[] = []

      if (ext === 'pdf') {
        const base64 = Buffer.from(buffer).toString('base64')
        userContent.push({
          type:   'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any)
        userContent.push({
          type: 'text',
          text: `Above is the bank statement PDF.\n\nBelow is the QuickBooks data:\n\n${qbText}\n\nReconcile these two sources and return the JSON object as instructed.`,
        })
      } else {
        userContent.push({
          type: 'text',
          text: `BANK STATEMENT (${file.name}):\n\n${bankText}\n\n---\n\n${qbText}\n\nReconcile these two sources and return the JSON object as instructed.`,
        })
      }

      // ── Call Claude ──────────────────────────────────────────────────────────
      // Prefill the assistant turn with `{"results":[` to force raw JSON output
      // and prevent Claude from wrapping the response in markdown fences.
      const msg = await anthropic.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 16000,
        system:     SYSTEM_PROMPT,
        messages: [
          { role: 'user',      content: userContent as any },
          { role: 'assistant', content: '{"results":[' },
        ],
      })

      const rawText = ((msg.content ?? []).find((b: any) => b.type === 'text') as any)?.text as string ?? ''

      // Claude continues from the prefill, so we reconstruct the full JSON
      const fullJson = '{"results":[' + rawText

      // Strip any trailing markdown fence or stray text after the last `}`
      const stripped = fullJson.slice(0, fullJson.lastIndexOf('}') + 1)

      let parsed: { results: MatchResult[] }
      try {
        parsed = JSON.parse(stripped)
      } catch {
        // Fallback: try to extract the JSON object if reconstruction failed
        const jsonMatch = fullJson.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('Claude did not return a valid reconciliation. Please try again.')
        }
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch {
          throw new Error('Claude returned malformed JSON. Please try again.')
        }
      }

      const results = parsed.results ?? []

      // ── Compute summary ──────────────────────────────────────────────────────
      const matched      = results.filter(r => r.status === 'MATCHED').length
      const missingInQB  = results.filter(r => r.status === 'MISSING_IN_QB').length
      const missingInBnk = results.filter(r => r.status === 'MISSING_IN_BANK').length
      const mismatch     = results.filter(r => r.status === 'AMOUNT_MISMATCH').length
      const possible     = results.filter(r => r.status === 'POSSIBLE_MATCH').length
      const duplicates   = results.filter(r => r.status === 'DUPLICATE').length

      const bankTxns = results.filter(r => r.bankTxn).map(r => r.bankTxn!)
      const qbTxns   = results.filter(r => r.qbTxn  ).map(r => r.qbTxn!)

      const totalBank = bankTxns.reduce((s, t) => s + (t.amount ?? 0), 0)
      const totalQB   = qbTxns.reduce((s, t)   => s + (t.amount ?? 0), 0)

      // Unique bank / QB counts (MATCHED results share one bank + one QB txn)
      const bankCount = new Set(bankTxns.map(t => t.id)).size
      const qbCount   = new Set(qbTxns.map(t => t.id)).size

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
