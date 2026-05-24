import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) {
    return NextResponse.json({
      briefing: '⚠️ SAMA_AI_KEY is not set in .env.local.\n\nAdd this line to C:\\Users\\pc\\Documents\\sama-alostoura\\.env.local:\nSAMA_AI_KEY=your-anthropic-key\n\nThen restart the dev server.',
    })
  }

  try {
    const body = await req.json()
    const { projectData } = body

    if (!projectData) {
      return NextResponse.json({ error: 'No project data provided' }, { status: 400 })
    }

    // Build comprehensive context from the project data
    const outstanding = projectData.contract_value - projectData.received_amount
    const pctCollected = Math.round((projectData.received_amount / projectData.contract_value) * 100)

    const completedList = projectData.completed_works || []
    const partialList = projectData.partial_works || []
    const pendingList = projectData.pending_works || []

    let context = 'PROJECT BRIEFING REQUEST\n\n'
    context += 'PROJECT NAME: ' + projectData.name + '\n'
    context += 'Location: ' + projectData.location + '\n'
    context += 'Client: ' + (projectData.client_name || 'Not specified') + '\n'
    context += 'Type: ' + projectData.type + '\n'
    context += 'Status: ' + projectData.status + '\n\n'
    context += 'PROGRESS SUMMARY:\n'
    context += '- Actual work completion: ' + projectData.progress_percent + '%\n'
    if (projectData.mbhre_approved_progress) {
      context += '- MBHRE approved progress: ' + projectData.mbhre_approved_progress + '%\n'
    }
    context += '\nFINANCIAL SUMMARY:\n'
    context += '- Contract value: AED ' + projectData.contract_value.toLocaleString() + '\n'
    context += '- Received to date: AED ' + projectData.received_amount.toLocaleString() + ' (' + pctCollected + '%)\n'
    context += '- Outstanding: AED ' + outstanding.toLocaleString() + '\n'
    context += '- 10% Retention held: AED ' + (projectData.received_amount * 0.1).toLocaleString() + '\n'
    if (projectData.mbhre_approved_amount) {
      context += '- MBHRE approved amount: AED ' + projectData.mbhre_approved_amount.toLocaleString() + '\n'
    }
    context += '\nCOMPLETED WORKS (' + completedList.length + ' items):\n'
    context += completedList.map((w: string) => '[DONE] ' + w).join('\n') + '\n'
    context += '\nWORKS IN PROGRESS (' + partialList.length + ' items):\n'
    context += partialList.map((w: any) => '[' + w.progress + '%] ' + w.name).join('\n') + '\n'
    context += '\nPENDING WORKS (' + pendingList.length + ' items):\n'
    context += pendingList.map((w: string) => '[TODO] ' + w).join('\n') + '\n'
    context += '\nCURRENT STAGE: ' + (projectData.current_stage || 'Not specified') + '\n'
    if (projectData.scope_changes) {
      context += '\nSCOPE CHANGES:\n' + projectData.scope_changes + '\n'
    }
    if (projectData.notes) {
      context += '\nNOTES:\n' + projectData.notes + '\n'
    }
    context += '\nPLEASE PROVIDE:\n'
    context += '1. Executive summary of what\'s complete\n'
    context += '2. Status of in-progress items and any blockers\n'
    context += '3. Key pending items that need attention TODAY\n'
    context += '4. Recommendation for next payment stage (if MBHRE-funded, consider the gap between actual work and approved progress)\n'
    context += '5. Action items for the contractor and project manager'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: `You are an expert construction project manager and AI consultant. You provide clear, actionable project briefings that help construction company management understand project status at a glance.

Your briefing format should be:
- Start with a 1-sentence executive summary
- List what's DONE (completed works)
- List what's NEARLY DONE (highlight the in-progress items with highest completion %)
- List what NEEDS ACTION TODAY (pending items blocking next stage)
- For MBHRE-funded projects: highlight if actual progress exceeds approved progress and recommend when to submit for next payment
- End with 2-3 specific ACTION ITEMS for tomorrow

Use clear formatting with headers (###), bold for key numbers (**AED X**), and bullet points for lists.`,
      messages: [{ role: 'user', content: context }],
    })

    const briefing = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ briefing })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ briefing: `Error getting briefing: ${msg}` }, { status: 500 })
  }
}
