import { NextResponse } from 'next/server'
import { seedRates } from '@/lib/rates-store'

// Initial rate library extracted from BOQ template
const INITIAL_RATES = [
  // Mobilization
  { description: 'TEMPORARY CONNECTION OF WATER', unit: 'L.S', unitRate: 5000, category: 'Mobilization', notes: 'Contractor' },
  { description: 'SITE OFFICES AND FENCE WORK', unit: 'L.S', unitRate: 20000, category: 'Mobilization', notes: 'Contractor' },

  // Excavation and Backfilling
  { description: 'EXCAVATION', unit: 'M3', unitRate: 25, category: 'Excavation and Backfilling' },
  { description: 'BACK FILLING BY EXCAVATED SOIL', unit: 'M3', unitRate: 15, category: 'Excavation and Backfilling' },
  { description: 'BACK FILLING BY Selected SOIL', unit: 'M3', unitRate: 30, category: 'Excavation and Backfilling' },
  { description: 'ROAD BASE', unit: 'M3', unitRate: 95, category: 'Excavation and Backfilling' },
  { description: 'DEWATERING', unit: 'L.S', unitRate: 5000, category: 'Excavation and Backfilling' },

  // Substructure
  { description: 'P.C.C UNDER FOOTING & TIE BEAM', unit: 'M3', unitRate: 650, category: 'Substructure' },
  { description: 'R.C.C FOOTING & RAFT', unit: 'M3', unitRate: 1400, category: 'Substructure' },
  { description: 'R.C.C NECK COLUMNS & WALL', unit: 'M3', unitRate: 1400, category: 'Substructure' },
  { description: 'R.C.C TIE BEAMS', unit: 'M3', unitRate: 1400, category: 'Substructure' },
  { description: 'SOLID BLOCK WORK', unit: 'M2', unitRate: 115, category: 'Substructure' },
  { description: 'BITUMEN PAINT', unit: 'L.S', unitRate: 5000, category: 'Substructure' },
  { description: 'POLYGENE SHEET & FIXBLE SHREET', unit: 'L.S', unitRate: 3000, category: 'Substructure' },
  { description: 'ANTI-TERMITE TREATMENT', unit: 'L.S', unitRate: 1500, category: 'Substructure' },
  { description: 'GRADE SLAB', unit: 'M3', unitRate: 800, category: 'Substructure' },

  // Super Structure
  { description: 'RCC IN COLUMNS', unit: 'M3', unitRate: 1400, category: 'Super Structure' },
  { description: 'RCC IN DROP BEAMS', unit: 'M3', unitRate: 1400, category: 'Super Structure' },
  { description: 'RCC IN SOLID SLAB', unit: 'M3', unitRate: 1400, category: 'Super Structure' },
  { description: 'DECORATION IN CONCRETE FRONT SIDE DESIGN', unit: 'M3', unitRate: 1400, category: 'Super Structure' },
  { description: 'RCC WORK IN STAIR', unit: 'M3', unitRate: 1400, category: 'Super Structure' },
  { description: 'PARAPET RCC WORK', unit: 'M3', unitRate: 1400, category: 'Super Structure' },
  { description: 'R.C.C FOR EXTERNAL STIPS', unit: 'M3', unitRate: 1200, category: 'Super Structure' },
  { description: 'R.C.C IN LINTELS', unit: 'M3', unitRate: 1400, category: 'Super Structure' },

  // Block Works
  { description: 'THERMAL BLOCK', unit: 'M2', unitRate: 150, category: 'Block Works' },
  { description: '10 CM Hollow BLOCK', unit: 'M2', unitRate: 100, category: 'Block Works' },
  { description: '15 CM Hollow BLOCK', unit: 'M2', unitRate: 120, category: 'Block Works' },
  { description: '20 CM Hollow BLOCK', unit: 'M2', unitRate: 120, category: 'Block Works' },
  { description: '25 CM Hollow BLOCK', unit: 'M2', unitRate: 135, category: 'Block Works' },
  { description: 'SOLID BLOCK', unit: 'M2', unitRate: 140, category: 'Block Works' },

  // Internal Plaster Works
  { description: 'INTERNAL WALL PLASTER', unit: 'M2', unitRate: 40, category: 'Internal Plaster Works' },
  { description: 'CEILING PLASTER', unit: 'M2', unitRate: 45, category: 'Internal Plaster Works' },

  // External Plaster Works
  { description: 'EXTERNAL PLASTER INCLUDE GROVES ON ELEVATIONS', unit: 'M2', unitRate: 50, category: 'External Plaster Works' },

  // Water Proofing Works
  { description: 'WATER PROOFING FOR ROOF', unit: 'M2', unitRate: 120, category: 'Water Proofing Works' },
  { description: 'WET AREA WATER PROOFING', unit: 'M2', unitRate: 80, category: 'Water Proofing Works' },
  { description: 'WATER TANK LINING', unit: 'M2', unitRate: 100, category: 'Water Proofing Works' },

  // Electrical & Etisalat works
  { description: 'ELECTRIC WORKS AS PER DEWA RULES', unit: 'L.S', unitRate: 125000, category: 'Electrical & Etisalat works' },
  { description: 'Etisalat Work', unit: 'L.S', unitRate: 5000, category: 'Electrical & Etisalat works' },

  // Plumbing & Drainage works
  { description: 'PLUMBING & DRAINAGE & WATER SUPPLY WORK', unit: 'L.S', unitRate: 80000, category: 'Plumbing & Drainage works' },
  { description: 'UP GROUND & ROOF WATER TANK', unit: 'L.S', unitRate: 20000, category: 'Plumbing & Drainage works' },
  { description: 'WATER PUMPS', unit: 'L.S', unitRate: 22000, category: 'Plumbing & Drainage works' },
  { description: 'Septing Tank And Soak Away', unit: 'L.S', unitRate: 20000, category: 'Plumbing & Drainage works' },
  { description: 'SOLAR WATER HEATER', unit: 'L.S', unitRate: 15000, category: 'Plumbing & Drainage works' },
  { description: 'MASTER BED ROOM SANITARY SETS', unit: 'L.S', unitRate: 8000, category: 'Plumbing & Drainage works' },
  { description: 'OTHER BED ROOM SANITARY SETS', unit: 'L.S', unitRate: 5000, category: 'Plumbing & Drainage works' },
  { description: 'HALL BathRoom SANITARY SETS', unit: 'L.S', unitRate: 4000, category: 'Plumbing & Drainage works' },

  // Air Condition
  { description: 'AC CIVIL WORKS', unit: 'L.S', unitRate: 15000, category: 'Air Condition' },
  { description: 'SUPPLY AND INSTALLATION OF AIR-CONDITIONING', unit: 'L.S', unitRate: 50000, category: 'Air Condition' },
  { description: 'VENTILATION FAN WORK', unit: 'L.S', unitRate: 5000, category: 'Air Condition' },

  // Fire Alarm System
  { description: 'SUPPLYING AND FIXING FIRE ALARM SYSTEM', unit: 'P.S', unitRate: 10000, category: 'Fire Alarm System' },

  // Fixing & Supplying Flooring and Wall Tiling
  { description: 'MARBLE FLOORING FOR EXTERNAL ENTRANCE', unit: 'M2', unitRate: 350, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'MARBLE FLOORING FOR STAIRCASE', unit: 'M2', unitRate: 350, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'MARBLE THRESHOLD', unit: 'NO', unitRate: 100, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'Ceramic FLOOR FOR MAJLIS, DINNING AND LIVING', unit: 'M2', unitRate: 140, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'Ceramic SKIRTING', unit: 'L.S', unitRate: 3000, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'Ceramic FLOOR FOR ALL BED ROOMS', unit: 'M2', unitRate: 140, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'Ceramic FLOOR FOR ALL BATH ROOM', unit: 'M2', unitRate: 110, category: 'Fixing & Supplying Flooring and Wall Tiling' },
  { description: 'Ceramic WALL FOR ALL BATH ROOM', unit: 'M2', unitRate: 110, category: 'Fixing & Supplying Flooring and Wall Tiling' },

  // Doors and Windows
  { description: 'ALUMINUM WINDOWS WITH GLASS', unit: 'M2', unitRate: 300, category: 'Doors and Windows' },
  { description: 'WOODEN DOORS WITH FRAMES', unit: 'NO', unitRate: 1500, category: 'Doors and Windows' },
  { description: 'ALUMINUM MAIN ENTRANCE DOOR', unit: 'NO', unitRate: 3000, category: 'Doors and Windows' },

  // Painting Works
  { description: 'INTERNAL PAINTING', unit: 'M2', unitRate: 50, category: 'Painting Works' },
  { description: 'EXTERNAL PAINTING', unit: 'M2', unitRate: 60, category: 'Painting Works' },

  // False Ceiling Works
  { description: 'FALSE CEILING WORKS', unit: 'M2', unitRate: 80, category: 'False Ceiling Works' },

  // Carpentry Works
  { description: 'CARPENTRY WORKS', unit: 'M2', unitRate: 150, category: 'Carpentry Works' },

  // Kitchen Equipment
  { description: 'KITCHEN CABINET AND EQUIPMENT', unit: 'L.S', unitRate: 30000, category: 'Kitchen Equipment' },

  // Provisional Items
  { description: 'PROVISIONAL SUM FOR CONTINGENCIES', unit: 'L.S', unitRate: 50000, category: 'Provisional Items' },

  // Site Supervision
  { description: 'SITE SUPERVISION', unit: 'MONTH', unitRate: 5000, category: 'Site Supervision' },

  // Final Cleaning
  { description: 'FINAL CLEANING', unit: 'L.S', unitRate: 10000, category: 'Final Cleaning' },

  // Handover
  { description: 'HANDOVER AND DEFECT LIABILITY', unit: 'L.S', unitRate: 5000, category: 'Handover' }
]

export async function POST() {
  try {
    await seedRates(INITIAL_RATES)
    return NextResponse.json({
      success: true,
      message: `Rate library seeded with ${INITIAL_RATES.length} items`
    })
  } catch (error) {
    console.error('Error seeding rates:', error)
    return NextResponse.json(
      { error: 'Failed to seed rates' },
      { status: 500 }
    )
  }
}

// GET: Check if rates are already seeded
export async function GET() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/rates`)
    const data = await response.json()
    const rateCount = data.count || 0

    return NextResponse.json({
      seeded: rateCount > 0,
      rateCount,
      message: rateCount > 0 ? 'Rates already seeded' : 'Rate library is empty. Call POST to seed.'
    })
  } catch (error) {
    console.error('Error checking rates:', error)
    return NextResponse.json(
      { error: 'Failed to check rates' },
      { status: 500 }
    )
  }
}
