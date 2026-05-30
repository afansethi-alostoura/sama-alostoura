import { NextResponse }                                                                        from 'next/server'
import { fetchInvoices, fetchPayments, fetchCustomers, fetchCompanyInfo, fetchClasses, fetchPurchases, fetchBills } from '@/lib/quickbooks/client'
import { loadTokensAsync }                                                                     from '@/lib/quickbooks/tokens'
import { supabaseAdmin, isSupabaseConfigured }                                               from '@/lib/supabase'
import type { QBSnapshot }                                                                     from '@/lib/quickbooks/types'

// ── POST — fetch from QBO and save snapshot ──────────────────

export async function POST() {
  const tokens = await loadTokensAsync()
  if (!tokens) {
    return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 401 })
  }

  try {
    console.log('[QB Sync] Fetching data from QuickBooks...')
    const [invoices, payments, customers, companyInfo, classes, purchases, bills] = await Promise.all([
      fetchInvoices(),
      fetchPayments(),
      fetchCustomers(),
      fetchCompanyInfo(),
      fetchClasses().catch(e => { console.warn('[QB Sync] fetchClasses failed:', e.message); return [] }),
      fetchPurchases().catch(e => { console.warn('[QB Sync] fetchPurchases failed:', e.message); return [] }),
      fetchBills().catch(e => { console.warn('[QB Sync] fetchBills failed:', e.message); return [] }),
    ])

    const snapshot: QBSnapshot = {
      realm_id:     tokens.realm_id,
      company_name: companyInfo?.CompanyName ?? 'Sama Alostoura Building Contracting LLC',
      synced_at:    new Date().toISOString(),
      invoices,
      payments,
      customers,
      classes,
      purchases,
      bills,
    }

    console.log(
      `[QB Sync] Fetched: ${invoices.length} invoices, ${payments.length} payments, ` +
      `${customers.length} customers, ${classes.length} classes, ` +
      `${purchases.length} purchases, ${bills.length} bills`
    )

    // Save to Supabase — try with new columns first, fall back if migration not run yet
    if (isSupabaseConfigured() && supabaseAdmin) {
      const basePayload = {
        id:           1,
        realm_id:     snapshot.realm_id,
        company_name: snapshot.company_name,
        synced_at:    snapshot.synced_at,
        invoices,
        payments,
        customers,
      }

      // Try saving with classes/purchases/bills (requires migration)
      const { error } = await supabaseAdmin
        .from('qb_snapshot')
        .upsert({ ...basePayload, classes, purchases, bills }, { onConflict: 'id' })

      if (error) {
        console.warn('[QB Sync] Full upsert failed (migration may be needed):', error.message)
        // Fall back: save base data only
        const { error: err2 } = await supabaseAdmin
          .from('qb_snapshot')
          .upsert(basePayload, { onConflict: 'id' })
        if (err2) {
          console.error('[QB Sync] Base upsert also failed:', err2)
          throw new Error(`Failed to save snapshot: ${err2.message}`)
        }
        console.log('[QB Sync] ✅ Base snapshot saved (classes/expenses need DB migration)')
      } else {
        console.log('[QB Sync] ✅ Full snapshot saved to Supabase (with classes & expenses)')
      }
    }

    return NextResponse.json({
      success:      true,
      synced_at:    snapshot.synced_at,
      company_name: snapshot.company_name,
      counts: {
        invoices:   invoices.length,
        payments:   payments.length,
        customers:  customers.length,
        classes:    classes.length,
        purchases:  purchases.length,
        bills:      bills.length,
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
      invoices:     data.invoices   ?? [],
      payments:     data.payments   ?? [],
      customers:    data.customers  ?? [],
      classes:      data.classes    ?? [],
      purchases:    data.purchases  ?? [],
      bills:        data.bills      ?? [],
    })
  } catch (err) {
    console.error('[QB Sync GET] Error:', err)
    return NextResponse.json({ synced: false, message: 'Failed to read cached data' })
  }
}
