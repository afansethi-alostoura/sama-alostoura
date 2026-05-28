/**
 * Estimation Engineer AI Agent
 * POST /api/agents/estimation-engineer
 *
 * Accepts JSON body:
 *   files        — Array<{ path, name, category }>  (Supabase Storage paths)
 *   projectName, ownerName, plotSize, floors, bedrooms, bathrooms, notes
 *
 * Files were uploaded directly from the browser to Supabase Storage using
 * signed upload URLs — this route downloads them server-side.
 *
 * Returns: { success, analysis, plot_area, floors, bedrooms, bathrooms, items }
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase'
import { BOQ_TEMPLATE, applyQuantities } from '@/lib/boq-template'

export const maxDuration = 60

const BUCKET = 'estimation-drawings'

// ── Template metadata ────────────────────────────────────────────────────────
const ITEM_KEYS = BOQ_TEMPLATE.map(i => i.itemNo).join(', ')

// Full template listing sent to Claude
const TEMPLATE_SUMMARY = BOQ_TEMPLATE.map(i =>
  `"${i.itemNo}" | ${i.description} | unit: ${i.unit} | rate: ${i.unitRate > 0 ? `AED ${i.unitRate}` : 'by Owner / N/A'}`
).join('\n')

// Items that are legitimately zero (by Owner, if required, provisional)
const ZERO_OK_ITEMS = new Set(BOQ_TEMPLATE
  .filter(i =>
    i.unitRate === 0 ||
    i.description.toLowerCase().includes('by owner') ||
    i.description.toLowerCase().includes('if required') ||
    i.unit === 'P.S'
  )
  .map(i => i.itemNo)
)

// ── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(plotArea: number, numFloors: number, numBeds: number, numBaths: number) {

  // Pre-compute reference values from context so Claude has a concrete baseline
  const footprint     = plotArea * 0.55                         // typical built-up ratio
  const totalBFA      = footprint * numFloors                   // total built floor area
  const extPerimeter  = Math.sqrt(footprint) * 4               // approx external perimeter (m)
  const extWallArea   = extPerimeter * 3.2 * numFloors         // height 3.2 m per floor
  const intWallArea   = totalBFA * 1.4                         // internal walls both sides
  const roofArea      = footprint

  const excavation    = Math.round(footprint * 1.5)
  const backfill      = Math.round(excavation * 1.3)
  const pcc           = Math.round(extPerimeter * 0.3 * 0.15)
  const raft          = Math.round(footprint * 0.4)
  const neckCols      = Math.round(((footprint / 25) * 0.3 * 0.3 * 1.2))  // ~1 col / 25m2
  const tieBm         = Math.round(extPerimeter * 0.3 * 0.5)
  const gradeSlab     = Math.round(footprint * 0.15)
  const colsPerFloor  = Math.round(footprint / 25)
  const rccCols       = Math.round(colsPerFloor * 0.3 * 0.3 * 3.2 * numFloors)
  const rccSlabs      = Math.round(totalBFA * 0.2)
  const rccBeams      = Math.round(extPerimeter * numFloors * 0.3 * 0.5)
  const rccStair      = numFloors === 1 ? 20 : 28
  const thermalBlock  = Math.round(extWallArea * 0.7)          // minus 30% openings
  const hollowBlock20 = Math.round(intWallArea * 0.5)
  const hollowBlock10 = Math.round(hollowBlock20 * 0.25)
  const parapet       = Math.round(extPerimeter * 1.2)
  const intPlaster    = Math.round((thermalBlock + hollowBlock20 + hollowBlock10) * 1.9)
  const extPlaster    = Math.round(extWallArea * 1.1)
  const roofWP        = roofArea
  const wetAreaWP     = numBaths * 10
  const graniteEnt    = Math.round(footprint * 0.12)
  const marbleSteps   = Math.round(numFloors * 12 * 0.3 * 1.5)
  const ceramicFloor  = Math.round(totalBFA * 0.65)
  const ceramicBathF  = numBaths * 6
  const ceramicBathW  = numBaths * 12
  const intPaint      = Math.round(intPlaster * 1.05)
  const extPaint      = extPlaster
  const curtainWall   = Math.round(extWallArea * 0.2)
  const alumWindows   = Math.round(extWallArea * 0.15)
  const handrails     = numFloors === 1 ? 50 : 70
  const compoundWall  = Math.round(Math.sqrt(plotArea) * 4 - 6)
  const otherBedrooms = Math.max(0, numBeds - 1)

  return `You are a Senior Quantity Surveyor for Sama Alostoura Building Contracting LLC, Dubai, UAE.
You have 20 years of experience preparing villa BOQs.

════════════════════════════════════════════════════════════════
ABSOLUTE RULES — READ THESE FIRST
════════════════════════════════════════════════════════════════

1. You MUST output a quantity > 0 for every item whose rate is NOT zero and is NOT marked "by Owner" or "if required".
   Items that MUST be non-zero: excavation, backfill, all concrete (M3), all block work (M2),
   plaster, waterproofing, tiles, paint, aluminium, doors, compound wall.

2. If the drawings are blurry, low-resolution, or you cannot read them clearly — DO NOT output zeros.
   Instead, use the pre-computed baseline values I provide below (calculated from project context).

3. "I cannot see the drawings" is NOT an acceptable reason to output 0.
   The project context alone (plot area, floors, bedrooms, bathrooms) is sufficient to produce a full BOQ.

4. All quantities must be realistic for a Dubai villa of this size:
   - Never output a total BOQ value below AED 800,000
   - Excavation must be > 100 M3 for any plot > 200 M2
   - Block work must be > 200 M2 for any project with walls

════════════════════════════════════════════════════════════════
PROJECT CONTEXT — USE THESE VALUES AS YOUR BASELINE
════════════════════════════════════════════════════════════════

Plot area:    ${plotArea} M2
Floors:       ${numFloors} (Ground${numFloors > 1 ? ' + ' + (numFloors - 1) + ' upper' : ''})
Bedrooms:     ${numBeds}
Bathrooms:    ${numBaths}
Built footprint (approx 55% of plot): ${Math.round(footprint)} M2
Total built floor area: ${Math.round(totalBFA)} M2
External wall perimeter: ${Math.round(extPerimeter)} m

════════════════════════════════════════════════════════════════
PRE-COMPUTED BASELINE QUANTITIES (from context — use if drawings unclear)
════════════════════════════════════════════════════════════════

ITEM    | BASELINE | FORMULA USED
2.1     | ${excavation} M3   | footprint(${Math.round(footprint)}) × 1.5m depth
2.2     | ${backfill} M3   | excavation × 1.3 (bulking factor)
3.1     | ${pcc} M3    | perimeter(${Math.round(extPerimeter)}m) × 0.3m × 0.15m
3.2     | ${raft} M3   | footprint × 0.4m thick
3.3     | ${neckCols} M3    | ~${Math.round(footprint/25)} cols × 0.09m² × 1.2m
3.4     | ${tieBm} M3    | perimeter × 0.3m × 0.5m
3.9     | ${gradeSlab} M3    | footprint × 0.15m
4.1     | ${rccCols} M3    | ${colsPerFloor} cols/floor × 0.09m² × 3.2m × ${numFloors} floors
4.2     | ${rccBeams} M3    | perimeter × ${numFloors} floors × 0.3m × 0.5m
4.3     | ${rccSlabs} M3   | floor area(${Math.round(totalBFA)}m²) × 0.2m
4.6     | ${rccStair} M3    | standard stair volume G+${numFloors-1}
5.1     | ${thermalBlock} M2  | external wall area × 0.7 (minus 30% openings)
5.2     | ${hollowBlock10} M2  | 25% of 20cm block
5.4     | ${hollowBlock20} M2  | internal walls (both sides) × 50%
4.7     | ${parapet} M2  | roof perimeter × 1.2m
6.1     | ${intPlaster} M2  | (thermal+hollow) × 1.9 (both sides + reveals)
7.1     | ${extPlaster} M2  | external wall area × 1.1
7.2     | ${Math.round(extPerimeter * 1.2)} M2  | parapet inside perimeter × 1.2m
8.1     | ${Math.round(roofWP)} M2  | roof slab area = footprint
8.2     | ${wetAreaWP} M2    | ${numBaths} bathrooms × 10 M2 each
13.1    | ${graniteEnt} M2   | 12% of ground floor for entrance
13.6    | ${marbleSteps} M2   | ${numFloors} floors × 12 steps × 0.3m × 1.5m wide
13.7    | ${ceramicFloor} M2  | total BFA × 65%
13.11   | ${ceramicBathF} M2   | ${numBaths} bathrooms × 6 M2
13.12   | ${ceramicBathW} M2   | ${numBaths} bathrooms × 12 M2
15.1    | ${intPaint} M2  | internal plaster × 1.05
16.1    | ${extPaint} M2  | = external plaster
16.2    | ${Math.round(extPerimeter * 1.2)} M2  | parapet inside × 1.2m
19.1    | ${curtainWall} M2    | 20% of external wall (curtain wall + main doors)
19.2    | ${handrails} R.M   | stair run + balcony perimeter
19.3    | ${alumWindows} M2    | 15% of external wall area
20.3    | ${numBeds} N.O    | = number of bedrooms
20.4    | ${numBaths} N.O    | = number of bathrooms
22.1    | ${compoundWall} R.M   | plot perimeter − 6m entrance
10.7    | 1 L.S    | master bedroom sanitary set
10.8    | ${otherBedrooms} L.S    | other bedrooms (total beds − 1)
13.13   | 15 M2    | maid/store room

Fixed L.S items (qty = 1):
1.1, 1.2, 1.4, 1.5, 3.6, 3.7, 3.8, 9.1, 9.2, 10.1, 10.2, 10.3, 10.5, 11.1, 13.8,
23.3, 23.5, 24.1

════════════════════════════════════════════════════════════════
DRAWING ANALYSIS — HOW TO USE THE PROVIDED FILES
════════════════════════════════════════════════════════════════

ARCHITECTURAL: Extract actual room dimensions, wall thicknesses, door/window schedules.
  If readable → use actual measurements (better than baseline).
  If not readable → use baseline values above.

STRUCTURAL: Extract actual footing dimensions, column grid, slab thickness.
  If readable → adjust concrete quantities accordingly.
  If not readable → use baseline values above.

MEP: Confirms L.S scope. If present → set 9.1, 9.2, 10.1–10.5, 11.1 to 1.
  If not provided → still set these to 1 (standard for Dubai villas).

SITE PLAN: Extract actual plot perimeter for compound wall (22.1).
  If readable → use actual perimeter minus 6m entrance.
  If not readable → use baseline ${compoundWall} R.M.

════════════════════════════════════════════════════════════════
COMPLETE BOQ TEMPLATE — FILL QUANTITIES FOR ALL ITEMS
════════════════════════════════════════════════════════════════
${TEMPLATE_SUMMARY}

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — RETURN ONLY VALID JSON, NO MARKDOWN, NO EXTRA TEXT
════════════════════════════════════════════════════════════════
{
  "analysis": "2–3 sentence summary: what drawings were reviewed, key dimensions found, and which values came from drawings vs estimates",
  "plot_area": ${plotArea},
  "floors": ${numFloors},
  "bedrooms": ${numBeds},
  "bathrooms": ${numBaths},
  "quantities": {
    ${ITEM_KEYS.split(', ').map(k => `"${k}": 0`).join(',\n    ')}
  }
}

FINAL CHECKLIST BEFORE OUTPUTTING:
✓ Every item listed above has a quantity (even if 0 for by-Owner / P.S items)
✓ Items 2.1, 2.2, 3.1, 3.2, 3.4, 3.9, 4.1, 4.2, 4.3, 5.1, 5.4, 6.1, 7.1, 8.1, 13.7, 15.1, 16.1, 22.1 are ALL > 0
✓ All L.S items (9.1, 9.2, 10.1–10.5, 11.1, etc.) are set to 1
✓ JSON is valid — no trailing commas, no comments`
}

// ── Category labels ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  architectural: '🏗 ARCHITECTURAL DRAWINGS',
  structural:    '⚙ STRUCTURAL DRAWINGS',
  mep:           '⚡ MEP DRAWINGS',
  site:          '🗺 SITE PLAN',
}

interface FileEntry {
  path:     string
  name:     string
  category: string
}

// ── Storage helpers ──────────────────────────────────────────────────────────
async function downloadFromStorage(path: string): Promise<ArrayBuffer | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) { console.error(`Download failed for ${path}:`, error?.message); return null }
  return data.arrayBuffer()
}

async function cleanupFiles(paths: string[]) {
  if (!supabaseAdmin || !paths.length) return
  await supabaseAdmin.storage.from(BUCKET).remove(paths).catch(() => {})
}

// ── Check whether AI result has usable quantities ────────────────────────────
function isMostlyZero(quantities: Record<string, number>): boolean {
  const mustBeNonZero = ['2.1','2.2','3.2','4.3','5.1','6.1','7.1','8.1','13.7','15.1','16.1','22.1']
  const zeros = mustBeNonZero.filter(k => !quantities[k] || quantities[k] === 0)
  return zeros.length >= 6  // if 6+ critical items are zero → treat as failed extraction
}

// ── Context-only fallback estimation ─────────────────────────────────────────
async function estimateFromContextOnly(params: {
  projectName: string; plotSize: string; floors: string; bedrooms: string; bathrooms: string; notes: string
}): Promise<Record<string, number>> {
  const plotArea  = Number(params.plotSize)  || 500
  const numFloors = Number(params.floors)    || 2
  const numBeds   = Number(params.bedrooms)  || 5
  const numBaths  = Number(params.bathrooms) || 4

  const prompt = buildSystemPrompt(plotArea, numFloors, numBeds, numBaths)

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 6000,
    system:     prompt,
    messages: [{
      role: 'user',
      content: `No drawing files were provided or they could not be read.
Estimate ALL quantities using ONLY the project context and the pre-computed baseline values in your instructions.

Project: ${params.projectName}
Plot size: ${plotArea} M2  |  Floors: ${numFloors}  |  Bedrooms: ${numBeds}  |  Bathrooms: ${numBaths}
Notes: ${params.notes || 'None'}

Use the baseline quantities from your system prompt. Output the full JSON now.`,
    }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const match   = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return {}
  const parsed = JSON.parse(match[0])
  return parsed.quantities ?? {}
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const uploadedPaths: string[] = []

  try {
    const body = await req.json()
    const {
      files        = [] as FileEntry[],
      projectName  = 'Villa Project',
      ownerName    = '',
      plotSize     = '500',
      floors       = '2',
      bedrooms     = '5',
      bathrooms    = '4',
      notes        = '',
    } = body

    const plotArea  = Number(plotSize)  || 500
    const numFloors = Number(floors)    || 2
    const numBeds   = Number(bedrooms)  || 5
    const numBaths  = Number(bathrooms) || 4

    if (!Array.isArray(files) || files.length === 0) {
      // No files — go straight to context-only estimation
      const quantities = await estimateFromContextOnly({ projectName, plotSize, floors, bedrooms, bathrooms, notes })
      const items = applyQuantities(quantities)
      return NextResponse.json({
        success:   true,
        analysis:  `No drawing files provided. BOQ estimated from project context: ${plotArea} M2 plot, ${numFloors} floor(s), ${numBeds} bedrooms, ${numBaths} bathrooms.`,
        plot_area: plotArea,
        floors:    numFloors,
        bedrooms:  numBeds,
        bathrooms: numBaths,
        items,
        skipped:   [],
      })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 })
    }

    files.forEach((f: FileEntry) => uploadedPaths.push(f.path))

    // ── Group files by category ─────────────────────────────────────────────
    const grouped: Record<string, FileEntry[]> = {
      architectural: [], structural: [], mep: [], site: [],
    }
    for (const f of files as FileEntry[]) {
      const cat = f.category ?? 'architectural'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(f)
    }

    // ── Build Claude message content ────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    const skipped: string[] = []
    let filesAttached = 0

    for (const [cat, entries] of Object.entries(grouped)) {
      if (!entries.length) continue

      content.push({
        type: 'text',
        text: `\n${'═'.repeat(60)}\n${CATEGORY_LABELS[cat] ?? cat.toUpperCase()} — ${entries.length} file(s)\n${'═'.repeat(60)}`,
      })

      for (const f of entries) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        content.push({ type: 'text', text: `File: ${f.name}` })

        const buffer = await downloadFromStorage(f.path)
        if (!buffer) {
          skipped.push(f.name)
          content.push({ type: 'text', text: `[Could not download "${f.name}" — will use baseline estimates for this category]` })
          continue
        }

        const base64 = Buffer.from(buffer).toString('base64')

        if (ext === 'pdf') {
          content.push({
            type:   'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          })
          filesAttached++
        } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          const mediaType =
            ext === 'png'  ? 'image/png'  :
            ext === 'webp' ? 'image/webp' : 'image/jpeg'
          content.push({
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          })
          filesAttached++
        } else {
          content.push({ type: 'text', text: `[Unsupported file type: .${ext} — will use baseline estimates]` })
        }
      }
    }

    // ── Final instruction with explicit context ─────────────────────────────
    const categoriesPresent = Object.entries(grouped)
      .filter(([, v]) => v.length)
      .map(([k]) => k)
      .join(', ')

    content.push({
      type: 'text',
      text: `
════════════════════════════════════════════════════════════════
YOUR TASK
════════════════════════════════════════════════════════════════
Project: ${projectName}
Owner:   ${ownerName || 'Not specified'}
Plot size: ${plotArea} M2  |  Floors: ${numFloors}  |  Bedrooms: ${numBeds}  |  Bathrooms: ${numBaths}
Notes: ${notes || 'None'}
Drawings: ${filesAttached} file(s) attached (${categoriesPresent})
${skipped.length ? `Could not load: ${skipped.join(', ')} — use baseline values for these` : ''}

INSTRUCTIONS:
1. Examine every drawing file provided above.
2. Extract actual dimensions where visible. If a drawing is blurry or unreadable, use the pre-computed baseline values from your system prompt instead.
3. For EVERY item in the BOQ template, output a realistic quantity.
4. CRITICAL: Do NOT output 0 for structural, concrete, block, plaster, tiles, paint, aluminium, or compound wall items.
5. Use the pre-computed baseline values from your system prompt as a floor — actual drawing measurements may increase them, never decrease them to 0.
6. Return ONLY the JSON object. No markdown fences, no explanation text, no preamble.`,
    })

    // ── Call Claude (with drawing files) ────────────────────────────────────
    const systemPrompt = buildSystemPrompt(plotArea, numFloors, numBeds, numBaths)

    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-5',
      max_tokens: 8000,
      system:     systemPrompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages:   [{ role: 'user', content }] as any,
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    console.log('Claude raw response (first 500):', rawText.slice(0, 500))

    // ── Parse response ──────────────────────────────────────────────────────
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
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      console.error('JSON parse failed, raw response:', rawText.slice(0, 1000))
      // Fall back to context-only estimation
      console.log('Falling back to context-only estimation...')
      const quantities = await estimateFromContextOnly({ projectName, plotSize, floors, bedrooms, bathrooms, notes })
      await cleanupFiles(uploadedPaths)
      return NextResponse.json({
        success:   true,
        analysis:  `Drawing analysis failed — BOQ estimated from project context (${plotArea} M2 plot, ${numFloors} floors, ${numBeds} bedrooms).`,
        plot_area: plotArea,
        floors:    numFloors,
        bedrooms:  numBeds,
        bathrooms: numBaths,
        items:     applyQuantities(quantities),
        skipped,
      })
    }

    // ── If Claude returned mostly zeros, retry with context-only ────────────
    if (isMostlyZero(parsed.quantities ?? {})) {
      console.log('AI returned mostly zeros — retrying with context-only estimation')
      const fallbackQty = await estimateFromContextOnly({ projectName, plotSize, floors, bedrooms, bathrooms, notes })
      // Merge: use fallback only for the zero items, keep any non-zero from drawing analysis
      const mergedQty: Record<string, number> = { ...fallbackQty }
      for (const [k, v] of Object.entries(parsed.quantities ?? {})) {
        if (v > 0) mergedQty[k] = v  // drawing gave real value → keep it
      }
      parsed.quantities = mergedQty
      parsed.analysis   = (parsed.analysis || '') +
        ' (Note: quantities estimated from project context as drawings could not be fully analyzed.)'
    }

    const items = applyQuantities(parsed.quantities ?? {})
    await cleanupFiles(uploadedPaths)

    return NextResponse.json({
      success:   true,
      analysis:  parsed.analysis  ?? `Analyzed ${filesAttached} drawing(s).`,
      plot_area: (parsed.plot_area ?? plotArea)  || plotArea,
      floors:    (parsed.floors    ?? numFloors) || numFloors,
      bedrooms:  (parsed.bedrooms  ?? numBeds)   || numBeds,
      bathrooms: (parsed.bathrooms ?? numBaths)  || numBaths,
      items,
      skipped,
    })

  } catch (err) {
    await cleanupFiles(uploadedPaths).catch(() => {})
    console.error('Estimation engineer error:', err)
    return NextResponse.json(
      { error: 'Failed to analyze drawings: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
