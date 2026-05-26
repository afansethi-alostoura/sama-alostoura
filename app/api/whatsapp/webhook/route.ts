/**
 * Meta WhatsApp Business API Webhook
 * GET  /api/whatsapp/webhook  — Meta verification handshake (one-time setup)
 * POST /api/whatsapp/webhook  — Receive incoming WhatsApp messages
 *
 * Add these to .env.local and Vercel environment variables:
 *   META_WHATSAPP_TOKEN          — Permanent access token from Meta for Developers
 *   META_WHATSAPP_PHONE_ID       — Phone Number ID from Meta dashboard (NOT the phone number itself)
 *   META_WEBHOOK_VERIFY_TOKEN    — sama_alostoura_verify_2024  (must match what you enter in Meta dashboard)
 *
 * Webhook URL to enter in Meta dashboard:
 *   https://app.sabcconstruction.com/api/whatsapp/webhook
 */

import { NextResponse } from 'next/server'
import { getAllStoredProjects } from '@/lib/projects-store'
import { getAllProgress, saveProgress } from '@/lib/project-progress'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

// ─── Meta payload types ───────────────────────────────────────────────────────

interface MetaTextMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | string
  text?: { body: string }
  image?: { caption?: string; id: string }
  document?: { caption?: string; filename: string; id: string }
}

interface MetaWebhookBody {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      field: string
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: MetaTextMessage[]
        statuses?: unknown[]
      }
    }>
  }>
}

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'sama_alostoura_verify_2024'
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp] Webhook verified by Meta ✅')
    return new Response(challenge ?? '', { status: 200 })
  }

  console.warn('[WhatsApp] Verification failed — token mismatch')
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — Receive messages from Meta ───────────────────────────────────────

export async function POST(req: Request) {
  let body: MetaWebhookBody
  let rawText = ''

  try {
    rawText = await req.text()
    body = JSON.parse(rawText) as MetaWebhookBody
  } catch {
    console.error('[WhatsApp] POST received non-JSON body:', rawText.slice(0, 500))
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Log every POST so we can see it in Vercel logs
  console.log('[WhatsApp] POST received — object:', body.object, '| entries:', body.entry?.length ?? 0)

  // Always return 200 immediately — Meta will retry if we don't
  if (body.object !== 'whatsapp_business_account') {
    console.log('[WhatsApp] Ignored — unexpected object type:', body.object)
    return NextResponse.json({ status: 'ignored' })
  }

  let messageCount = 0

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      console.log('[WhatsApp] Change field:', change.field)
      if (change.field !== 'messages') continue
      const { messages, contacts } = change.value
      console.log('[WhatsApp] Messages in payload:', messages?.length ?? 0)
      if (!messages?.length) continue

      for (const msg of messages) {
        const text =
          msg.text?.body ??
          msg.image?.caption ??
          msg.document?.caption ??
          ''
        if (!text.trim()) continue

        const from       = msg.from
        const senderName = contacts?.find(c => c.wa_id === from)?.profile.name ?? 'Unknown'
        console.log(`[WhatsApp] Message from ${senderName} (${from}): "${text.slice(0, 100)}"`)
        messageCount++

        // Process synchronously — Vercel kills async work after response is sent
        try {
          await handleMessage({ text: text.trim(), from, senderName })
        } catch (err) {
          console.error('[WhatsApp] handleMessage error:', err)
        }
      }
    }
  }

  console.log(`[WhatsApp] Processed ${messageCount} message(s)`)
  return NextResponse.json({ status: 'ok', processed: messageCount })
}

// ─── Core message handler ─────────────────────────────────────────────────────

