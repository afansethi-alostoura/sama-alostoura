import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode }              from '@/lib/quickbooks/client'
import { cookies }                   from 'next/headers'

async function validateState(state: string): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const savedState = cookieStore.get('qb-oauth-state')?.value

    // Delete the cookie (one-time use)
    cookieStore.delete('qb-oauth-state')

    return savedState === state
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code    = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state   = searchParams.get('state')
  const error   = searchParams.get('error')

  // User denied access
  if (error) {
    return NextResponse.redirect(
      new URL(`/accounting?qb_error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(new URL('/accounting?qb_error=missing_params', req.url))
  }

  // CSRF check
  const isValidState = await validateState(state)
  if (!isValidState) {
    return NextResponse.redirect(new URL('/accounting?qb_error=invalid_state', req.url))
  }

  try {
    await exchangeCode(code, realmId)
    return NextResponse.redirect(new URL('/accounting?qb_connected=1', req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/accounting?qb_error=${encodeURIComponent(msg)}`, req.url)
    )
  }
}
