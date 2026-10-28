import { NextRequest, NextResponse } from 'next/server'
import { generate } from '@/lib/gemini'
import { query, isDbConfigured } from '@/lib/db'

const VERIFY_TOKEN    = process.env.WHATSAPP_VERIFY_TOKEN ?? 'sama-procurement'
const ACCESS_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

// Ensure table exists on first use
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS procurement_prs (
      id             SERIAL PRIMARY KEY,
      pr_number      TEXT NOT NULL,
      project_id     TEXT,
      project_name   TEXT,
      title          TEXT NOT NULL,
      description    TEXT,
      requested_by   TEXT,
      date_requested DATE,
      date_needed    DATE,
      status         TEXT DEFAULT 'requested',
      items          JSONB DEFAULT '[]',
      source         TEXT DEFAULT 'manual',
      whatsapp_from  TEXT,
      notes          TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST — Incoming WhatsApp message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const entry   = body?.entry?.[0]
    const change  = entry?.changes?.[0]?.value
    const msg     = change?.messages?.[0]
    const contact = change?.contacts?.[0]

    if (!msg || msg.type !== 'text') {
      return NextResponse.json({ status: 'ignored' })
    }

    const from        = msg.from
    const msgBody     = msg.text?.body?.trim() ?? ''
    const profileName = contact?.profile?.name ?? ''
    const phoneId     = change?.metadata?.phone_number_id ?? PHONE_NUMBER_ID

    if (!msgBody) return NextResponse.json({ status: 'empty' })

    // Parse with Gemini
    let parsed = { project: '', material: '', quantity: '', unit: '', date: '' }
    try {
      const raw = await generate(
        `Extract procurement request details from this WhatsApp message sent to a Dubai construction company (Sama Alostoura):

"${msgBody}"

Return ONLY valid JSON (no markdown):
{
  "project": "<project name or empty>",
  "material": "<material or item requested>",
  "quantity": "<number only or empty>",
  "unit": "<e.g. bags, tons, pcs, m2, or empty>",
  "date": "<YYYY-MM-DD if mentioned, else empty>"
}`,
        undefined,
        256,
      )
      parsed = JSON.parse(raw.trim())
    } catch {
      parsed.material = msgBody
    }

    if (!parsed.material) {
      await sendReply(phoneId, from, `I couldn't understand your request. Please try:\n\n*Project:* FAHAD\n*Material:* Cement\n*Qty:* 50 bags\n*Date:* 2026-07-15\n\nor just describe what you need freely.`)
      return NextResponse.json({ status: 'unparsed' })
    }

    // Match project name from DB
    let projectId   = ''
    let projectName = parsed.project || ''
    if (parsed.project && isDbConfigured()) {
      try {
        const res = await query<{ id: string; name: string }>(
          `SELECT id, name FROM projects WHERE name ILIKE $1 LIMIT 1`,
          [`%${parsed.project}%`],
        )
        if (res[0]) { projectId = res[0].id; projectName = res[0].name }
      } catch {}
    }

    // Create PR in Railway
    const prNumber = `WA-${Date.now().toString().slice(-6)}`
    const title    = parsed.material + (projectName ? ` — ${projectName}` : '')

    if (!isDbConfigured()) {
      await sendReply(phoneId, from, `Request received but database not configured. Call the office for: ${title}`)
      return NextResponse.json({ status: 'db_not_configured' })
    }

    await ensureTable()

    await query(
      `INSERT INTO procurement_prs
         (pr_number, project_id, project_name, title, description, requested_by,
          date_requested, date_needed, status, items, source, whatsapp_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,'whatsapp',$10)`,
      [
        prNumber,
        projectId || null,
        projectName || null,
        title,
        msgBody,
        profileName || from,
        new Date().toISOString().slice(0, 10),
        parsed.date || null,
        JSON.stringify([{ description: parsed.material, qty: parsed.quantity || '', unit: parsed.unit || '', notes: '' }]),
        from,
      ],
    )

    const reply = [
      `✅ *Purchase Request Created*`,
      `*PR#:* ${prNumber}`,
      `*Material:* ${parsed.material}`,
      parsed.quantity ? `*Qty:* ${parsed.quantity} ${parsed.unit}` : '',
      projectName      ? `*Project:* ${projectName}` : '',
      parsed.date      ? `*Needed by:* ${parsed.date}` : '',
      `*Status:* Pending Approval`,
      ``,
      `The procurement team will review and follow up. 🏗️`,
    ].filter(Boolean).join('\n')

    await sendReply(phoneId, from, reply)
    return NextResponse.json({ status: 'ok', pr_number: prNumber })

  } catch (e) {
    console.error('WhatsApp PR webhook error:', e)
    return NextResponse.json({ status: 'error' }, { status: 200 }) // always 200 to Meta
  }
}

// Send reply via Meta Graph API
async function sendReply(phoneNumberId: string, to: string, text: string) {
  if (!ACCESS_TOKEN || !phoneNumberId) return
  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  })
}
