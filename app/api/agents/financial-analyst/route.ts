import { NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export async function POST(req: Request) {
  if (!process.env.SAMA_AI_KEY) return NextResponse.json({ briefing: '⚠️ SAMA_AI_KEY not configured.' })
  try {
    const body = await req.json().catch(() => ({}))
    const projects = body.projects ?? []
    const total = projects.reduce((s: number, p: any) => s + (p.contract_value ?? 0), 0)
    const received = projects.reduce((s: number, p: any) => s + (p.received_amount ?? 0), 0)
    const context = `FINANCIAL ANALYSIS — Sama Alostoura
Date: ${new Date().toLocaleDateString('en-AE')}
Total Portfolio: AED ${total.toLocaleString()}
Total Received: AED ${received.toLocaleString()}
Outstanding: AED ${(total - received).toLocaleString()}
Collection Rate: ${total > 0 ? Math.round((received / total) * 100) : 0}%

Projects:
${projects.map((p: any) => `- ${p.name}: AED ${(p.contract_value ?? 0).toLocaleString()} contract, AED ${(p.received_amount ?? 0).toLocaleString()} received (${p.progress_percent ?? 0}% complete)`).join('\n')}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 900,
      system: `You are a Financial Analyst AI for Sama Alostoura Building Contracting LLC, Dubai. Analyze cash flow, revenue trends, profitability, and payment collection. Use ### headers and bullet points. Be specific with AED amounts.`,
      messages: [{ role: 'user', content: context }],
    })
    return NextResponse.json({ briefing: message.content[0].type === 'text' ? message.content[0].text : '' })
  } catch (err) {
    return NextResponse.json({ briefing: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }, { status: 500 })
  }
}
