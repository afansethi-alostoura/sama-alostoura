/**
 * Subscribe this app to the WhatsApp Business Account webhook
 * GET /api/whatsapp/subscribe — triggers subscription
 *
 * Call this once after setting up a new phone number.
 * This tells Meta to send webhook events to our endpoint.
 */

import { NextResponse } from 'next/server'

const WABA_ID = '1017512510722491'

export async function GET() {
  const token = process.env.META_WHATSAPP_TOKEN ?? ''

  if (!token) {
    return NextResponse.json({ error: '❌ META_WHATSAPP_TOKEN not set in Vercel env vars' }, { status: 500 })
  }

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
      return NextResponse.json({
        success: true,
        message: '✅ App successfully subscribed to WhatsApp Business Account webhook!',
        next_step: 'Send a WhatsApp message to your business number and check Vercel logs',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '❌ Subscription failed',
        meta_response: data,
        hint: 'Your token may not have whatsapp_business_management permission. Generate a System User token from business.facebook.com',
      }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
