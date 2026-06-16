import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? 'sama-procurement'
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

// ── GET — Meta webhook verification ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST — Incoming WhatsApp message ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Extract message from Meta webhook payload
    const entry   = body?.entry?.[0]
    const change  = entry?.changes?.[0]?.value
    const msg     = change?.messages?.[0]
    const contact = change?.contacts?.[0]

    // Only handle inbound text messages
    if (!msg || msg.type !== 'text') {
      return NextResponse.json({ status: 'ignored' })
    }

    const from        = msg.from               // e.g. "971501234567"
    const msgBody     = msg.text?.body?.trim() ?? ''
    const profileName = contact?.profile?.name ?? ''
    const phoneId     = change?.metadata?.phone_number_id ?? PHONE_NUMBER_ID

    if (!msgBody) return NextResponse.json({ status: 'empty' })

    // ── Parse with Claude ─────────────────────────────────────────────────────
    let parsed = { project: '', material: '', quantity: '', unit: '', date: '' }
    try {
      const ai = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Extract procurement request details from this WhatsApp message sent to a Dubai construction company (Sama Alostoura):

"${msgBody}"

Return ONLY valid JSON (no markdown):
{
  "project": "<project name or empty>",
  "material": "<material or item requested>",
  "quantity": "<number only or empty>",
  "unit": "<e.g. bags, tons, pcs, m2, or empty>",
  "date": "<YYYY-MM-DD if mentioned, else empty>"
}`,
        }],
      })
      const text = ai.content[0].type === 'text' ? ai.content[0].text.trim() : '{}'
      parsed = JSON.parse(text)
    } catch {
      parsed.material = msgBody
    }

    if (!parsed.material) {
      await sendReply(phoneId, from, `I couldn't understand your request. Please try:\n\n*Project:* FAHAD\n*Material:* Cement\n*Qty:* 50 bags\n*Date:* 2026-07-15\n\nor just describe what you need freely.`)
      return NextResponse.json({ status: 'unparsed' })
    }

    // ── Match project ─────────────────────────────────────────────────────────
    let projectId = ''
    let projectName = parsed.project || ''
    if (parsed.project && isSupabaseConfigured() && supabaseAdmin) {
      const { data: proj } = await supabaseAdmin
        .from('projects')
        .select('id, name')
        .ilike('name', `%${parsed.project}%`)
        .limit(1)
        .single()
      if (proj) { projectId = proj.id; projectName = proj.name }
    }

    // ── Create PR ─────────────────────────────────────────────────────────────
    const prNumber = `WA-${Date.now().toString().slice(-6)}`
    const title    = parsed.material + (projectName ? ` — ${projectName}` : '')

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      await sendReply(phoneId, from, `Request received but system not configured. Call the office for: ${title}`)
      return NextResponse.json({ status: 'db_not_configured' })
    }

    const { data: pr, error } = await supabaseAdmin
      .from('procurement_prs')
      .insert({
        pr_number:      prNumber,
        project_id:     projectId,
        project_name:   projectName,
        title,
        description:    msgBody,
        requested_by:   profileName || from,
        date_requested: new Date().toISOString().slice(0, 10),
        date_needed:    parsed.date || null,
        status:         'requested',
        items:          [{ description: parsed.material, qty: parsed.quantity || '', unit: parsed.unit || '', notes: '' }],
        source:         'whatsapp',
        whatsapp_from:  from,
        notes:          '',
      })
      .select()
      .single()

    if (error || !pr) {
      await sendReply(phoneId, from, `Sorry, couldn't create the request. Please call the office.`)
      return NextResponse.json({ status: 'insert_error', error: error?.message })
    }

    const reply = [
      `✅ *Purchase Request Created*`,
      `*PR#:* ${prNumber}`,
      `*Material:* ${parsed.material}`,
      parsed.quantity ? `*Qty:* ${parsed.quantity} ${parsed.unit}` : '',
      projectName ? `*Project:* ${projectName}` : '',
      parsed.date ? `*Needed by:* ${parsed.date}` : '',
      `*Status:* Pending Approval`,
      ``,
      `The procurement team will review and follow up. 🏗️`,
    ].filter(Boolean).join('\n')

    await sendReply(phoneId, from, reply)
    return NextResponse.json({ status: 'ok', pr_number: prNumber })

  } catch (e) {
    console.error('WhatsApp webhook error:', e)
    return NextResponse.json({ status: 'error' }, { status: 200 }) // always 200 to Meta
  }
}

// ── Send reply via Meta Graph API ─────────────────────────────────────────────
async function sendReply(phoneNumberId: string, to: string, text: string) {
  if (!ACCESS_TOKEN || !phoneNumberId) return
  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })
}
