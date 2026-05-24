import { NextResponse } from 'next/server'
import { getStatus }    from '@/lib/quickbooks/client'

export async function GET() {
  return NextResponse.json(getStatus())
}
