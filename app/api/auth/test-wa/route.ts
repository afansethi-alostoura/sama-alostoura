import { NextResponse } from 'next/server'

export async function GET() {
  const token   = process.env.META_WHATSAPP_TOKEN    ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  const to      = process.env.ADMIN_WHATSAPP         ?? ''

  if (!token || !phoneId || !to) {
    return NextResponse.json({ error: 'Missing env vars', token: !!token, phoneId: !!phoneId, to: !!to })
  }

  const toNumber = to.replace(/^\+/, '')

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toNumber,
      type: 'text',
      text: { body: 'Test OTP: 123456' },
    }),
  })

  const data = await res.json()
  return NextResponse.json({ status: res.status, data, toNumber })
}
