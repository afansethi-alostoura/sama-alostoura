/**
 * Quick outbound test — sends hello_world template from business number
 * GET /api/whatsapp/send-test?to=971XXXXXXXXX
 */

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const to      = searchParams.get('to') ?? '971562467600'
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  if (!token || !phoneId) {
    return NextResponse.json({ error: 'Token or Phone ID missing' }, { status: 500 })
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
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      }),
    })

    const data = await res.json()

    if (res.ok) {
      return NextResponse.json({
        success: true,
        message: `✅ Template message sent to ${to}`,
        meta_response: data,
      })
    } else {
      return NextResponse.json({
        success: false,
        to,
        meta_error: data,
      }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
