/**
 * Twilio WhatsApp Webhook
 * POST /api/whatsapp/webhook
 *
 * Set this URL in Twilio Console → Messaging → your WhatsApp sender → Webhook URL
 *
 * Flow:
 *  1. Receive WhatsApp message from Twilio (URL-encoded form)
 *  2. Claude AI identifies project + action (progress, payment, material, issue)
 *  3. Save to Supabase whatsapp_messages table
 *  4. Auto-update project_progress if progress % is clearly stated
 *  5. Reply with TwiML confirmation via WhatsApp
 */

import { NextResponse } from 'next/server'
import { getAllStoredProjects } from '@/lib/projects-store'
import { getAllProgress, saveProgress } from '@/lib/project-progress'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

// ── TwiML helpers ─────────────────────────────────────────────────────────────

function twimlReply(message: string): Response {
  const safe = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

function twimlEmpty(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

// ── GET — health check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: '/api/whatsapp/webhook',
    message: 'Sama Alostoura WhatsApp webhook is active',
  })
}

// ── POST — receive WhatsApp message from Twilio ───────────────────────────────

export async function POST(req: Request) {

  // 1. Parse Twilio's form-encoded payload
  let messageBody = ''
  let from        = ''
  let profileName = 'Unknown'
  let groupId     = ''

  try {
    const form  = await req.formData()
    messageBody = form.get('Body')?.toString().trim() ?? ''
    from        = form.get('From')?.toString() ?? ''
    profileName = form.get('ProfileName')?.toString() ?? 'Unknown'
    groupId     = form.get('GroupId')?.toString() ?? ''
  } catch {
    return twimlEmpty()
  }

  if (!messageBody) return twimlEmpty()

  // 2. Load live project data
  const stored    = getAllStoredProjects()
  const overrides = await getAllProgress()

  const projects = stored.map(p => ({
    id:               p.id,
    name:             p.name,
    client_name:      (p.client_name ?? '') as string,
    location:         ((p as any).location ?? '') as string,
    progress_percent: overrides[p.id]?.progress_percent ?? p.progress_percent,
    current_stage:    (overrides[p.id]?.current_stage   ?? p.current_stage ?? '') as string,
    boq_sections:     overrides[p.id]?.boq_sections     ?? (p as any).boq_sections ?? [],
  }))

  // 3. Ask Claude to parse the message
  const prompt = `You are the WhatsApp message parser for Sama Alostoura Building Contracting LLC, Dubai UAE.
A message arrived on the company WhatsApp${groupId ? ' from a project group' : ''} from ${profileName}.

MESSAGE: "${messageBody}"

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
    "progress_percent":   <number 0-100 or null>,
    "current_stage":      "<new stage description or null>",
    "payment_amount":     <AED number or null>,
    "materials":          "<materials description or null>",
    "issue_description":  "<problem description or null>",
    "note":               "<any other info>"
  },
  "ai_summary":    "<one clear sentence for the CEO morning briefing>",
  "confidence":    "<high | medium | low>",
  "reply_message": "<friendly WhatsApp reply, max 2 sentences, start with ✅ if clear or ❓ if project unknown. Match sender language (Arabic or English).>"
}

Rules:
- Match project by client name, project name, location or any identifier in the message
- Extract progress % if stated or clearly implied (e.g. "foundation done" = ~15%)
- Extract AED payment amounts
- If project cannot be determined set project_id to null
- confidence=high only when project match is certain and data is explicit`

  interface ParsedMsg {
    project_id:    string | null
    project_name:  string | null
    action_type:   string
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
    const raw = aiRes.content[0].type === 'text' ? aiRes.content[0].text.trim() : ''
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(clean) as ParsedMsg
  } catch (err) {
    console.error('[WhatsApp webhook] AI parse failed:', err)
  }

  // 4. Save to Supabase whatsapp_messages table
  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin.from('whatsapp_messages').insert({
        project_id:   parsed?.project_id   ?? null,
        project_name: parsed?.project_name ?? null,
        from_number:  from,
        sender_name:  profileName,
        group_id:     groupId || null,
        message_body: messageBody,
        action_type:  parsed?.action_type  ?? 'note',
        parsed_data:  parsed?.parsed_data  ?? {},
        ai_summary:   parsed?.ai_summary   ?? messageBody,
        confidence:   parsed?.confidence   ?? 'low',
        auto_applied: false,
      })
    } catch (err) {
      console.error('[WhatsApp webhook] Supabase insert error:', err)
    }
  }

  // 5. Auto-apply progress update when confidence is high or medium
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

        // Mark as auto-applied in the DB
        if (isSupabaseConfigured() && supabaseAdmin) {
          await supabaseAdmin
            .from('whatsapp_messages')
            .update({ auto_applied: true })
            .eq('from_number', from)
            .order('created_at', { ascending: false })
            .limit(1)
        }
      } catch (err) {
        console.error('[WhatsApp webhook] Progress save error:', err)
      }
    }
  }

  // 6. Build and send reply
  const baseReply = parsed?.reply_message
    ?? (parsed?.project_id
        ? `✅ Update logged for ${parsed.project_name}.`
        : '✅ Received. Please mention the project name so I can log it correctly.')

  const dashboardNote = autoApplied
    ? '\n\n📊 Progress updated in the dashboard automatically.'
    : ''

  return twimlReply(baseReply + dashboardNote)
}
