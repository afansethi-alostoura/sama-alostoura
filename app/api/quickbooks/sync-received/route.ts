/**
 * POST /api/quickbooks/sync-received
 *
 * Strategy (two passes — uses whichever gives a higher confidence match):
 *
 * Pass 1 — CLASS-based (primary):
 *   Fetch all QB Invoices that have a ClassRef at header level.
 *   For each invoice: paid = TotalAmt - Balance.
 *   Group paid totals by class name → fuzzy-match class name to project name.
 *
 * Pass 2 — CUSTOMER-based (fallback for unmatched projects):
 *   Fetch all QB Payments, group TotalAmt by CustomerRef.name.
 *   Fuzzy-match customer name to project client_name.
 *
 * Updates received_amount in .projects-data.json for every matched project.
 */
import { NextResponse }                              from 'next/server'
import { loadTokensAsync }                           from '@/lib/quickbooks/tokens'
import { getAllStoredProjects, updateStoredProject }  from '@/lib/projects-store'
import type { QBInvoice, QBPayment }                 from '@/lib/quickbooks/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

// ── QB helpers (inline — avoids importing paginated helpers that may not exist) ─
async function qbGetAll<T>(tokens: { access_token: string; realm_id: string }, sql: string, entity: string): Promise<T[]> {
  const BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'

  const PAGE = 1000
  const all: T[] = []
  let pos = 1

  while (true) {
    const query = `${sql} MAXRESULTS ${PAGE} STARTPOSITION ${pos}`
    const url   = `${BASE}/${tokens.realm_id}/query?query=${encodeURIComponent(query)}&minorversion=70`
    const res   = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`QB query failed (${res.status}): ${err}`)
    }
    const data = await res.json()
    const rows = (data?.QueryResponse?.[entity] as T[] | undefined) ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
    pos += PAGE
  }
  return all
}

// ── Name normalisation ─────────────────────────────────────────────────────────
function words(name: string): Set<string> {
  return new Set(
    name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1)
  )
}

function matchScore(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  if (!wa.size || !wb.size) return 0
  let common = 0
  for (const w of wa) if (wb.has(w)) common++
  return common / Math.max(wa.size, wb.size)
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected. Go to Settings → Connect QB.' }, { status: 401 })
  }

  try {
    const t = { access_token: tokens.access_token, realm_id: tokens.realm_id }

    // Fetch invoices and payments in parallel
    const [invoices, payments]: [QBInvoice[], QBPayment[]] = await Promise.all([
      qbGetAll<QBInvoice>(t, 'SELECT * FROM Invoice ORDERBY TxnDate DESC', 'Invoice'),
      qbGetAll<QBPayment>(t, 'SELECT * FROM Payment ORDERBY TxnDate DESC', 'Payment'),
    ])

    // ── Pass 1: received by QB Class (TotalAmt − Balance = paid) ──────────────
    const paidByClass = new Map<string, number>()  // className → total paid
    for (const inv of invoices) {
      if (!inv.ClassRef?.name) continue
      const paid = (inv.TotalAmt ?? 0) - (inv.Balance ?? 0)
      if (paid <= 0) continue
      const cls = inv.ClassRef.name
      paidByClass.set(cls, (paidByClass.get(cls) ?? 0) + paid)
    }

    // ── Pass 2: received by QB Customer (Payment.TotalAmt) ────────────────────
    const paidByCustomer = new Map<string, number>()
    for (const p of payments) {
      const name = p.CustomerRef?.name
      if (!name) continue
      paidByCustomer.set(name, (paidByCustomer.get(name) ?? 0) + (p.TotalAmt ?? 0))
    }

    const projects = getAllStoredProjects()
    const THRESHOLD = 0.4

    const updated:   Array<{ project: string; method: string; matched: string; old: number; new: number }> = []
    const unchanged: Array<{ project: string; method: string; matched: string; amount: number }> = []
    const unmatched: Array<{ project: string; client: string }> = []

    for (const project of projects) {
      // Try class match first (against project name)
      let bestScore = 0, bestKey = '', bestAmount = 0, bestMethod = ''

      for (const [cls, amt] of paidByClass) {
        const s = matchScore(project.name, cls)
        if (s > bestScore) { bestScore = s; bestKey = cls; bestAmount = amt; bestMethod = 'class' }
      }

      // Try class match against client name too
      for (const [cls, amt] of paidByClass) {
        const s = matchScore(project.client_name, cls)
        if (s > bestScore) { bestScore = s; bestKey = cls; bestAmount = amt; bestMethod = 'class' }
      }

      // Fall back to customer payment match
      if (bestScore < THRESHOLD) {
        for (const [cust, amt] of paidByCustomer) {
          const s = matchScore(project.client_name, cust)
          if (s > bestScore) { bestScore = s; bestKey = cust; bestAmount = amt; bestMethod = 'customer' }
        }
      }

      if (bestScore < THRESHOLD) {
        unmatched.push({ project: project.name, client: project.client_name })
        continue
      }

      const rounded = Math.round(bestAmount * 100) / 100

      if (rounded === project.received_amount) {
        unchanged.push({ project: project.name, method: bestMethod, matched: bestKey, amount: rounded })
        continue
      }

      updateStoredProject(project.id, { received_amount: rounded })
      updated.push({ project: project.name, method: bestMethod, matched: bestKey, old: project.received_amount, new: rounded })
    }

    return NextResponse.json({
      ok:        true,
      synced_at: new Date().toISOString(),
      updated,
      unchanged,
      unmatched,
      debug: {
        invoices_fetched:  invoices.length,
        payments_fetched:  payments.length,
        classes_with_income: paidByClass.size,
        customers_with_payments: paidByCustomer.size,
        class_income: Object.fromEntries(
          [...paidByClass.entries()].map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      },
      counts: {
        projects:  projects.length,
        updated:   updated.length,
        unchanged: unchanged.length,
        unmatched: unmatched.length,
      },
    })

  } catch (err) {
    console.error('[QB sync-received]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
