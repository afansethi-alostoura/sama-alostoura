/**
 * POST /api/agents/accountant-qb
 *
 * AI Accountant agent that analyses QuickBooks expense data and produces
 * specific, actionable financial findings — overspending, unusual payments,
 * potential duplicates, cost anomalies, and financial risks.
 *
 * Input:
 *   {
 *     expenses:     QBClassExpenseRow[]          per-class dynamic account breakdown
 *     accountNames: string[]                     all account types present
 *     projects:     { name, contract_value, progress_percent, received_amount }[]
 *     purchases:    QBPurchase[]                 raw transactions for duplicate detection
 *     bills:        QBBill[]
 *     dateRange:    { from: string|null, to: string|null }
 *   }
 *
 * Output:
 *   { findings: Finding[] }
 *
 *   Finding: { severity, title, detail, amount?, project? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic }                 from '@/lib/anthropic'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import type { QBClassExpenseRow, QBPurchase, QBBill } from '@/lib/quickbooks/types'

export const maxDuration = 60

// ── Duplicate detector ────────────────────────────────────────────────────────
interface TxnSummary {
  date:   string
  amount: number
  vendor: string
  type:   'purchase' | 'bill'
  id:     string
}

function findDuplicates(purchases: QBPurchase[], bills: QBBill[]): TxnSummary[][] {
  const all: TxnSummary[] = [
    ...purchases.map(p => ({
      date:   p.TxnDate,
      amount: p.TotalAmt,
      vendor: p.EntityRef?.name ?? 'Unknown',
      type:   'purchase' as const,
      id:     p.Id,
    })),
    ...bills.map(b => ({
      date:   b.TxnDate,
      amount: b.TotalAmt,
      vendor: b.VendorRef?.name ?? 'Unknown',
      type:   'bill' as const,
      id:     b.Id,
    })),
  ]

  // Group by date+vendor+amount
  const groups = new Map<string, TxnSummary[]>()
  for (const t of all) {
    const key = `${t.date}|${t.vendor}|${t.amount.toFixed(2)}`
    const g   = groups.get(key) ?? []
    g.push(t)
    groups.set(key, g)
  }

  return Array.from(groups.values()).filter(g => g.length > 1)
}

// ── Summarise expenses for prompt ─────────────────────────────────────────────
function buildPromptContext(
  expenses:     QBClassExpenseRow[],
  accountNames: string[],
  projects:     Array<{ name: string; contract_value: number; progress_percent: number; received_amount: number }>,
  purchases:    QBPurchase[],
  bills:        QBBill[],
  dateRange:    { from: string | null; to: string | null },
): string {
  const rangeStr = dateRange.from || dateRange.to
    ? `Period: ${dateRange.from ?? 'start'} → ${dateRange.to ?? 'today'}`
    : 'All dates (no date filter applied)'

  const totalExpenses = expenses.reduce((s, r) => s + r.total, 0)
  const totalBudget   = projects.reduce((s, p) => s + p.contract_value, 0)

  // Project budget vs expenses
  const projectLines = projects.map(p => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const linked = expenses.find(e =>
      norm(e.className).includes(norm(p.name)) ||
      norm(p.name).includes(norm(e.className))
    )
    const spent = linked?.total ?? 0
    const pct   = p.contract_value > 0 ? Math.round((spent / p.contract_value) * 100) : 0
    return `  • ${p.name}: Budget AED ${p.contract_value.toLocaleString()} | Spent AED ${spent.toLocaleString()} (${pct}%) | Progress ${p.progress_percent}% | Received AED ${p.received_amount.toLocaleString()}`
  }).join('\n')

  // Per-class expense summary
  const classLines = expenses.map(e => {
    const accs = Object.entries(e.accounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: AED ${v.toLocaleString()}`)
      .join(', ')
    return `  • ${e.className} — Total AED ${e.total.toLocaleString()} [${accs}]`
  }).join('\n')

  // Top 10 largest individual transactions
  const allTxns: { date: string; amount: number; vendor: string; type: string }[] = [
    ...purchases.map(p => ({
      date:   p.TxnDate,
      amount: p.TotalAmt,
      vendor: p.EntityRef?.name ?? 'Unknown',
      type:   'Purchase / ' + p.PaymentType,
    })),
    ...bills.map(b => ({
      date:   b.TxnDate,
      amount: b.TotalAmt,
      vendor: b.VendorRef?.name ?? 'Unknown',
      type:   'Bill',
    })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 15)

  const topTxnLines = allTxns.map(t =>
    `  • ${t.date} | ${t.vendor} | AED ${t.amount.toLocaleString()} | ${t.type}`
  ).join('\n')

  // Possible duplicate transactions
  const dupes = findDuplicates(purchases, bills)
  const dupeLines = dupes.slice(0, 10).map(group =>
    `  • ${group[0].date} | ${group[0].vendor} | AED ${group[0].amount.toLocaleString()} × ${group.length} times`
  ).join('\n')

  // Account category totals across all classes
  const accountTotals: Record<string, number> = {}
  for (const row of expenses) {
    for (const [acc, amt] of Object.entries(row.accounts)) {
      accountTotals[acc] = (accountTotals[acc] ?? 0) + amt
    }
  }
  const accountLines = Object.entries(accountTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  • ${k}: AED ${v.toLocaleString()}`)
    .join('\n')

  return `
=== FINANCIAL ANALYSIS INPUT ===
${rangeStr}
Total budget across all projects: AED ${totalBudget.toLocaleString()}
Total expenses recorded (QB Classes): AED ${totalExpenses.toLocaleString()}
Overall expense ratio: ${totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0}%
Total transactions analysed: ${purchases.length + bills.length} (${purchases.length} purchases, ${bills.length} bills)

=== PROJECT BUDGET vs SPEND ===
${projectLines || '  (no projects)'}

=== EXPENSE BREAKDOWN BY CLASS/PROJECT ===
${classLines || '  (no class-tagged expenses)'}

=== EXPENSE BREAKDOWN BY ACCOUNT TYPE ===
${accountLines || '  (no accounts)'}

=== TOP 15 LARGEST TRANSACTIONS ===
${topTxnLines || '  (none)'}

=== POSSIBLE DUPLICATE TRANSACTIONS ===
${dupeLines || '  None detected'}

=== ACCOUNT TYPES PRESENT ===
${accountNames.join(', ')}
`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      expenses     = [] as QBClassExpenseRow[],
      accountNames = [] as string[],
      projects     = [] as Array<{ name: string; contract_value: number; progress_percent: number; received_amount: number }>,
      dateRange    = { from: null, to: null } as { from: string | null; to: string | null },
    } = body

    // Fetch raw purchases and bills from snapshot for duplicate detection
    let purchases: QBPurchase[] = body.purchases ?? []
    let bills:     QBBill[]     = body.bills     ?? []

    if ((!purchases.length || !bills.length) && isSupabaseConfigured() && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('qb_snapshot')
        .select('purchases, bills')
        .eq('id', 1)
        .single()
      if (data) {
        purchases = (data.purchases ?? []) as QBPurchase[]
        bills     = (data.bills     ?? []) as QBBill[]
      }
    }

    const context = buildPromptContext(expenses, accountNames, projects, purchases, bills, dateRange)

    const system = `You are a senior chartered accountant with 25 years of experience in UAE construction finance.
You are reviewing QuickBooks expense data for Sama Alostoura Building Contracting LLC, Dubai.

Your job: Produce SPECIFIC, ACTIONABLE financial findings — like a real accountant reviewing the books.

Rules:
1. Be specific: name the project, vendor, amount, and date where possible
2. Calculate ratios: expense % of budget, cost per progress point, etc.
3. Flag any of: overspending vs contract value, payments with no class tag, unusually large single payments, possible duplicate payments (same vendor + same amount + same date), account categories that seem disproportionately high, projects where cost is running faster than progress, missing or low collection vs invoiced amount
4. Prioritise by severity: 🔴 DANGER (immediate action needed), 🟡 WARNING (monitor closely), 🔵 INFO (note for future reference)
5. Be concise — one clear sentence for the title, 2-3 sentences max for detail
6. If data looks healthy, say so — don't invent problems

Return ONLY a JSON array of findings, no markdown fences:
[
  {
    "severity": "danger" | "warning" | "info",
    "title": "Short title (under 80 chars)",
    "detail": "Specific detail with numbers and names",
    "amount": 12345.00,
    "project": "Project name or null"
  },
  ...
]`

    const resp = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 3000,
      system,
      messages:   [{ role: 'user', content: context }],
    })

    const raw = resp.content[0].type === 'text' ? resp.content[0].text : '[]'

    let findings: unknown[] = []
    try {
      const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const match = clean.match(/\[[\s\S]*\]/)
      if (match) findings = JSON.parse(match[0])
    } catch {
      console.warn('[accountant-qb] Failed to parse AI response as JSON')
      findings = [{ severity: 'info', title: 'Analysis complete', detail: raw.slice(0, 500), amount: null, project: null }]
    }

    return NextResponse.json({ findings })

  } catch (err) {
    console.error('[accountant-qb] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 },
    )
  }
}
