/**
 * Estimation Engineer AI Agent
 * POST /api/agents/estimation-engineer
 *
 * Accepts multipart FormData:
 *   file            — PDF or image (JPG/PNG) of architectural drawing
 *   projectName     — e.g. "Villa G+1 Al Khawaneej"
 *   ownerName       — e.g. "Mohammed Al Rashid"
 *   plotSize        — e.g. "500" (M2)
 *   floors          — e.g. "2"
 *   bedrooms        — e.g. "6"
 *   bathrooms       — e.g. "5"
 *   notes           — any extra context
 *
 * Returns:
 *   { analysis, plotArea, floors, bedrooms, bathrooms, items: BOQItem[] }
 *
 * No filesystem writes — fully in-memory, works on Vercel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { BOQ_TEMPLATE, applyQuantities } from '@/lib/boq-template'

// Build the complete list of item keys for the prompt
const ITEM_KEYS = BOQ_TEMPLATE.map(i => i.itemNo).join(', ')

// Build a readable template summary for the prompt
const TEMPLATE_SUMMARY = BOQ_TEMPLATE.map(i =>
  `${i.itemNo} | ${i.section} | ${i.description} | ${i.unit} | Rate: ${i.unitRate > 0 ? `AED ${i.unitRate}` : 'N/A'}`
).join('\n')

const SYSTEM_PROMPT = `You are a Senior Quantity Surveyor for Sama Alostoura Building Contracting LLC, Dubai, UAE.
You have 20 years of experience taking off quantities from architectural drawings for UAE villa construction.

TASK:
Analyze the provided architectural drawing/document. Extract all dimensions visible in the drawing.
Then calculate construction quantities for every item in the standard BOQ template below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUANTITY CALCULATION RULES (Dubai Villa Standards):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UNITS GUIDE:
• M3  = cubic metres (concrete, excavation, backfill)
• M2  = square metres (block work, plaster, tiles, paint, waterproofing)
• R.M = running metres (compound wall, handrails, kerb stone)
• N.O = number of items (doors, windows count)
• L.S = lump sum (MEP, fees, specialist works) — quantity is always 1 if applicable, 0 if not
• P.S = provisional sum — quantity 0 or 1

CALCULATION METHODOLOGY:

1. EXCAVATION (M3):
   • Excavation = building_footprint × 1.5m depth
   • Backfill by excavated soil = excavation × 1.3 (bulking)

2. SUBSTRUCTURE (M3):
   • PCC under footings = (footing perimeter × 0.3m) × 0.15m
   • RCC raft/footing = footprint_area × 0.4m thickness
   • Neck columns = 0.3 × 0.3m × num_columns × 1.2m height
   • Tie beams = perimeter_m × 0.3m × 0.5m
   • Grade slab = footprint × 0.15m

3. SUPER STRUCTURE per floor (M3):
   • RCC columns = 0.3 × 0.3m × floor_height × num_columns
   • RCC beams = (external_perimeter + internal_beams_length) × 0.3m × 0.5m
   • RCC slab = floor_area × 0.2m thickness
   • RCC stair = 20 M3 for G+1, 25 M3 for G+2

4. BLOCK WORKS (M2):
   • Thermal block (external 30cm) = external_perimeter × floor_height × num_floors, minus 30% for openings
   • 20cm hollow block (internal main walls) = internal_wall_length × floor_height × num_floors
   • 10cm hollow block (partitions) = 25% of internal block area
   • Parapet block = roof_perimeter × 1.2m height

5. PLASTER (M2):
   • Internal wall plaster = (block_work_M2_internal + block_work_M2_external) × 1.9 (both sides + reveals)
   • External plaster = external_block_M2 × 1.1
   • Stone cladding = same as external plaster area

6. WATERPROOFING (M2):
   • Roof = roof_slab_area (= top floor area)
   • Wet areas = num_bathrooms × 10 M2 per bathroom

7. TILES & FLOORING (M2):
   • Granite entrance = 12% of ground_floor_area
   • Marble steps = num_floors × 12 steps × 0.3m × stair_width (use 1.5m default)
   • Ceramic floor (living areas) = floor_area × 0.65 per floor × num_floors
   • Ceramic wall bathrooms = num_bathrooms × 12 M2 each (perimeter × 2.4m ht)
   • Ceramic floor bathrooms = num_bathrooms × 6 M2 each
   • Maid/store = 15 M2

8. PAINT (M2):
   • Internal = internal_plaster_M2 × 1.05
   • External = external_plaster_M2

9. ALUMINIUM (M2/R.M):
   • Windows curtain wall = 20% of external_wall_area (feature windows + main door)
   • Aluminium windows = 15% of external_wall_area
   • Handrails = stair_run + balcony_perimeter (approx 50 R.M for G+1)

10. DOORS (N.O):
    • Bedroom doors = num_bedrooms
    • Bathroom doors = num_bathrooms

11. COMPOUND WALL (R.M):
    • = plot_perimeter - main_entrance_width
    • Use sqrt(plot_area) × 4 as estimate if perimeter not shown, minus 6m for entrance

12. EXTERNAL FINISHING:
    • Kerb stone = 1 L.S (quantity 1)
    • Manhole = 1 L.S (quantity 1)

13. MEP (all L.S = quantity 1):
    • Electrical DEWA, Etisalat, Plumbing, AC Civil Works, Solar Heater = qty 1 each
    • Sanitary sets for master bedroom = 1, other bedrooms = (num_bedrooms - 1)

14. MOBILIZATION (all L.S = quantity 1 unless clearly inapplicable)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE BOQ TEMPLATE (fill quantities for ALL items):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${TEMPLATE_SUMMARY}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — return ONLY valid JSON, no markdown, no extra text:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "analysis": "Brief summary of what you found in the drawing",
  "plot_area": 500,
  "floors": 2,
  "bedrooms": 6,
  "bathrooms": 5,
  "quantities": {
    "1.1": 1, "1.2": 1, "1.3": 0, "1.4": 1, "1.5": 1, "1.6": 0,
    "2.1": 780, "2.2": 1014, "2.3": 0, "2.4": 0, "2.5": 0, "2.6": 0,
    ... (ALL ${BOQ_TEMPLATE.length} items must be present)
  }
}

RULES:
• L.S / P.S items: quantity = 1 if applicable, 0 if not applicable / by Owner
• Zero-rate items (unitRate = 0 in template) should usually be 0 unless clearly needed
• "by Owner" items = 0
• Round all M3 quantities to nearest whole number
• Round all M2 quantities to nearest whole number
• Round R.M quantities to nearest whole number
• ALL ${BOQ_TEMPLATE.length} keys must be present: ${ITEM_KEYS}`

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export async function POST(req: NextRequest) {
  try {
    const form        = await req.formData()
    const file        = form.get('file')        as File   | null
    const projectName = form.get('projectName') as string || 'Villa Project'
    const ownerName   = form.get('ownerName')   as string || ''
    const plotSize    = form.get('plotSize')    as string || 'Unknown'
    const floors      = form.get('floors')      as string || 'Unknown'
    const bedrooms    = form.get('bedrooms')    as string || 'Unknown'
    const bathrooms   = form.get('bathrooms')   as string || 'Unknown'
    const notes       = form.get('notes')       as string || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const supportedImages = ['jpg', 'jpeg', 'png', 'webp']
    const isPDF   = ext === 'pdf'
    const isImage = supportedImages.includes(ext)

    if (!isPDF && !isImage) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF, JPG, or PNG architectural drawing.' },
        { status: 400 },
      )
    }

    // ── Read file into base64 (in-memory — no fs writes) ──────────────────────
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const userPrompt = `Analyze this architectural drawing and generate quantities for all BOQ items.

Project details provided by estimator:
• Project: ${projectName}
• Owner: ${ownerName || 'Not specified'}
• Plot size: ${plotSize} M2 (use this if dimensions not visible in drawing)
• Floors: ${floors}
• Bedrooms: ${bedrooms}
• Bathrooms: ${bathrooms}
• Additional notes: ${notes || 'None'}

Step 1: Extract all dimensions visible in the drawing (room sizes, overall dimensions, wall lengths, heights, etc.)
Step 2: If drawing dimensions differ from the provided context, use the DRAWING dimensions.
Step 3: Calculate quantities for all ${BOQ_TEMPLATE.length} BOQ items using the methodology in the system prompt.
Step 4: Return the JSON with quantities for every single item.`

    // ── Build message content ──────────────────────────────────────────────────
    type ContentBlock =
      | { type: 'image'; source: { type: 'base64'; media_type: ImageMediaType; data: string } }
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'text'; text: string }

    const content: ContentBlock[] = []

    if (isPDF) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      })
    } else {
      const mediaType: ImageMediaType =
        ext === 'png'  ? 'image/png'  :
        ext === 'webp' ? 'image/webp' : 'image/jpeg'
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      })
    }

    content.push({ type: 'text', text: userPrompt })

    // ── Call Claude ────────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 8000,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // ── Parse JSON from response ───────────────────────────────────────────────
    let parsed: {
      analysis:  string
      plot_area: number
      floors:    number
      bedrooms:  number
      bathrooms: number
      quantities: Record<string, number>
    }

    try {
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON object found in response')
      parsed = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('Failed to parse AI response:', rawText.slice(0, 500))
      return NextResponse.json(
        { error: 'AI returned an unparseable response. Please try again.' },
        { status: 500 },
      )
    }

    // ── Merge quantities into the template ────────────────────────────────────
    const items = applyQuantities(parsed.quantities ?? {})

    return NextResponse.json({
      success:   true,
      analysis:  parsed.analysis  ?? 'Drawing analyzed successfully.',
      plot_area: parsed.plot_area ?? Number(plotSize) || 0,
      floors:    parsed.floors    ?? Number(floors)   || 0,
      bedrooms:  parsed.bedrooms  ?? Number(bedrooms) || 0,
      bathrooms: parsed.bathrooms ?? Number(bathrooms)|| 0,
      items,
    })
  } catch (err) {
    console.error('Estimation engineer error:', err)
    return NextResponse.json(
      { error: 'Failed to analyze drawing: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
