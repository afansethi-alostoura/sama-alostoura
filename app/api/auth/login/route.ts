import { NextResponse } from 'next/server'
import { cookies }       from 'next/headers'
import crypto            from 'crypto'

// ── Credentials from env (never hardcode in source) ──────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-set-SESSION_SECRET-in-env'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days

// ── Simple in-memory brute-force protection ───────────────────────────────────
// Resets on cold start — good enough to block automated attacks without needing
// external storage.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS  = 10
const WINDOW_MS     = 15 * 60 * 1000   // 15 min window

function isRateLimited(ip: string): boolean {
  const now   = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > MAX_ATTEMPTS
}

function clearAttempts(ip: string) { loginAttempts.delete(ip) }

// ── Signed session token ──────────────────────────────────────────────────────
// Format: {randomHex}.{expiryMs}.{hmac_base64url}
// HMAC covers both the id and expiry, so neither can be tampered.
export function createSessionToken(): string {
  const id      = crypto.randomBytes(32).toString('hex')
  const expiry  = Date.now() + SESSION_TTL_MS
  const payload = `${id}.${expiry}`
  const sig     = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      { status: 429 }
    )
  }

  try {
    const body     = await req.json()
    const username = (body.username ?? '').trim()
    const password = (body.password ?? '').trim()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }

    // Constant-time comparison to prevent timing attacks
    let ok = true
    try {
      ok = ok && username.length === ADMIN_USERNAME.length &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(ADMIN_USERNAME))
      ok = ok && password.length === ADMIN_PASSWORD.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD))
    } catch { ok = false }

    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    clearAttempts(ip)
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
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error' }, { status: 500 })
  }
}
