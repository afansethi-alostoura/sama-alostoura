import { NextResponse } from 'next/server'
import { getStatus }    from '@/lib/quickbooks/client'

export async function GET() {
  try {
    return NextResponse.json(getStatus())
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({
      connected: false,
      client_configured: !!process.env.QUICKBOOKS_CLIENT_ID,
      environment: process.env.QUICKBOOKS_ENVIRONMENT ?? 'sandbox'
    })
  }
}
