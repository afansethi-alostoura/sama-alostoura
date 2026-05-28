/**
 * Estimation Engineer AI Agent
 * POST /api/agents/estimation-engineer
 *
 * Accepts multipart FormData:
 *   files[]       — one or more PDF/JPG/PNG drawing files
 *   categories[]  — matching category for each file:
 *                   'architectural' | 'structural' | 'mep' | 'site'
 *   projectName, ownerName, plotSize, floors, bedrooms, bathrooms, notes
 *
 * Returns: { success, analysis, plot_area, floors, bedrooms, bathrooms, items }
 *
 * Fully in-memory — no filesystem writes (Vercel-safe).
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { BOQ_TEMPLATE, applyQuantities } from '@/lib/boq-template'

const ITEM_KEYS       = BOQ_TEMPLATE.map(i => i.itemNo).join(', ')
const TEMPLATE_SUMMARY = BOQ_TEMPLATE.map(i =>
  `${i.itemNo} | ${i.section} | ${i.description} | ${i.unit} | Rate: ${i.unitRate > 0 ? `AED ${i.unitRate}` : 'N/A'}`
).join('\n')

const CATEGORY_GUIDE: Record<string, string> = {
  architectural: `ARCHITECTURAL DRAWINGS (floor plans, elevations, sections, roof plan)
   → Extract: room names & dimensions, total floor area per level, external wall perimeter,
     internal wall layout, door/window positions and counts, ceiling heights,
     stair geometry, balcony/terrace areas, building footprint, parapet heights.`,
  structural: `STRUCTURAL DRAWINGS (foundation plan, column layout, beam schedule, slab details)
   → Extract: footing type (raft/pad), footing dimensions and depth, column sizes and grid,
     beam sizes and spans, slab thickness, stair and lift core structure,
     parapet/retaining walls, all concrete volumes.`,
  mep: `MEP DRAWINGS (electrical single-line, plumbing riser, HVAC layout)
   → Extract: electrical DB locations, number of lighting/power circuits, DEWA meter room,
     plumbing riser and fixture count per bathroom, roof tank size and pump type,
     AC indoor/outdoor unit positions, ventilation fan locations, fire alarm zones.
     All MEP items are L.S (lump sum) — confirm scope is present.`,
  site: `SITE PLAN (plot boundary, road access, compound wall, external works)
   → Extract: plot dimensions (length × width), total plot area, plot perimeter,
     compound wall alignment and total length, entrance gate position and width,
     driveway area, landscaping area, external utility connections.`,
}

const SYSTEM_PROMPT = `You are a Senior Quantity Surveyor for Sama Alostoura Building Contracting LLC, Dubai, UAE.
You have 20 years of experience taking off quantities from villa construction drawings.

TASK:
Multiple drawing files will be provided, each labelled with its category.
Analyze ALL drawings together and cross-reference them to calculate accurate quantities.
Then fill in quantities for EVERY item in the standard 24-section BOQ template below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO USE EACH DRAWING CATEGORY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${Object.values(CATEGORY_GUIDE).join('\n\n')}

CROSS-REFERENCING RULES:
• If structural and architectural show the same element, use structural for concrete quantities
  and architectural for finishes (plaster, tiles, paint).
• If site plan shows plot perimeter → use it for compound wall (R.M).
• If floor plans show room count → use them for doors (N.O) and sanitary sets.
• If MEP drawings are present → confirm all MEP L.S items apply (qty = 1).
• If a drawing type is missing → estimate from user-provided context + other drawings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNITS GUIDE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• M3  = cubic metres  (concrete, excavation, backfill)
• M2  = square metres (block work, plaster, tiles, paint, waterproofing)
• R.M = running metres (compound wall, handrails, kerb stone)
• N.O = number (doors, windows — count each opening individually)
• L.S = lump sum — qty 1 if in scope, 0 if not applicable / by Owner
• P.S = provisional sum — qty 0 or 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUANTITY CALCULATION METHODOLOGY (Dubai Villa Standards):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXCAVATION (M3):
  Excavation = building_footprint × 1.5m depth
  Backfill by excavated soil = excavation × 1.3 (bulking factor)

SUBSTRUCTURE (M3):
  PCC under footings = footing_perimeter × 0.3m wide × 0.15m thick
  RCC raft/footing = footprint_area × 0.4m thickness
  Neck columns = 0.3×0.3m × num_columns × 1.2m height
  Tie beams = perimeter_m × 0.3m × 0.5m cross-section
  Grade slab = footprint × 0.15m

SUPER STRUCTURE per floor (M3):
  RCC columns = 0.3×0.3m × floor_height × num_columns_per_floor
  RCC beams = (external_perimeter + internal_beam_lengths) × 0.3m × 0.5m
  RCC slab = floor_area × 0.2m thickness
  RCC stair = 20 M3 for G+1, 28 M3 for G+2

BLOCK WORKS (M2):
  Thermal block (external 30cm) = external_perimeter × floor_height × num_floors, minus 30% openings
  20cm hollow block (internal main walls) = internal_wall_length × floor_height × num_floors
  10cm hollow block (partitions) = 25% of 20cm block area
  Parapet = roof_perimeter × 1.2m height

PLASTER (M2):
  Internal = (block_internal + block_external) × 1.9 (both sides + reveals)
  External = external_block_area × 1.1 (with grooves)
  Stone cladding = same as external plaster area

WATERPROOFING (M2):
  Roof = roof_slab_area (top floor area)
  Wet areas = num_bathrooms × 10 M2 per bathroom

TILES & FLOORING (M2):
  Granite entrance = 12% of ground_floor_area
  Marble steps = num_floors × 12 steps × 0.3m tread × stair_width (default 1.5m)
  Ceramic floor (living/bed areas) = total_floor_area × 0.65 per floor
  Ceramic wall bathrooms = num_bathrooms × 12 M2 each
  Ceramic floor bathrooms = num_bathrooms × 6 M2 each
  Maid/store = 15 M2

PAINT (M2):
  Internal = internal_plaster_M2 × 1.05
  External = external_plaster_M2

ALUMINIUM (M2 / R.M):
  Windows curtain wall = 20% of external_wall_area (feature windows + main door)
  Aluminium windows = 15% of external_wall_area
  Handrails = stair_run + balcony_perimeter (approx 50 R.M for G+1)

DOORS (N.O):
  Bedroom doors = num_bedrooms
  Bathroom doors = num_bathrooms

COMPOUND WALL (R.M):
  = plot_perimeter − main_entrance_width
  If perimeter not visible: use √(plot_area) × 4, minus 6m entrance

EXTERNAL FINISHING:
  Kerb stone = 1 L.S (qty 1)
  Manhole = 1 L.S (qty 1)

MEP — confirm scope from MEP drawings (all L.S, qty 1 each):
  Electrical DEWA, Etisalat, Plumbing & Drainage, AC Civil Works, Solar Heater,
  Master bedroom sanitary = 1, other bedrooms = (num_bedrooms − 1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE BOQ TEMPLATE — fill quantities for ALL ${BOQ_TEMPLATE.length} items:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${TEMPLATE_SUMMARY}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — return ONLY valid JSON, no markdown, no extra text:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "analysis": "1-2 sentence summary of all drawings reviewed and key dimensions found",
  "plot_area": 500,
  "floors": 2,
  "bedrooms": 6,
  "bathrooms": 5,
  "quantities": {
    "1.1": 1, "1.2": 1, ...
    (ALL ${BOQ_TEMPLATE.length} keys required: ${ITEM_KEYS})
  }
}

CRITICAL RULES:
• Every one of the ${BOQ_TEMPLATE.length} item keys must appear in "quantities"
• L.S / P.S: quantity = 1 if in scope, 0 if not
• "by Owner" items = 0
• Items marked "if required" that don't apply = 0
• Round M3 and M2 to nearest whole number
• Round R.M to nearest whole number`

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const MAX_FILES       = 10
const MAX_BYTES       = 8 * 1024 * 1024  // 8 MB per file

export async function POST(req: NextRequest) {
  try {
    const form        = await req.formData()
    const files       = form.getAll('files')      as File[]
    const categories  = form.getAll('categories') as string[]
    const projectName = (form.get('projectName')  as string) || 'Villa Project'
    const ownerName   = (form.get('ownerName')    as string) || ''
    const plotSize    = (form.get('plotSize')      as string) || 'Unknown'
    const floors      = (form.get('floors')        as string) || 'Unknown'
    const bedrooms    = (form.get('bedrooms')      as string) || 'Unknown'
    const bathrooms   = (form.get('bathrooms')     as string) || 'Unknown'
    const notes       = (form.get('notes')         as string) || ''

    if (!files.length) {
      return NextResponse.json({ error: 'No drawing files provided.' }, { status: 400 })
    }

    // Cap total files
    const fileList = files.slice(0, MAX_FILES)
    const catList  = categories.slice(0, MAX_FILES)

    // ── Group files by category ───────────────────────────────────────────────
    const grouped: Record<string, Array<{ file: File; idx: number }>> = {
      architectural: [], structural: [], mep: [], site: [],
    }
    fileList.forEach((file, i) => {
      const cat = catList[i] ?? 'architectural'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({ file, idx: i })
    })

    // ── Build Claude message content ──────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    const skipped: string[] = []

    const CATEGORY_LABELS: Record<string, string> = {
      architectural: '🏗 ARCHITECTURAL DRAWINGS',
      structural:    '⚙ STRUCTURAL DRAWINGS',
      mep:           '⚡ MEP DRAWINGS',
      site:          '🗺 SITE PLAN',
    }

    for (const [cat, entries] of Object.entries(grouped)) {
      if (!entries.length) continue

      content.push({
        type: 'text',
        text: `\n${'═'.repeat(60)}\n${CATEGORY_LABELS[cat] ?? cat.toUpperCase()} (${entries.length} file${entries.length > 1 ? 's' : ''})\n${'═'.repeat(60)}`,
      })

      for (const { file } of entries) {
        if (file.size > MAX_BYTES) {
          skipped.push(file.name)
          content.push({ type: 'text', text: `[File "${file.name}" skipped — too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 8 MB limit)]` })
          continue
        }

        const ext    = file.name.split('.').pop()?.toLowerCase() ?? ''
        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')

        content.push({ type: 'text', text: `File: ${file.name}` })

        if (ext === 'pdf') {
          content.push({
            type:   'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          })
        } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          const mediaType: ImageMediaType =
            ext === 'png'  ? 'image/png'  :
            ext === 'webp' ? 'image/webp' : 'image/jpeg'
          content.push({
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          })
        } else {
          content.push({ type: 'text', text: `[Unsupported file type: ${ext} — skipped]` })
        }
      }
    }

    // ── Final user instruction ────────────────────────────────────────────────
    const totalShown = fileList.length - skipped.length
    content.push({
      type: 'text',
      text: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT CONTEXT (provided by estimator):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project: ${projectName}
Owner:   ${ownerName || 'Not specified'}
Plot size: ${plotSize} M2  |  Floors: ${floors}  |  Bedrooms: ${bedrooms}  |  Bathrooms: ${bathrooms}
Notes: ${notes || 'None'}
Drawings provided: ${totalShown} file(s) across ${Object.entries(grouped).filter(([, v]) => v.length).map(([k]) => k).join(', ')} categories
${skipped.length ? `Skipped (too large): ${skipped.join(', ')}` : ''}

INSTRUCTIONS:
1. Review ALL ${totalShown} drawing file(s) above carefully.
2. Cross-reference drawings across categories for maximum accuracy.
3. Use drawing dimensions first; fall back to context values only if not visible.
4. Calculate quantities for every item in the 24-section BOQ template.
5. Return ONLY the JSON object specified in the system prompt — no other text.`,
    })

    // ── Call Claude ───────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 8000,
      system:     SYSTEM_PROMPT,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages:   [{ role: 'user', content }] as any,
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // ── Parse response ────────────────────────────────────────────────────────
    let parsed: {
      analysis:   string
      plot_area:  number
      floors:     number
      bedrooms:   number
      bathrooms:  number
      quantities: Record<string, number>
    }

    try {
      const cleaned   = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Failed to parse AI response:', rawText.slice(0, 500))
      return NextResponse.json(
        { error: 'AI returned an unparseable response. Please try again.' },
        { status: 500 },
      )
    }

    const items = applyQuantities(parsed.quantities ?? {})

    return NextResponse.json({
      success:   true,
      analysis:  parsed.analysis  ?? `Analyzed ${totalShown} drawing(s) successfully.`,
      plot_area: (parsed.plot_area ?? Number(plotSize))  || 0,
      floors:    (parsed.floors    ?? Number(floors))    || 0,
      bedrooms:  (parsed.bedrooms  ?? Number(bedrooms))  || 0,
      bathrooms: (parsed.bathrooms ?? Number(bathrooms)) || 0,
      items,
      skipped,
    })
  } catch (err) {
    console.error('Estimation engineer error:', err)
    return NextResponse.json(
      { error: 'Failed to analyze drawings: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
