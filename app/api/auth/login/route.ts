import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { generateCode, setPendingOTP, getPendingOTP, OTP_TTL_MS } from '@/lib/otp-store'

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Brute-force protection
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const e = loginAttempts.get(ip)
  if (!e || now > e.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false }
  e.count++
  return e.count > 10
}

export function createSessionToken(): string {
  const id = crypto.randomBytes(32).toString('hex')
  const expiry = Date.now() + SESSION_TTL_MS
  const payload = `${id}.${expiry}`
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set('sama-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  })
}

async function sendOTP(to: string, code: string): Promise<void> {
  const msg = `🔐 *Sama Alostoura*\n\nYour login code:\n\n*${code}*\n\nValid for 10 minutes. Do not share.`

  const token   = process.env.META_WHATSAPP_TOKEN    ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) throw new Error('META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_ID not configured')

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'text',
      text: { body: msg },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta WA error: ${JSON.stringify(err)}`)
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Wait 15 minutes.' }, { status: 429 })
  }

  try {
    const { username, password } = await req.json()

    const expectedUser = process.env.ADMIN_USERNAME ?? 'Samaalostoura'
    const expectedPass = process.env.ADMIN_PASSWORD ?? 'Alostoura1122@'

    let ok = true
    try {
      const uMatch = username?.length === expectedUser.length &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser))
      const pMatch = password?.length === expectedPass.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass))
      ok = uMatch && pMatch
    } catch { ok = false }

    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    // No WhatsApp configured — log in directly
    const adminWA = process.env.ADMIN_WHATSAPP ?? ''
    if (!adminWA) {
      const token = createSessionToken()
      const res = NextResponse.json({ ok: true, step: 'done' })
      setSessionCookie(res, token)
      return res
    }

    // Enforce 60s cooldown between OTP sends
    const existing = getPendingOTP()
    if (existing && Date.now() - existing.requestedAt < 60_000) {
      const wait = Math.ceil((60_000 - (Date.now() - existing.requestedAt)) / 1000)
      return NextResponse.json({ step: 'otp', cooldown: wait })
    }

    // Generate and send OTP — no timeout, let it complete
    const code = generateCode()
    setPendingOTP({ code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, requestedAt: Date.now() })

    try {
      await sendOTP(adminWA, code)
    } catch (err) {
      console.error('[login] WhatsApp send failed:', err)
      // Fall back to direct login so user is never locked out
      const token = createSessionToken()
      const res = NextResponse.json({ ok: true, step: 'done', warning: 'WhatsApp unavailable' })
      setSessionCookie(res, token)
      return res
    }

    const masked = adminWA.slice(0, -4).replace(/\d/g, '*') + adminWA.slice(-4)
    return NextResponse.json({ step: 'otp', sentTo: masked })
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error.' }, { status: 500 })
  }
}
