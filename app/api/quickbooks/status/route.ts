import { NextResponse } from 'next/server'
import { getStatus }    from '@/lib/quickbooks/client'

export async function GET() {
  try {
    const status = await getStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({
      connected: false,
      client_configured: !!process.env.QUICKBOOKS_CLIENT_ID,
      environment: process.env.QUICKBOOKS_ENVIRONMENT ?? 'sandbox'
    })
  }
}
