/**
 * WhatsApp Diagnostic Test Endpoint
 * GET  /api/whatsapp/test        — Check env vars + token validity
 * POST /api/whatsapp/test        — Send a test message to a phone number
 *
 * Usage:
 *   GET  https://app.sabcconstruction.com/api/whatsapp/test
 *   POST https://app.sabcconstruction.com/api/whatsapp/test
 *        Body: { "to": "971501234567", "message": "Test message" }
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'sama_alostoura_verify_2024 (hardcoded fallback)'

  const checks = {
    META_WHATSAPP_TOKEN:       token   ? `✅ Set (${token.slice(0, 20)}...)` : '❌ MISSING',
    META_WHATSAPP_PHONE_ID:    phoneId ? `✅ Set (${phoneId})`               : '❌ MISSING',
    META_WEBHOOK_VERIFY_TOKEN: verifyToken ? `✅ Set`                        : '❌ MISSING',
    SAMA_AI_KEY:               process.env.SAMA_AI_KEY               ? '✅ Set' : '❌ MISSING',
    NEXT_PUBLIC_SUPABASE_URL:  process.env.NEXT_PUBLIC_SUPABASE_URL  ? '✅ Set' : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ MISSING',
  }

  // Try to validate the Meta token by calling the phone number endpoint
  let metaTokenStatus = 'Not tested (token missing)'
  if (token && phoneId) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${phoneId}?fields=display_phone_number,verified_name&access_token=${token}`
      )
      const data = await res.json()
      if (res.ok) {
        metaTokenStatus = `✅ Valid — Phone: ${data.display_phone_number}, Name: ${data.verified_name}`
      } else {
        metaTokenStatus = `❌ Invalid — ${data.error?.message ?? JSON.stringify(data)}`
      }
    } catch (err) {
      metaTokenStatus = `❌ Request failed: ${err}`
    }
  }

  return NextResponse.json({
    status: 'WhatsApp webhook diagnostic',
    webhook_url: 'https://app.sabcconstruction.com/api/whatsapp/webhook',
    verify_token: 'sama_alostoura_verify_2024',
    env_checks: checks,
    meta_token_validation: metaTokenStatus,
    instructions: {
      step1: 'Verify all env vars are ✅',
      step2: 'meta_token_validation must show ✅ Valid',
      step3: 'In Meta dashboard → WhatsApp → Configuration → Webhook Fields → subscribe to "messages"',
      step4: 'Send a WhatsApp message to your registered number and check Vercel logs',
    }
  })
}

export async function POST(req: Request) {
  const { to, message } = await req.json()

  if (!to || !message) {
    return NextResponse.json({ error: 'Provide { to: "971XXXXXXXXX", message: "..." }' }, { status: 400 })
  }

  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  if (!token || !phoneId) {
    return NextResponse.json({ error: 'META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    })

    const data = await res.json()

    if (res.ok) {
      return NextResponse.json({ success: true, meta_response: data })
    } else {
      return NextResponse.json({ success: false, meta_error: data }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
