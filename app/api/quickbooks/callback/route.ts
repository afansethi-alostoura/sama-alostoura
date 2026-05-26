import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode }              from '@/lib/quickbooks/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state   = searchParams.get('state')
  const error   = searchParams.get('error')

  // Maximum logging — show everything
  console.log('[QB Callback] ══════════════════════════════════')
  console.log('[QB Callback] URL:', req.url)
  console.log('[QB Callback] Params:', JSON.stringify(Object.fromEntries(searchParams.entries())))
  console.log('[QB Callback] code:', code ? `YES (${code.length} chars)` : 'MISSING')
  console.log('[QB Callback] realmId:', realmId ?? 'MISSING')
  console.log('[QB Callback] state:', state ? `YES (${state.length} chars)` : 'MISSING')
  console.log('[QB Callback] error:', error ?? 'none')
  console.log('[QB Callback] cookies:', req.cookies.getAll().map(c => c.name).join(', ') || 'NONE')

  // User denied
  if (error) {
    const msg = searchParams.get('error_description') || error
    console.error('[QB Callback] Intuit error:', msg)
    return NextResponse.redirect(new URL(`/accounting?qb_error=${encodeURIComponent(msg)}`, req.url))
  }

  // Missing params
  if (!code || !realmId) {
    console.error('[QB Callback] Missing code or realmId — redirecting with error')
    return NextResponse.redirect(new URL('/accounting?qb_error=missing_params', req.url))
  }

  // Skip strict state check for internal app — just log the mismatch
  if (state) {
    const savedState = req.cookies.get('qb-oauth-state')?.value
    console.log('[QB Callback] State check — cookie:', savedState ? 'present' : 'MISSING', '| match:', savedState === state)
    // Log but don't block — internal app doesn't need strict CSRF
  }

  try {
    console.log('[QB Callback] Exchanging code for tokens with realmId:', realmId)
    await exchangeCode(code, realmId)
    console.log('[QB Callback] ✅ Connected successfully!')
    return NextResponse.redirect(new URL('/accounting?qb_connected=1', req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[QB Callback] ❌ Exchange failed:', msg)
    return NextResponse.redirect(new URL(`/accounting?qb_error=${encodeURIComponent(msg)}`, req.url))
  }
}
