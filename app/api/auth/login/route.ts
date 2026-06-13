import { NextResponse } from 'next/server'
import crypto           from 'crypto'
import { sendWhatsApp, isTwilioConfigured } from '@/lib/twilio'
import {
  OTP_TTL_MS, generateCode, setPendingOTP, getPendingOTP,
} from '@/lib/otp-store'

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? ''
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-set-SESSION_SECRET-in-env'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// ── Brute-force protection on password step ───────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const e   = loginAttempts.get(ip)
  if (!e || now > e.resetAt) { loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 }); return false }
  e.count++
  return e.count > 10
}
function clearAttempts(ip: string) { loginAttempts.delete(ip) }

// ── Signed session token ──────────────────────────────────────────────────────
export function createSessionToken(): string {
  const id      = crypto.randomBytes(32).toString('hex')
  const expiry  = Date.now() + SESSION_TTL_MS
  const payload = `${id}.${expiry}`
  const sig     = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// ── Send OTP via Twilio or Meta ───────────────────────────────────────────────
async function sendOTP(to: string, code: string): Promise<void> {
  const msg =
    `🔐 *Sama Alostoura*\n\n` +
    `Your login code:\n\n*${code}*\n\n` +
    `Valid for 10 minutes. Do not share.`

  if (isTwilioConfigured()) {
    await sendWhatsApp(to, msg)
    return
  }

  // Meta WA fallback
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) throw new Error('No WhatsApp provider configured')

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

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const ip = req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Wait 15 minutes.' }, { status: 429 })
  }

  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    // Constant-time credential check
    let ok = true
    try {
      ok = ok && username.length === ADMIN_USERNAME.length &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(ADMIN_USERNAME))
      ok = ok && password.length === ADMIN_PASSWORD.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD))
    } catch { ok = false }

    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    clearAttempts(ip)

    // Credentials valid — enforce 60 s cooldown between OTP sends
    const existing = getPendingOTP()
    if (existing && (Date.now() - existing.requestedAt) < 60_000) {
      const wait = Math.ceil((60_000 - (Date.now() - existing.requestedAt)) / 1000)
      return NextResponse.json({ step: 'otp', cooldown: wait }, { status: 200 })
    }

    // Generate and send OTP
    const adminWA = process.env.ADMIN_WHATSAPP ?? ''
    if (!adminWA) {
      return NextResponse.json({ error: 'ADMIN_WHATSAPP not configured.' }, { status: 500 })
    }

    const code = generateCode()
    setPendingOTP({ code, expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, requestedAt: Date.now() })

    try {
      await sendOTP(adminWA, code)
    } catch (err) {
      console.error('[login] WhatsApp send failed:', err)
      return NextResponse.json(
        { error: 'Credentials correct but WhatsApp send failed. Check WhatsApp config.' },
        { status: 500 }
      )
    }

    const masked = adminWA.slice(0, -4).replace(/\d/g, '*') + adminWA.slice(-4)
    return NextResponse.json({ step: 'otp', sentTo: masked })
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Login error.' }, { status: 500 })
  }
}
