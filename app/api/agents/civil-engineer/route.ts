/**
 * Civil Engineer AI Agent
 * POST /api/agents/civil-engineer
 *
 * Phase 1 — Claude reads drawings and extracts raw dimensions
 * Phase 2 — Server applies standard formulas to those dimensions
 *
 * Accepts JSON: { files: [{path, name, category}], projectName, ownerName,
 *                plotSize, floors, bedrooms, bathrooms, notes }
 *
 * Files were uploaded to Supabase Storage via signed URLs.
 * Returns: { success, extraction, items } where items have unitRate = 0
 * (user fills in rates manually in the BOQ editor).
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase'
import { BOQ_TEMPLATE } from '@/lib/boq-template'

export const maxDuration = 60

const BUCKET = 'estimation-drawings'

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function downloadFile(path: string): Promise<Buffer | null> {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (error || !data) {
    console.error(`[civil-engineer] download failed for ${path}:`, error?.message)
    return null
  }
  return Buffer.from(await data.arrayBuffer())
}

async function cleanupFiles(paths: string[]) {
  if (!supabaseAdmin || !paths.length) return
  await supabaseAdmin.storage.from(BUCKET).remove(paths).catch(() => {})
}

// ── Claude extraction prompt ──────────────────────────────────────────────────
const EXTRACTION_SYSTEM = `You are an expert civil engineer with 20 years of experience reading Dubai villa construction drawings.

TASK: Examine every drawing carefully and extract every dimension, area, count and measurement that you can clearly see.
Report ONLY values you can read directly from the drawings. Set a field to null if you cannot clearly see it.

WHAT TO LOOK FOR:

ARCHITECTURAL (floor plans, elevations, sections, roof plan):
- Plot dimensions and total area from title block or site plan
- Room labels with dimensions (e.g. "MASTER BED: 5.0 x 4.5")
- Total floor area per level (sometimes shown as GFA in m²)
- External building dimensions (overall length × width)
- Floor-to-floor height from sections
- Door schedule or door count per floor
- Window schedule or window count
- Balcony / terrace areas
- Stair dimensions

STRUCTURAL (foundation plan, column schedule, beam schedule, slab details):
- Foundation type: raft, isolated pad, strip
- Raft or footing thickness (mm) from sections/details
- Footing depth below ground level (m)
- Column grid spacing (e.g. 5.0m × 4.5m)
- Column cross-section size (mm × mm) from schedule
- Number of columns per floor (count from plan)
- Beam depth (mm) from schedule or section
- Slab thickness (mm) from notes or detail

DRAINAGE / MEP (plumbing, electrical, HVAC):
- Confirm which services are shown (electrical ✓, plumbing ✓, AC ✓)
- Sanitary fixture count per floor if shown

SITE PLAN:
- Plot boundary dimensions (length × width)
- Total plot area
- Compound wall perimeter (annotated or measurable)
- Entrance gate width

RETURN ONLY this JSON object — no markdown fences, no extra text:
{
  "plot_area_m2": null,
  "plot_length_m": null,
  "plot_width_m": null,
  "plot_perimeter_m": null,
  "gf_area_m2": null,
  "ff_area_m2": null,
  "sf_area_m2": null,
  "total_floor_area_m2": null,
  "num_floors": null,
  "external_perimeter_m": null,
  "floor_height_m": null,
  "slab_thickness_mm": null,
  "footing_type": null,
  "footing_depth_m": null,
  "raft_thickness_mm": null,
  "column_size_mm": null,
  "column_count_per_floor": null,
  "beam_depth_mm": null,
  "num_bedrooms": null,
  "num_bathrooms": null,
  "num_doors_total": null,
  "num_windows_total": null,
  "compound_wall_m": null,
  "balcony_area_m2": null,
  "stair_width_m": null,
  "has_electrical": null,
  "has_plumbing": null,
  "has_ac": null,
  "notes": "describe what you could and could not read from each drawing"
}`

// ── Extracted dimensions type ─────────────────────────────────────────────────
interface Extracted {
  plot_area_m2?:          number | null
  plot_length_m?:         number | null
  plot_width_m?:          number | null
  plot_perimeter_m?:      number | null
  gf_area_m2?:            number | null
  ff_area_m2?:            number | null
  sf_area_m2?:            number | null
  total_floor_area_m2?:   number | null
  num_floors?:            number | null
  external_perimeter_m?:  number | null
  floor_height_m?:        number | null
  slab_thickness_mm?:     number | null
  footing_type?:          string | null
  footing_depth_m?:       number | null
  raft_thickness_mm?:     number | null
  column_size_mm?:        string | null
  column_count_per_floor?: number | null
  beam_depth_mm?:         number | null
  num_bedrooms?:          number | null
  num_bathrooms?:         number | null
  num_doors_total?:       number | null
  num_windows_total?:     number | null
  compound_wall_m?:       number | null
  balcony_area_m2?:       number | null
  stair_width_m?:         number | null
  has_electrical?:        boolean | null
  has_plumbing?:          boolean | null
  has_ac?:                boolean | null
  notes?:                 string
}

// ── BOQ calculator using extracted dimensions ─────────────────────────────────
function calculateFromExtraction(
  ex:        Extracted,
  fallback:  { plotArea: number; numFloors: number; numBeds: number; numBaths: number },
): Record<string, number> {

  // Resolve each dimension: extracted value > fallback
  const plotArea     = ex.plot_area_m2       || fallback.plotArea
  const numFloors    = ex.num_floors         || fallback.numFloors
  const numBeds      = ex.num_bedrooms       || fallback.numBeds
  const numBaths     = ex.num_bathrooms      || fallback.numBaths
  const floorHt      = ex.floor_height_m     || 3.2
  const slabThickM   = (ex.slab_thickness_mm || 200) / 1000
  const raftThickM   = (ex.raft_thickness_mm || 400) / 1000
  const footDepth    = ex.footing_depth_m    || 1.5

  // Floor areas — prefer extracted, else derive from plot
  const footprint    = ex.gf_area_m2         || Math.round(plotArea * 0.55)
  const totalBFA: number = (() => {
    if (ex.total_floor_area_m2) return ex.total_floor_area_m2
    const gf = ex.gf_area_m2 || footprint
    const ff = ex.ff_area_m2 || (numFloors >= 2 ? footprint : 0)
    const sf = ex.sf_area_m2 || (numFloors >= 3 ? footprint : 0)
    return gf + ff + sf
  })()

  // Perimeters
  const extPerim  = ex.external_perimeter_m || (4 * Math.sqrt(footprint))
  const plotPerim = ex.plot_perimeter_m      || (4 * Math.sqrt(plotArea))

  // Column count per floor
  const colCount  = ex.column_count_per_floor || Math.round(footprint / 20)

  // Column cross-section area (m²)
  const colSize   = ex.column_size_mm || '300x300'
  const [cw, cd]  = colSize.split(/[xX×]/).map(Number)
  const colArea   = ((cw || 300) / 1000) * ((cd || 300) / 1000)

  // External wall area
  const extWallArea = extPerim * floorHt * numFloors

  // Door / window counts
  const doorCount = ex.num_doors_total  || (numBeds + numBaths + 4)  // beds + baths + 4 common doors
  const winCount  = ex.num_windows_total || Math.round(extPerim * 0.5)

  // ── Calculate quantities ───────────────────────────────────────────────────

  // 1. MOBILIZATION
  const mob = { '1.1':1, '1.2':1, '1.3':1, '1.4':1, '1.5':1, '1.6':0 }

  // 2. EXCAVATION
  const excDepth   = footDepth + 0.5          // footing depth + working space
  const excavation = Math.round(footprint * excDepth)
  const backfill   = Math.round(footprint * footDepth * 0.5)
  const exc = { '2.1':excavation, '2.2':backfill, '2.3':0, '2.4':0, '2.5':0, '2.6':0 }

  // 3. SUBSTRUCTURE
  const pcc      = Math.max(3,  Math.round(extPerim * 0.3 * 0.15))
  const raft     = Math.round(footprint * raftThickM)
  const neckCols = Math.max(2,  Math.round(colCount * colArea * 1.2))
  const tieBeams = Math.max(5,  Math.round(extPerim * 0.3 * 0.5))
  const solidBlk = Math.round(extPerim * 0.6)
  const gradeSlab= Math.round(footprint * 0.15)
  const sub = {
    '3.1':pcc, '3.2':raft, '3.3':neckCols, '3.4':tieBeams,
    '3.5':solidBlk, '3.6':1, '3.7':1, '3.8':1, '3.9':gradeSlab, '3.10':0,
  }

  // 4. SUPER STRUCTURE
  const rccCols   = Math.max(5, Math.round(colCount * colArea * floorHt * numFloors))
  const rccBeams  = Math.max(8, Math.round(extPerim * numFloors * 0.3 * ((ex.beam_depth_mm||500)/1000)))
  const rccSlab   = Math.round(totalBFA * slabThickM)
  const rccStair  = numFloors >= 3 ? 35 : numFloors === 2 ? 25 : 18
  const parapBlk  = Math.round(extPerim * 1.2)
  const parapRCC  = Math.max(3, Math.round(extPerim * 0.18))
  const decor     = Math.max(3, Math.round(extPerim * 0.25))
  const strips    = Math.max(2, Math.round(extPerim * 0.12))
  const lintels   = Math.max(2, Math.round(extPerim * 0.08))
  const sup = {
    '4.1':rccCols, '4.2':rccBeams, '4.3':rccSlab, '4.4':0,
    '4.5':decor, '4.6':rccStair, '4.7':parapBlk, '4.8':parapRCC,
    '4.9':strips, '4.10':lintels, '4.11':0,
  }

  // 5. BLOCK WORKS
  const thermalBlk = Math.round(extWallArea * 0.70)
  const hollow20   = Math.round(totalBFA * 1.60)
  const hollow10   = Math.round(hollow20 * 0.30)
  const blk = { '5.1':thermalBlk, '5.2':hollow10, '5.3':0, '5.4':hollow20, '5.5':0, '5.6':0 }

  // 6 & 7. PLASTER
  const intPlaster  = Math.round(totalBFA * 3.5)
  const extPlaster  = Math.round(extWallArea * 1.10)
  const parapPlstr  = Math.round(extPerim * 1.2)
  const stoneWork   = Math.round(extWallArea * 0.40)
  const plstr = {
    '6.1':intPlaster, '6.2':0,
    '7.1':extPlaster, '7.2':parapPlstr, '7.3':stoneWork,
  }

  // 8. WATERPROOFING
  const wp = { '8.1':Math.round(footprint), '8.2':numBaths*10, '8.3':0 }

  // 9. ELECTRICAL
  const elec = { '9.1':1, '9.2':1 }

  // 10. PLUMBING
  const otherBeds = Math.max(0, numBeds-1)
  const plmb = {
    '10.1':1, '10.2':1, '10.3':1, '10.4':0, '10.5':1,
    '10.7':1, '10.8':otherBeds, '10.9':1, '10.11':numBeds, '10.12':1,
  }

  // 11. AC
  const ac = { '11.1':1, '11.2':0, '11.3':0 }

  // 12. FIRE ALARM
  const fire = { '12.1':0 }

  // 13. TILES
  const graniteEnt  = Math.round(footprint * 0.12)
  const marbleSteps = Math.round(numFloors * 12 * 0.45)
  const ceramicFlr  = Math.round(totalBFA * 0.60)
  const bathFlr     = numBaths * 6
  const bathWall    = numBaths * 12
  const tiles = {
    '13.1':graniteEnt, '13.6':marbleSteps, '13.7':ceramicFlr,
    '13.8':1, '13.11':bathFlr, '13.12':bathWall, '13.13':15,
  }

  // 15 & 16. PAINT
  const paint = {
    '15.1':Math.round(intPlaster*1.05), '15.2':0,
    '16.1':extPlaster, '16.2':parapPlstr,
  }

  // 17. FALSE CEILING
  const ceil = { '17.1':0 }

  // 19. ALUMINIUM
  const curtainWall = Math.round(extWallArea * 0.20)
  const alumWin     = Math.round(extWallArea * 0.12)
  const handrails   = numFloors===1 ? 45 : numFloors===2 ? 60 : 80
  const alum = { '19.1':curtainWall, '19.2':handrails, '19.3':alumWin }

  // 20. JOINERY — use actual door count if extracted
  const bedroomDoors  = ex.num_bedrooms  ? numBeds  : Math.min(numBeds,  doorCount)
  const bathroomDoors = ex.num_bathrooms ? numBaths : Math.min(numBaths, doorCount)
  const join = { '20.3':bedroomDoors, '20.4':bathroomDoors }

  // 21. METAL
  const metal = { '21.1':1, '21.2':1, '21.3':1, '21.4':1, '21.5':0 }

  // 22. COMPOUND WALL — use extracted length if found
  const compWall = ex.compound_wall_m
    ? Math.round(ex.compound_wall_m)
    : Math.max(10, Math.round(plotPerim - 6))
  const comp = { '22.1':compWall }

  // 23. EXTERNAL
  const ext = { '23.1':0, '23.3':1, '23.5':1 }

  // 24. PROVISIONAL
  const prov = {
    '24.1':1,'24.2':0,'24.3':0,'24.4':0,'24.5':0,
    '24.6':0,'24.7':0,'24.8':0,'24.9':0,'24.10':0,
  }

  return {
    ...mob,...exc,...sub,...sup,...blk,...plstr,...wp,...elec,...plmb,...ac,
    ...fire,...tiles,...paint,...ceil,...alum,...join,...metal,...comp,...ext,...prov,
  }
}

// ── Apply quantities with zero rates (user fills rates) ───────────────────────
function buildItemsZeroRates(quantities: Record<string, number>) {
  return BOQ_TEMPLATE.map(item => ({
    ...item,
    unitRate: 0,
    quantity: quantities[item.itemNo] ?? 0,
    amount:   0,   // rate × qty — both 0 until user fills rate
    progress: 0,
  }))
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const uploadedPaths: string[] = []

  try {
    const body = await req.json()
    const {
      files       = [] as Array<{ path: string; name: string; category: string }>,
      projectName = 'Villa Project',
      ownerName   = '',
      plotSize    = '500',
      floors      = '2',
      bedrooms    = '5',
      bathrooms   = '4',
      notes       = '',
    } = body

    const fallback = {
      plotArea:  Math.max(50,  Number(plotSize)  || 500),
      numFloors: Math.max(1,   Number(floors)    || 2),
      numBeds:   Math.max(1,   Number(bedrooms)  || 5),
      numBaths:  Math.max(1,   Number(bathrooms) || 4),
    }

    // ── If no files — run formula calculator only ─────────────────────────────
    if (!Array.isArray(files) || files.length === 0) {
      const qty   = calculateFromExtraction({}, fallback)
      const items = buildItemsZeroRates(qty)
      return NextResponse.json({
        success:    true,
        extraction: { notes: 'No drawings provided — quantities estimated from project inputs.' },
        analysis:   `BOQ generated from project inputs: ${fallback.plotArea} M² plot, ${fallback.numFloors} floor(s).`,
        items,
      })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Storage not configured.' }, { status: 500 })
    }

    files.forEach((f) => uploadedPaths.push(f.path))

    // ── Build Claude content blocks ───────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = []
    const loaded: string[] = []
    const failed: string[] = []

    const categoryLabel: Record<string, string> = {
      architectural: '🏗 ARCHITECTURAL',
      structural:    '⚙ STRUCTURAL',
      mep:           '⚡ MEP / DRAINAGE',
      site:          '🗺 SITE PLAN',
    }

    // Group by category for clear section headers
    const byCategory: Record<string, typeof files> = {}
    for (const f of files) {
      const cat = f.category || 'architectural'
      ;(byCategory[cat] = byCategory[cat] || []).push(f)
    }

    for (const [cat, entries] of Object.entries(byCategory)) {
      content.push({ type:'text', text:`\n${'═'.repeat(50)}\n${categoryLabel[cat]||cat.toUpperCase()} (${entries.length} file(s))\n${'═'.repeat(50)}` })

      for (const f of entries) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        content.push({ type:'text', text:`File: ${f.name}` })

        const buf = await downloadFile(f.path)
        if (!buf) {
          failed.push(f.name)
          content.push({ type:'text', text:`[Could not load "${f.name}" — skipped]` })
          continue
        }

        const b64 = buf.toString('base64')
        loaded.push(f.name)

        if (ext === 'pdf') {
          content.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } })
        } else if (['jpg','jpeg','png','webp'].includes(ext)) {
          const mt = ext==='png' ? 'image/png' : ext==='webp' ? 'image/webp' : 'image/jpeg'
          content.push({ type:'image', source:{ type:'base64', media_type:mt, data:b64 } })
        } else {
          content.push({ type:'text', text:`[Unsupported type .${ext} — skipped]` })
          failed.push(f.name)
        }
      }
    }

    // ── Final instruction ─────────────────────────────────────────────────────
    content.push({
      type:'text',
      text:`
${'═'.repeat(50)}
PROJECT CONTEXT (for reference / cross-check)
${'═'.repeat(50)}
Project: ${projectName}
Owner: ${ownerName || '—'}
Plot size (approx): ${fallback.plotArea} M²
Floors: ${fallback.numFloors}   Bedrooms: ${fallback.numBeds}   Bathrooms: ${fallback.numBaths}
Notes: ${notes || 'none'}
Files loaded: ${loaded.join(', ') || 'none'}
Files failed: ${failed.join(', ') || 'none'}

Now extract all dimensions from the drawings above.
Set each field to null if you cannot clearly see it.
Return ONLY the JSON object. No markdown, no explanation.`
    })

    // ── Call Claude ───────────────────────────────────────────────────────────
    console.log(`[civil-engineer] sending ${loaded.length} files to Claude`)
    const resp = await anthropic.messages.create({
      model:     'claude-opus-4-5',
      max_tokens: 4000,
      system:    EXTRACTION_SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages:  [{ role:'user', content }] as any,
    })

    const raw = resp.content[0].type === 'text' ? resp.content[0].text : ''
    console.log('[civil-engineer] raw response:', raw.slice(0, 600))

    // ── Parse extraction ──────────────────────────────────────────────────────
    let ex: Extracted = {}
    try {
      const clean = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      if (match) ex = JSON.parse(match[0])
    } catch {
      console.warn('[civil-engineer] failed to parse extraction JSON — using fallback')
    }

    // ── Calculate BOQ from extracted dimensions ───────────────────────────────
    const quantities = calculateFromExtraction(ex, fallback)
    const items      = buildItemsZeroRates(quantities)

    // Build a human-readable summary of what was extracted
    const extracted: string[] = []
    if (ex.plot_area_m2)          extracted.push(`Plot ${ex.plot_area_m2} M²`)
    if (ex.total_floor_area_m2)   extracted.push(`BFA ${ex.total_floor_area_m2} M²`)
    if (ex.external_perimeter_m)  extracted.push(`perimeter ${ex.external_perimeter_m} m`)
    if (ex.num_bedrooms)          extracted.push(`${ex.num_bedrooms} bedrooms`)
    if (ex.num_bathrooms)         extracted.push(`${ex.num_bathrooms} bathrooms`)
    if (ex.compound_wall_m)       extracted.push(`compound wall ${ex.compound_wall_m} m`)
    if (ex.slab_thickness_mm)     extracted.push(`slab ${ex.slab_thickness_mm} mm`)
    if (ex.raft_thickness_mm)     extracted.push(`raft ${ex.raft_thickness_mm} mm`)
    if (ex.column_count_per_floor)extracted.push(`${ex.column_count_per_floor} columns/floor`)

    const analysis = extracted.length
      ? `Extracted from drawings: ${extracted.join(' · ')}. ${ex.notes || ''}`
      : `Drawings analyzed — ${ex.notes || 'quantities derived from project context.'}`

    await cleanupFiles(uploadedPaths)

    return NextResponse.json({
      success:    true,
      extraction: ex,
      analysis,
      items,
    })

  } catch (err) {
    await cleanupFiles(uploadedPaths).catch(() => {})
    console.error('[civil-engineer] error:', err)
    return NextResponse.json(
      { error: 'Analysis failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
