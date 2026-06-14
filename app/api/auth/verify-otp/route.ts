import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSessionToken, parseOTPCookie, bumpAttempts } from '@/app/api/auth/login/route'

const MAX_ATTEMPTS = 3

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = (body.code ?? '').trim()

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const otpCookieValue = cookieStore.get('sama-otp')?.value

    if (!otpCookieValue) {
      return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 400 })
    }

    const otp = parseOTPCookie(otpCookieValue)

    if (!otp) {
      return NextResponse.json({ error: 'Invalid session. Please log in again.' }, { status: 400 })
    }
    if (Date.now() > otp.expiresAt) {
      return NextResponse.json({ error: 'Code expired. Please log in again.' }, { status: 400 })
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many wrong attempts. Please log in again.' }, { status: 429 })
    }
    if (code !== otp.code) {
      const left = MAX_ATTEMPTS - (otp.attempts + 1)
      const res = NextResponse.json(
        { error: `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.` },
        { status: 401 }
      )
      res.cookies.set('sama-otp', bumpAttempts(otpCookieValue), {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: 600, path: '/',
      })
      return res
    }

    // Correct — issue session, clear OTP cookie
    const res = NextResponse.json({ ok: true })
    res.cookies.set('sama-session', createSessionToken(), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/',
    })
    res.cookies.delete('sama-otp')
    return res
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 })
  }
}
