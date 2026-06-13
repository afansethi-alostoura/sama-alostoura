import { NextResponse } from 'next/server'

// This endpoint is no longer used — OTP is now sent automatically by /api/auth/login
// after credential verification. Kept as a stub to avoid 404s from cached clients.
export async function POST() {
  return NextResponse.json(
    { error: 'Use /api/auth/login to request an OTP.' },
    { status: 410 }
  )
}
