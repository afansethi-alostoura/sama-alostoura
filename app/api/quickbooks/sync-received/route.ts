/**
 * POST /api/quickbooks/sync-received
 *
 * Pulls all QB Payments, groups total received per customer,
 * fuzzy-matches each QB customer to a project's client_name,
 * then updates received_amount in .projects-data.json.
 *
 * Returns:
 *  - updated: list of projects whose received_amount changed
 *  - unchanged: projects that matched but amount didn't change
 *  - unmatched: projects with no QB customer match
 *  - qb_customers: all QB customers found (for debugging)
 */
import { NextResponse }                              from 'next/server'
import { fetchPayments, fetchInvoices }              from '@/lib/quickbooks/client'
import { loadTokensAsync }                           from '@/lib/quickbooks/tokens'
import { getAllStoredProjects, updateStoredProject }  from '@/lib/projects-store'
import type { QBPayment, QBInvoice }                 from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

// ── Name normalisation ─────────────────────────────────────────────────────────
function normalise(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)           // ignore single-char noise
}

/**
 * Simple word-overlap score between two name strings.
 * Returns 0–1 (1 = perfect overlap).
 */
function matchScore(a: string, b: string): number {
  const wa = new Set(normalise(a))
  const wb = new Set(normalise(b))
  if (wa.size === 0 || wb.size === 0) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.max(wa.size, wb.size)
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function POST() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected. Connect QB first in Settings.' }, { status: 401 })
  }

  try {
    // 1. Fetch QB Payments and Invoices in parallel
    const [payments, invoices]: [QBPayment[], QBInvoice[]] = await Promise.all([
      fetchPayments(1000),
      fetchInvoices(1000),
    ])

    // 2. Sum total payments received per QB customer name
    const receivedByCustomer = new Map<string, number>()
    for (const p of payments) {
      const name = p.CustomerRef?.name
      if (!name) continue
      receivedByCustomer.set(name, (receivedByCustomer.get(name) ?? 0) + (p.TotalAmt ?? 0))
    }

    // 3. Also capture invoice total (billed) per customer for reference
    const billedByCustomer = new Map<string, number>()
    for (const inv of invoices) {
      const name = inv.CustomerRef?.name
      if (!name) continue
      billedByCustomer.set(name, (billedByCustomer.get(name) ?? 0) + (inv.TotalAmt ?? 0))
    }

    const qbCustomers = Array.from(receivedByCustomer.entries()).map(([name, received]) => ({
      name,
      received: Math.round(received * 100) / 100,
      billed:   Math.round((billedByCustomer.get(name) ?? 0) * 100) / 100,
    }))

    // 4. Load all projects and match each to a QB customer
    const projects = getAllStoredProjects()

    const updated:   Array<{ project: string; client: string; qb_customer: string; old: number; new: number; score: number }> = []
    const unchanged: Array<{ project: string; client: string; qb_customer: string; amount: number; score: number }> = []
    const unmatched: Array<{ project: string; client: string }> = []

    const MATCH_THRESHOLD = 0.5   // at least 50% word overlap required

    for (const project of projects) {
      let bestScore    = 0
      let bestCustomer = ''
      let bestReceived = 0

      for (const [qbName, received] of receivedByCustomer) {
        const score = matchScore(project.client_name, qbName)
        if (score > bestScore) {
          bestScore    = score
          bestCustomer = qbName
          bestReceived = received
        }
      }

      if (bestScore < MATCH_THRESHOLD) {
        unmatched.push({ project: project.name, client: project.client_name })
        continue
      }

      const rounded = Math.round(bestReceived * 100) / 100

      if (rounded === project.received_amount) {
        unchanged.push({
          project:     project.name,
          client:      project.client_name,
          qb_customer: bestCustomer,
          amount:      rounded,
          score:       Math.round(bestScore * 100),
        })
        continue
      }

      // Update the project
      updateStoredProject(project.id, { received_amount: rounded })

      updated.push({
        project:     project.name,
        client:      project.client_name,
        qb_customer: bestCustomer,
        old:         project.received_amount,
        new:         rounded,
        score:       Math.round(bestScore * 100),
      })
    }

    return NextResponse.json({
      ok:           true,
      synced_at:    new Date().toISOString(),
      updated,
      unchanged,
      unmatched,
      qb_customers: qbCustomers,
      counts: {
        qb_payments:  payments.length,
        qb_customers: qbCustomers.length,
        projects:     projects.length,
        updated:      updated.length,
        unchanged:    unchanged.length,
        unmatched:    unmatched.length,
      },
    })

  } catch (err) {
    console.error('[QB sync-received] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
