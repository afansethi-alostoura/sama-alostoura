'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Printer, CheckCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BOQItem {
  section_no: number
  section_name: string
  item_code: string
  description: string
  unit: string
  qty: number
  rate: number
  remarks: string
}

interface BOQHeader {
  project_number: string
  project_name: string
  area: string
  owner: string
  contractor: string
}

// ── Default template items ────────────────────────────────────────────────────

const DEFAULT_ITEMS: BOQItem[] = [
  { section_no:1, section_name:'MOBILIZATION', item_code:'1.1', description:'TEMPORARY CONNECTION OF WATER', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:1, section_name:'MOBILIZATION', item_code:'1.2', description:'SITE OFFICES AND FENCE WORK', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:1, section_name:'MOBILIZATION', item_code:'1.3', description:'PAY DM FEES AND ETC', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:1, section_name:'MOBILIZATION', item_code:'1.4', description:'DEMOLISHING OF TEMPORARY OFFICES INCLUDING SITE CLEARANCE', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:1, section_name:'MOBILIZATION', item_code:'1.5', description:'CLEANING AWAY ON COMPLETION INSIDE BUILDING', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:1, section_name:'MOBILIZATION', item_code:'1.6', description:'DEMOLISHING WORK', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:2, section_name:'EXCAVATION AND BACKFILLING', item_code:'2.1', description:'EXCAVATION', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:2, section_name:'EXCAVATION AND BACKFILLING', item_code:'2.2', description:'BACK FILLING BY EXCAVATED SOIL', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:2, section_name:'EXCAVATION AND BACKFILLING', item_code:'2.3', description:'BACK FILLING BY SELECTED SOIL', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:2, section_name:'EXCAVATION AND BACKFILLING', item_code:'2.4', description:'SOIL REPLACEMENT if required', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:2, section_name:'EXCAVATION AND BACKFILLING', item_code:'2.5', description:'ROAD BASE if required as Soil report or Drawing', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:2, section_name:'EXCAVATION AND BACKFILLING', item_code:'2.6', description:'DEWATERING if required', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.1', description:'P.C.C UNDER FOOTING & TIE BEAM', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.2', description:'R.C.C FOOTING & RAFT', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.3', description:'R.C.C NECK COLUMNS & WALL', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.4', description:'R.C.C TIE BEAMS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.5', description:'SOLID BLOCK WORK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.6', description:'BITUMEN PAINT', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.7', description:'POLYGENE SHEET & FLEXIBLE SHEET', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.8', description:'ANTI-TERMITE TREATMENT', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.9', description:'GRADE SLAB', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:3, section_name:'SUBSTRUCTURE', item_code:'3.10', description:'WATER TANK STRUCTURE if required', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.1', description:'RCC IN COLUMNS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.2', description:'RCC IN DROP BEAMS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.3', description:'RCC IN SOLID SLAB', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.4', description:'POST TENSION SLAB if required', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.5', description:'DECORATION IN CONCRETE FRONT SIDE DESIGN', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.6', description:'RCC WORK IN STAIR', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.7', description:'PARAPET BLOCK WORK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.8', description:'PARAPET RCC WORK (INCLUDE ALL PARAPET DESIGN AS DRAWING)', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.9', description:'R.C.C FOR EXTERNAL STRIPS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.10', description:'R.C.C IN LINTELS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:4, section_name:'SUPER STRUCTURE', item_code:'4.11', description:'ELEVATIONS AND WINDOWS DESIGN PROJECTIONS', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.1', description:'THERMAL BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.2', description:'10 CM HOLLOW BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.3', description:'15 CM HOLLOW BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.4', description:'20 CM HOLLOW BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.5', description:'25 CM HOLLOW BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.6', description:'SOLID BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:5, section_name:'BLOCK WORKS', item_code:'5.7', description:'OTHERS / PROJECTION', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:6, section_name:'INTERNAL PLASTER WORKS', item_code:'6.1', description:'INTERNAL WALL PLASTER', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:6, section_name:'INTERNAL PLASTER WORKS', item_code:'6.2', description:'CEILING PLASTER if required', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:6, section_name:'INTERNAL PLASTER WORKS', item_code:'6.3', description:'OTHERS / PROJECTION', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:7, section_name:'EXTERNAL PLASTER WORKS', item_code:'7.1', description:'EXTERNAL PLASTER INCLUDE GROVES ON ELEVATIONS', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:7, section_name:'EXTERNAL PLASTER WORKS', item_code:'7.2', description:'EXTERNAL PLASTER (Inside Parapet Area Only)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:7, section_name:'EXTERNAL PLASTER WORKS', item_code:'7.3', description:'OTHERS / PROJECTION', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:8, section_name:'WATER PROOFING WORKS', item_code:'8.1', description:'WATER PROOFING FOR ROOF (all layers) As Drawing and Specification 7 CM', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:8, section_name:'WATER PROOFING WORKS', item_code:'8.2', description:'WET AREA (Bathroom, Kitchen, Balcony in 1st Floor) As Drawing and Specification', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:8, section_name:'WATER PROOFING WORKS', item_code:'8.3', description:'WATER TANK LINING if required', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:8, section_name:'WATER PROOFING WORKS', item_code:'8.4', description:'OTHERS / PROJECTION', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:9, section_name:'ELECTRICAL & ETISALAT WORKS', item_code:'9.1', description:'ELECTRIC WORKS AS PER DEWA RULES (INCLUDE LIGHT FIXING, CCTV, INTERCOM CONDUIT FIXING)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:9, section_name:'ELECTRICAL & ETISALAT WORKS', item_code:'9.2', description:'ETISALAT WORK AS AUTHORITY RULES', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:9, section_name:'ELECTRICAL & ETISALAT WORKS', item_code:'9.3', description:'OTHERS / PROJECTION', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.1', description:'PLUMBING & DRAINAGE & WATER SUPPLY WORK As Drawing and Specification', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.2', description:'UP GROUND & ROOF WATER TANK (GRP PANEL)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.3', description:'WATER PUMPS (TRANSFER & BOOSTER)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.4', description:'SEPTIC TANK AND SOAK AWAY As Drawing', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.5', description:'SOLAR WATER HEATER ARISTON AS Drawing', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.7', description:'MASTER BED ROOM SANITARY SETS AND OTHER ACCESSORIES', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.8', description:'OTHER BED ROOM SANITARY SETS AND OTHER ACCESSORIES', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.9', description:'HALL BATHROOM SANITARY SETS AND OTHER ACCESSORIES', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.11', description:'KITCHEN / HOT KITCHEN / LAUNDRY / MAID ROOM SANITARY', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:10, section_name:'PLUMBING & DRAINAGE WORKS', item_code:'10.12', description:'OTHERS / PROJECTION', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:11, section_name:'AIR CONDITION', item_code:'11.1', description:'AC CIVIL WORKS', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:11, section_name:'AIR CONDITION', item_code:'11.2', description:'SUPPLY AND INSTALLATION OF AIR-CONDITIONING, DUCTING (General Brand)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:11, section_name:'AIR CONDITION', item_code:'11.3', description:'VENTILATION FAN WORK Supplying and Fixing As Drawing Specification', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:12, section_name:'FIRE ALARM SYSTEM', item_code:'12.1', description:'SUPPLYING AND FIXING FIRE ALARM SYSTEM AS PER DCD RULES', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.1', description:'MARBLE FLOORING FOR ALL EXTERNAL ENTRANCE (250 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.2', description:'MARBLE FLOORING FOR ALL EXTERNAL ENTRANCE STEP (250 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.3', description:'PORCELAIN SKIRTING FOR ALL EXTERNAL ENTRANCE (25 AED)', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.4', description:'MARBLE FOR STAIRCASE (250 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.5', description:'MARBLE FOR STAIRCASE TREAD AND RISER (250 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.6', description:'MARBLE THRESHOLD 3CM THICK WITH SAME WIDTH OF THE WALL (80 AED)', unit:'NO', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.7', description:'CERAMIC FLOOR FOR MAJLIS, DINING AND LIVING, BED ROOMS ALL VILLA (85 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.8', description:'CERAMIC SKIRTING FOR MAJLIS DINING AND LIVING STAIR AREA (15 AED)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.9', description:'CERAMIC FLOOR FOR ALL BED ROOMS (16 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.10', description:'CERAMIC SKIRTING FOR ALL BED ROOMS (15 AED)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.11', description:'CERAMIC FLOOR FOR ALL BATH ROOM (70 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.12', description:'CERAMIC WALL FOR ALL BATH ROOM (70 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.13', description:'CERAMIC FLOOR FOR MAID AND STORE (40 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:13, section_name:'SUPPLYING FLOORING AND WALL TILING', item_code:'13.14', description:'CERAMIC SKIRTING FOR MAID AND STORE (15 AED)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.1', description:'PORCELAIN FLOORING FOR ALL EXTERNAL ENTRANCE', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.2', description:'PORCELAIN FLOORING FOR ALL EXTERNAL ENTRANCE STEP', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.3', description:'PORCELAIN SKIRTING FOR ALL EXTERNAL ENTRANCE', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.4', description:'PORCELAIN FOR STAIRCASE TREAD AND RISER', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.5', description:'PORCELAIN SKIRTING FOR STAIRCASE TREAD AND RISER', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.6', description:'PORCELAIN THRESHOLD 3CM THICK WITH SAME WIDTH OF THE WALL', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.7', description:'CERAMIC FLOOR FOR MAJLIS DINING AND LIVING STAIR AREA', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.8', description:'CERAMIC SKIRTING FOR MAJLIS DINING AND LIVING STAIR AREA', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.9', description:'CERAMIC FLOOR FOR ALL BED ROOMS', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.10', description:'CERAMIC SKIRTING FOR ALL BED ROOMS', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.11', description:'CERAMIC FLOOR FOR ALL BATH ROOM', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.12', description:'CERAMIC WALL FOR ALL BATH ROOM', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.13', description:'CERAMIC FLOOR FOR MAID AND STORE', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:14, section_name:'FIXING FLOORING AND WALL TILING', item_code:'14.14', description:'CERAMIC SKIRTING FOR MAID AND STORE', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:15, section_name:'INTERNAL PAINT WORKS', item_code:'15.1', description:'INTERNAL WALL PAINT (JOTUN)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:15, section_name:'INTERNAL PAINT WORKS', item_code:'15.2', description:'INTERNAL CEILING PAINT (JOTUN) if required', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:16, section_name:'EXTERNAL PAINT WORKS', item_code:'16.1', description:'EXTERNAL WALL PAINT (Gravio Décor Paint)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:16, section_name:'EXTERNAL PAINT WORKS', item_code:'16.2', description:'EXTERNAL PAINT (Inside Parapet Area)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:17, section_name:'DÉCOR WORK AND FALSE CEILING', item_code:'17.1', description:'FALSE CEILING 60X60 GYPSUM (KITCHEN and Services ONLY)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:18, section_name:'STONE WORK', item_code:'18.1', description:'SUPPLYING EXTERNAL STONE (Main Building Only) AS SPECIFICATION AND DRAWING (80 AED)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:18, section_name:'STONE WORK', item_code:'18.2', description:'FIXING EXTERNAL STONE (INCLUDE SCAFFOLDING, BITUMEN PAINT, GENERATOR)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:19, section_name:'ALUMINIUM WORKS', item_code:'19.1', description:'WINDOWS CURTAIN WALL PROFILE (8×5)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:19, section_name:'ALUMINIUM WORKS', item_code:'19.2', description:'HANDRAIL FOR STAIRCASE', unit:'R.M', qty:0, rate:0, remarks:'' },
  { section_no:19, section_name:'ALUMINIUM WORKS', item_code:'19.3', description:'GLASS DOORS SHOWER AREA', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:20, section_name:'JOINERY WORKS', item_code:'20.1', description:'VILLA MAIN DOOR (8,000 AED)', unit:'N.O', qty:0, rate:0, remarks:'' },
  { section_no:20, section_name:'JOINERY WORKS', item_code:'20.2', description:'MAJLIS DOOR (4,000 AED)', unit:'N.O', qty:0, rate:0, remarks:'' },
  { section_no:20, section_name:'JOINERY WORKS', item_code:'20.3', description:'BED ROOM DOOR, BATHROOMS ETC (2,600 AED)', unit:'N.O', qty:0, rate:0, remarks:'' },
  { section_no:20, section_name:'JOINERY WORKS', item_code:'20.4', description:'MAID ROOM AND ALL SERVICES DOOR (1,700 AED)', unit:'N.O', qty:0, rate:0, remarks:'' },
  { section_no:21, section_name:'METAL WORKS', item_code:'21.1', description:'MAIN GATES INCLUDE MOTOR (10,000 AED)', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:21, section_name:'METAL WORKS', item_code:'21.2', description:'PERSON GATE (5,000 AED)', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:21, section_name:'METAL WORKS', item_code:'21.3', description:'CAR SHADE (15,000 AED)', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:21, section_name:'METAL WORKS', item_code:'21.4', description:'DECORATIVE METAL GRILL', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:21, section_name:'METAL WORKS', item_code:'21.5', description:'CAT LADDER STAIR (5,000 AED)', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:21, section_name:'METAL WORKS', item_code:'21.6', description:'ALUMINIUM CLADDING ON VILLA ELEVATION / SWIMMING POOL AREA (15,000 AED)', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.1', description:'EXCAVATION', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.2', description:'BACK FILLING FROM THE SITE WITH COMPACTION', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.3', description:'P.C.C', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.4', description:'R.C.C FOOTING', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.5', description:'R.C.C STRAP BEAM', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.6', description:'SOLID BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.7', description:'R.C.C NECK COLUMNS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.8', description:'R.C.C RETAINING WALL', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.9', description:'R.C.C TIE BEAM', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.10', description:'R.C.C COLUMNS', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.11', description:'R.C.C COPING BEAM AND SLAB', unit:'M3', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.12', description:'POLYTHENE SHEET (1000 GAUGE)', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.13', description:'BITUMEN', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.14', description:'8" HOLLOW BLOCK', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.15', description:'PLASTER (All INTERNAL SIDE + EXTERNAL FRONT SIDE ELEVATIONS)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:22, section_name:'COMPOUND WALL', item_code:'22.16', description:'PAINT (All INTERNAL SIDE + EXTERNAL FRONT SIDE ELEVATIONS)', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:23, section_name:'EXTERNAL FINISHING WORK', item_code:'23.1', description:'INTERLOCK TILES 8 CM THICK (30 AED) FOR SUPPLY', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:23, section_name:'EXTERNAL FINISHING WORK', item_code:'23.2', description:'INTERLOCK TILES 6 CM THICK (20 AED) FOR SUPPLY', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:23, section_name:'EXTERNAL FINISHING WORK', item_code:'23.3', description:'KERB STONE (15 AED) FOR SUPPLY', unit:'L.M', qty:0, rate:0, remarks:'' },
  { section_no:23, section_name:'EXTERNAL FINISHING WORK', item_code:'23.5', description:'MANHOLE WORK (CIVIL AND COVER) INTERLOCK FIXED BUILT IN THE MANHOLE', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.1', description:'LIGHT FITTING, SOCKET AND SWITCH', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.2', description:'SECURITY (C.C.T.V) if required', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.3', description:'INTERCOM if required', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.4', description:'SOUND SYSTEM if required', unit:'L.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.5', description:'KITCHEN CABINET', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.6', description:'WARDROBES', unit:'M2', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.7', description:'GYPSUM DECORATION (25,000 AED)', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.8', description:'LANDSCAPING', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.9', description:'SWIMMING POOL FULL SCOPE WITH HANDRAIL', unit:'P.S', qty:0, rate:0, remarks:'' },
  { section_no:24, section_name:'PROVISIONAL SUM ITEMS', item_code:'24.10', description:'ELEVATOR WORK', unit:'P.S', qty:0, rate:0, remarks:'' },
]

function fmt(n: number) {
  return n === 0 ? '' : n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getSections(items: BOQItem[]) {
  const map = new Map<number, { name: string; items: BOQItem[] }>()
  items.forEach(it => {
    if (!map.has(it.section_no)) map.set(it.section_no, { name: it.section_name, items: [] })
    map.get(it.section_no)!.items.push(it)
  })
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
}

export default function CompanyBOQPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const boqId        = searchParams.get('id') // null = new BOQ

  const [boqDbId, setBoqDbId] = useState<string | null>(boqId)
  const [header, setHeader]   = useState<BOQHeader>({
    project_number: '', project_name: '', area: '', owner: '',
    contractor: 'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
  })
  const [items, setItems]     = useState<BOQItem[]>(DEFAULT_ITEMS.map(i => ({ ...i })))
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(!!boqId)

  // Load existing BOQ if id present in URL
  useEffect(() => {
    if (!boqId) { setLoading(false); return }
    fetch(`/api/boq/company?id=${boqId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.items) {
          setHeader({ project_number: data.project_number ?? '', project_name: data.project_name ?? '', area: data.area ?? '', owner: data.owner ?? '', contractor: data.contractor ?? 'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C' })
          const savedMap = new Map<string, BOQItem>()
          ;(data.items as BOQItem[]).forEach((it: BOQItem) => savedMap.set(it.item_code, it))
          setItems(DEFAULT_ITEMS.map(t => { const sv = savedMap.get(t.item_code); return sv ? { ...t, qty: sv.qty, rate: sv.rate, remarks: sv.remarks } : { ...t } }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boqId])

  const updateItem = useCallback((item_code: string, field: 'qty' | 'rate' | 'remarks', value: string | number) => {
    setItems(prev => prev.map(it => it.item_code === item_code ? { ...it, [field]: field === 'remarks' ? value : Number(value) } : it))
    setSaved(false)
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      let res: Response
      if (boqDbId) {
        // Update existing
        res = await fetch('/api/boq/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: boqDbId, ...header, items }) })
      } else {
        // Create new
        res = await fetch('/api/boq/company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...header, items }) })
        if (res.ok) {
          const data = await res.json()
          setBoqDbId(data.id)
          // Update URL without navigation
          router.replace(`/estimation/boq/company?id=${data.id}`, { scroll: false })
        }
      }
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to save BOQ')
    } finally {
      setSaving(false)
    }
  }

  const sections   = getSections(items)
  const grandTotal = items.reduce((s, it) => s + it.qty * it.rate, 0)

  if (loading) return <div className="p-8 text-slate-500">Loading BOQ…</div>

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/estimation" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Estimation
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-semibold text-slate-700">Company BOQ{boqDbId ? '' : ' — New'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save BOQ'}</>}
          </button>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="text-center mb-5">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">SAMA ALOSTOURA BUILDING CONTRACTING L.L.C</h1>
            <h2 className="text-base font-semibold text-slate-600 mt-1">Bill of Quantities</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {([
              { label: 'PROJECT NUMBER', field: 'project_number' as const, placeholder: 'e.g. 036' },
              { label: 'PROJECT',        field: 'project_name'   as const, placeholder: 'e.g. PROPOSED G + 1 + R VILLA' },
              { label: 'AREA',           field: 'area'           as const, placeholder: 'e.g. AL AWIR FIRST — Plot No. 71112312' },
              { label: 'OWNER',          field: 'owner'          as const, placeholder: 'Owner full name' },
              { label: 'CONTRACTOR',     field: 'contractor'     as const, placeholder: 'Contractor name' },
            ] as const).map(({ label, field, placeholder }) => (
              <div key={field} className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-500 w-32 flex-shrink-0">{label}:</span>
                <input className="flex-1 text-sm text-slate-900 font-medium bg-transparent outline-none placeholder:text-slate-300" value={header[field]} onChange={e => { setHeader(h => ({ ...h, [field]: e.target.value })); setSaved(false) }} placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2.5 text-left border border-slate-600 w-8">N</th>
                  <th className="px-3 py-2.5 text-left border border-slate-600 w-16">ITEM</th>
                  <th className="px-3 py-2.5 text-left border border-slate-600">TASK DESCRIPTION</th>
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-14">UNIT</th>
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-20">QTY</th>
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-24">RATE</th>
                  <th className="px-3 py-2.5 text-right border border-slate-600 w-28">SUB TOTAL</th>
                  <th className="px-3 py-2.5 text-right border border-slate-600 w-28">TOTAL</th>
                  <th className="px-3 py-2.5 text-left border border-slate-600 print:hidden">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(([sectionNo, { name, items: si }]) => {
                  const sectionTotal = si.reduce((s, it) => s + it.qty * it.rate, 0)
                  return (
                    <tr key={`g-${sectionNo}`} className="contents">
                      {/* section header */}
                      {(() => {
                        const rows = [
                          <tr key={`sh-${sectionNo}`} className="bg-blue-50 border-t-2 border-blue-200">
                            <td className="px-3 py-2 font-bold text-blue-800 border border-blue-200">{sectionNo}</td>
                            <td colSpan={7} className="px-3 py-2 font-bold text-blue-800 uppercase tracking-wide border border-blue-200">{name}</td>
                            <td className="border border-blue-200 print:hidden" />
                          </tr>,
                          ...si.map((item, idx) => {
                            const subTotal = item.qty * item.rate
                            return (
                              <tr key={item.item_code} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="px-3 py-1.5 border border-slate-100 text-slate-300" />
                                <td className="px-3 py-1.5 border border-slate-100 font-mono text-xs text-slate-500">{item.item_code}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-slate-800">{item.description}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-center font-mono text-xs text-slate-500">{item.unit}</td>
                                <td className="px-1 py-1 border border-slate-100">
                                  <input type="number" min="0" step="any" value={item.qty || ''} placeholder="0" onChange={e => updateItem(item.item_code, 'qty', e.target.value)} className="w-full text-center text-sm font-medium bg-blue-50/60 border border-blue-100 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 print:bg-transparent print:border-0" />
                                </td>
                                <td className="px-1 py-1 border border-slate-100">
                                  <input type="number" min="0" step="any" value={item.rate || ''} placeholder="0" onChange={e => updateItem(item.item_code, 'rate', e.target.value)} className="w-full text-center text-sm font-medium bg-blue-50/60 border border-blue-100 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 print:bg-transparent print:border-0" />
                                </td>
                                <td className="px-3 py-1.5 border border-slate-100 text-right font-medium text-slate-700">{fmt(subTotal)}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-right font-bold text-slate-900">{idx === 0 && sectionTotal > 0 ? fmt(sectionTotal) : ''}</td>
                                <td className="px-1 py-1 border border-slate-100 print:hidden">
                                  <input type="text" value={item.remarks} placeholder="Notes…" onChange={e => updateItem(item.item_code, 'remarks', e.target.value)} className="w-full text-xs bg-transparent outline-none placeholder:text-slate-300" />
                                </td>
                              </tr>
                            )
                          }),
                          <tr key={`st-${sectionNo}`} className="bg-slate-100">
                            <td colSpan={6} className="px-3 py-1.5 text-right text-xs font-semibold text-slate-600 border border-slate-200">{name} — SECTION TOTAL</td>
                            <td className="px-3 py-1.5 text-right font-bold text-slate-900 border border-slate-200">{fmt(sectionTotal)}</td>
                            <td className="px-3 py-1.5 border border-slate-200" />
                            <td className="px-3 py-1.5 border border-slate-200 print:hidden" />
                          </tr>,
                        ]
                        return rows
                      })()}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t-2 border-slate-800 bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
            <span className="font-bold text-sm tracking-wide">GRAND TOTAL</span>
            <span className="text-xl font-bold">AED {grandTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Summary Schedule */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="bg-slate-800 text-white px-5 py-2.5"><h3 className="font-bold text-sm tracking-wide">SUMMARY SCHEDULE</h3></div>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-slate-100"><th className="px-4 py-2 text-left border border-slate-200 w-10">N</th><th className="px-4 py-2 text-left border border-slate-200">DESCRIPTION</th><th className="px-4 py-2 text-right border border-slate-200 w-40">TOTAL AMOUNT (AED)</th></tr></thead>
            <tbody>
              {sections.map(([sectionNo, { name, items: si }]) => {
                const t = si.reduce((s, it) => s + it.qty * it.rate, 0)
                return <tr key={sectionNo} className={sectionNo % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}><td className="px-4 py-1.5 border border-slate-100 font-medium text-slate-700">{sectionNo}</td><td className="px-4 py-1.5 border border-slate-100 text-slate-700">{name}</td><td className="px-4 py-1.5 border border-slate-100 text-right font-semibold text-slate-900">{t > 0 ? fmt(t) : '—'}</td></tr>
              })}
            </tbody>
            <tfoot><tr className="bg-slate-800 text-white"><td colSpan={2} className="px-4 py-2.5 font-bold tracking-wide">GRAND TOTAL</td><td className="px-4 py-2.5 text-right font-bold text-lg">{grandTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td></tr></tfoot>
          </table>
        </div>

        {/* Signatures */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
          <div className="grid grid-cols-2 gap-12 mt-8">
            <div className="text-center"><div className="border-t border-slate-400 pt-2 mt-8"><p className="text-sm font-semibold text-slate-700">OWNER</p><p className="text-xs text-slate-400 mt-0.5">{header.owner || '___________________________'}</p></div></div>
            <div className="text-center"><div className="border-t border-slate-400 pt-2 mt-8"><p className="text-sm font-semibold text-slate-700">CONTRACTOR</p><p className="text-xs text-slate-400 mt-0.5">{header.contractor}</p></div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
