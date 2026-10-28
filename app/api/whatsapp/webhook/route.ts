/**
 * Meta WhatsApp Business API Webhook
 * Handles: text messages, business card photos, technical report photos/PDFs, material requests
 *
 * Env vars required:
 *   META_WHATSAPP_TOKEN       — permanent access token from Meta
 *   META_WHATSAPP_PHONE_ID    — Phone Number ID from Meta dashboard
 *   META_WEBHOOK_VERIFY_TOKEN — sama_alostoura_verify_2024
 *   GOOGLE_API_KEY            — for Gemini AI (text + vision)
 */

import { NextResponse } from 'next/server'
import { getAllStoredProjects } from '@/lib/projects-store'
import { getAllProgress, saveProgress } from '@/lib/project-progress'
import { generate, generateWithImage } from '@/lib/gemini'
import { query as dbQuery, isDbConfigured } from '@/lib/db'

const TOKEN    = () => process.env.META_WHATSAPP_TOKEN    ?? ''
const PHONE_ID = () => process.env.META_WHATSAPP_PHONE_ID ?? ''

// ─── Meta payload types ───────────────────────────────────────────────────────

interface MetaMessage {
  from: string
  id:   string
  timestamp: string
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | string
  text?:     { body: string }
  image?:    { caption?: string; id: string; mime_type?: string }
  document?: { caption?: string; filename: string; id: string; mime_type?: string }
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
        messages?: MetaMessage[]
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
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — Receive messages from Meta ───────────────────────────────────────

export async function POST(req: Request) {
  let body: MetaWebhookBody
  try {
    body = JSON.parse(await req.text()) as MetaWebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' })
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const { messages, contacts } = change.value
      if (!messages?.length) continue

      for (const msg of messages) {
        const from       = msg.from
        const senderName = contacts?.find(c => c.wa_id === from)?.profile.name ?? 'Unknown'

        try {
          if (msg.type === 'text') {
            await handleTextMessage({ text: msg.text?.body?.trim() ?? '', from, senderName })

          } else if (msg.type === 'image') {
            await handleImageMessage({
              mediaId:  msg.image!.id,
              caption:  msg.image?.caption ?? '',
              mimeType: (msg.image?.mime_type ?? 'image/jpeg') as any,
              from, senderName,
            })

          } else if (msg.type === 'document') {
            await handleDocumentMessage({
              mediaId:  msg.document!.id,
              filename: msg.document?.filename ?? '',
              caption:  msg.document?.caption ?? '',
              mimeType: msg.document?.mime_type ?? 'application/pdf',
              from, senderName,
            })
          }
        } catch (err) {
          console.error('[WhatsApp] handler error:', err)
        }
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}

// ─── Download media from Meta ─────────────────────────────────────────────────

async function downloadMedia(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const token = TOKEN()
  if (!token) return null
  try {
    // Step 1: get download URL
    const meta = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!meta.ok) return null
    const { url, mime_type } = await meta.json()

    // Step 2: download the actual bytes
    const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!file.ok) return null
    const buffer = Buffer.from(await file.arrayBuffer())
    return { base64: buffer.toString('base64'), mimeType: mime_type ?? 'image/jpeg' }
  } catch {
    return null
  }
}

// ─── 1. TEXT messages — progress updates, material requests, notes ────────────

async function handleTextMessage({ text, from, senderName }: { text: string; from: string; senderName: string }) {
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

  const aiPrompt = `You are the WhatsApp assistant for Sama Alostoura Building Contracting LLC, Dubai UAE.
Message from ${senderName}: "${text}"

PROJECTS:
${projects.map(p => {
  const sp = stored.find(s => s.id === p.id)
  const lines = [
    `• ID: ${p.id} | ${p.name} | Client: ${p.client_name} | Location: ${p.location} | Progress: ${p.progress_percent}% | Stage: ${p.current_stage}`,
    `  Contract: AED ${sp?.contract_value?.toLocaleString() ?? '?'} | Received: AED ${sp?.received_amount?.toLocaleString() ?? '?'}`,
  ]
  if (sp?.mbhre_approved_amount)   lines.push(`  MBHRE Approved: AED ${sp.mbhre_approved_amount.toLocaleString()} (${sp.mbhre_approved_progress ?? '?'}%)`)
  if (sp?.mbhre_payment_1)         lines.push(`  MBHRE Payment 1: AED ${sp.mbhre_payment_1.toLocaleString()} | Retention: AED ${sp.mbhre_payment_1_retention?.toLocaleString() ?? '?'}`)
  if (sp?.mbhre_payment_2)         lines.push(`  MBHRE Payment 2: AED ${sp.mbhre_payment_2.toLocaleString()} | Retention: AED ${sp.mbhre_payment_2_retention?.toLocaleString() ?? '?'}`)
  if (sp?.total_retention_held)    lines.push(`  Total Retention Held: AED ${sp.total_retention_held.toLocaleString()}`)
  if (sp?.outstanding_to_collect)  lines.push(`  Outstanding to Collect: AED ${sp.outstanding_to_collect.toLocaleString()}`)
  if (sp?.next_payment_claimable)  lines.push(`  Next MBHRE Claimable: AED ${sp.next_payment_claimable.toLocaleString()}`)
  return lines.join('\n')
}).join('\n')}

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
    "quantity":          "<string or null>",
    "issue_description": "<string or null>",
    "note":              "<string or null>"
  },
  "ai_summary":    "<one sentence for CEO briefing>",
  "confidence":    "<high|medium|low>",
  "reply_message": "<WhatsApp reply max 2 sentences. ✅ if clear, ❓ if project unclear. Match sender language (Arabic/English).>"
}`

  interface Parsed {
    project_id: string | null; project_name: string | null; action_type: string
    parsed_data: { progress_percent: number | null; current_stage: string | null; payment_amount: number | null; materials: string | null; quantity: string | null; issue_description: string | null; note: string | null }
    ai_summary: string; confidence: 'high' | 'medium' | 'low'; reply_message: string
  }

  let parsed: Parsed | null = null
  try {
    const raw   = (await generate(aiPrompt, undefined, 500)).trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(clean)
  } catch (err) {
    console.error('[WhatsApp] AI parse error:', err)
  }

  // Save message log
  if (isDbConfigured()) {
    try {
      await dbQuery(
        `INSERT INTO whatsapp_messages (project_id, project_name, sender_name, action_type, ai_summary, auto_applied)
         VALUES ($1,$2,$3,$4,$5,false)`,
        [parsed?.project_id ?? null, parsed?.project_name ?? null, senderName, parsed?.action_type ?? 'note', parsed?.ai_summary ?? text],
      )
    } catch {}
  }

  // Auto-apply progress update
  let autoApplied = false
  if (parsed?.project_id && parsed.action_type === 'progress_update' && parsed.parsed_data.progress_percent !== null && parsed.confidence !== 'low') {
    const project = projects.find(p => p.id === parsed!.project_id)
    if (project) {
      try {
        await saveProgress(parsed.project_id, parsed.parsed_data.progress_percent!, parsed.parsed_data.current_stage ?? project.current_stage, project.boq_sections as any)
        autoApplied = true
      } catch {}
    }
  }

  // Auto-create PR for material requests
  let prNumber: string | null = null
  if (parsed?.action_type === 'material_request' && parsed.parsed_data.materials && isDbConfigured()) {
    prNumber = await createPR({
      material:    parsed.parsed_data.materials,
      quantity:    parsed.parsed_data.quantity ?? '',
      projectId:   parsed.project_id ?? '',
      projectName: parsed.project_name ?? '',
      description: text,
      requestedBy: senderName,
      from,
    })
  }

  let reply = parsed?.reply_message ?? '✅ Message received and logged.'
  if (autoApplied) reply += '\n\n📊 Dashboard updated automatically.'
  if (prNumber)     reply += `\n\n🛒 *PR# ${prNumber} created* — procurement team notified.`

  await sendReply(from, reply)
}

// ─── 2. IMAGE messages — business cards + site photos + reports ───────────────

async function handleImageMessage({
  mediaId, caption, mimeType, from, senderName,
}: { mediaId: string; caption: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; from: string; senderName: string }) {

  // Acknowledge immediately so user knows it was received
  await sendReply(from, '📷 Image received — analyzing...')

  const media = await downloadMedia(mediaId)
  if (!media) {
    await sendReply(from, '⚠️ Could not download the image. Please retake and resend, or type the details manually.')
    return
  }

  // Ask Gemini what the image is
  const classifyPrompt = `You are an assistant for a Dubai construction company. Classify this image.
Caption from sender: "${caption}"

Return ONLY valid JSON:
{
  "type": "<business_card|technical_report|site_photo|material_request|other>",
  "confidence": "<high|medium|low>"
}`

  let imgType = 'other'
  try {
    const raw   = (await generateWithImage(classifyPrompt, media.base64, mimeType as any, undefined, 200)).trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    imgType = JSON.parse(clean).type ?? 'other'
  } catch {}

  // If caption mentions material/need → treat as material request
  const captionLower = caption.toLowerCase()
  if (captionLower.includes('need') || captionLower.includes('order') || captionLower.includes('cement') || captionLower.includes('steel') || captionLower.includes('material')) {
    imgType = 'material_request'
  }

  if (imgType === 'business_card') {
    await handleBusinessCard({ base64: media.base64, mimeType: mimeType as any, from, senderName })
  } else if (imgType === 'technical_report') {
    await handleTechnicalReport({ base64: media.base64, mimeType: mimeType as any, caption, filename: '', from, senderName })
  } else if (imgType === 'material_request') {
    await handleTextMessage({ text: caption || 'Material needed (see photo)', from, senderName })
  } else {
    // General site photo — log it
    await sendReply(from, `✅ Photo received and logged, ${senderName}. Add a caption if you need something specific done with it.`)
  }
}

// ─── 3. DOCUMENT messages — PDFs, reports ────────────────────────────────────

async function handleDocumentMessage({
  mediaId, filename, caption, mimeType, from, senderName,
}: { mediaId: string; filename: string; caption: string; mimeType: string; from: string; senderName: string }) {

  const filenameLower = filename.toLowerCase()
  const captionLower  = caption.toLowerCase()
  const isReport = ['report','inspection','technical','survey','test','certificate','permit'].some(
    k => filenameLower.includes(k) || captionLower.includes(k)
  )

  if (isReport || mimeType === 'application/pdf') {
    await handleTechnicalReport({ base64: null, mimeType: mimeType as any, caption, filename, from, senderName })
  } else {
    await sendReply(from, `✅ Document "${filename}" received and logged by ${senderName}.`)
  }
}

// ─── Business card handler ────────────────────────────────────────────────────

async function handleBusinessCard({
  base64, mimeType, from, senderName,
}: { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; from: string; senderName: string }) {

  const extractPrompt = `Extract all information from this business card for a Dubai construction company supplier directory.
Return ONLY valid JSON:
{
  "person_name":  "<full name or empty>",
  "company_name": "<company name or empty>",
  "trade":        "<e.g. Electrical, Plumbing, Steel, Tiles, Glass, MEP, Carpentry, Painting, or empty>",
  "phone":        "<phone number or empty>",
  "email":        "<email or empty>",
  "website":      "<website or empty>",
  "address":      "<address or empty>"
}`

  let supplier: Record<string, string> = {}
  try {
    const raw   = (await generateWithImage(extractPrompt, base64, mimeType, undefined, 400)).trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    supplier = JSON.parse(clean)
  } catch {
    await sendReply(from, '⚠️ Could not read the business card clearly. Please retake the photo with better lighting.')
    return
  }

  if (!supplier.company_name && !supplier.person_name) {
    await sendReply(from, '⚠️ Could not read the business card. Please retake with better lighting or type the details.')
    return
  }

  // Save to suppliers table
  if (isDbConfigured()) {
    try {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id SERIAL PRIMARY KEY, company_name TEXT, person_name TEXT, trade TEXT,
          phone TEXT, email TEXT, website TEXT, address TEXT,
          source TEXT DEFAULT 'whatsapp', added_by TEXT, whatsapp_from TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`)
      await dbQuery(
        `INSERT INTO suppliers (company_name, person_name, trade, phone, email, website, address, source, added_by, whatsapp_from)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'whatsapp',$8,$9)`,
        [supplier.company_name, supplier.person_name, supplier.trade, supplier.phone, supplier.email, supplier.website, supplier.address, senderName, from],
      )
    } catch (err) {
      console.error('[WhatsApp] Supplier insert error:', err)
    }
  }

  const reply = [
    `✅ *New Supplier Saved!*`,
    supplier.company_name ? `🏢 *Company:* ${supplier.company_name}` : '',
    supplier.person_name  ? `👤 *Contact:* ${supplier.person_name}`  : '',
    supplier.trade        ? `🔧 *Trade:* ${supplier.trade}`           : '',
    supplier.phone        ? `📞 *Phone:* ${supplier.phone}`           : '',
    supplier.email        ? `📧 *Email:* ${supplier.email}`           : '',
    ``,
    `Added to supplier directory by ${senderName}.`,
  ].filter(Boolean).join('\n')

  await sendReply(from, reply)
}

// ─── Technical report handler ─────────────────────────────────────────────────

async function handleTechnicalReport({
  base64, mimeType, caption, filename, from, senderName,
}: { base64: string | null; mimeType: any; caption: string; filename: string; from: string; senderName: string }) {

  const stored   = getAllStoredProjects()
  const projList = stored.map(p => `• ${p.name}`).join('\n')

  let reportInfo: Record<string, string> = {}

  if (base64) {
    // Vision — extract from image
    const prompt = `This is a technical/inspection report photo from a Dubai construction site.
Projects in our system:\n${projList}

Extract report details. Return ONLY valid JSON:
{
  "project_name":  "<matched project name or empty>",
  "report_type":   "<e.g. Inspection Report | Soil Test | Concrete Test | Progress Report | Municipality Inspection | DEWA | other>",
  "report_date":   "<YYYY-MM-DD if visible, else empty>",
  "summary":       "<one sentence summary of what the report shows>"
}`
    try {
      const raw   = (await generateWithImage(prompt, base64, mimeType, undefined, 400)).trim()
      const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
      reportInfo  = JSON.parse(clean)
    } catch {}
  } else {
    // PDF/doc — use filename + caption to infer
    reportInfo = {
      project_name: stored.find(p => (caption + filename).toLowerCase().includes(p.name.toLowerCase()))?.name ?? '',
      report_type:  filename || 'Document',
      report_date:  '',
      summary:      caption || filename,
    }
  }

  // Save to project_documents table
  if (isDbConfigured()) {
    try {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS project_documents (
          id SERIAL PRIMARY KEY, project_name TEXT, doc_type TEXT, filename TEXT,
          description TEXT, filed_at DATE, source TEXT DEFAULT 'whatsapp',
          whatsapp_from TEXT, added_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
        )`)
      await dbQuery(
        `INSERT INTO project_documents (project_name, doc_type, filename, description, filed_at, source, whatsapp_from, added_by)
         VALUES ($1,$2,$3,$4,$5,'whatsapp',$6,$7)`,
        [
          reportInfo.project_name || null,
          reportInfo.report_type  || 'Document',
          filename || 'photo',
          reportInfo.summary || caption,
          reportInfo.report_date || new Date().toISOString().slice(0, 10),
          from,
          senderName,
        ],
      )
    } catch (err) {
      console.error('[WhatsApp] Document insert error:', err)
    }
  }

  const reply = [
    `✅ *Report Filed Successfully*`,
    reportInfo.project_name ? `🏗️ *Project:* ${reportInfo.project_name}` : `🏗️ *Project:* Not identified — check dashboard`,
    `📋 *Type:* ${reportInfo.report_type || 'Document'}`,
    reportInfo.report_date  ? `📅 *Date:* ${reportInfo.report_date}` : '',
    reportInfo.summary      ? `📝 ${reportInfo.summary}` : '',
    ``,
    `Saved by ${senderName}.`,
  ].filter(Boolean).join('\n')

  await sendReply(from, reply)
}

