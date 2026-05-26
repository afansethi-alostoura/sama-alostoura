/**
 * Twilio WhatsApp Webhook
 * POST /api/webhooks/whatsapp
 *
 * Twilio calls this URL whenever a WhatsApp message is received on your number.
 * Flow:
 *  1. Parse the incoming message (URL-encoded form from Twilio)
 *  2. Use Claude to identify the project + action type
 *  3. Save raw message + parsed data to Supabase (whatsapp_messages table)
 *  4. If it's a progress update with a clear %, auto-update project_progress
 *  5. Reply with a TwiML confirmation message
 */

import { NextResponse } from 'next/server'
import { getAllStoredProjects } from '@/lib/projects-store'
import { getAllProgress, saveProgress } from '@/lib/project-progress'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { twimlReply } from '@/lib/twilio'

// Twilio will only POST here — reject GET requests
export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook active' })
}

export async function POST(req: Request) {
  let body = ''
  let from = ''
  let profileName = 'Unknown'
  let groupId = ''

  try {
    // Twilio sends application/x-www-form-urlencoded
    const formData = await req.formData()
    body        = formData.get('Body')?.toString().trim() ?? ''
    from        = formData.get('From')?.toString() ?? ''
    profileName = formData.get('ProfileName')?.toString() ?? 'Unknown'
    groupId     = formData.get('GroupId')?.toString() ?? '' // WhatsApp group UID, if from a group
  } catch {
    return twimlReply('⚠️ Could not read message.')
  }

  if (!body) return twimlReply('')  // silent ack for empty messages

  // ── 1. Load all real projects ──────────────────────────────────────────────
  const stored    = getAllStoredProjects()
  const overrides = await getAllProgress()

  const projectList = stored.map(p => ({
    id:               p.id,
    name:             p.name,
    client_name:      p.client_name ?? '',
    location:         (p as any).location ?? '',
    progress_percent: overrides[p.id]?.progress_percent ?? p.progress_percent,
    current_stage:    overrides[p.id]?.current_stage    ?? p.current_stage ?? '',
    boq_sections:     overrides[p.id]?.boq_sections     ?? (p as any).boq_sections ?? [],
  }))

  // ── 2. Ask Claude to parse the message ────────────────────────────────────
  const parsePrompt = `You are the WhatsApp message parser for Sama Alostoura Building Contracting LLC, Dubai.
A message was received on the company WhatsApp${groupId ? ' (from a project group)' : ''} from ${profileName}.

Message: "${body}"

Known projects:
${projectList.map(p =>
  `• ID: ${p.id}\n  Name: ${p.name}\n  Client: ${p.client_name}\n  Location: ${p.location}\n  Progress: ${p.progress_percent}%\n  Stage: ${p.current_stage}`
).join('\n\n')}

Your job: parse this message and return ONLY valid JSON (no markdown, no explanation):

{
  "project_id": "<matching project ID, or null if cannot determine>",
  "project_name": "<matching project name, or null>",
  "action_type": "<one of: progress_update | payment_received | material_request | issue_report | note>",
  "parsed_data": {
    "progress_percent": <number 0-100 or null — only if a percentage was clearly stated or implied>,
    "current_stage": "<updated stage description or null>",
    "payment_amount": <AED amount as number or null>,
    "materials": "<materials needed or null>",
    "issue_description": "<problem description or null>",
    "note": "<any other key info>"
  },
  "ai_summary": "<one clear sentence summarising the update for the CEO morning briefing>",
  "confidence": "<high | medium | low — how confident are you about the project match>",
  "reply_message": "<friendly WhatsApp reply to send back, max 2 sentences. Start with ✅ for success or ❓ if project unclear>"
}

Matching rules:
- Match by client name, project name, location, or any obvious identifier in the message
- For progress: extract % if stated ("40% done", "finished foundation"), or infer from stage description
- For payment: extract AED amount; phrases like "received payment", "client paid", "transfer done"
- For material: "need cement", "order steel", "buy tiles" etc.
- If project is ambiguous, set project_id to null and ask in reply_message
- Always reply in the same language the sender used (Arabic or English)`

  interface ParsedMessage {
    project_id:   string | null
    project_name: string | null
    action_type:  string
    parsed_data: {
      progress_percent: number | null
      current_stage:    string | null
      payment_amount:   number | null
      materials:        string | null
      issue_description: string | null
      note:             string | null
    }
    ai_summary:    string
    confidence:    string
    reply_message: string
  }

  let parsed: ParsedMessage | null = null

  try {
    const aiRes = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 600,
      messages:   [{ role: 'user', content: parsePrompt }],
    })
    const text = aiRes.content[0].type === 'text' ? aiRes.content[0].text.trim() : ''
    // Strip any accidental markdown code fences
    const clean = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(clean) as ParsedMessage
  } catch (err) {
    console.error('[WhatsApp] AI parse error:', err)
    // Fall through — we still save the raw message even if parsing fails
  }

  // ── 3. Save raw message + parsed data to Supabase ─────────────────────────
  if (isSupabaseConfigured() && supabaseAdmin) {
    try {
      await supabaseAdmin.from('whatsapp_messages').insert({
        project_id:    parsed?.project_id   ?? null,
        project_name:  parsed?.project_name ?? null,
        from_number:   from,
        sender_name:   profileName,
        group_id:      groupId || null,
        message_body:  body,
        action_type:   parsed?.action_type  ?? 'note',
        parsed_data:   parsed?.parsed_data  ?? {},
        ai_summary:    parsed?.ai_summary   ?? body,
        confidence:    parsed?.confidence   ?? 'low',
        auto_applied:  false,
        created_at:    new Date().toISOString(),
      })
    } catch (err) {
      console.error('[WhatsApp] Supabase insert error:', err)
    }
  }

  // ── 4. Auto-apply progress update if confidence is high ───────────────────
  let autoApplied = false

  if (
    parsed?.project_id &&
    parsed.action_type === 'progress_update' &&
    parsed.parsed_data.progress_percent !== null &&
    parsed.confidence !== 'low'
  ) {
    const project = projectList.find(p => p.id === parsed!.project_id)
    if (project) {
      try {
        const newPct   = parsed.parsed_data.progress_percent!
        const newStage = parsed.parsed_data.current_stage ?? project.current_stage
        await saveProgress(
          parsed.project_id,
          newPct,
          newStage,
          project.boq_sections as any,
        )
        autoApplied = true

        // Update the whatsapp_messages row to mark as applied
        if (isSupabaseConfigured() && supabaseAdmin) {
          await supabaseAdmin
            .from('whatsapp_messages')
            .update({ auto_applied: true })
            .eq('from_number', from)
            .order('created_at', { ascending: false })
            .limit(1)
        }
      } catch (err) {
        console.error('[WhatsApp] Progress save error:', err)
      }
    }
  }

  // ── 5. Reply ──────────────────────────────────────────────────────────────
  const replyText = parsed?.reply_message
    ?? (parsed?.project_id
        ? `✅ Update logged for ${parsed.project_name}.`
        : '✅ Message received and logged. Could not match a project — please mention the project name.')

  const suffix = autoApplied ? '\n\n📊 Project progress updated automatically in the dashboard.' : ''

  return twimlReply(replyText + suffix)
}
