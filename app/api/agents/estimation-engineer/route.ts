/**
 * Estimation Engineer AI Agent
 * POST /api/agents/estimation-engineer
 *
 * Accepts JSON body:
 *   files        — Array<{ path, name, category }>  (Supabase Storage paths)
 *   projectName, ownerName, plotSize, floors, bedrooms, bathrooms, notes
 *
 * Files were uploaded directly from the browser to Supabase Storage using
 * signed upload URLs — this route downloads them server-side, so there is
 * no Vercel request body limit involved.
 *
 * Returns: { success, analysis, plot_area, floors, bedrooms, bathrooms, items }
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase'
import { BOQ_TEMPLATE, applyQuantities } from '@/lib/boq-template'

export const maxDuration = 60   // extended timeout (Vercel Pro / hobby)

const BUCKET = 'estimation-drawings'

const ITEM_KEYS        = BOQ_TEMPLATE.map(i => i.itemNo).join(', ')
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

interface FileEntry {
  path:     string
  name:     string
  category: string
}

const CATEGORY_LABELS: Record<string, string> = {
  architectural: '🏗 ARCHITECTURAL DRAWINGS',
  structural:    '⚙ STRUCTURAL DRAWINGS',
  mep:           '⚡ MEP DRAWINGS',
  site:          '🗺 SITE PLAN',
}

// Download a file from Supabase Storage and return its ArrayBuffer
async function downloadFromStorage(path: string): Promise<ArrayBuffer | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) {
    console.error(`Failed to download ${path}:`, error?.message)
    return null
  }
  return data.arrayBuffer()
}

// Delete uploaded temp files from Supabase Storage after processing
async function cleanupFiles(paths: string[]) {
  if (!supabaseAdmin || !paths.length) return
  await supabaseAdmin.storage.from(BUCKET).remove(paths)
}

export async function POST(req: NextRequest) {
  const uploadedPaths: string[] = []

  try {
    const body = await req.json()
    const {
      files        = [] as FileEntry[],
      projectName  = 'Villa Project',
      ownerName    = '',
      plotSize     = 'Unknown',
      floors       = 'Unknown',
      bedrooms     = 'Unknown',
      bathrooms    = 'Unknown',
      notes        = '',
    } = body

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No drawing files provided.' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 })
    }

    // Track all paths for cleanup
    files.forEach((f: FileEntry) => uploadedPaths.push(f.path))

    // ── Group files by category ───────────────────────────────────────────────
    const grouped: Record<string, FileEntry[]> = {
      architectural: [], structural: [], mep: [], site: [],
    }
    for (const f of files as FileEntry[]) {
      const cat = f.category ?? 'architectural'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(f)
    }

    // ── Build Claude message content ──────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    const skipped: string[] = []

    for (const [cat, entries] of Object.entries(grouped)) {
      if (!entries.length) continue

      content.push({
        type: 'text',
        text: `\n${'═'.repeat(60)}\n${CATEGORY_LABELS[cat] ?? cat.toUpperCase()} (${entries.length} file${entries.length > 1 ? 's' : ''})\n${'═'.repeat(60)}`,
      })

      for (const f of entries) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        content.push({ type: 'text', text: `File: ${f.name}` })

        const buffer = await downloadFromStorage(f.path)
        if (!buffer) {
          skipped.push(f.name)
          content.push({ type: 'text', text: `[File "${f.name}" could not be downloaded — skipped]` })
          continue
        }

        const base64 = Buffer.from(buffer).toString('base64')

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
    const totalShown = files.length - skipped.length
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
${skipped.length ? `Skipped: ${skipped.join(', ')}` : ''}

INSTRUCTIONS:
1. Review ALL ${totalShown} drawing file(s) above carefully.
2. Cross-reference drawings across categories for maximum accuracy.
3. Use drawing dimensions first; fall back to context values only if not visible.
4. Calculate quantities for every item in the 24-section BOQ template.
5. Return ONLY the JSON object specified in the system prompt — no other text.`,
    })

    // ── Call Claude ───────────────────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
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

    // ── Clean up uploaded files from Supabase ─────────────────────────────────
    await cleanupFiles(uploadedPaths)

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
    // Attempt cleanup even on error
    await cleanupFiles(uploadedPaths).catch(() => {})
    console.error('Estimation engineer error:', err)
    return NextResponse.json(
      { error: 'Failed to analyze drawings: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
