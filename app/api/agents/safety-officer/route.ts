import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  try {
    const body = await req.json().catch(() => ({}))
    const projects = body.projects ?? []
    const context = `SITE SAFETY REVIEW — Sama Alostoura
Date: ${new Date().toLocaleDateString('en-AE')}
Active Sites: ${projects.filter((p: any) => p.status === 'active').length}

${projects.filter((p: any) => p.status === 'active').map((p: any) => `SITE: ${p.name}
- Stage: ${p.current_stage ?? 'N/A'} | Location: ${p.location ?? 'Dubai'}
- Notes: ${p.notes ?? 'None'}`).join('\n\n')}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 900,
      system: `You are a Safety Officer AI for Sama Alostoura Building Contracting LLC, Dubai construction sites. Review active construction stages and provide: safety hazards to watch for at each stage, required PPE, Civil Defence compliance requirements, worker welfare checklist (UAE labour law), and any urgent safety actions. Use ### headers.`,
      messages: [{ role: 'user', content: context }],
    })
    return NextResponse.json({ briefing: message.content[0].type === 'text' ? message.content[0].text : '' })
  } catch (err) {
    return NextResponse.json({ briefing: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 500 })
  }
}
