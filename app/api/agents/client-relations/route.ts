import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  try {
    const body = await req.json().catch(() => ({}))
    const projects = body.projects ?? []
    const context = `CLIENT RELATIONS REVIEW — Sama Alostoura
Date: ${new Date().toLocaleDateString('en-AE')}

${projects.map((p: any) => `PROJECT: ${p.name}
- Client: ${p.client_name ?? 'N/A'} | Status: ${p.status}
- Progress: ${p.progress_percent ?? 0}% | Stage: ${p.current_stage ?? 'N/A'}
- Contract: AED ${(p.contract_value ?? 0).toLocaleString()} | Received: AED ${(p.received_amount ?? 0).toLocaleString()}
- Notes: ${p.notes ?? 'None'}`).join('\n\n')}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 900,
      system: `You are a Client Relations AI for Sama Alostoura Building Contracting LLC, Dubai. Review all projects and provide: client update messages ready to send, any clients who need a proactive call today, pending approvals or decisions needed from clients, and suggested communication for projects with payment gaps. Use ### headers. Write professional, warm messages suitable for UAE clients.`,
      messages: [{ role: 'user', content: context }],
    })
    return NextResponse.json({ briefing: message.content[0].type === 'text' ? message.content[0].text : '' })
  } catch (err) {
    return NextResponse.json({ briefing: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 500 })
  }
}
