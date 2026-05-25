import { NextResponse }                                   from 'next/server'
import { fetchInvoices, fetchPayments, fetchCustomers, fetchCompanyInfo } from '@/lib/quickbooks/client'
import { loadTokens }                                    from '@/lib/quickbooks/tokens'
import type { QBSnapshot }                               from '@/lib/quickbooks/types'
import fs                                                from 'fs'
import path                                              from 'path'

const SNAP_FILE = path.join(process.cwd(), '.qb-data.json')

export async function POST() {
  const tokens = loadTokens()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    const [invoices, payments, customers, companyInfo] = await Promise.all([
      fetchInvoices(),
      fetchPayments(),
      fetchCustomers(),
      fetchCompanyInfo(),
    ])

    const snapshot: QBSnapshot = {
      realm_id:     tokens.realm_id,
      company_name: companyInfo?.CompanyName ?? 'Sama Alostoura Building Contracting LLC',
      synced_at:    new Date().toISOString(),
      invoices,
      payments,
      customers,
    }

    fs.writeFileSync(SNAP_FILE, JSON.stringify(snapshot, null, 2), 'utf8')

    return NextResponse.json({
      success:      true,
      synced_at:    snapshot.synced_at,
      company_name: snapshot.company_name,
      counts: {
        invoices:  invoices.length,
        payments:  payments.length,
        customers: customers.length,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** GET returns the cached snapshot without hitting QBO API */
export async function GET() {
  try {
    if (!fs.existsSync(SNAP_FILE)) {
      return NextResponse.json({ synced: false, message: 'No sync data yet. Run a sync first.' })
    }
    const snap: QBSnapshot = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8'))
    return NextResponse.json({ synced: true, ...snap })
  } catch (error) {
    console.error('Sync GET error:', error)
    return NextResponse.json({ synced: false, message: 'Failed to read cached data' })
  }
}
