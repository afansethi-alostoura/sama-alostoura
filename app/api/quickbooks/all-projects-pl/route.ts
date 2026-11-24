/**
 * GET /api/quickbooks/all-projects-pl?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns QB Profit & Loss report summarised by Class (one column per project).
 */
import { NextResponse }                        from 'next/server'
import { loadTokensAsync, isAccessTokenFresh } from '@/lib/quickbooks/tokens'
import { refreshAccessToken }                  from '@/lib/quickbooks/client'

export const dynamic     = 'force-dynamic'
export const maxDuration = 120

const API_BASE = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
  ? 'https://quickbooks.api.intuit.com/v3/company'
  : 'https://sandbox-quickbooks.api.intuit.com/v3/company'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || `${new Date().getFullYear()}-01-01`
    const to   = searchParams.get('to')   || new Date().toISOString().slice(0, 10)

    const tokens = await loadTokensAsync()
    if (!tokens) {
      return NextResponse.json(
        { error: 'QuickBooks not connected. Go to Settings → Connect QB.' },
        { status: 401 },
      )
    }

    const fresh = isAccessTokenFresh(tokens) ? tokens : await refreshAccessToken(tokens)

    const params = new URLSearchParams({
      summarize_column_by: 'Classes',
      start_date:          from,
      end_date:            to,
      minorversion:        '70',
    })

    const url = `${API_BASE}/${fresh.realm_id}/reports/ProfitAndLoss?${params}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${fresh.access_token}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json({ error: `QB API error (${res.status}): ${txt}` }, { status: 502 })
    }

    const report = await res.json()

    // ── Parse the QB report format into a usable structure ──────────────────
    // Columns: first col is "account", rest are classes + "Total"
    const columns: { key: string; label: string }[] = (report?.Columns?.Column ?? []).map((c: any) => ({
      key:   c.ColType === 'Account' ? 'account' : (c.MetaData?.find((m: any) => m.Name === 'ID')?.Value ?? c.ColTitle ?? ''),
      label: c.ColTitle ?? '',
    }))

    // Extract per-class totals from key rows
    const projectMap: Record<string, {
      label: string
      income: number
      cogs: number
      grossProfit: number
      expenses: number
      otherExpenses: number
      netEarnings: number
    }> = {}

    function getVal(row: any, colIndex: number): number {
      const cell = row?.ColData?.[colIndex]
      return parseFloat(cell?.value ?? '0') || 0
    }

    function processRows(rows: any[], group?: string) {
      for (const row of rows ?? []) {
        const kind    = row.type   ?? row.Summary?.type ?? ''
        const label   = row.Header?.ColData?.[0]?.value ?? row.Summary?.ColData?.[0]?.value ?? row.ColData?.[0]?.value ?? ''
        const isSummary = row.Summary != null || kind === 'GrandTotal'

        // We want the Summary rows at level 0 (Total Income, Total COGS, Gross Profit, Total Expenses, Net Earnings)
        if (isSummary && row.Summary) {
          const summaryLabel = (row.Summary.ColData?.[0]?.value ?? '').toLowerCase()
          columns.forEach((col, ci) => {
            if (ci === 0) return // skip account col
            if (col.key === 'not_specified') return
            if (!projectMap[col.key]) {
              projectMap[col.key] = { label: col.label, income: 0, cogs: 0, grossProfit: 0, expenses: 0, otherExpenses: 0, netEarnings: 0 }
            }
            const val = getVal(row.Summary, ci)
            if (summaryLabel.includes('total income')) projectMap[col.key].income = val
            else if (summaryLabel.includes('total cost of sales') || summaryLabel.includes('total cost')) projectMap[col.key].cogs = val
            else if (summaryLabel.includes('gross profit')) projectMap[col.key].grossProfit = val
            else if (summaryLabel.includes('total expenses') && !summaryLabel.includes('other')) projectMap[col.key].expenses = val
            else if (summaryLabel.includes('total other expenses')) projectMap[col.key].otherExpenses = val
            else if (summaryLabel.includes('net earnings') || summaryLabel.includes('net income') || summaryLabel.includes('net loss')) projectMap[col.key].netEarnings = val
          })
        }

        if (row.Rows?.Row) processRows(row.Rows.Row, group ?? label)
      }
    }

    processRows(report?.Rows?.Row ?? [])

    // Build projects array, filter out non-projects (car classes, unspecified)
    const NON_PROJECTS = new Set(['not_specified', '640519']) // "All Projects" rollup
    const projects = Object.entries(projectMap)
      .filter(([key]) => !NON_PROJECTS.has(key))
      .map(([, v]) => v)
      .filter(p => p.income > 0 || p.cogs > 0 || p.netEarnings !== 0)
      .sort((a, b) => b.income - a.income)

    const totals = projects.reduce((acc, p) => ({
      income:       acc.income       + p.income,
      cogs:         acc.cogs         + p.cogs,
      grossProfit:  acc.grossProfit  + p.grossProfit,
      expenses:     acc.expenses     + p.expenses,
      netEarnings:  acc.netEarnings  + p.netEarnings,
    }), { income: 0, cogs: 0, grossProfit: 0, expenses: 0, netEarnings: 0 })

    return NextResponse.json({
      period:    { from, to },
      projects,
      totals,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[all-projects-pl]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
