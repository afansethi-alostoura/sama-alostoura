import { NextResponse }     from 'next/server'
import { anthropic, SYSTEM_PROMPTS } from '@/lib/anthropic'
import { getLiveProjects }  from '@/lib/get-live-projects'

export async function POST() {
  // Always fetch live data from Supabase — never hardcoded
  const projects  = await getLiveProjects()
  const active    = projects.filter(p => p.status === 'active')
  const totalContract = projects.reduce((s, p) => s + p.contract_value,  0)
  const totalReceived = projects.reduce((s, p) => s + p.received_amount, 0)

  const context = `
COMPANY: Sama Alostoura Building Contracting LLC, Dubai UAE
Date: ${new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

PORTFOLIO SUMMARY:
Total projects: ${projects.length} | Active: ${active.length}
Total contract value: AED ${totalContract.toLocaleString()}
Total received: AED ${totalReceived.toLocaleString()}
Total outstanding: AED ${(totalContract - totalReceived).toLocaleString()}
Collection rate: ${totalContract > 0 ? Math.round((totalReceived / totalContract) * 100) : 0}%

ACTIVE PROJECTS (${active.length}):
${active.map(p => `
  • ${p.name} — ${p.location}
    Progress: ${p.progress_percent}% | Stage: ${p.current_stage || 'Not set'}
    Contract: AED ${p.contract_value.toLocaleString()} | Received: AED ${p.received_amount.toLocaleString()} | Outstanding: AED ${(p.contract_value - p.received_amount).toLocaleString()}
    Client: ${p.client_name}${p.mbhre_approved_progress != null ? ` | MBHRE approved: ${p.mbhre_approved_progress}%` : ''}
`).join('')}
`

  if (!process.env.SAMA_AI_KEY) {
    return NextResponse.json({
      briefing: [
        '⚠️ AI not configured (SAMA_AI_KEY missing).',
        '',
        `LIVE SUMMARY (${new Date().toLocaleDateString('en-AE')}):`,
        `• ${active.length} active project${active.length !== 1 ? 's' : ''}`,
        `• Total contract: AED ${totalContract.toLocaleString()}`,
        `• Total received: AED ${totalReceived.toLocaleString()}`,
        `• Outstanding: AED ${(totalContract - totalReceived).toLocaleString()}`,
        '',
        ...active.map(p => `• ${p.name}: ${p.progress_percent}% complete — ${p.current_stage || 'stage not set'}`),
      ].join('\n'),
    })
  }

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system:     SYSTEM_PROMPTS.CEO_DASHBOARD,
      messages:   [{ role: 'user', content: `Generate my morning CEO briefing:\n${context}` }],
    })
    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ briefing })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `AI Error: ${msg}` }, { status: 500 })
  }
}
