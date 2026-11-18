/**
 * POST /api/staff/daily-followup
 * Sends a WhatsApp voice message (Urdu) + text link to every active engineer & supervisor
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
  'Managing Director',
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

// ─── WhatsApp helpers ────────────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string) {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp not configured' }

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

async function sendWhatsAppAudio(to: string, mediaId: string) {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) return { ok: false, error: 'WhatsApp not configured' }

  const normalised = to.replace(/^\+/, '').replace(/[\s\-()]/g, '')

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messaging_product: 'whatsapp',
      to:   normalised,
      type: 'audio',
      audio: { id: mediaId },
    }),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

// ─── Urdu voice generation ───────────────────────────────────────────────────

interface UrduMessage { arabic: string; roman: string }

async function buildUrduMessage(staffName: string, role: string, projectName: string): Promise<UrduMessage> {
  const firstName = staffName.split(' ')[0]
  const prompt = `You are writing a daily WhatsApp follow-up for a UAE construction company (Sama Alostoura).

Recipient: ${firstName} (${role})
Project: ${projectName}

Write TWO versions of the same short friendly message (4-5 sentences):

VERSION 1 - ARABIC_SCRIPT: Write in Urdu Arabic script (اردو). Greet with السلام علیکم, ask about today's progress on "${projectName}", ask about any issues, ask what's planned for tomorrow. End with شکریہ - Sama Alostoura Management

VERSION 2 - ROMAN_URDU: Write the EXACT same message but in Roman Urdu (Urdu words spelled in English letters, as spoken in Pakistan/UAE). Example style: "Assalam o Alaikum ${firstName} bhai! Sama Alostoura ki taraf se aap ko good morning. Aaj ${projectName} project ka kya update hai? Koi masla toh nahi? Kal ka kya plan hai? Shukriya - Sama Alostoura Management"

Respond in this EXACT format with no extra text:
ARABIC_SCRIPT: <arabic urdu text here>
ROMAN_URDU: <roman urdu text here>`

  try {
    const result = await generate(prompt, undefined, 400)
    const arabicMatch = result.match(/ARABIC_SCRIPT:\s*(.+?)(?=ROMAN_URDU:|$)/s)
    const romanMatch  = result.match(/ROMAN_URDU:\s*(.+?)$/s)
    return {
      arabic: arabicMatch?.[1]?.trim() ?? `السلام علیکم ${firstName}! سما الاستورہ کی طرف سے روزانہ اپ ڈیٹ۔ "${projectName}" پر آج کی پیشرفت بتائیں۔ کوئی مسئلہ؟ کل کا پلان؟ شکریہ - Sama Alostoura`,
      roman:  romanMatch?.[1]?.trim()  ?? `Assalam o Alaikum ${firstName} bhai! Sama Alostoura ki taraf se good morning. Aaj ${projectName} project ka kya update hai? Koi masla toh nahi? Kal ka kya plan hai? Shukriya, Sama Alostoura Management.`,
    }
  } catch {
    return {
      arabic: `السلام علیکم ${firstName}! سما الاستورہ کی طرف سے روزانہ اپ ڈیٹ۔ "${projectName}" پر آج کی پیشرفت بتائیں۔ کل کا پلان کیا ہے؟ شکریہ`,
      roman:  `Assalam o Alaikum ${firstName} bhai! Sama Alostoura ki taraf se good morning. Aaj ${projectName} project ka kya update hai? Koi masla toh nahi? Shukriya, Sama Alostoura Management.`,
    }
  }
}

async function generateVoiceMP3(urduText: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY ?? ''
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:           'tts-1-hd',
        input:           urduText,
        voice:           'onyx',
        response_format: 'mp3',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('TTS error:', err)
      return null
    }

    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch (err) {
    console.error('TTS exception:', err)
    return null
  }
}

async function uploadAudioToMeta(audioBuffer: Buffer): Promise<string | null> {
  const token   = process.env.META_WHATSAPP_TOKEN   ?? ''
  const phoneId = process.env.META_WHATSAPP_PHONE_ID ?? ''
  if (!token || !phoneId) return null

  try {
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    formData.append('file', blob, 'followup.mp3')
    formData.append('type', 'audio/mpeg')
    formData.append('messaging_product', 'whatsapp')

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/media`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    })

    const data = await res.json() as { id?: string; error?: unknown }
    if (!res.ok || !data.id) {
      console.error('Meta media upload failed:', data)
      return null
    }
    return data.id
  } catch (err) {
    console.error('Media upload exception:', err)
    return null
  }
}

// ─── Main follow-up runner ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runFollowup()
}

export async function GET(req: NextRequest) {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sama-alostoura.vercel.app')

  const staff = await query(`
    SELECT * FROM staff_members
    WHERE status = 'active' AND phone IS NOT NULL AND phone != ''
    AND role = ANY($1)
  `, [FOLLOWUP_ROLES]) as Array<{
    id: number; name: string; role: string; department: string; phone: string
  }>

  const projects = getAllStoredProjects().filter(p => p.status === 'active')

  if (staff.length === 0) {
    return NextResponse.json({ message: 'No staff with phone numbers found', sent: 0 })
  }
  if (projects.length === 0) {
    return NextResponse.json({ message: 'No active projects found', sent: 0 })
  }

  const results: Array<{ staff: string; project: string; status: string; voice: string }> = []

  for (const member of staff) {
    for (const project of projects) {
      const token     = crypto.randomBytes(16).toString('hex')
      const updateUrl = `${appUrl}/followup/${token}`

      await query(
        `INSERT INTO staff_followups (staff_id, project_name, token) VALUES ($1, $2, $3)`,
        [member.id, project.name, token]
      )

      // Generate Urdu message (arabic script for text, roman urdu for voice)
      const urduMsg = await buildUrduMessage(member.name, member.role, project.name)

      let voiceStatus = 'skipped'

      // Try to send voice message using Roman Urdu (clear pronunciation)
      const audioBuffer = await generateVoiceMP3(urduMsg.roman)
      if (audioBuffer) {
        const mediaId = await uploadAudioToMeta(audioBuffer)
        if (mediaId) {
          const voiceResult = await sendWhatsAppAudio(member.phone, mediaId)
          voiceStatus = voiceResult.ok ? 'sent' : `failed: ${JSON.stringify(voiceResult.data)}`
        } else {
          voiceStatus = 'upload_failed'
        }
      } else {
        voiceStatus = 'tts_failed'
      }

      // Send Arabic script text message with the update link
      const firstName = member.name.split(' ')[0]
      const linkText  = `${urduMsg.arabic}\n\n📎 اپ ڈیٹ لنک:\n${updateUrl}`
      const textResult = await sendWhatsApp(member.phone, linkText)

      await query(
        `INSERT INTO staff_activities (staff_id, note, created_by) VALUES ($1, $2, $3)`,
        [member.id, `📲 Daily Urdu voice follow-up sent for project: ${project.name} (voice: ${voiceStatus})`, 'AI System']
      )

      results.push({
        staff:        member.name,
        project:      project.name,
        phone:        member.phone,
        voice:        voiceStatus,
        status:       textResult.ok ? 'text_sent' : `text_failed: ${JSON.stringify(textResult.data ?? textResult.error)}`,
        text_response: textResult.data,
      })
    }
  }

  return NextResponse.json({
    sent:    results.filter(r => r.status === 'text_sent').length,
    voice:   results.filter(r => r.voice === 'sent').length,
    failed:  results.filter(r => r.status !== 'text_sent').length,
    results,
  })
}
