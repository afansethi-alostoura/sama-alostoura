import { NextResponse } from 'next/server'
import { createSessionToken } from '@/app/api/auth/login/route'
import {
  getPendingOTP, clearPendingOTP, markWrongAttempt, MAX_ATTEMPTS,
} from '@/lib/otp-store'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = (body.code ?? '').trim()

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code from WhatsApp.' }, { status: 400 })
    }

    const otp = getPendingOTP()

    if (!otp) {
      return NextResponse.json({ error: 'No pending OTP. Please log in again.' }, { status: 400 })
    }
    if (Date.now() > otp.expiresAt) {
      clearPendingOTP()
      return NextResponse.json({ error: 'Code has expired. Please log in again.' }, { status: 400 })
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      clearPendingOTP()
      return NextResponse.json({ error: 'Too many wrong attempts. Please log in again.' }, { status: 429 })
    }
    if (code !== otp.code) {
      markWrongAttempt()
      const left = MAX_ATTEMPTS - (otp.attempts + 1)
      return NextResponse.json(
        { error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` },
        { status: 401 }
      )
    }

    // Correct — clear OTP and issue signed session cookie
    clearPendingOTP()
    const token = createSessionToken()

    const res = NextResponse.json({ ok: true })
    res.cookies.set('sama-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 })
  }
}
