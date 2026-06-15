import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export const maxDuration = 60

const SYSTEM = `You are an expert quantity surveyor for Sama Alostoura Building Contracting LLC in Dubai, UAE.

Analyze the uploaded renovation documents and generate a professional Bill of Quantities (BOQ).

Use only sections relevant to the documents. Common sections:
- Mobilization & Site Preparation
- Demolition Works
- Civil & Structural Works
- Masonry Works
- Plastering & Screeding
- Flooring Works
- Ceiling Works
- Painting Works
- MEP Works (Mechanical, Electrical, Plumbing)
- Doors & Windows
- Joinery & Carpentry
- Sanitary Works
- External Works
- Provisional Sums

For each item provide:
- description: Clear, specific work description
- unit: m², m, m³, No, Set, kg, L.S, Lot, or similar
- quantity: Best estimate from the documents (0 if not determinable)
- remarks: Specifications, conditions, or notes (empty string if none)

Reply with ONLY valid JSON — no explanation, no markdown fences:
[{"name":"Section Name","items":[{"description":"...","unit":"m²","quantity":0,"remarks":""}]}]`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const content: any[] = []
    for (const file of files) {
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        title: file.name,
      })
    }
    content.push({
      type: 'text',
      text: 'Analyze these documents and generate the renovation BOQ as specified.',
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI returned no structured data. Try a clearer document.' }, { status: 500 })
    }

    const sections = JSON.parse(jsonMatch[0])
    return NextResponse.json({ sections })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
