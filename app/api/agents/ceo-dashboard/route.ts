import { NextResponse } from 'next/server'
import type { Project } from '@/types'
import { anthropic, SYSTEM_PROMPTS } from '@/lib/anthropic'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) {
    return NextResponse.json({
      briefing: [
        '⚠️ AI not configured yet.',
        '',
        'To enable the CEO Dashboard AI:',
        '1. Copy .env.local.example → .env.local',
        '2. Add your Anthropic API key (get it at console.anthropic.com)',
        '3. Restart the dev server with: npm run dev',
        '',
        'DEMO SUMMARY (no AI):',
        '• 4 active projects, 1 completed',
        '• Total contract: AED 4,285,000',
        '• Total received: AED 1,924,500',
        '• Outstanding: AED 2,360,500',
        '• Most urgent: Khalid villa — AC subcontractor and DEWA connection not started',
      ].join('\n'),
    })
  }

  const { projects } = await req.json() as { projects: Project[] }

  const active = projects.filter(p => p.status === 'active')
  const totalContract = projects.reduce((s, p) => s + p.contract_value, 0)
  const totalReceived = projects.reduce((s, p) => s + p.received_amount, 0)

  const context = `
COMPANY: Sama Alostoura Building Contracting LLC, Dubai UAE
Date: ${new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

ACTIVE PROJECTS (${active.length}):
${active.map(p => `
  • ${p.name} Villa (${p.location})
    Progress: ${p.progress_percent}% | Stage: ${p.current_stage}
    Contract: AED ${p.contract_value.toLocaleString()} | Received: AED ${p.received_amount.toLocaleString()} | Outstanding: AED ${(p.contract_value - p.received_amount).toLocaleString()}
`).join('')}

FINANCIAL SUMMARY:
Total contract value: AED ${totalContract.toLocaleString()}
Total received: AED ${totalReceived.toLocaleString()}
Total outstanding: AED ${(totalContract - totalReceived).toLocaleString()}
Collection rate: ${Math.round((totalReceived / totalContract) * 100)}%

KNOWN ISSUES:
- Khalid project: AC subcontractor not confirmed, DEWA connection not applied (takes 3 weeks)
- Khalid project: Stage 4 MBHRE payment (AED 200,000) applied, awaiting release
- Trade license expires March 2025 — renewal due soon
- Engineer Mahmoud visa expires December 2024 — renewal urgent
`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SYSTEM_PROMPTS.CEO_DASHBOARD,
      messages: [{ role: 'user', content: `Generate my morning CEO briefing:\n${context}` }],
    })

    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ briefing })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI Error: ${msg}` }, { status: 500 })
  }
}
