/**
 * BOQ Quantity Calculator
 * POST /api/agents/estimation-engineer
 *
 * Pure formula-based calculation — no AI, no file reading.
 * Accepts: { projectName, ownerName, plotNo, plotSize, floors, bedrooms, bathrooms, notes }
 * Returns: { success, analysis, items }
 *
 * All quantities are derived from standard Dubai villa construction ratios.
 */
import { NextRequest, NextResponse } from 'next/server'
import { applyQuantities } from '@/lib/boq-template'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────────────────────
// Core quantity calculator
// ─────────────────────────────────────────────────────────────────────────────
function calculateQuantities(
  plotArea:  number,
  numFloors: number,
  numBeds:   number,
  numBaths:  number,
): Record<string, number> {

  // ── Derived measurements ───────────────────────────────────────────────────
  const footprint     = plotArea * 0.55                       // 55 % built coverage
  const totalBFA      = footprint * numFloors                 // total built floor area
  const extPerimeter  = 4 * Math.sqrt(footprint)             // external wall perimeter (m)
  const plotPerimeter = 4 * Math.sqrt(plotArea)              // plot boundary (m)
  const roofArea      = footprint                            // top slab = footprint
  const floorHt       = 3.2                                  // floor-to-floor height (m)
  const numCols       = Math.round(footprint / 20)           // 1 column per 20 m²
  const extWallArea   = extPerimeter * floorHt * numFloors   // gross external wall face (m²)

  // ── 1. MOBILIZATION ───────────────────────────────────────────────────────
  const mob: Record<string, number> = {
    '1.1': 1,   // Temp water connection
    '1.2': 1,   // Site office & fence
    '1.3': 1,   // DM fees
    '1.4': 1,   // Demolish temp offices
    '1.5': 1,   // Cleaning on completion
    '1.6': 0,   // Demolishing work (existing structure) — not applicable by default
  }

  // ── 2. EXCAVATION & BACKFILL ──────────────────────────────────────────────
  const excavation = Math.round(footprint * 2.0)             // 2 m depth (user spec)
  const backfill   = Math.round(footprint * 0.9)             // soil replaced around foundation
  const exc: Record<string, number> = {
    '2.1': excavation,
    '2.2': backfill,
    '2.3': 0,   // selected soil — allow owner to adjust
    '2.4': 0,   // soil replacement if required
    '2.5': 0,   // road base if required
    '2.6': 0,   // dewatering if required
  }

  // ── 3. SUBSTRUCTURE ───────────────────────────────────────────────────────
  const pcc       = Math.max(3, Math.round(extPerimeter * 0.3 * 0.15))
  const raft      = Math.round(footprint * 0.4)
  const neckCols  = Math.max(2, Math.round(numCols * 0.09 * 1.2))
  const tieBeams  = Math.max(5, Math.round(extPerimeter * 0.3 * 0.5))
  const solidBlk  = Math.round(extPerimeter * 0.6)           // sub-grade block
  const gradeSlab = Math.round(footprint * 0.15)
  const sub: Record<string, number> = {
    '3.1': pcc,
    '3.2': raft,
    '3.3': neckCols,
    '3.4': tieBeams,
    '3.5': solidBlk,
    '3.6': 1,   // Bitumen paint (L.S)
    '3.7': 1,   // Polygene sheet (L.S)
    '3.8': 1,   // Anti-termite (L.S)
    '3.9': gradeSlab,
    '3.10': 0,  // Water tank structure — if required
  }

  // ── 4. SUPER STRUCTURE ────────────────────────────────────────────────────
  const rccCols  = Math.max(5,  Math.round(numCols * 0.09 * floorHt * numFloors))
  const rccBeams = Math.max(8,  Math.round(extPerimeter * numFloors * 0.3 * 0.5))
  const rccSlab  = Math.round(totalBFA * 0.2)
  const rccStair = numFloors >= 3 ? 35 : numFloors === 2 ? 25 : 18
  const parapetBlock = Math.round(extPerimeter * 1.2)        // parapet 1.2 m high
  const parapetRCC   = Math.max(3, Math.round(extPerimeter * 0.18))
  const decoration   = Math.max(3, Math.round(extPerimeter * 0.25))  // facade concrete
  const strips       = Math.max(2, Math.round(extPerimeter * 0.12))
  const lintels      = Math.max(2, Math.round(extPerimeter * 0.08))
  const sup: Record<string, number> = {
    '4.1':  rccCols,
    '4.2':  rccBeams,
    '4.3':  rccSlab,
    '4.4':  0,   // post-tension if required
    '4.5':  decoration,
    '4.6':  rccStair,
    '4.7':  parapetBlock,
    '4.8':  parapetRCC,
    '4.9':  strips,
    '4.10': lintels,
    '4.11': 0,   // elevation projections — provisional
  }

  // ── 5. BLOCK WORKS ────────────────────────────────────────────────────────
  // External thermal block: perimeter × height × floors, minus 30% for openings
  const thermalBlock  = Math.round(extWallArea * 0.70)
  // 20 cm hollow: main internal walls = BFA × 1.6 (running meter factor × height)
  const hollow20      = Math.round(totalBFA * 1.60)
  // 10 cm hollow: lightweight partitions = 30% of 20 cm
  const hollow10      = Math.round(hollow20 * 0.30)
  const blk: Record<string, number> = {
    '5.1': thermalBlock,
    '5.2': hollow10,
    '5.3': 0,
    '5.4': hollow20,
    '5.5': 0,
    '5.6': 0,
  }

  // ── 6 & 7. PLASTER ───────────────────────────────────────────────────────
  // Internal plaster = total internal wall faces (both sides) + internal face of ext walls
  const intPlaster      = Math.round(totalBFA * 3.5)         // ~3.5 × BFA rule of thumb
  const extPlaster      = Math.round(extWallArea * 1.10)
  const parapetIntPlstr = Math.round(extPerimeter * 1.2)
  const stoneWork       = Math.round(extWallArea * 0.40)     // 40% facade with stone
  const plstr: Record<string, number> = {
    '6.1': intPlaster,
    '6.2': 0,
    '7.1': extPlaster,
    '7.2': parapetIntPlstr,
    '7.3': stoneWork,
  }

  // ── 8. WATERPROOFING ─────────────────────────────────────────────────────
  const wp: Record<string, number> = {
    '8.1': Math.round(roofArea),      // roof slab
    '8.2': numBaths * 10,             // wet areas 10 m² per bathroom
    '8.3': 0,
  }

  // ── 9. ELECTRICAL ────────────────────────────────────────────────────────
  const elec: Record<string, number> = {
    '9.1': 1,   // DEWA electrical works
    '9.2': 1,   // Etisalat
  }

  // ── 10. PLUMBING ─────────────────────────────────────────────────────────
  const otherBedrooms = Math.max(0, numBeds - 1)
  const plmb: Record<string, number> = {
    '10.1':  1,              // plumbing & drainage
    '10.2':  1,              // roof water tank
    '10.3':  1,              // pumps
    '10.4':  0,              // septic tank if required
    '10.5':  1,              // solar heater
    '10.7':  1,              // master bedroom sanitary
    '10.8':  otherBedrooms, // other bedrooms
    '10.9':  1,              // dining bathroom
    '10.11': numBeds,       // wash basin counters (L.M = 1 per bed)
    '10.12': 1,              // service block bathroom
  }

  // ── 11. AIR CONDITIONING ─────────────────────────────────────────────────
  const ac: Record<string, number> = {
    '11.1': 1,   // AC civil works
    '11.2': 0,   // supply & install (by owner)
    '11.3': 0,   // ventilation fans (if required)
  }

  // ── 12. FIRE ALARM ───────────────────────────────────────────────────────
  const fire: Record<string, number> = {
    '12.1': 0,   // by owner / provisional
  }

  // ── 13. TILES & FLOORING ─────────────────────────────────────────────────
  // Ceramic floor: living/bed/corridor areas = 60% of BFA
  const ceramicFloor     = Math.round(totalBFA * 0.60)
  const graniteEntrance  = Math.round(footprint * 0.12)
  const marbleSteps      = Math.round(numFloors * 12 * 0.45) // 12 steps × 0.45 m² each
  const ceramicBathFloor = numBaths * 6
  const ceramicBathWall  = numBaths * 12
  const tiles: Record<string, number> = {
    '13.1':  graniteEntrance,
    '13.6':  marbleSteps,
    '13.7':  ceramicFloor,
    '13.8':  1,              // ceramic skirting (L.S)
    '13.11': ceramicBathFloor,
    '13.12': ceramicBathWall,
    '13.13': 15,             // maid & store room
  }

  // ── 15 & 16. PAINT ───────────────────────────────────────────────────────
  const paint: Record<string, number> = {
    '15.1': Math.round(intPlaster * 1.05),
    '15.2': 0,
    '16.1': extPlaster,
    '16.2': parapetIntPlstr,
  }

  // ── 17. FALSE CEILING ────────────────────────────────────────────────────
  const ceil: Record<string, number> = {
    '17.1': 0,   // by owner
  }

  // ── 19. ALUMINIUM ─────────────────────────────────────────────────────────
  // Curtain wall: feature windows + main door (20% of ext wall area)
  const curtainWall = Math.round(extWallArea * 0.20)
  // Regular aluminium windows (12% of ext wall area)
  const alumWindows = Math.round(extWallArea * 0.12)
  // Handrails: staircase + balconies
  const handrails   = numFloors === 1 ? 45 : numFloors === 2 ? 60 : 80
  const alum: Record<string, number> = {
    '19.1': curtainWall,
    '19.2': handrails,
    '19.3': alumWindows,
  }

  // ── 20. JOINERY ──────────────────────────────────────────────────────────
  const join: Record<string, number> = {
    '20.3': numBeds,   // bedroom doors (N.O)
    '20.4': numBaths,  // bathroom doors (N.O)
  }

  // ── 21. METAL WORKS ──────────────────────────────────────────────────────
  const metal: Record<string, number> = {
    '21.1': 1,   // main gate
    '21.2': 1,   // person gate
    '21.3': 1,   // car shade
    '21.4': 1,   // cat ladder / roof access
    '21.5': 0,   // aluminium cladding (if required)
  }

  // ── 22. COMPOUND WALL ────────────────────────────────────────────────────
  // Plot perimeter minus one entrance (6 m)
  const compoundWall = Math.max(10, Math.round(plotPerimeter - 6))
  const comp: Record<string, number> = {
    '22.1': compoundWall,
  }

  // ── 23. EXTERNAL FINISHING ───────────────────────────────────────────────
  const ext: Record<string, number> = {
    '23.1': 0,   // interlock tiles (by owner)
    '23.3': 1,   // kerb stone (L.S)
    '23.5': 1,   // manhole work (L.S)
  }

  // ── 24. PROVISIONAL SUMS ─────────────────────────────────────────────────
  const prov: Record<string, number> = {
    '24.1': 1,   // light fittings
    '24.2': 0,
    '24.3': 0,
    '24.4': 0,
    '24.5': 0,
    '24.6': 0,
    '24.7': 0,
    '24.8': 0,
    '24.9': 0,
    '24.10': 0,
  }

  return {
    ...mob, ...exc, ...sub, ...sup, ...blk,
    ...plstr, ...wp, ...elec, ...plmb, ...ac,
    ...fire, ...tiles, ...paint, ...ceil, ...alum,
    ...join, ...metal, ...comp, ...ext, ...prov,
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body        = await req.json()
    const plotArea    = Math.max(50, Number(body.plotSize)  || 500)
    const numFloors   = Math.max(1,  Number(body.floors)    || 2)
    const numBeds     = Math.max(1,  Number(body.bedrooms)  || 5)
    const numBaths    = Math.max(1,  Number(body.bathrooms) || 4)
    const projectName = (body.projectName as string) || 'Villa Project'

    const quantities = calculateQuantities(plotArea, numFloors, numBeds, numBaths)
    const items      = applyQuantities(quantities)

    const footprint = Math.round(plotArea * 0.55)
    const totalBFA  = footprint * numFloors

    const analysis =
      `${projectName}: ${plotArea} M² plot, ${numFloors} floor(s), ` +
      `${numBeds} bedrooms, ${numBaths} bathrooms. ` +
      `Built area ≈ ${totalBFA} M² · All quantities calculated from standard Dubai villa ratios.`

    return NextResponse.json({
      success:   true,
      analysis,
      plot_area: plotArea,
      floors:    numFloors,
      bedrooms:  numBeds,
      bathrooms: numBaths,
      items,
    })
  } catch (err) {
    console.error('BOQ calculator error:', err)
    return NextResponse.json(
      { error: 'Calculation failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    )
  }
}
