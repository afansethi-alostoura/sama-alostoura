/**
 * POST /api/auth/verify-otp
 * Body: { code: "123456" }
 *
 * Validates the pending OTP and issues a signed session cookie on success.
 */
import { NextResponse }  from 'next/server'
import { cookies }       from 'next/headers'
import { createSessionToken } from '../login/route'
import { getPendingOTP, clearPendingOTP, markAttempt } from '../request-otp/route'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_ATTEMPTS   = 3

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = (body.code ?? '').trim()

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code from WhatsApp.' }, { status: 400 })
    }

    const otp = getPendingOTP()

    if (!otp) {
      return NextResponse.json({ error: 'No OTP pending. Request a new code.' }, { status: 400 })
    }

    if (Date.now() > otp.expiresAt) {
      clearPendingOTP()
      return NextResponse.json({ error: 'OTP has expired. Request a new code.' }, { status: 400 })
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      clearPendingOTP()
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new code.' }, { status: 429 })
    }

    if (code !== otp.code) {
      markAttempt()
      const remaining = MAX_ATTEMPTS - otp.attempts
      return NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` },
        { status: 401 }
      )
    }

    // ── Valid OTP — issue session ───────────────────────────────────────────
    clearPendingOTP()
    const token = createSessionToken()

    const cookieStore = await cookies()
    cookieStore.set('sama-session', token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   SESSION_TTL_MS / 1000,
      path:     '/',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[verify-otp]', err)
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 })
  }
}
