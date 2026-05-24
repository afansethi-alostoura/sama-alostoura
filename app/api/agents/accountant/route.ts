import { NextResponse }    from 'next/server'
import { anthropic }       from '@/lib/anthropic'
import type { QBInvoice, QBPayment, QBSnapshot } from '@/lib/quickbooks/types'
import { DEMO_PROJECTS }   from '@/lib/demo-data'
import fs                  from 'fs'
import path                from 'path'

const SNAP_FILE = path.join(process.cwd(), '.qb-data.json')

const ACCOUNTANT_PROMPT = `You are the AI Accountant for Sama Alostoura Building Contracting LLC, Dubai UAE.

You analyse all financial data from QuickBooks Online and the project database. You understand:
- UAE construction project billing — contracts paid in stages via MBHRE inspections
- 10% retention on all MBHRE payments, released at project completion
- UAE VAT at 5% on all invoiced amounts
- AED currency throughout

Your briefing must cover:
1. COLLECTIONS SUMMARY — total billed vs received vs outstanding, this month
2. OVERDUE INVOICES — list each by client name, amount, days overdue
3. MBHRE PIPELINE — which stage payments are ready to apply for, amounts, blocking conditions
4. CASH FLOW — next 30-day projection, any risk flags
5. TOP ACTIONS — max 3 specific actions the owner must take today

Be concise, specific, and use AED amounts. Lead with the most urgent issue.`

function classifyInvoice(inv: QBInvoice): 'paid' | 'overdue' | 'unpaid' {
  if (inv.Balance === 0) return 'paid'
  if (inv.DueDate && new Date(inv.DueDate) < new Date()) return 'overdue'
  return 'unpaid'
}

function daysOverdue(dueDate: string): number {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86_400_000)
}

export async function POST() {
  if (!process.env.SAMA_AI_KEY) {
    return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not set in .env.local' })
  }

  // Load QuickBooks snapshot if available
  let snapshot: QBSnapshot | null = null
  try {
    if (fs.existsSync(SNAP_FILE)) {
      snapshot = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8'))
    }
  } catch {}

  const projects = DEMO_PROJECTS.filter(p => p.status === 'active')

  // Build financial context
  let qbContext = ''
  if (snapshot) {
    const invoices  = snapshot.invoices
    const payments  = snapshot.payments
    const paid      = invoices.filter(i => classifyInvoice(i) === 'paid')
    const overdue   = invoices.filter(i => classifyInvoice(i) === 'overdue')
    const unpaid    = invoices.filter(i => classifyInvoice(i) === 'unpaid')
    const totalBilled     = invoices.reduce((s, i) => s + i.TotalAmt, 0)
    const totalOutstanding = invoices.reduce((s, i) => s + i.Balance, 0)
    const totalPaid       = payments.reduce((s, p) => s + p.TotalAmt, 0)

    qbContext = `
QUICKBOOKS DATA (synced: ${snapshot.synced_at}):
Company: ${snapshot.company_name}

INVOICE SUMMARY:
Total invoiced: AED ${totalBilled.toLocaleString()}
Total outstanding: AED ${totalOutstanding.toLocaleString()}
Total payments received: AED ${totalPaid.toLocaleString()}
Paid invoices: ${paid.length}
Overdue invoices: ${overdue.length}
Unpaid (not yet due): ${unpaid.length}

OVERDUE INVOICES (${overdue.length}):
${overdue.map(i => `  - Invoice #${i.DocNumber} | ${i.CustomerRef.name} | AED ${i.Balance.toLocaleString()} | Due: ${i.DueDate} | ${daysOverdue(i.DueDate!)} days overdue`).join('\n') || '  None'}

RECENT PAYMENTS (last 5):
${payments.slice(0, 5).map(p => `  - ${p.TxnDate} | ${p.CustomerRef.name} | AED ${p.TotalAmt.toLocaleString()}`).join('\n') || '  None'}

UNPAID INVOICES:
${unpaid.map(i => `  - Invoice #${i.DocNumber} | ${i.CustomerRef.name} | AED ${i.Balance.toLocaleString()} | Due: ${i.DueDate ?? 'No due date'}`).join('\n') || '  None'}
`
  } else {
    qbContext = `
QUICKBOOKS DATA: Not yet synced.
Using project database only for financial analysis.
`
  }

  const projectContext = `
PROJECT FINANCIAL STATUS (from project database):
${projects.map(p => {
  const outstanding = p.contract_value - p.received_amount
  const retention   = p.received_amount * 0.1
  return `
  Project: ${p.name} | ${p.type} | ${p.location}
  Contract: AED ${p.contract_value.toLocaleString()}
  Received: AED ${p.received_amount.toLocaleString()} (${Math.round((p.received_amount / p.contract_value) * 100)}%)
  Outstanding: AED ${outstanding.toLocaleString()}
  Retention held: AED ${retention.toLocaleString()}
  Progress: ${p.progress_percent}%
  Stage: ${p.current_stage}`
}).join('\n')}

TOTAL COMPANY POSITION:
Total contract value: AED ${projects.reduce((s, p) => s + p.contract_value, 0).toLocaleString()}
Total received: AED ${projects.reduce((s, p) => s + p.received_amount, 0).toLocaleString()}
Total outstanding: AED ${projects.reduce((s, p) => s + (p.contract_value - p.received_amount), 0).toLocaleString()}
Total retention held: AED ${projects.reduce((s, p) => s + p.received_amount * 0.1, 0).toLocaleString()}

MBHRE PAYMENT NOTES:
- Khalid project: Stage 4 (AED 200,000) applied to MBHRE — awaiting release
- Khalid project: 3 further stages totalling AED 530,000 pending completion milestones
- Al Qubaisi project: 92% complete — final stage payment should be applied imminently
`

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 900,
      system:     ACCOUNTANT_PROMPT,
      messages: [{
        role:    'user',
        content: `Generate my financial briefing:\n${qbContext}\n${projectContext}`,
      }],
    })

    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ briefing, has_qb_data: !!snapshot })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI Error: ${msg}` }, { status: 500 })
  }
}
