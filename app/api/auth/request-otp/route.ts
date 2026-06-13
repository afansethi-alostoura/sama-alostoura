/**
 * POST /api/auth/request-otp
 *
 * Generates a 6-digit OTP and sends it to the admin's pre-configured
 * WhatsApp number (ADMIN_WHATSAPP env var).
 *
 * Rate limit: 3 requests per 10 minutes.
 * OTP expires: 10 minutes from generation.
 */
import { NextResponse } from 'next/server'
import { sendWhatsApp, isTwilioConfigured } from '@/lib/twilio'

const OTP_TTL_MS       = 10 * 60 * 1000   // 10 minutes
const COOLDOWN_MS      = 60 * 1000         // 60 s between requests
const MAX_REQUESTS     = 3                 // per window
const WINDOW_MS        = 10 * 60 * 1000

// ── In-memory OTP state (single admin, one pending OTP at a time) ─────────────
interface OTPRecord {
  code:        string
  expiresAt:   number
  attempts:    number   // wrong-code attempts
  requestedAt: number   // time of last request (for cooldown)
  requestCount: number  // requests in current window
  windowStart:  number  // start of current rate-limit window
}

let pendingOTP: OTPRecord | null = null

export function getPendingOTP(): OTPRecord | null { return pendingOTP }
export function clearPendingOTP()                 { pendingOTP = null }
export function markAttempt()                     { if (pendingOTP) pendingOTP.attempts++ }

// ── Send via Meta WA Business API (fallback when Twilio not configured) ───────
async function sendViaMeta(to: string, message: string): Promise<void> {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) throw new Error('Meta WhatsApp not configured')

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),   // Meta wants digits only, no +
      type: 'text',
      text: { body: message },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta API error: ${JSON.stringify(err)}`)
  }
}

export async function POST() {
  const adminWA = process.env.ADMIN_WHATSAPP ?? ''
  if (!adminWA) {
    return NextResponse.json(
      { error: 'ADMIN_WHATSAPP not set in environment variables.' },
      { status: 500 }
    )
  }

  const now = Date.now()

  // ── Cooldown check ─────────────────────────────────────────────────────────
  if (pendingOTP) {
    const secondsSinceRequest = (now - pendingOTP.requestedAt) / 1000
    if (secondsSinceRequest < COOLDOWN_MS / 1000) {
      const wait = Math.ceil(COOLDOWN_MS / 1000 - secondsSinceRequest)
      return NextResponse.json({ error: `Please wait ${wait}s before requesting another OTP.` }, { status: 429 })
    }
    // Rate-limit window
    if (now - pendingOTP.windowStart < WINDOW_MS) {
      if (pendingOTP.requestCount >= MAX_REQUESTS) {
        return NextResponse.json({ error: 'Too many OTP requests. Try again in 10 minutes.' }, { status: 429 })
      }
    } else {
      // New window
      pendingOTP.windowStart   = now
      pendingOTP.requestCount  = 0
    }
  }

  // ── Generate OTP ───────────────────────────────────────────────────────────
  const code = String(Math.floor(100000 + Math.random() * 900000))

  pendingOTP = {
    code,
    expiresAt:    now + OTP_TTL_MS,
    attempts:     0,
    requestedAt:  now,
    requestCount: (pendingOTP?.windowStart && now - pendingOTP.windowStart < WINDOW_MS)
                    ? (pendingOTP.requestCount + 1) : 1,
    windowStart:  pendingOTP?.windowStart && now - pendingOTP.windowStart < WINDOW_MS
                    ? pendingOTP.windowStart : now,
  }

  const message =
    `🔐 *Sama Alostoura Login*\n\n` +
    `Your verification code is:\n\n` +
    `*${code}*\n\n` +
    `Valid for 10 minutes. Do not share this code with anyone.`

  // ── Send ───────────────────────────────────────────────────────────────────
  try {
    if (isTwilioConfigured()) {
      await sendWhatsApp(adminWA, message)
    } else {
      await sendViaMeta(adminWA, message)
    }
  } catch (err) {
    console.error('[request-otp] Send failed:', err)
    pendingOTP = null  // Don't leave a code if send failed
    return NextResponse.json(
      { error: 'Failed to send WhatsApp message. Check WhatsApp configuration.' },
      { status: 500 }
    )
  }

  // Return masked phone so UI can show where it was sent
  const masked = adminWA.slice(0, -4).replace(/\d/g, '*') + adminWA.slice(-4)

  return NextResponse.json({
    ok:          true,
    sentTo:      masked,
    expiresInMs: OTP_TTL_MS,
  })
}
