import { NextResponse } from 'next/server'
import { generate, SYSTEM_PROMPTS } from '@/lib/gemini'

export async function POST(req: Request) {
  if (!process.env.GOOGLE_API_KEY) return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  try {
    const body = await req.json().catch(() => ({}))
    const projects = body.projects ?? []
    const context = `QUALITY ASSURANCE REVIEW — Sama Alostoura
Date: ${new Date().toLocaleDateString('en-AE')}

${projects.filter((p: any) => p.status === 'active').map((p: any) => `PROJECT: ${p.name}
- Stage: ${p.current_stage ?? 'N/A'} | Progress: ${p.progress_percent ?? 0}%
- Type: ${p.type ?? 'Villa'} | Location: ${p.location ?? 'Dubai'}
- Notes: ${p.notes ?? 'None'}`).join('\n\n')}`

    const messageText = await generate(context, `You are a QA Inspector AI for Sama Alostoura Building Contracting LLC, Dubai. For each project stage (foundation, structure, MEP, finishes), list key quality checkpoints that must be verified. Flag any compliance issues with Dubai Municipality standards. Use ### headers and checklists.`, 900)
    return NextResponse.json({ briefing: message.content[0].type === 'text' ? message.content[0].text : '' })
  } catch (err) {
    return NextResponse.json({ briefing: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 500 })
  }
}
