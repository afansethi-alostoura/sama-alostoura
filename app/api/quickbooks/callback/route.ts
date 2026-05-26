import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode }              from '@/lib/quickbooks/client'

async function validateState(req: NextRequest, state: string): Promise<boolean> {
  try {
    const savedState = req.cookies.get('qb-oauth-state')?.value
    console.log('[QB Callback] Cookie state:', savedState ? savedState.slice(0, 8) + '...' : 'MISSING')
    console.log('[QB Callback] URL state:   ', state ? state.slice(0, 8) + '...' : 'MISSING')
    console.log('[QB Callback] State match:', savedState === state)
    return savedState === state
  } catch (err) {
    console.error('[QB Callback] validateState error:', err)
    return false
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state   = searchParams.get('state')
  const error   = searchParams.get('error')

  // Full diagnostic logging
  console.log('[QB Callback] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[QB Callback] Full URL:', req.url)
  console.log('[QB Callback] All params:', Object.fromEntries(searchParams.entries()))
  console.log('[QB Callback] Parsed:', {
    hasCode: !!code,
    codeLength: code?.length ?? 0,
    realmId,
    hasState: !!state,
    error
  })

  // User denied access
  if (error) {
    const errorMsg = searchParams.get('error_description') || error
    console.error('[QB Callback] User denied:', errorMsg)
    return NextResponse.redirect(
      new URL(`/accounting?qb_error=${encodeURIComponent(errorMsg)}`, req.url)
    )
  }

  if (!code || !realmId || !state) {
    console.error('[QB Callback] Missing params:', { code: !!code, realmId: !!realmId, state: !!state })
    return NextResponse.redirect(new URL('/accounting?qb_error=missing_params', req.url))
  }

  // CSRF check
  console.log('[QB Callback] Validating state...')
  console.log('[QB Callback] All cookies:', [...req.cookies.getAll().map(c => c.name)])
  const isValidState = await validateState(req, state)
  if (!isValidState) {
    console.error('[QB Callback] Invalid state - possible CSRF attack')
    return NextResponse.redirect(new URL('/accounting?qb_error=invalid_state', req.url))
  }

  try {
    console.log('[QB Callback] Exchanging code for tokens...')
    await exchangeCode(code, realmId)
    console.log('[QB Callback] Successfully connected! Redirecting...')
    return NextResponse.redirect(new URL('/accounting?qb_connected=1', req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[QB Callback] Exchange failed:', msg, err)
    return NextResponse.redirect(
      new URL(`/accounting?qb_error=${encodeURIComponent(msg)}`, req.url)
    )
  }
}
