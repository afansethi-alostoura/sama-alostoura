/**
 * Drawing Chat API
 * POST /api/agents/drawing-chat
 *
 * Chat assistant that reads uploaded drawings and answers quantity questions.
 * Downloads files from Supabase Storage on each turn, injects them into the
 * first user message, then runs the full conversation through Claude Vision.
 *
 * Accepts JSON:
 *   { files: [{ path, name, category }], messages: [{ role, content }] }
 * Returns:
 *   { answer: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const BUCKET = 'estimation-drawings'

// ── File helpers ──────────────────────────────────────────────────────────────
async function downloadFile(path: string): Promise<Buffer | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) {
    console.error(`[drawing-chat] download failed for ${path}:`, error?.message)
    return null
  }
  return Buffer.from(await data.arrayBuffer())
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `You are a professional Civil Engineer and Quantity Surveyor with 20 years of experience reading Dubai villa construction drawings.

The user has uploaded architectural, structural, MEP, and/or site drawings. Your job is to answer questions about quantities, dimensions, and measurements from those drawings.

RULES:
1. Always cite which drawing and which location you found the information (e.g. "From Ground Floor Plan, Master Bedroom: 5.5m × 4.2m")
2. Give specific numbers with correct BOQ units:
   - Concrete volumes in M³ (show calculation: area × thickness)
   - Block work, plaster, tiles, paint in M²
   - Compound wall, kerb in R.M (running meters)
   - Doors, windows, sanitary fixtures in N.O
   - Electrical, plumbing, AC systems as L.S
3. Show your calculation clearly: e.g. "Slab area 275 M² × 0.20m thick = 55 M³"
4. If you CANNOT find the information in the drawings, say: "I cannot find this in the uploaded drawings. Based on standard Dubai villa ratios for a [size] villa, it would typically be [estimate]."
5. Be concise but precise — the user is filling in a BOQ and needs exact numbers.
6. For follow-up questions, remember the drawings and previous answers in this conversation.`

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      files    = [] as Array<{ path: string; name: string; category: string }>,
      messages = [] as Array<{ role: 'user' | 'assistant'; content: string }>,
    } = body

    if (!messages.length) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
    }

    // ── Download drawings ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const drawingBlocks: any[] = []

    if (Array.isArray(files) && files.length > 0) {
      const categoryLabel: Record<string, string> = {
        architectural: '🏗 ARCHITECTURAL',
        structural:    '⚙ STRUCTURAL',
        mep:           '⚡ MEP / DRAINAGE',
        site:          '🗺 SITE PLAN',
      }

      // Group by category
      const byCategory: Record<string, typeof files> = {}
      for (const f of files) {
        const cat = f.category || 'architectural'
        ;(byCategory[cat] = byCategory[cat] || []).push(f)
      }

      for (const [cat, entries] of Object.entries(byCategory)) {
        drawingBlocks.push({
          type: 'text',
          text: `\n${'═'.repeat(50)}\n${categoryLabel[cat] || cat.toUpperCase()} (${entries.length} drawing(s))\n${'═'.repeat(50)}`,
        })

        for (const f of entries) {
          const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
          drawingBlocks.push({ type: 'text', text: `Drawing file: ${f.name}` })

          const buf = await downloadFile(f.path)
          if (!buf) {
            drawingBlocks.push({ type: 'text', text: `[Could not load "${f.name}" — skipped]` })
            continue
          }

          const b64 = buf.toString('base64')
          if (ext === 'pdf') {
            drawingBlocks.push({
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: b64 },
            })
          } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            const mt = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
            drawingBlocks.push({
              type: 'image',
              source: { type: 'base64', media_type: mt, data: b64 },
            })
          } else {
            drawingBlocks.push({ type: 'text', text: `[Unsupported type .${ext} — skipped]` })
          }
        }
      }

      drawingBlocks.push({
        type: 'text',
        text: `\n${'═'.repeat(50)}\nAll drawings shown above. Answer the user's question below based on what you can see in these drawings.\n${'═'.repeat(50)}`,
      })
    } else {
      drawingBlocks.push({
        type: 'text',
        text: 'Note: No drawing files were provided. Answer based on general Dubai villa construction knowledge and state that no drawings were available.',
      })
    }

    // ── Build Claude messages array ───────────────────────────────────────────
    // Drawings are injected into the first user message only.
    // Subsequent turns are plain text.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const claudeMessages: any[] = []

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]

      if (i === 0 && msg.role === 'user') {
        // First question: prepend drawing blocks
        claudeMessages.push({
          role: 'user',
          content: [
            ...drawingBlocks,
            { type: 'text', text: msg.content },
          ],
        })
      } else {
        claudeMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    console.log(`[drawing-chat] ${files.length} drawings, ${messages.length} messages → Claude`)

    // ── Call Claude ───────────────────────────────────────────────────────────
    const resp = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      system:     SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages:   claudeMessages as any,
    })

    const answer = resp.content[0].type === 'text' ? resp.content[0].text : '(No response)'

    return NextResponse.json({ answer })

  } catch (err) {
    console.error('[drawing-chat] error:', err)
    return NextResponse.json(
      { error: 'Chat failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