// ─── Create Purchase Request ──────────────────────────────────────────────────

async function createPR({ material, quantity, projectId, projectName, description, requestedBy, from }: {
  material: string; quantity: string; projectId: string; projectName: string; description: string; requestedBy: string; from: string
}): Promise<string | null> {
  try {
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS procurement_prs (
        id SERIAL PRIMARY KEY, pr_number TEXT NOT NULL, project_id TEXT,
        project_name TEXT, title TEXT NOT NULL, description TEXT,
        requested_by TEXT, date_requested DATE, date_needed DATE,
        status TEXT DEFAULT 'requested', items JSONB DEFAULT '[]',
        source TEXT DEFAULT 'manual', whatsapp_from TEXT, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`)
    const prNumber = `WA-${Date.now().toString().slice(-6)}`
    const title    = material + (projectName ? ` — ${projectName}` : '')
    await dbQuery(
      `INSERT INTO procurement_prs (pr_number,project_id,project_name,title,description,requested_by,date_requested,status,items,source,whatsapp_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'requested',$8,'whatsapp',$9)`,
      [prNumber, projectId || null, projectName || null, title, description, requestedBy, new Date().toISOString().slice(0, 10), JSON.stringify([{ description: material, qty: quantity, unit: '', notes: '' }]), from],
    )
    return prNumber
  } catch (err) {
    console.error('[WhatsApp] createPR error:', err)
    return null
  }
}

// ─── Send reply via Meta Cloud API ───────────────────────────────────────────

async function sendReply(to: string, message: string) {
  const token   = TOKEN()
  const phoneId = PHONE_ID()
  if (!token || !phoneId) return
  try {
    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
    })
  } catch (err) {
    console.error('[WhatsApp] sendReply error:', err)
  }
}
