import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode }              from '@/lib/quickbooks/client'
import fs                            from 'fs'
import path                          from 'path'

function validateState(state: string): boolean {
  try {
    const file = path.join(process.cwd(), '.qb-oauth-state.tmp')
    if (!fs.existsSync(file)) return false
    const { state: saved, expires } = JSON.parse(fs.readFileSync(file, 'utf8'))
    fs.unlinkSync(file) // one-time use
    return saved === state && Date.now() < expires
  } catch { return false }
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
      new URL(`/settings?qb_error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code || !realmId || !state) {
    return NextResponse.redirect(new URL('/settings?qb_error=missing_params', req.url))
  }

  // CSRF check
  if (!validateState(state)) {
    return NextResponse.redirect(new URL('/settings?qb_error=invalid_state', req.url))
  }

  try {
    await exchangeCode(code, realmId)
    return NextResponse.redirect(new URL('/settings?qb_connected=1', req.url))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/settings?qb_error=${encodeURIComponent(msg)}`, req.url)
    )
  }
}
