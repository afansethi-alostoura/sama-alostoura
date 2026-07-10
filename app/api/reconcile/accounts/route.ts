import { NextResponse }    from 'next/server'
import { fetchAccounts }  from '@/lib/quickbooks/client'
import { loadTokensAsync } from '@/lib/quickbooks/tokens'

export const dynamic = 'force-dynamic'

// Priority order for account type grouping in the UI dropdown
const TYPE_ORDER: Record<string, number> = {
  'Bank':                 0,
  'Credit Card':          1,
  'Other Current Asset':  2,
  'Fixed Asset':          3,
  'Other Asset':          4,
  'Accounts Receivable':  5,
  'Accounts Payable':     6,
  'Other Current Liability': 7,
  'Long Term Liability':  8,
  'Equity':               9,
  'Income':               10,
  'Cost of Goods Sold':   11,
  'Expense':              12,
  'Other Income':         13,
  'Other Expense':        14,
}

export async function GET() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    const all = await fetchAccounts(500)

    const accounts = all
      .filter(a => a.Active)
      .map(a => ({
        id:      a.Id,
        name:    a.FullyQualifiedName ?? a.Name,
        type:    a.AccountType,
        subtype: a.AccountSubType ?? '',
        balance: a.CurrentBalance ?? 0,
      }))
      .sort((a, b) => {
        const ta = TYPE_ORDER[a.type] ?? 99
        const tb = TYPE_ORDER[b.type] ?? 99
        if (ta !== tb) return ta - tb
        return a.name.localeCompare(b.name)
      })

    return NextResponse.json({ accounts })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch accounts'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
