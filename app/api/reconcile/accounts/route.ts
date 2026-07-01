import { NextResponse }   from 'next/server'
import { fetchAccounts }  from '@/lib/quickbooks/client'
import { loadTokensAsync } from '@/lib/quickbooks/tokens'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    const all  = await fetchAccounts(500)
    const bank = all
      .filter(a => a.AccountType === 'Bank')
      .map(a => ({ id: a.Id, name: a.Name, balance: a.CurrentBalance ?? 0 }))

    return NextResponse.json({ accounts: bank })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch accounts'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
