import { NextResponse } from 'next/server'
import { revokeTokens } from '@/lib/quickbooks/client'

export async function POST() {
  await revokeTokens()
  return NextResponse.json({ disconnected: true })
}
