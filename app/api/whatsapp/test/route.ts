/**
 * WhatsApp Diagnostic + Subscribe Endpoint
 * GET  /api/whatsapp/test           — Check env vars + token + subscription status
 * POST /api/whatsapp/test?action=subscribe  — Subscribe app to WABA webhook
 * POST /api/whatsapp/test           — Send a test message { to, message }
 */

import { NextResponse } from 'next/server'

const WABA_ID = '1017512510722491' // WhatsApp Business Account ID

export async function GET() {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  const checks = {
    META_WHATSAPP_TOKEN:       token   ? `✅ Set (${token.slice(0, 20)}...)` : '❌ MISSING',
    META_WHATSAPP_PHONE_ID:    phoneId ? `✅ Set (${phoneId})`               : '❌ MISSING',
    META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN ? '✅ Set' : '❌ MISSING',
    SAMA_AI_KEY:               process.env.SAMA_AI_KEY               ? '✅ Set' : '❌ MISSING',
    NEXT_PUBLIC_SUPABASE_URL:  process.env.NEXT_PUBLIC_SUPABASE_URL  ? '✅ Set' : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ MISSING',
  }

  // Validate token using WABA endpoint (more permissive than phone number endpoint)
  let metaTokenStatus = 'Not tested (token missing)'
  let subscriptionStatus = 'Not tested'

  if (token) {
    try {
      // Test 1: Validate token via WABA
      const wabaRes = await fetch(
        `https://graph.facebook.com/v20.0/${WABA_ID}?fields=id,name&access_token=${token}`
      )
      const wabaData = await wabaRes.json()

      if (wabaRes.ok) {
        metaTokenStatus = `✅ Valid — WABA: ${wabaData.name ?? wabaData.id}`
      } else {
        metaTokenStatus = `❌ Invalid — ${wabaData.error?.message ?? JSON.stringify(wabaData)}`
      }

      // Test 2: Check current webhook subscriptions
      const subRes = await fetch(
        `https://graph.facebook.com/v20.0/${WABA_ID}/subscribed_apps?access_token=${token}`
      )
      const subData = await subRes.json()
      if (subRes.ok) {
        const apps = subData.data ?? []
        subscriptionStatus = apps.length > 0
          ? `✅ ${apps.length} app(s) subscribed: ${apps.map((a: any) => a.name ?? a.id).join(', ')}`
          : '❌ No apps subscribed to this WABA — POST to /api/whatsapp/test?action=subscribe to fix'
      } else {
        subscriptionStatus = `❌ Could not check: ${subData.error?.message ?? JSON.stringify(subData)}`
      }
    } catch (err) {
      metaTokenStatus = `❌ Request failed: ${err}`
    }
  }

  return NextResponse.json({
    status: 'WhatsApp webhook diagnostic',
    waba_id: WABA_ID,
    webhook_url: 'https://app.sabcconstruction.com/api/whatsapp/webhook',
    env_checks: checks,
    meta_token_validation: metaTokenStatus,
    webhook_subscription: subscriptionStatus,
    fix_instructions: {
      if_token_invalid: 'Go to business.facebook.com → Settings → System Users → generate token with whatsapp_business_messaging + whatsapp_business_management permissions',
      if_not_subscribed: 'Open: https://app.sabcconstruction.com/api/whatsapp/subscribe',
    }
  })
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action')

  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  if (!token) {
    return NextResponse.json({ error: 'META_WHATSAPP_TOKEN not set' }, { status: 500 })
  }

  // Subscribe app to WABA
  if (action === 'subscribe') {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${WABA_ID}/subscribed_apps`, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        return NextResponse.json({ success: true, message: '✅ App subscribed to WABA webhook successfully!' })
      } else {
        return NextResponse.json({ success: false, meta_error: data }, { status: 400 })
      }
    } catch (err) {
      return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
    }
  }

  // Send test message
  const body = await req.json()
  const { to, message } = body

  if (!to || !message) {
    return NextResponse.json({ error: 'Provide { to: "971XXXXXXXXX", message: "..." }' }, { status: 400 })
  }

  if (!phoneId) {
    return NextResponse.json({ error: 'META_WHATSAPP_PHONE_ID not set' }, { status: 500 })
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
