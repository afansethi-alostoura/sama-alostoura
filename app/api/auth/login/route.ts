import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SECRET       = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'
const SESSION_TTL  = 7 * 24 * 60 * 60 * 1000
const OTP_TTL      = 10 * 60 * 1000

// Brute-force protection (in-memory is fine here — it's per-instance, adds friction)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const e = loginAttempts.get(ip)
  if (!e || now > e.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false }
  e.count++
  return e.count > 10
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createSessionToken(): string {
  const id = crypto.randomBytes(32).toString('hex')
  const expiry = Date.now() + SESSION_TTL
  const payload = `${id}.${expiry}`
  return `${payload}.${hmac(payload)}`
}

// OTP stored in a signed cookie — stateless, works across Vercel instances
export function createOTPCookie(code: string): string {
  const expiresAt = Date.now() + OTP_TTL
  const attempts  = 0
  const payload   = `${code}.${expiresAt}.${attempts}`
  return `${payload}.${hmac(payload)}`
}

export function parseOTPCookie(cookie: string): { code: string; expiresAt: number; attempts: number } | null {
  try {
    const lastDot = cookie.lastIndexOf('.')
    if (lastDot === -1) return null
    const payload = cookie.slice(0, lastDot)
    const sig     = cookie.slice(lastDot + 1)
    if (hmac(payload) !== sig) return null

    const parts = payload.split('.')
    if (parts.length !== 3) return null
    const [code, expiresAt, attempts] = parts
    return { code, expiresAt: parseInt(expiresAt), attempts: parseInt(attempts) }
  } catch { return null }
}

export function bumpAttempts(cookie: string): string {
  const data = parseOTPCookie(cookie)
  if (!data) return cookie
  const payload = `${data.code}.${data.expiresAt}.${data.attempts + 1}`
  return `${payload}.${hmac(payload)}`
}

function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set('sama-session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: SESSION_TTL / 1000, path: '/',
  })
}

function setOTPCookie(res: NextResponse, value: string) {
  res.cookies.set('sama-otp', value, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: OTP_TTL / 1000, path: '/',
  })
}

async function sendOTP(to: string, code: string): Promise<void> {
  const msg     = `🔐 *Sama Alostoura*\n\nYour login code:\n\n*${code}*\n\nValid for 10 minutes. Do not share.`
  const token   = process.env.META_WHATSAPP_TOKEN    ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) throw new Error('META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_ID not set')

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
    throw new Error(`Meta error: ${JSON.stringify(err)}`)
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
      ok = username?.length === expectedUser.length &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser)) &&
        password?.length === expectedPass.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass))
    } catch { ok = false }

    if (!ok) return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })

    // No WhatsApp configured — log in directly
    const adminWA = process.env.ADMIN_WHATSAPP ?? ''
    if (!adminWA) {
      const res = NextResponse.json({ ok: true, step: 'done' })
      setSessionCookie(res, createSessionToken())
      return res
    }

    // Generate and send OTP
    const code = String(Math.floor(100000 + Math.random() * 900000))
    try {
      await sendOTP(adminWA, code)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[login] WhatsApp failed:', msg)
      return NextResponse.json({ error: `WhatsApp error: ${msg}` }, { status: 500 })
    }

    // Store OTP in signed cookie — survives across serverless instances
    const otpCookie = createOTPCookie(code)
    const masked    = adminWA.slice(0, -4).replace(/\d/g, '*') + adminWA.slice(-4)
    const res       = NextResponse.json({ step: 'otp', sentTo: masked })
    setOTPCookie(res, otpCookie)
    return res
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error.' }, { status: 500 })
  }
}
