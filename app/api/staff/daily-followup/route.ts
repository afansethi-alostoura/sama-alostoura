/**
 * POST /api/staff/daily-followup
 * Sends a WhatsApp follow-up to every active engineer & supervisor
 * asking for a status update on each active project.
 *
 * Also used as the Vercel cron endpoint (GET, protected by CRON_SECRET).
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getAllStoredProjects } from '@/lib/projects-store'
import { generate } from '@/lib/gemini'
import crypto from 'crypto'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// Roles that receive daily follow-up messages
const FOLLOWUP_ROLES = [
  'Project Manager',
  'Site Civil Engineer',
  'MEP Engineer / Coordinator',
  'General Foreman / Site Supervisor',
  'HSE / Safety Officer',
  'Estimation Engineer / QS',
]

async function ensureFollowupTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS staff_followups (
      id           SERIAL PRIMARY KEY,
      staff_id     INTEGER REFERENCES staff_members(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      token        TEXT UNIQUE NOT NULL,
      sent_at      TIMESTAMPTZ DEFAULT NOW(),
      response     TEXT,
      responded_at TIMESTAMPTZ,
      status       TEXT NOT NULL DEFAULT 'pending'
    )
  `)
}

async function sendWhatsApp(to: string, body: string) {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp not configured' }

  // Normalise number: strip leading +, spaces, dashes
  const normalised = to.replace(/^\+/, '').replace(/[\s\-()]/g, '')

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messaging_product: 'whatsapp',
      to:   normalised,
      type: 'text',
      text: { body },
    }),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

async function buildMessage(staffName: string, role: string, projectName: string, updateUrl: string): Promise<string> {
  const prompt = `Write a short, professional WhatsApp follow-up message (3-4 lines max) for a UAE construction company.

Send to: ${staffName} (${role})
Project: ${projectName}
Company: Sama Alostoura Building Contracting LLC, Dubai

The message should:
- Greet them by first name
- Ask for a brief status update on the project today
- Ask if there are any issues or blockers
- Include this update link (do NOT modify it): ${updateUrl}
- Be friendly and professional in English
- No emojis except one at the start
- Do NOT add any explanation, just write the WhatsApp message text directly`

  try {
    return await generate(prompt, undefined, 200)
  } catch {
    const firstName = staffName.split(' ')[0]
    return `Good morning ${firstName}! 👋\n\nPlease share today's update for *${projectName}* — progress, any issues, and what's planned for today.\n\nSubmit your update here: ${updateUrl}\n\nThank you — Sama Alostoura Management`
  }
}

export async function POST(req: NextRequest) {
  // Allow internal trigger OR cron secret
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runFollowup()
}

export async function GET(req: NextRequest) {
  // Vercel cron calls GET
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (cronSecret) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  return runFollowup()
}

async function runFollowup() {
  await ensureFollowupTable()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://sama-alostoura.vercel.app'

  // Get active staff engineers & supervisors with phone numbers
  const staff = await query(`
    SELECT * FROM staff_members
    WHERE status = 'active' AND phone IS NOT NULL AND phone != ''
    AND role = ANY($1)
  `, [FOLLOWUP_ROLES]) as Array<{
    id: number; name: string; role: string; department: string; phone: string
  }>

  // Get active projects
  const projects = getAllStoredProjects().filter(p => p.status === 'active')

  if (staff.length === 0) {
    return NextResponse.json({ message: 'No staff with phone numbers found', sent: 0 })
  }
  if (projects.length === 0) {
    return NextResponse.json({ message: 'No active projects found', sent: 0 })
  }

  const results: Array<{ staff: string; project: string; status: string }> = []

  for (const member of staff) {
    for (const project of projects) {
      // Generate a unique token for this follow-up
      const token = crypto.randomBytes(16).toString('hex')
      const updateUrl = `${appUrl}/followup/${token}`

      // Save follow-up record
      await query(
        `INSERT INTO staff_followups (staff_id, project_name, token) VALUES ($1, $2, $3)`,
        [member.id, project.name, token]
      )

      // Build AI message
      const message = await buildMessage(member.name, member.role, project.name, updateUrl)

      // Send WhatsApp
      const result = await sendWhatsApp(member.phone, message)

      // Log in staff_activities
      await query(
        `INSERT INTO staff_activities (staff_id, note, created_by) VALUES ($1, $2, $3)`,
        [member.id, `📲 Daily follow-up sent for project: ${project.name}`, 'AI System']
      )

      results.push({
        staff:   member.name,
        project: project.name,
        status:  result.ok ? 'sent' : `failed: ${JSON.stringify(result.data ?? result.error)}`,
      })
    }
  }

  return NextResponse.json({
    sent:    results.filter(r => r.status === 'sent').length,
    failed:  results.filter(r => r.status !== 'sent').length,
    results,
  })
}
