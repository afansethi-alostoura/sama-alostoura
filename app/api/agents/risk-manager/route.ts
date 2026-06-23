import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  try {
    const body = await req.json().catch(() => ({}))
    const projects = body.projects ?? []
    const context = `RISK ASSESSMENT — Sama Alostoura
Date: ${new Date().toLocaleDateString('en-AE')}
Active Projects: ${projects.filter((p: any) => p.status === 'active').length}

${projects.map((p: any) => `PROJECT: ${p.name}
- Status: ${p.status} | Progress: ${p.progress_percent ?? 0}%
- Stage: ${p.current_stage ?? 'N/A'}
- Contract: AED ${(p.contract_value ?? 0).toLocaleString()} | Received: AED ${(p.received_amount ?? 0).toLocaleString()}
- Notes: ${p.notes ?? 'None'}`).join('\n\n')}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 900,
      system: `You are a Risk Manager AI for Sama Alostoura Building Contracting LLC, Dubai villa construction. Identify and assess: payment risks, schedule risks, permit/regulatory risks, subcontractor risks, and site safety risks. Rate each risk HIGH/MEDIUM/LOW. Provide mitigation steps. Use ### headers.`,
      messages: [{ role: 'user', content: context }],
    })
    return NextResponse.json({ briefing: message.content[0].type === 'text' ? message.content[0].text : '' })
  } catch (err) {
    return NextResponse.json({ briefing: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 500 })
  }
}
