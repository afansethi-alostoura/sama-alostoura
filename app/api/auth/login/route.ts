import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SECRET      = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const e   = loginAttempts.get(ip)
  if (!e || now > e.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false }
  e.count++
  return e.count > 10
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createSessionToken(): string {
  const id      = crypto.randomBytes(32).toString('hex')
  const expiry  = Date.now() + SESSION_TTL
  const payload = `${id}.${expiry}`
  return `${payload}.${hmac(payload)}`
}

// ── Keep these exports so verify-otp doesn't break (it no longer uses them
//    but they're imported via named export — safe to leave as no-ops) ──────────
export function createOTPCookie(_code: string): string { return '' }
export function parseOTPCookie(_cookie: string) { return null }
export function bumpAttempts(cookie: string): string { return cookie }

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
      ok =
        username?.length === expectedUser.length &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser)) &&
        password?.length === expectedPass.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass))
    } catch { ok = false }

    if (!ok) return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })

    // If no TOTP secret configured → log in directly (dev fallback)
    if (!process.env.TOTP_SECRET) {
      const res = NextResponse.json({ ok: true, step: 'done' })
      res.cookies.set('sama-session', createSessionToken(), {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: SESSION_TTL / 1000, path: '/',
      })
      return res
    }

    // Credentials valid — ask for Google Authenticator code
    return NextResponse.json({ step: 'totp' })

  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error.' }, { status: 500 })
  }
}