async function handleMessage({
  text,
  from,
  senderName,
}: {
  text: string
  from: string
  senderName: string
}) {
  // 1. Load live project data
  const stored    = getAllStoredProjects()
  const overrides = await getAllProgress()

  const projects = stored.map(p => ({
    id:               p.id,
    name:             p.name,
    client_name:      (p.client_name ?? '') as string,
    location:         ((p as any).location ?? '') as string,
    progress_percent: overrides[p.id]?.progress_percent ?? p.progress_percent,
    current_stage:    (overrides[p.id]?.current_stage ?? p.current_stage ?? '') as string,
    boq_sections:     overrides[p.id]?.boq_sections ?? (p as any).boq_sections ?? [],
  }))

  // 2. Claude Haiku parses the message
  const aiPrompt = `You are the WhatsApp assistant for Sama Alostoura Building Contracting LLC, Dubai UAE.
Message from ${senderName}: "${text}"

PROJECTS:
${projects.map(p =>
  `• ID: ${p.id} | ${p.name} | Client: ${p.client_name} | Location: ${p.location} | Progress: ${p.progress_percent}% | Stage: ${p.current_stage}`
).join('\n')}

Return ONLY valid JSON:
{
  "project_id":   "<matched project ID or null>",
  "project_name": "<matched project name or null>",
  "action_type":  "<progress_update|payment_received|material_request|issue_report|note>",
  "parsed_data": {
    "progress_percent":  <0-100 or null>,
    "current_stage":     "<string or null>",
    "payment_amount":    <AED number or null>,
    "materials":         "<string or null>",
    "issue_description": "<string or null>",
    "note":              "<string or null>"
  },
  "ai_summary":    "<one sentence for CEO briefing>",
  "confidence":    "<high|medium|low>",
  "reply_message": "<WhatsApp reply max 2 sentences. ✅ if clear, ❓ if project unclear. Match sender language (Arabic/English).>"
}`

  interface Parsed {
    project_id:   string | null
    project_name: string | null
    action_type:  string
    parsed_data: {
      progress_percent:  number | null
      current_stage:     string | null
      payment_amount:    number | null
      materials:         string | null
      issue_description: string | null
      note:              string | null
    }
    ai_summary:    string
    confidence:    'high' | 'medium' | 'low'
    reply_message: string
  }

  let parsed: Parsed | null = null
  try {
    const res  = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 500,
      messages:   [{ role: 'user', content: aiPrompt }],
    })
    const raw   = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(clean)
  } catch (err) {
    console.error('[WhatsApp] AI parse error:', err)
  }

  // 3. Save to Supabase
  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin.from('whatsapp_messages').insert({
        project_id:   parsed?.project_id   ?? null,
        project_name: parsed?.project_name ?? null,
        from_number:  from,
        sender_name:  senderName,
        message_body: text,
        action_type:  parsed?.action_type  ?? 'note',
        parsed_data:  parsed?.parsed_data  ?? {},
        ai_summary:   parsed?.ai_summary   ?? text,
        confidence:   parsed?.confidence   ?? 'low',
        auto_applied: false,
      })
    } catch (err) {
      console.error('[WhatsApp] Supabase insert error:', err)
    }
  }

  // 4. Auto-apply progress update (high/medium confidence only)
  let autoApplied = false
  if (
    parsed?.project_id &&
    parsed.action_type === 'progress_update' &&
    parsed.parsed_data.progress_percent !== null &&
    parsed.confidence !== 'low'
  ) {
    const project = projects.find(p => p.id === parsed!.project_id)
    if (project) {
      try {
        await saveProgress(
          parsed.project_id,
          parsed.parsed_data.progress_percent!,
          parsed.parsed_data.current_stage ?? project.current_stage,
          project.boq_sections as any,
        )
        autoApplied = true
      } catch (err) {
        console.error('[WhatsApp] saveProgress error:', err)
      }
    }
  }

  // 5. Send WhatsApp reply
  const reply =
    (parsed?.reply_message ?? '✅ Message received and logged.') +
    (autoApplied ? '\n\n📊 Dashboard updated automatically.' : '')

  await sendReply(from, reply)
}

// ─── Send reply via Meta Cloud API ───────────────────────────────────────────

async function sendReply(to: string, message: string) {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  if (!token || !phoneId) {
    console.warn('[WhatsApp] META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set')
    return
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

    if (!res.ok) {
      const err = await res.text()
      console.error('[WhatsApp] Send reply failed:', res.status, err)
    }
  } catch (err) {
    console.error('[WhatsApp] sendReply error:', err)
  }
}
