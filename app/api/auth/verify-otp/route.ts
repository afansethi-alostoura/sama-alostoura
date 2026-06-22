import { NextResponse } from 'next/server'
import { createSessionToken } from '@/app/api/auth/login/route'
import { verifyTOTP } from '@/lib/totp'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = (body.code ?? '').replace(/\s/g, '')

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code from Google Authenticator.' }, { status: 400 })
    }

    const secret = process.env.TOTP_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'TOTP not configured. Contact admin.' }, { status: 500 })
    }

    const valid = verifyTOTP(code, secret)
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect code. Try again — codes refresh every 30 seconds.' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('sama-session', createSessionToken(), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/',
    })
    return res
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 })
  }
}
