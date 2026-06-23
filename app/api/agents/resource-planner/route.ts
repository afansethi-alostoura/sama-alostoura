import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) {
    return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  }

  try {
    const body = await req.json().catch(() => ({}))
    let projects = body.projects ?? []

    if (!projects.length && isSupabaseConfigured() && supabaseAdmin) {
      const { data } = await supabaseAdmin.from('projects').select('*').order('created_at', { ascending: false })
      projects = data ?? []
    }

    const active = projects.filter((p: any) => p.status === 'active')

    const context = `RESOURCE PLANNING ANALYSIS — Sama Alostoura Building Contracting LLC
Date: ${new Date().toLocaleDateString('en-AE')}
Active Projects: ${active.length}

${active.map((p: any) => `PROJECT: ${p.name}
- Location: ${p.location ?? 'N/A'}
- Progress: ${p.progress_percent ?? 0}%
- Stage: ${p.current_stage ?? 'N/A'}
- Contract Value: AED ${(p.contract_value ?? 0).toLocaleString()}
- Notes: ${p.notes ?? 'None'}`).join('\n\n')}

Analyze team and schedule optimization across all active projects.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: `You are a Resource Planning AI for Sama Alostoura Building Contracting LLC, a villa construction company in Dubai, UAE.

Analyze the active projects and provide:
1. **Workforce Allocation** — which projects need more manpower right now based on progress and stage
2. **Schedule Conflicts** — identify if any projects are likely competing for the same crew or subcontractors
3. **Priority Order** — rank projects by urgency (payment stage, client deadline, % progress)
4. **Resource Gaps** — flag any stages that typically need specialist subcontractors (MEP, tiling, painting)
5. **This Week's Focus** — top 3 resource actions to take this week

Be specific with project names. Use AED for amounts. Format with ### headers and bullet points.`,
      messages: [{ role: 'user', content: context }],
    })

    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ briefing })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ briefing: `Error: ${msg}` }, { status: 500 })
  }
}
