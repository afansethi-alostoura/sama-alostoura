import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Brute-force protection
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const e = loginAttempts.get(ip)
  if (!e || now > e.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return false
  }
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
    } catch {
      ok = false
    }

    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    // Credentials correct — issue session directly
    const token = createSessionToken()
    const res = NextResponse.json({ ok: true })
    res.cookies.set('sama-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS / 1000,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error.' }, { status: 500 })
  }
}
