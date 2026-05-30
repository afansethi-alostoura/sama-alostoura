import { NextResponse }                                                                        from 'next/server'
import {
  fetchInvoices, fetchPayments, fetchCustomers, fetchCompanyInfo,
  fetchClasses, fetchPurchases, fetchBills,
  fetchAccounts, fetchGLReport, parseGLReport, buildMonthSummaries,
} from '@/lib/quickbooks/client'
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

    // Wide date range for Alostoura GL report (3 years back → today)
    const glFrom = new Date(); glFrom.setFullYear(glFrom.getFullYear() - 3)
    const glFromStr = glFrom.toISOString().slice(0, 10)
    const glToStr   = new Date().toISOString().slice(0, 10)

    const [invoices, payments, customers, companyInfo, classes, purchases, bills, accounts] = await Promise.all([
      fetchInvoices(),
      fetchPayments(),
      fetchCustomers(),
      fetchCompanyInfo(),
      fetchClasses().catch(e => { console.warn('[QB Sync] fetchClasses failed:', e.message); return [] }),
      fetchPurchases().catch(e => { console.warn('[QB Sync] fetchPurchases failed:', e.message); return [] }),
      fetchBills().catch(e => { console.warn('[QB Sync] fetchBills failed:', e.message); return [] }),
      fetchAccounts().catch(e => { console.warn('[QB Sync] fetchAccounts failed:', e.message); return [] }),
    ])

    // Fetch Alostoura General Ledger
    let alostouraCache: object | null = null
    try {
      const alostouraAccount = accounts.find(a =>
        a.Name.toLowerCase().includes('alostoura') ||
        a.FullyQualifiedName.toLowerCase().includes('alostoura')
      )
      if (alostouraAccount) {
        const glReport    = await fetchGLReport(alostouraAccount.Id, glFromStr, glToStr)
        const transactions = parseGLReport(glReport)
        const monthly      = buildMonthSummaries(transactions)
        const totalCredits = transactions.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0)
        const totalDebits  = transactions.filter(t => t.amount <  0).reduce((s, t) => s + Math.abs(t.amount), 0)
        const closingBal   = transactions.length ? transactions[transactions.length - 1].balance : alostouraAccount.CurrentBalance ?? 0
        alostouraCache = {
          account: {
            id:      alostouraAccount.Id,
            name:    alostouraAccount.Name,
            type:    alostouraAccount.AccountType,
            subType: alostouraAccount.AccountSubType,
            balance: alostouraAccount.CurrentBalance,
          },
          transactions: transactions.reverse(),   // newest first
          monthly,
          summary: {
            totalCredits:  Math.round(totalCredits * 100) / 100,
            totalDebits:   Math.round(totalDebits  * 100) / 100,
            netChange:     Math.round((totalCredits - totalDebits) * 100) / 100,
            closingBalance: Math.round(closingBal  * 100) / 100,
            txnCount:      transactions.length,
          },
        }
        console.log(`[QB Sync] Alostoura: ${transactions.length} GL transactions cached`)
      } else {
        console.warn('[QB Sync] No Alostoura account found in Chart of Accounts')
      }
    } catch (e: any) {
      console.warn('[QB Sync] Alostoura GL fetch failed (non-fatal):', e.message)
    }

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

      // Try saving with classes/purchases/bills/alostoura (requires migration)
      const { error } = await supabaseAdmin
        .from('qb_snapshot')
        .upsert({ ...basePayload, classes, purchases, bills, alostoura: alostouraCache }, { onConflict: 'id' })

      if (error) {
        console.warn('[QB Sync] Full upsert failed (migration may be needed):', error.message)
        // Try with just classes/purchases/bills (no alostoura column)
        const { error: err3 } = await supabaseAdmin
          .from('qb_snapshot')
          .upsert({ ...basePayload, classes, purchases, bills }, { onConflict: 'id' })
        if (err3) {
          // Fall back to base only
          const { error: err2 } = await supabaseAdmin
            .from('qb_snapshot')
            .upsert(basePayload, { onConflict: 'id' })
          if (err2) {
            console.error('[QB Sync] Base upsert also failed:', err2)
            throw new Error(`Failed to save snapshot: ${err2.message}`)
          }
          console.log('[QB Sync] ✅ Base snapshot saved (full columns need DB migration)')
        } else {
          console.log('[QB Sync] ✅ Snapshot saved with classes/purchases/bills (alostoura column needs migration)')
        }
      } else {
        console.log('[QB Sync] ✅ Full snapshot saved to Supabase (classes, expenses & alostoura)')
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
        alostoura:  alostouraCache ? (alostouraCache as any).summary?.txnCount ?? 0 : 0,
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
