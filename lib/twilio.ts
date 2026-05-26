/**
 * Twilio WhatsApp helper for Sama Alostoura
 *
 * Required environment variables (set in Vercel dashboard):
 *   TWILIO_ACCOUNT_SID   — from Twilio Console → Account Info
 *   TWILIO_AUTH_TOKEN    — from Twilio Console → Account Info
 *   TWILIO_WHATSAPP_NUMBER — your WhatsApp sender, e.g. whatsapp:+14155238886
 */

let _client: ReturnType<typeof import('twilio')> | null = null

function getTwilioClient() {
  if (_client) return _client
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? ''
  const authToken  = process.env.TWILIO_AUTH_TOKEN  ?? ''
  if (!accountSid || !authToken) return null
  // Lazy import avoids issues when env vars are missing at build time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require('twilio')
  _client = twilio(accountSid, authToken)
  return _client
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN  &&
    process.env.TWILIO_WHATSAPP_NUMBER
  )
}

/** Send a WhatsApp message via Twilio */
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const client = getTwilioClient()
  if (!client) throw new Error('Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER to Vercel env vars')
  const from = process.env.TWILIO_WHATSAPP_NUMBER ?? ''
  await (client as any).messages.create({
    from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    to:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
    body,
  })
}

/**
 * Build a TwiML XML response — used as the synchronous reply to Twilio's webhook.
 * Twilio expects this within 15 seconds or it times out.
 */
export function twimlReply(message: string): Response {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } },
  )
}

/** Empty TwiML — reply with no message (silent ack) */
export function twimlEmpty(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { 'Content-Type': 'text/xml' } },
  )
}
