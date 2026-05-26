import { NextResponse }                                                       from 'next/server'
import { fetchInvoices, fetchPayments, fetchCustomers, fetchCompanyInfo }     from '@/lib/quickbooks/client'
import { loadTokensAsync }                                                     from '@/lib/quickbooks/tokens'
import { supabaseAdmin, isSupabaseConfigured }                                from '@/lib/supabase'
import type { QBSnapshot }                                                     from '@/lib/quickbooks/types'

// ── POST — fetch from QBO and save snapshot ──────────────────

export async function POST() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    console.log('[QB Sync] Fetching data from QuickBooks...')
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

    console.log(`[QB Sync] Fetched: ${invoices.length} invoices, ${payments.length} payments, ${customers.length} customers`)

    // Save to Supabase
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('qb_snapshot')
        .upsert({
          id:           1, // single-row table
          realm_id:     snapshot.realm_id,
          company_name: snapshot.company_name,
          synced_at:    snapshot.synced_at,
          invoices:     invoices,
          payments:     payments,
          customers:    customers,
        }, { onConflict: 'id' })

      if (error) {
        console.error('[QB Sync] Supabase save error:', error)
        throw new Error(`Failed to save snapshot: ${error.message}`)
      }
      console.log('[QB Sync] ✅ Snapshot saved to Supabase')
    }

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
    console.error('[QB Sync] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── GET — return cached snapshot ──────────────────────────────

export async function GET() {
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ synced: false, message: 'Supabase not configured' })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('qb_snapshot')
      .select('*')
      .eq('id', 1)
      .single()

    if (error || !data) {
      return NextResponse.json({ synced: false, message: 'No sync data yet. Run a sync first.' })
    }

    return NextResponse.json({
      synced:       true,
      realm_id:     data.realm_id,
      company_name: data.company_name,
      synced_at:    data.synced_at,
      invoices:     data.invoices  ?? [],
      payments:     data.payments  ?? [],
      customers:    data.customers ?? [],
    })
  } catch (err) {
    console.error('[QB Sync GET] Error:', err)
    return NextResponse.json({ synced: false, message: 'Failed to read cached data' })
  }
}
