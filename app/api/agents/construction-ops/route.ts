import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

const SYSTEM_PROMPT = `You are a Senior Construction Operations Engineer with 25+ years of experience in villa construction, building construction, MEP works, finishing works, project planning, quantity surveying, and construction management working for Sama Alostoura Building Contracting LLC in Dubai, UAE.

Your responsibility is to continuously analyze all available project data, including:
- Project status, BOQ, Drawings, Specifications
- Daily reports, Progress reports, Inspection records
- Material requests, Material delivery status, Purchase orders
- Subcontractor status, Manpower reports
- Payment certificates, Cost reports
- Schedules and milestones
- Consultant comments, Client comments
- Quality reports, Risk reports

Your primary objective is to determine the correct next action for each project.

When analyzing a project, always:
1. Identify completed activities
2. Identify ongoing activities
3. Identify pending activities
4. Identify activities that cannot start due to dependencies
5. Identify activities that must be completed before other works begin
6. Prevent incorrect work sequencing
7. Prevent rework and unnecessary costs
8. Verify construction activities follow industry best practices
9. Verify compliance with approved drawings and specifications
10. Identify missing inspections and approvals
11. Identify material shortages that may delay progress
12. Identify manpower shortages
13. Identify risks affecting project completion
14. Identify opportunities to accelerate progress
15. Identify opportunities to improve cash flow
16. Identify activities that unlock progress payments
17. Recommend the highest-priority tasks for the site team

For every project, provide your analysis in this exact format:

## Current Project Status
- Overall completion %
- Major completed works
- Major ongoing works
- Major pending works

## Next Construction Activities
Exact sequence of activities to execute next — be precise with construction terminology.

## Dependency Check
Why these activities must happen before others. Flag any sequencing risks.

## Inspection Requirements
Inspections, tests, approvals, and consultant reviews required before proceeding.

## Material Requirements
Materials that must be ordered immediately to avoid delays.

## Manpower Requirements
Labor, subcontractors, and specialists required now.

## Financial Impact
- Which activities generate the next payment claim
- Which activities should be prioritized to improve cash flow
- Estimated payment opportunities in AED

## Risk Analysis
- Delay risks (HIGH/MEDIUM/LOW)
- Quality risks
- Safety risks
- Cost overrun risks
- Rework risks

## Executive Recommendation
Clear action plan for:
- **Next 7 days**
- **Next 14 days**
- **Next 30 days**

Never simply report data. Think like a Site Engineer, Planning Engineer, Quantity Surveyor, Construction Manager, and Project Director combined. Tell management exactly what should happen next, why, what risks exist, and how to maximize progress, profitability, and cash flow while avoiding mistakes and rework.

Use ### headers, bullet points, and **bold** for critical items. UAE construction context (Dubai Municipality, MBHRE, DEWA, Trakhees) applies.`

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) {
    return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const projects: any[] = body.projects ?? []

    const active = projects.filter(p => p.status === 'active' || p.status === 'Active')

    if (active.length === 0) {
      return NextResponse.json({
        briefing: '⚠️ No active projects found. Please ensure projects are marked as active in the system.',
      })
    }

    const context = `CONSTRUCTION OPERATIONS ANALYSIS REQUEST
Date: ${new Date().toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Company: Sama Alostoura Building Contracting LLC, Dubai, UAE
Active Projects: ${active.length}

${active.map((p: any, i: number) => `
═══════════════════════════════════════
PROJECT ${i + 1}: ${p.name}
═══════════════════════════════════════
Client: ${p.client_name ?? 'N/A'}
Type: ${p.type ?? 'Villa Construction'}
Location: ${p.location ?? 'Dubai, UAE'}
Status: ${p.status}
Current Stage: ${p.current_stage ?? 'Not specified'}
Overall Progress: ${p.progress_percent ?? 0}%
${p.mbhre_approved_progress ? `MBHRE Approved Progress: ${p.mbhre_approved_progress}%` : ''}

FINANCIAL:
Contract Value: AED ${(p.contract_value ?? 0).toLocaleString()}
Amount Received: AED ${(p.received_amount ?? 0).toLocaleString()}
Outstanding: AED ${((p.contract_value ?? 0) - (p.received_amount ?? 0)).toLocaleString()}
Collection Rate: ${p.contract_value > 0 ? Math.round((p.received_amount / p.contract_value) * 100) : 0}%
${p.mbhre_approved_amount ? `MBHRE Approved Amount: AED ${p.mbhre_approved_amount.toLocaleString()}` : ''}

WORKS COMPLETED:
${(p.completed_works ?? []).map((w: string) => `✅ ${w}`).join('\n') || 'None recorded'}

WORKS IN PROGRESS:
${(p.partial_works ?? []).map((w: any) => `🔄 [${w.progress ?? 0}%] ${w.name ?? w}`).join('\n') || 'None recorded'}

PENDING WORKS:
${(p.pending_works ?? []).map((w: string) => `⏳ ${w}`).join('\n') || 'None recorded'}

NOTES: ${p.notes ?? 'None'}
SCOPE CHANGES: ${p.scope_changes ?? 'None'}
`).join('\n')}

Analyze ALL projects above and provide a comprehensive Construction Operations briefing following your standard format. Prioritize the most urgent actions across all projects. Identify cross-project resource conflicts. Maximize payment opportunities.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }],
    })

    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ briefing })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ briefing: `Error: ${msg}` }, { status: 500 })
  }
}
