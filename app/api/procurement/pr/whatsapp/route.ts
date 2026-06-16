import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { anthropic } from '@/lib/anthropic'

// Twilio sends form-encoded POST — we parse it and create a PR
// Also supports GET for webhook verification

export async function GET() {
  return new NextResponse('Sama Alostoura WhatsApp PR Webhook — OK', { status: 200 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    const from    = params.get('From') ?? ''   // e.g. whatsapp:+971501234567
    const msgBody = (params.get('Body') ?? '').trim()
    const profileName = params.get('ProfileName') ?? ''

    if (!msgBody) return twiml('Please send a message describing what you need.')

    // ── Use Claude to parse the message ──────────────────────────────────────
    let parsed: { project: string; material: string; quantity: string; unit: string; date: string } = {
      project: '', material: '', quantity: '', unit: '', date: '',
    }

    try {
      const ai = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Extract procurement request details from this WhatsApp message sent to a Dubai construction company (Sama Alostoura):

"${msgBody}"

Return ONLY a JSON object (no markdown, no explanation):
{
  "project": "<project name or empty string>",
  "material": "<material or item requested>",
  "quantity": "<number only>",
  "unit": "<unit e.g. bags, tons, pcs, m2, or empty>",
  "date": "<YYYY-MM-DD if a date was mentioned, else empty>"
}`,
        }],
      })
      const text = ai.content[0].type === 'text' ? ai.content[0].text.trim() : '{}'
      parsed = JSON.parse(text)
    } catch {
      // fallback: use raw message as material
      parsed.material = msgBody
    }

    if (!parsed.material) {
      return twiml(`I couldn't understand your request. Please send it like:\n\n"Project: FAHAD | Material: Cement | Qty: 50 bags | Date: 2026-07-15"\n\nor just describe what you need.`)
    }

    // ── Match project if possible ─────────────────────────────────────────────
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

    // ── Build PR ──────────────────────────────────────────────────────────────
    const prNumber = `WA-${Date.now().toString().slice(-6)}`
    const item = {
      description: parsed.material,
      qty: parsed.quantity || '',
      unit: parsed.unit || '',
      notes: '',
    }
    const title = parsed.material + (projectName ? ` — ${projectName}` : '')

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return twiml(`PR received but database not configured. Contact office to process: ${title}`)
    }

    const { data: pr, error } = await supabaseAdmin
      .from('procurement_prs')
      .insert({
        pr_number:      prNumber,
        project_id:     projectId,
        project_name:   projectName,
        title,
        description:    msgBody,
        requested_by:   profileName || from.replace('whatsapp:', ''),
        date_requested: new Date().toISOString().slice(0, 10),
        date_needed:    parsed.date || null,
        status:         'requested',
        items:          [item],
        source:         'whatsapp',
        whatsapp_from:  from,
        notes:          '',
      })
      .select()
      .single()

    if (error) return twiml(`Sorry, couldn't create the request. Please call the office.`)

    const confirmLines = [
      `✅ Purchase Request Created!`,
      `PR#: ${prNumber}`,
      `Material: ${parsed.material}`,
      parsed.quantity ? `Qty: ${parsed.quantity} ${parsed.unit}` : '',
      projectName ? `Project: ${projectName}` : '',
      parsed.date ? `Needed by: ${parsed.date}` : '',
      `Status: Pending Approval`,
      `\nThe procurement team will follow up.`,
    ].filter(Boolean).join('\n')

    return twiml(confirmLines)

  } catch (e) {
    console.error('WhatsApp webhook error:', e)
    return twiml('An error occurred. Please contact the office.')
  }
}

function twiml(message: string) {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } },
  )
}
