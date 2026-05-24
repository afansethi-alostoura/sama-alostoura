/**
 * POST /api/quickbooks/notify
 *
 * Intuit "Disconnect Notify URL" webhook.
 * Intuit sends a POST to this endpoint when a user disconnects
 * your app from their QuickBooks account (e.g. via the QB App Center).
 * We clear the local tokens so the Settings page shows "Not connected".
 */
import { NextResponse } from 'next/server'
import { clearTokens }  from '@/lib/quickbooks/tokens'

export async function POST(req: Request) {
  try {
    // Intuit sends JSON: { realmId, eventType, ... }
    const body = await req.json().catch(() => ({}))
    console.log('[QB notify] Disconnect notification received:', JSON.stringify(body))

    // Clear stored tokens so the app reflects the disconnected state
    clearTokens()

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[QB notify] Error handling disconnect notification:', err)
    return NextResponse.json({ received: true }, { status: 200 }) // always 200 to Intuit
  }
}

// Intuit may also send GET to verify the endpoint is reachable
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 })
}
