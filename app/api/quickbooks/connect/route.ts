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

    // Store state in secure cookie (10 minute expiry)
    const response = NextResponse.redirect(authUrl)
    const cookieStore = await cookies()
    cookieStore.set('qb-oauth-state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('QB connect error:', error)
    return NextResponse.json({
      error: 'Failed to initiate QB connection',
    }, { status: 500 })
  }
}
