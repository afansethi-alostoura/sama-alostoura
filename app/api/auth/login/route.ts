import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SECRET      = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000

// All users — add more rows here to create additional accounts
const USERS: Array<{ usernameEnv: string; passwordEnv: string; defaultUser: string; defaultPass: string; role: string }> = [
  {
    usernameEnv: 'ADMIN_USERNAME', passwordEnv: 'ADMIN_PASSWORD',
    defaultUser: 'Samaalostoura',  defaultPass:  'Alostoura1122@',
    role: 'admin',
  },
  {
    usernameEnv: 'ENGR_USERNAME',  passwordEnv: 'ENGR_PASSWORD',
    defaultUser: 'SamaEngineer',   defaultPass:  'Sama@Engr2025',
    role: 'engineer',
  },
]

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

export function createSessionToken(role = 'admin'): string {
  const id      = crypto.randomBytes(32).toString('hex')
  const expiry  = Date.now() + SESSION_TTL
  // payload includes role so it is signed and cannot be tampered
  const payload = `${role}:${id}.${expiry}`
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

    // Try each configured user
    let matchedRole: string | null = null
    for (const u of USERS) {
      const expectedUser = process.env[u.usernameEnv] ?? u.defaultUser
      const expectedPass = process.env[u.passwordEnv] ?? u.defaultPass
      let ok = false
      try {
        ok =
          username?.length === expectedUser.length &&
          crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser)) &&
          password?.length === expectedPass.length &&
          crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass))
      } catch { ok = false }
      if (ok) { matchedRole = u.role; break }
    }

    if (!matchedRole) return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })

    // Engineers skip TOTP (TOTP only applies to admin)
    if (!process.env.TOTP_SECRET || matchedRole !== 'admin') {
      const res = NextResponse.json({ ok: true, step: 'done' })
      res.cookies.set('sama-session', createSessionToken(matchedRole), {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', maxAge: SESSION_TTL / 1000, path: '/',
      })
      return res
    }

    // Admin with TOTP configured — ask for Google Authenticator code
    // Store pending role in a short-lived cookie so verify-otp can embed it
    const res = NextResponse.json({ step: 'totp' })
    res.cookies.set('sama-pending-role', 'admin', {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 300, path: '/',
    })
    return res

  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error.' }, { status: 500 })
  }
}
