import { NextRequest, NextResponse } from 'next/server'
import { generate } from '@/lib/gemini'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params
    const { role, department, existing } = await req.json()
    if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 })

    const existingNote = existing?.length
      ? `\n\nThe staff member already has these responsibilities (do not duplicate):\n${existing.map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`
      : ''

    const prompt = `You are an expert construction company HR consultant for Sama Alostoura Building Contracting LLC, Dubai, UAE.

Generate a list of 6-8 specific, practical job responsibilities for the following role:
- Role: ${role}
- Department: ${department}
- Company type: Building contracting company (villas, fit-outs, renovations) in Dubai${existingNote}

Requirements:
- Write each responsibility as a short, action-oriented statement (start with a verb)
- Make them specific to Dubai construction industry (mention Dubai Municipality, DEWA, UAE standards where relevant)
- Each responsibility on its own line, no bullet points, no numbers
- No introduction or closing text, just the list of responsibilities
- Language: English only`

    const raw = await generate(prompt, undefined, 600)

    const lines = raw
      .split('\n')
      .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter(l => l.length > 10)

    return NextResponse.json({ responsibilities: lines })
  } catch (err) {
    console.error('[AI responsibilities]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
