import { NextResponse } from 'next/server'
import { getAuthUrl }   from '@/lib/quickbooks/client'
import crypto           from 'crypto'
import fs               from 'fs'
import path             from 'path'

// Store OAuth state temporarily so we can validate the callback
function saveState(state: string) {
  fs.writeFileSync(
    path.join(process.cwd(), '.qb-oauth-state.tmp'),
    JSON.stringify({ state, expires: Date.now() + 10 * 60 * 1000 }), // 10 min
    'utf8'
  )
}

export async function GET() {
  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
    return NextResponse.json({
      error: 'QuickBooks not configured. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to .env.local',
    }, { status: 400 })
  }

  const state   = crypto.randomBytes(16).toString('hex')
  const authUrl = getAuthUrl(state)
  saveState(state)

  // Redirect the browser to Intuit's OAuth page
  return NextResponse.redirect(authUrl)
}
