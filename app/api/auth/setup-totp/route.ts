import { NextResponse } from 'next/server'
import { generateSecret, getOtpAuthUrl } from '@/lib/totp'

export async function GET() {
  const existing = process.env.TOTP_SECRET
  const secret   = existing ?? generateSecret()
  const url      = getOtpAuthUrl(secret)
  const qr       = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`
  return NextResponse.json({ secret, otpauthUrl: url, qrCodeUrl: qr, isConfigured: !!existing })
}
