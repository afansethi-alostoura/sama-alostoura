/**
 * Meta WhatsApp Business API Webhook
 * GET  /api/meta/whatsapp/webhook  — Meta verification handshake
 * POST /api/meta/whatsapp/webhook  — Receive incoming WhatsApp messages
 *
 * Required env vars (set in Vercel + .env.local):
 *   META_WHATSAPP_TOKEN          — Permanent access token from Meta for Developers
 *   META_WHATSAPP_PHONE_ID       — Phone Number ID (from Meta dashboard, not the actual number)
 *   META_WEBHOOK_VERIFY_TOKEN    — Any secret string you choose (must match what you enter in Meta dashboard)
 *
 * Flow:
 *  1. Meta calls GET to verify the webhook — we return hub.challenge
 *  2. Meta calls POST for every incoming message
 *  3. Claude parses the message: project match + action type
 *  4. Save to Supabase whatsapp_messages table
 *  5. Auto-update project_progress if progress % is stated clearly
 *  6. Send reply via Meta Cloud API
 */

import { NextResponse } from 'next/server'
import { getAllStoredProjects } from '@/lib/projects-store'
import { getAllProgress, saveProgress } from '@/lib/project-progress'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

// ── Types for Meta webhook payload ───────────────────────────────────────────

interface MetaMessage {
  from:      string
  id:        string
  timestamp: string
  type:      string
  text?:     { body: string }
  image?:    { caption?: string; mime_type: string; id: string }
  document?: { caption?: string; filename: string; id: string }
}

interface MetaContact {
  profile: { name: string }
  wa_id:   string
}

interface MetaValue {
  messaging_product: string
  metadata:  { display_phone_number: string; phone_number_id: string }
  contacts?: MetaContact[]
  messages?: MetaMessage[]
  statuses?: unknown[]
}

interface MetaWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{ value: MetaValue; field: string }>
  }>
}

// ── GET — Meta webhook verification ──────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? ''

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[Meta WhatsApp] Webhook verified ✅')
    return new Response(challenge ?? '', { status: 200 })
  }

  console.warn('[Meta WhatsApp] Webhook verification failed — token mismatch')
  return new Response('Forbidden', { status: 403 })
}

// ── POST — Receive messages ───────────────────────────────────────────────────

export async function POST(req: Request) {
  let payload: MetaWebhookPayload

  try {
    payload = await req.json() as MetaWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Meta always expects 200 OK immediately — process async
  // We process synchronously here (fast enough with Haiku) and still return 200
  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' })
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value

      // Skip delivery status updates — only process real messages
      if (!value.messages?.length) continue

      for (const message of value.messages) {
        // Only handle text messages (and image/doc captions)
        const body =
          message.text?.body ??
          message.image?.caption ??
          message.document?.caption ??
          ''

        if (!body.trim()) continue

        const from        = message.from   // e.g. "971501234567"
        const senderName  = value.contacts?.find(c => c.wa_id === from)?.profile?.name ?? 'Unknown'

        // Process in background — don't block the 200 response
        processMessage({ body: body.trim(), from, senderName, messageId: message.id }).catch(err =>
          console.error('[Meta WhatsApp] processMessage error:', err)
        )
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}

// ── Core processing logic ─────────────────────────────────────────────────────

async function processMessage({
  body,
  from,
  senderName,
  messageId,
}: {
  body:        string
  from:        string
  senderName:  string
  messageId:   string
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

  // 2. Claude parses the message
  const prompt = `You are the WhatsApp message parser for Sama Alostoura Building Contracting LLC, Dubai UAE.
Message received from ${senderName} on the company WhatsApp.

MESSAGE: "${body}"

ACTIVE PROJECTS:
${projects.map(p =>
  `• ID: ${p.id} | Name: ${p.name} | Client: ${p.client_name} | Location: ${p.location} | Progress: ${p.progress_percent}% | Stage: ${p.current_stage}`
).join('\n')}

Return ONLY valid JSON — no markdown, no explanation:
{
  "project_id":   "<matched project ID or null>",
  "project_name": "<matched project name or null>",
  "action_type":  "<progress_update | payment_received | material_request | issue_report | note>",
  "parsed_data": {
    "progress_percent":   <number 0-100 or null — only if clearly stated or implied>,
    "current_stage":      "<updated stage description or null>",
    "payment_amount":     <AED number or null>,
    "materials":          "<description or null>",
    "issue_description":  "<description or null>",
    "note":               "<any other info>"
  },
  "ai_summary":    "<one clear sentence for the CEO morning briefing>",
  "confidence":    "<high | medium | low>",
  "reply_message": "<friendly WhatsApp reply, max 2 sentences. Start with ✅ for success, ❓ if project unclear. Match sender language: Arabic or English.>"
}

Matching rules:
- Match project by client name, project name, location or any identifier
- Extract % if stated ("40% done", "foundation complete" ≈ 15%)
- Extract AED payment amounts
- confidence=high only when project match is certain AND data is explicit`

  interface ParsedMsg {
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

  let parsed: ParsedMsg | null = null

  try {
    const aiRes = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    })
    const raw   = aiRes.content[0].type === 'text' ? aiRes.content[0].text.trim() : ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(clean) as ParsedMsg
  } catch (err) {
    console.error('[Meta WhatsApp] AI parse failed:', err)
  }

  // 3. Save to Supabase
  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin.from('whatsapp_messages').insert({
        project_id:   parsed?.project_id   ?? null,
        project_name: parsed?.project_name ?? null,
        from_number:  from,
        sender_name:  senderName,
        group_id:     null,
        message_body: body,
        action_type:  parsed?.action_type  ?? 'note',
        parsed_data:  parsed?.parsed_data  ?? {},
        ai_summary:   parsed?.ai_summary   ?? body,
        confidence:   parsed?.confidence   ?? 'low',
        auto_applied: false,
      })
    } catch (err) {
      console.error('[Meta WhatsApp] Supabase insert error:', err)
    }
  }

  // 4. Auto-apply progress update
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

        if (isSupabaseConfigured() && supabaseAdmin) {
          await supabaseAdmin
            .from('whatsapp_messages')
            .update({ auto_applied: true })
            .eq('from_number', from)
            .order('created_at', { ascending: false })
            .limit(1)
        }
      } catch (err) {
        console.error('[Meta WhatsApp] Progress save error:', err)
      }
    }
  }

  // 5. Send WhatsApp reply via Meta Cloud API
  const replyText =
    (parsed?.reply_message ?? '✅ Message received and logged.') +
    (autoApplied ? '\n\n📊 Progress updated in the dashboard automatically.' : '')

  await sendWhatsAppReply(from, replyText)
}

// ── Send reply via Meta Cloud API ─────────────────────────────────────────────

async function sendWhatsAppReply(to: string, text: string): Promise<void> {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''

  if (!token || !phoneId) {
    console.warn('[Meta WhatsApp] META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_ID not set — skipping reply')
    return
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[Meta WhatsApp] Send reply failed:', err)
    }
  } catch (err) {
    console.error('[Meta WhatsApp] Send reply error:', err)
  }
}
