/**
 * Register phone number with WhatsApp Cloud API
 * GET /api/whatsapp/register — registers the phone number
 *
 * This must be called once after adding a new phone number.
 * Error #133010 "Account not registered" means this hasn't been done yet.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  if (!token || !phoneId) {
    return NextResponse.json({ error: 'META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/register`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: '123456',
      }),
    })

    const data = await res.json()

    if (res.ok && data.success) {
      return NextResponse.json({
        success: true,
        message: '✅ Phone number successfully registered with WhatsApp Cloud API!',
        next_step: 'Now open /api/whatsapp/send-test?to=971XXXXXXXXX to test outbound messaging',
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '❌ Registration failed',
        meta_response: data,
      }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
