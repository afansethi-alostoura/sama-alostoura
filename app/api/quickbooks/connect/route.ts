import { NextResponse } from 'next/server'
import { getAuthUrl }   from '@/lib/quickbooks/client'
import { cookies }      from 'next/headers'
import crypto           from 'crypto'

export async function GET() {
  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
    return NextResponse.json({
      error: 'QuickBooks not configured. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to .env.local',
    }, { status: 400 })
  }

  try {
    const state   = crypto.randomBytes(16).toString('hex')
    const authUrl = getAuthUrl(state)

    console.log('[QB Connect] Starting OAuth — state:', state.slice(0, 8) + '...')
    console.log('[QB Connect] Auth URL:', authUrl)

    // Set cookie directly on the redirect response (not via cookies() API)
    const response = NextResponse.redirect(authUrl)
    response.cookies.set('qb-oauth-state', state, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   600, // 10 minutes
      path:     '/',
    })

    console.log('[QB Connect] State cookie set, redirecting to Intuit...')
    return response
  } catch (error) {
    console.error('QB connect error:', error)
    return NextResponse.json({
      error: 'Failed to initiate QB connection',
    }, { status: 500 })
  }
}
