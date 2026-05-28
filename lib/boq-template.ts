/**
 * Sama Alostoura standard 24-section BOQ template.
 * All descriptions, units, and standard rates are fixed.
 * The AI estimation engineer fills in QUANTITIES only.
 */

export interface BOQTemplateItem {
  itemNo: string
  section: string
  description: string
  unit: string
  unitRate: number
}

export const BOQ_TEMPLATE: BOQTemplateItem[] = [
  // ── 1. MOBILIZATION ────────────────────────────────────────────────────────
  { itemNo: '1.1', section: 'MOBILIZATION', description: 'Temporary Connection of Water', unit: 'L.S', unitRate: 5000 },
  { itemNo: '1.2', section: 'MOBILIZATION', description: 'Site Offices and Fence Work', unit: 'L.S', unitRate: 15000 },
  { itemNo: '1.3', section: 'MOBILIZATION', description: 'Pay DM Fees and Etc', unit: 'L.S', unitRate: 0 },
  { itemNo: '1.4', section: 'MOBILIZATION', description: 'Demolishing of Temporary Offices Including Site Clearance', unit: 'L.S', unitRate: 3000 },
  { itemNo: '1.5', section: 'MOBILIZATION', description: 'Cleaning Away on Completion Inside Building', unit: 'L.S', unitRate: 3000 },
  { itemNo: '1.6', section: 'MOBILIZATION', description: 'Demolishing Work', unit: 'L.S', unitRate: 0 },

  // ── 2. EXCAVATION AND BACKFILLING ──────────────────────────────────────────
  { itemNo: '2.1', section: 'EXCAVATION AND BACKFILLING', description: 'Excavation', unit: 'M3', unitRate: 20 },
  { itemNo: '2.2', section: 'EXCAVATION AND BACKFILLING', description: 'Back Filling by Excavated Soil', unit: 'M3', unitRate: 10 },
  { itemNo: '2.3', section: 'EXCAVATION AND BACKFILLING', description: 'Back Filling by Selected Soil', unit: 'M3', unitRate: 0 },
  { itemNo: '2.4', section: 'EXCAVATION AND BACKFILLING', description: 'Soil Replacement (if required)', unit: 'M3', unitRate: 0 },
  { itemNo: '2.5', section: 'EXCAVATION AND BACKFILLING', description: 'Road Base (if required)', unit: 'M3', unitRate: 0 },
  { itemNo: '2.6', section: 'EXCAVATION AND BACKFILLING', description: 'Dewatering (if required)', unit: 'L.S', unitRate: 0 },

  // ── 3. SUBSTRUCTURE ────────────────────────────────────────────────────────
  { itemNo: '3.1', section: 'SUBSTRUCTURE', description: 'P.C.C Under Footing & Tie Beam', unit: 'M3', unitRate: 600 },
  { itemNo: '3.2', section: 'SUBSTRUCTURE', description: 'R.C.C Footing & Raft', unit: 'M3', unitRate: 1300 },
  { itemNo: '3.3', section: 'SUBSTRUCTURE', description: 'R.C.C Neck Columns & Wall', unit: 'M3', unitRate: 1300 },
  { itemNo: '3.4', section: 'SUBSTRUCTURE', description: 'R.C.C Tie Beams', unit: 'M3', unitRate: 1300 },
  { itemNo: '3.5', section: 'SUBSTRUCTURE', description: 'Solid Block Work', unit: 'M2', unitRate: 100 },
  { itemNo: '3.6', section: 'SUBSTRUCTURE', description: 'Bitumen Paint', unit: 'L.S', unitRate: 4500 },
  { itemNo: '3.7', section: 'SUBSTRUCTURE', description: 'Polygene Sheet', unit: 'L.S', unitRate: 3000 },
  { itemNo: '3.8', section: 'SUBSTRUCTURE', description: 'Anti-Termite Treatment', unit: 'L.S', unitRate: 5000 },
  { itemNo: '3.9', section: 'SUBSTRUCTURE', description: 'Grade Slab & Wall Footings', unit: 'M3', unitRate: 700 },
  { itemNo: '3.10', section: 'SUBSTRUCTURE', description: 'Water Tank Structure (if required)', unit: 'M3', unitRate: 0 },

  // ── 4. SUPER STRUCTURE ─────────────────────────────────────────────────────
  { itemNo: '4.1', section: 'SUPER STRUCTURE', description: 'RCC in Columns', unit: 'M3', unitRate: 1300 },
  { itemNo: '4.2', section: 'SUPER STRUCTURE', description: 'RCC in Drop Beams', unit: 'M3', unitRate: 1300 },
  { itemNo: '4.3', section: 'SUPER STRUCTURE', description: 'RCC in Solid Slab', unit: 'M3', unitRate: 1200 },
  { itemNo: '4.4', section: 'SUPER STRUCTURE', description: 'Post Tension Slab (if required)', unit: 'M3', unitRate: 0 },
  { itemNo: '4.5', section: 'SUPER STRUCTURE', description: 'Decoration in Concrete Front Side Design', unit: 'M3', unitRate: 1100 },
  { itemNo: '4.6', section: 'SUPER STRUCTURE', description: 'RCC Work in Stair & Lift', unit: 'M3', unitRate: 1300 },
  { itemNo: '4.7', section: 'SUPER STRUCTURE', description: 'Parapet Block Work', unit: 'M2', unitRate: 110 },
  { itemNo: '4.8', section: 'SUPER STRUCTURE', description: 'Parapet RCC Work (Include All Parapet Design as Drawing)', unit: 'M3', unitRate: 1200 },
  { itemNo: '4.9', section: 'SUPER STRUCTURE', description: 'R.C.C for External Strips', unit: 'M3', unitRate: 800 },
  { itemNo: '4.10', section: 'SUPER STRUCTURE', description: 'R.C.C in Lintels', unit: 'M3', unitRate: 800 },
  { itemNo: '4.11', section: 'SUPER STRUCTURE', description: 'Elevations and Windows Design Projections', unit: 'L.M', unitRate: 0 },

  // ── 5. BLOCK WORKS ─────────────────────────────────────────────────────────
  { itemNo: '5.1', section: 'BLOCK WORKS', description: 'Thermal Block', unit: 'M2', unitRate: 110 },
  { itemNo: '5.2', section: 'BLOCK WORKS', description: '10 CM Hollow Block', unit: 'M2', unitRate: 90 },
  { itemNo: '5.3', section: 'BLOCK WORKS', description: '15 CM Hollow Block', unit: 'M2', unitRate: 0 },
  { itemNo: '5.4', section: 'BLOCK WORKS', description: '20 CM Hollow Block', unit: 'M2', unitRate: 100 },
  { itemNo: '5.5', section: 'BLOCK WORKS', description: '25 CM Hollow Block', unit: 'M2', unitRate: 0 },
  { itemNo: '5.6', section: 'BLOCK WORKS', description: 'Solid Block', unit: 'M2', unitRate: 0 },

  // ── 6. INTERNAL PLASTER WORKS ──────────────────────────────────────────────
  { itemNo: '6.1', section: 'INTERNAL PLASTER WORKS', description: 'Internal Wall Plaster', unit: 'M2', unitRate: 30 },
  { itemNo: '6.2', section: 'INTERNAL PLASTER WORKS', description: 'Ceiling Plaster (if required)', unit: 'M2', unitRate: 0 },

  // ── 7. EXTERNAL PLASTER WORKS ──────────────────────────────────────────────
  { itemNo: '7.1', section: 'EXTERNAL PLASTER WORKS', description: 'External Plaster Including Groves on Elevations', unit: 'M2', unitRate: 35 },
  { itemNo: '7.2', section: 'EXTERNAL PLASTER WORKS', description: 'External Plaster (Inside Parapet Area Only)', unit: 'M2', unitRate: 30 },
  { itemNo: '7.3', section: 'EXTERNAL PLASTER WORKS', description: 'Stone Work Main Villa Building Full', unit: 'M2', unitRate: 80 },

  // ── 8. WATER PROOFING WORKS ────────────────────────────────────────────────
  { itemNo: '8.1', section: 'WATER PROOFING WORKS', description: 'Water Proofing for Roof — All Layers 7 CM', unit: 'M2', unitRate: 110 },
  { itemNo: '8.2', section: 'WATER PROOFING WORKS', description: 'Wet Area (Bathroom, Kitchen, Balcony 1st Floor)', unit: 'M2', unitRate: 90 },
  { itemNo: '8.3', section: 'WATER PROOFING WORKS', description: 'Water Tank Lining (if required)', unit: 'M2', unitRate: 0 },

  // ── 9. ELECTRICAL & ETISALAT WORKS ────────────────────────────────────────
  { itemNo: '9.1', section: 'ELECTRICAL & ETISALAT WORKS', description: 'Electric Works as per DEWA Rules (Include Light Fixing, CCTV, Intercom Conduit Fixing)', unit: 'L.S', unitRate: 135000 },
  { itemNo: '9.2', section: 'ELECTRICAL & ETISALAT WORKS', description: 'Etisalat Work as per Authority Rules', unit: 'L.S', unitRate: 4000 },

  // ── 10. PLUMBING & DRAINAGE WORKS ─────────────────────────────────────────
  { itemNo: '10.1', section: 'PLUMBING & DRAINAGE WORKS', description: 'Plumbing & Drainage & Water Supply Work', unit: 'L.S', unitRate: 92000 },
  { itemNo: '10.2', section: 'PLUMBING & DRAINAGE WORKS', description: 'Up Ground & Roof Water Tank', unit: 'L.S', unitRate: 10000 },
  { itemNo: '10.3', section: 'PLUMBING & DRAINAGE WORKS', description: 'Water Pumps (Transfer & Booster)', unit: 'L.S', unitRate: 5000 },
  { itemNo: '10.4', section: 'PLUMBING & DRAINAGE WORKS', description: 'Septic Tank and Soak Away (as drawing)', unit: 'L.S', unitRate: 0 },
  { itemNo: '10.5', section: 'PLUMBING & DRAINAGE WORKS', description: 'Solar Water Heater Ariston', unit: 'L.S', unitRate: 9500 },
  { itemNo: '10.7', section: 'PLUMBING & DRAINAGE WORKS', description: 'Master Bedroom Sanitary Sets and Other Accessories', unit: 'L.S', unitRate: 6000 },
  { itemNo: '10.8', section: 'PLUMBING & DRAINAGE WORKS', description: 'Other Bedroom Sanitary Sets and Other Accessories', unit: 'L.S', unitRate: 4500 },
  { itemNo: '10.9', section: 'PLUMBING & DRAINAGE WORKS', description: 'Dining Bathroom Sanitary Sets and Other Accessories', unit: 'L.S', unitRate: 4000 },
  { itemNo: '10.11', section: 'PLUMBING & DRAINAGE WORKS', description: 'Wash Basin Counter', unit: 'L.M', unitRate: 2000 },
  { itemNo: '10.12', section: 'PLUMBING & DRAINAGE WORKS', description: 'Service Block Bathroom', unit: 'L.M', unitRate: 2000 },

  // ── 11. AIR CONDITION ─────────────────────────────────────────────────────
  { itemNo: '11.1', section: 'AIR CONDITION', description: 'AC Civil Works', unit: 'L.S', unitRate: 5000 },
  { itemNo: '11.2', section: 'AIR CONDITION', description: 'Supply and Installation of Air-Conditioning (by Owner)', unit: 'L.S', unitRate: 0 },
  { itemNo: '11.3', section: 'AIR CONDITION', description: 'Ventilation Fan Work', unit: 'L.S', unitRate: 0 },

  // ── 12. FIRE ALARM SYSTEM ─────────────────────────────────────────────────
  { itemNo: '12.1', section: 'FIRE ALARM SYSTEM', description: 'Supply and Fix Fire Alarm System as per DCD Rules (by Owner)', unit: 'P.S', unitRate: 0 },

  // ── 13. SUPPLYING FLOORING AND WALL TILING ────────────────────────────────
  { itemNo: '13.1', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Granite for All External Entrance', unit: 'M2', unitRate: 350 },
  { itemNo: '13.6', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Marble for Steps', unit: 'M2', unitRate: 250 },
  { itemNo: '13.7', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Ceramic Floor — Majlis, Dining, Living Room, Bed Rooms, Stair Area', unit: 'M2', unitRate: 80 },
  { itemNo: '13.8', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Ceramic Skirting — Majlis, Dining, Living, Stair Area', unit: 'L.S', unitRate: 5000 },
  { itemNo: '13.11', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Ceramic Floor — All Bathrooms', unit: 'M2', unitRate: 80 },
  { itemNo: '13.12', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Ceramic Wall — All Bathrooms', unit: 'M2', unitRate: 80 },
  { itemNo: '13.13', section: 'SUPPLYING FLOORING AND WALL TILING', description: 'Ceramic Floor — Maid and Store', unit: 'M2', unitRate: 80 },

  // ── 15. INTERNAL PAINT WORKS ──────────────────────────────────────────────
  { itemNo: '15.1', section: 'INTERNAL PAINT WORKS', description: 'Internal Wall Paint (JOTUN)', unit: 'M2', unitRate: 25 },
  { itemNo: '15.2', section: 'INTERNAL PAINT WORKS', description: 'Internal Ceiling Paint (JOTUN) (if required)', unit: 'M2', unitRate: 0 },

  // ── 16. EXTERNAL PAINT WORKS ──────────────────────────────────────────────
  { itemNo: '16.1', section: 'EXTERNAL PAINT WORKS', description: 'External Wall Paint (Gravio Décor Paint)', unit: 'M2', unitRate: 25 },
  { itemNo: '16.2', section: 'EXTERNAL PAINT WORKS', description: 'External Paint (Inside Parapet Area)', unit: 'M2', unitRate: 25 },

  // ── 17. DÉCOR WORK AND FALSE CEILING ──────────────────────────────────────
  { itemNo: '17.1', section: 'DÉCOR WORK AND FALSE CEILING', description: 'False Ceiling 60×60 Gypsum — Kitchen and Services Only (by Owner)', unit: 'M2', unitRate: 0 },

  // ── 19. ALUMINIUM WORKS ───────────────────────────────────────────────────
  { itemNo: '19.1', section: 'ALUMINIUM WORKS', description: 'Windows Curtain Wall Profile (8×5) + Majlis Door + Villa Main Door', unit: 'M2', unitRate: 900 },
  { itemNo: '19.2', section: 'ALUMINIUM WORKS', description: 'Aluminium Handrails', unit: 'R.M', unitRate: 750 },
  { itemNo: '19.3', section: 'ALUMINIUM WORKS', description: 'Aluminium Windows', unit: 'M2', unitRate: 750 },

  // ── 20. JOINERY WORKS ─────────────────────────────────────────────────────
  { itemNo: '20.3', section: 'JOINERY WORKS', description: 'Bedroom Doors', unit: 'N.O', unitRate: 2000 },
  { itemNo: '20.4', section: 'JOINERY WORKS', description: 'Bathroom Doors', unit: 'N.O', unitRate: 1700 },

  // ── 21. METAL WORKS ───────────────────────────────────────────────────────
  { itemNo: '21.1', section: 'METAL WORKS', description: 'Main Gates Including Motor', unit: 'P.S', unitRate: 9000 },
  { itemNo: '21.2', section: 'METAL WORKS', description: 'Person Gate', unit: 'P.S', unitRate: 3000 },
  { itemNo: '21.3', section: 'METAL WORKS', description: 'Car Shade', unit: 'P.S', unitRate: 7500 },
  { itemNo: '21.4', section: 'METAL WORKS', description: 'Cat Ladder Stair', unit: 'P.S', unitRate: 9000 },
  { itemNo: '21.5', section: 'METAL WORKS', description: 'Aluminium Cladding on Villa Elevation Swimming Pool Area', unit: 'P.S', unitRate: 0 },

  // ── 22. COMPOUND WALL ─────────────────────────────────────────────────────
  { itemNo: '22.1', section: 'COMPOUND WALL', description: 'Compound Wall + Plaster 2 Sides + Paint 2 Sides', unit: 'R.M', unitRate: 880 },

  // ── 23. EXTERNAL FINISHING WORK ───────────────────────────────────────────
  { itemNo: '23.1', section: 'EXTERNAL FINISHING WORK', description: 'Interlock Tiles for Supply (by Owner)', unit: 'M2', unitRate: 0 },
  { itemNo: '23.3', section: 'EXTERNAL FINISHING WORK', description: 'Kerb Stone — Supply and Fixing', unit: 'L.M', unitRate: 8000 },
  { itemNo: '23.5', section: 'EXTERNAL FINISHING WORK', description: 'Manhole Work (Civil and Cover) Interlock Fixed', unit: 'L.S', unitRate: 11000 },

  // ── 24. PROVISIONAL SUM ITEMS ─────────────────────────────────────────────
  { itemNo: '24.1', section: 'PROVISIONAL SUM ITEMS', description: 'Light Fitting, Socket and Switch', unit: 'L.S', unitRate: 13000 },
  { itemNo: '24.2', section: 'PROVISIONAL SUM ITEMS', description: 'Security (C.C.T.V) (if required)', unit: 'L.S', unitRate: 0 },
  { itemNo: '24.3', section: 'PROVISIONAL SUM ITEMS', description: 'Intercom (if required)', unit: 'L.S', unitRate: 0 },
  { itemNo: '24.4', section: 'PROVISIONAL SUM ITEMS', description: 'Sound System (if required)', unit: 'L.S', unitRate: 0 },
  { itemNo: '24.5', section: 'PROVISIONAL SUM ITEMS', description: 'Kitchen Cabinet (by Owner)', unit: 'P.S', unitRate: 0 },
  { itemNo: '24.6', section: 'PROVISIONAL SUM ITEMS', description: 'Wardrobes (by Owner)', unit: 'M2', unitRate: 0 },
  { itemNo: '24.7', section: 'PROVISIONAL SUM ITEMS', description: 'Gypsum Decoration (by Owner)', unit: 'P.S', unitRate: 0 },
  { itemNo: '24.8', section: 'PROVISIONAL SUM ITEMS', description: 'Landscaping (by Owner)', unit: 'P.S', unitRate: 0 },
  { itemNo: '24.9', section: 'PROVISIONAL SUM ITEMS', description: 'Swimming Pool Full Scope with Handrail (by Owner)', unit: 'P.S', unitRate: 0 },
  { itemNo: '24.10', section: 'PROVISIONAL SUM ITEMS', description: 'Elevator Work (by Owner)', unit: 'P.S', unitRate: 0 },
]

/** Merge AI quantities into the template, return full BOQItem array ready for saving */
export function applyQuantities(
  quantities: Record<string, number>,
): Array<BOQTemplateItem & { quantity: number; amount: number; progress: number }> {
  return BOQ_TEMPLATE.map(item => {
    const qty = quantities[item.itemNo] ?? 0
    return {
      ...item,
      quantity: qty,
      amount:   qty * item.unitRate,
      progress: 0,
    }
  })
}
