# Estimation Engineer Module - Implementation Guide

## Overview

The Estimation Engineer module enables Sama Alostoura to automatically generate accurate Bills of Quantities (BOQ) from architectural drawings using AI. The module supports PDF, JPG, PNG, DWG, and DXF file uploads and leverages Claude Vision API for professional dimension extraction.

## Architecture

### Core Components

1. **Frontend Pages**
   - `/estimation` - Main dashboard listing all BOQs
   - `/estimation/create` - File upload and project details
   - `/estimation/[id]` - BOQ editor with line-item editing

2. **API Routes**
   - `POST /api/rates` - Create/update rate library items
   - `GET /api/rates` - Fetch all rates (with optional category filter)
   - `POST /api/rates/seed` - Initialize rate library with standard rates
   - `POST /api/boqs` - Create BOQ
   - `GET /api/boqs` - Fetch BOQ(s)
   - `PUT /api/boqs` - Update BOQ
   - `DELETE /api/boqs` - Delete BOQ
   - `POST /api/boqs/items` - Add/update BOQ items
   - `DELETE /api/boqs/items` - Delete BOQ item
   - `GET /api/boqs/export-pdf` - Export BOQ as PDF
   - `POST /api/estimations/upload` - File upload handler
   - `POST /api/agents/estimation-engineer` - AI extraction agent

3. **Data Models**
   - `RateLibraryItem` - Unit rate for construction items
   - `BOQItem` - Individual line item in a BOQ
   - `BOQ` - Complete bill of quantities document

4. **Stores** (File-based)
   - `.rates-data.json` - Rate library persistence
   - `.boq-data.json` - BOQ documents persistence
   - `.uploads/` - Temporary uploaded files

## Setup & Installation

### 1. Install Dependencies

```bash
cd sama-alostoura
npm install
```

New packages added:
- `pdfkit` - PDF generation
- `pdf-parse` - PDF text extraction
- `dxf` - AutoCAD DWG/DXF parsing
- `sharp` - Image processing

### 2. Initialize Rate Library

The rate library must be seeded before first use. Two options:

**Option A: Auto-seed with default rates**
```bash
curl -X POST http://localhost:3000/api/rates/seed
```

This creates a `.rates-data.json` file with 60+ standard Sama Alostoura rates extracted from your BOQ template.

**Option B: Custom Excel import**

If you have custom rates in an Excel file:
1. Convert Excel to JSON format
2. POST to `/api/rates` with array of items:

```bash
curl -X POST http://localhost:3000/api/rates \
  -H "Content-Type: application/json" \
  -d '{
    "seed": true,
    "rates": [
      {
        "description": "EXCAVATION",
        "unit": "M3",
        "unitRate": 25,
        "category": "Excavation and Backfilling"
      },
      ...
    ]
  }'
```

### 3. Environment Variables

Ensure `.env.local` contains:
```
SAMA_AI_KEY=your-anthropic-api-key
```

The module uses the existing `lib/anthropic.ts` client configured with `claude-sonnet-4-6`.

## Usage Flow

### 1. Upload Drawing (User)
- Navigate to `/estimation`
- Click "Upload Drawing"
- Select PDF, JPG, PNG, DWG, or DXF file
- Enter project details (name, plot size, floors, rooms, notes)
- System uploads file and shows preview

### 2. AI Extraction (Backend)
- Claude Vision analyzes the drawing
- Extracts dimensions: plot size, room layout, wall lengths, slab areas
- Matches extracted items to rate library by description
- Generates JSON BOQ with 40-100+ line items
- Assigns quantities and rates from drawing analysis

### 3. Review & Edit (User)
- Preview extracted BOQ items
- Click "Save" to persist BOQ
- Navigate to BOQ editor (`/estimation/{id}`)
- Edit any quantity, rate, or description
- Totals auto-calculate
- Add/delete items as needed

### 4. Export PDF (User)
- Click "Export PDF" button
- Professional PDF generated with:
  - Sama Alostoura branding (company name, address, date)
  - BOQ table grouped by section
  - Item quantities, rates, amounts
  - Section subtotals
  - Grand total with VAT
  - Signature line

## API Examples

### Create BOQ from Extracted Data

```bash
POST /api/boqs
{
  "projectId": "proj_123",
  "drawing_filename": "villa_floorplan.pdf",
  "extracted_dimensions": "Plot 500m², 2 floors, 6 rooms, ...",
  "items": [
    {
      "itemNo": 1,
      "section": "Mobilization",
      "description": "TEMPORARY CONNECTION OF WATER",
      "quantity": 1,
      "unit": "L.S",
      "unitRate": 5000
    },
    ...
  ]
}
```

### Update BOQ Item Quantity/Rate

```bash
PUT /api/boqs/items
{
  "boqId": "boq_123",
  "itemId": "item_456",
  "updates": {
    "quantity": 1500,  // will auto-calculate amount
    "unitRate": 30
  }
}
```

### Fetch All Rates for a Category

```bash
GET /api/rates?category=Excavation and Backfilling
```

Response:
```json
{
  "rates": [
    {
      "id": "rate_1",
      "description": "EXCAVATION",
      "unit": "M3",
      "unitRate": 25,
      "category": "Excavation and Backfilling"
    },
    ...
  ],
  "count": 5
}
```

## File Structure

```
app/
  ├── api/
  │   ├── rates/
  │   │   ├── route.ts          # CRUD operations
  │   │   └── seed/route.ts     # Initialize rate library
  │   ├── boqs/
  │   │   ├── route.ts          # BOQ CRUD
  │   │   ├── items/route.ts    # BOQ item operations
  │   │   └── export-pdf/route.ts
  │   ├── estimations/
  │   │   └── upload/route.ts   # File upload handler
  │   └── agents/
  │       └── estimation-engineer/route.ts  # AI agent
  └── estimation/
      ├── page.tsx             # Dashboard
      ├── create/page.tsx      # Upload & new BOQ
      └── [id]/page.tsx        # BOQ editor

lib/
  ├── rates-store.ts           # Rate library persistence
  └── boq-store.ts            # BOQ persistence

types/
  └── index.ts                # BOQ, BOQItem, RateLibraryItem types
```

## Data Persistence

### File-Based Storage (Current)

BOQs and rates are stored in JSON files in the project root:
- `.rates-data.json` - Array of RateLibraryItem
- `.boq-data.json` - Array of BOQ documents
- `.uploads/` - Temporary drawing files (deleted after processing)

### Database Migration (Future)

When ready for Supabase:

```sql
CREATE TABLE rate_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description VARCHAR NOT NULL,
  unit VARCHAR NOT NULL,
  unit_rate DECIMAL NOT NULL,
  category VARCHAR NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE boqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id VARCHAR,
  drawing_filename VARCHAR NOT NULL,
  extracted_dimensions TEXT,
  subtotal DECIMAL NOT NULL,
  vat DECIMAL,
  total DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE boq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boq_id UUID REFERENCES boqs(id) ON DELETE CASCADE,
  item_no INTEGER,
  section VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  quantity DECIMAL NOT NULL,
  unit VARCHAR NOT NULL,
  unit_rate DECIMAL NOT NULL,
  amount DECIMAL NOT NULL,
  notes TEXT
);
```

## AI Extraction Logic

The `estimation-engineer` agent:

1. **Accepts** file path, project context (name, plot size, floors, rooms)
2. **Reads** the uploaded drawing file
3. **Calls Claude Vision API** with system prompt instructing extraction
4. **Extracts** from drawing:
   - Physical dimensions (plot, wall lengths, areas, heights)
   - Implied work items (foundation type, wall heights, etc.)
   - Material specifications from drawing annotations
5. **Matches** extracted items to rate library by description similarity
6. **Calculates** quantities:
   - From explicit dimensions on drawing
   - From standard norms (e.g., 120mm brick wall = 1 layer solid block)
   - Escalates to surveyor for ambiguous cases
7. **Returns** JSON BOQ with amounts pre-calculated

## Rate Library Management

### Adding Rates via API

```bash
POST /api/rates
{
  "description": "EXCAVATION (Hard soil)",
  "unit": "M3",
  "unitRate": 35,
  "category": "Excavation and Backfilling",
  "notes": "Premium rate for rocky soil"
}
```

### Updating Rates

```bash
PUT /api/rates
{
  "id": "rate_123",
  "unitRate": 40,
  "notes": "Increased due to material costs"
}
```

### Getting Categories

```bash
GET /api/rates?categories=true
```

Returns: `{ "categories": ["Mobilization", "Excavation and Backfilling", ...] }`

## BOQ Sections (Standard for Sama Alostoura)

1. Mobilization
2. Excavation and Backfilling
3. Substructure
4. Super Structure
5. Block Works
6. Internal Plaster Works
7. External Plaster Works
8. Water Proofing Works
9. Electrical & Etisalat works
10. Plumbing & Drainage works
11. Air Condition
12. Fire Alarm System
13. Fixing & Supplying Flooring and Wall Tiling
14. Doors and Windows
15. Painting Works
16. False Ceiling Works
17. Carpentry Works
18. Kitchen Equipment
19. Provisional Items
20. Temporary Works
21. Maintenance Period
22. Final Cleaning
23. Site Supervision
24. Handover

## PDF Export Details

The PDF includes:
- **Header**: Company logo, name "Sama Alostoura", address "Dubai, UAE"
- **Title**: "BILL OF QUANTITIES"
- **Metadata**: Drawing filename, generation date, BOQ ID
- **Table**: 
  - Columns: Item No., Description, Qty, Unit, Rate, Amount
  - Sections with subtotal rows
  - Alternating row backgrounds for readability
- **Summary**: Subtotal, VAT (5%), Grand Total
- **Footer**: Signature line, generation timestamp
- **File**: Downloaded as `BOQ_{boqId}.pdf`

## Known Limitations

1. **DWG/DXF Parsing**: Limited layer extraction. Dimensions must be on visible layers.
2. **AI Extraction**: Claude Vision best for clear, legible drawings. Low-res/blurry images may reduce accuracy.
3. **File Upload**: Max 50MB per file.
4. **Rate Library**: Hardcoded category list. New categories require code changes.
5. **VAT**: Fixed at 5%. Configurable per project in future.

## Testing Checklist

- [ ] Rate library seeded (60+ items)
- [ ] Upload PDF drawing → AI extracts dimensions
- [ ] Upload JPG floor plan → BOQ items generated
- [ ] Edit BOQ quantities → Totals recalculate
- [ ] Edit rates → Amounts update correctly
- [ ] Add new item → Appears in BOQ
- [ ] Delete item → Totals update
- [ ] Export PDF → File downloads with correct formatting
- [ ] PDF shows company branding, all items, correct totals
- [ ] All 24 BOQ sections used in template

## Deployment

### Vercel Deployment

```bash
# Push to GitHub
git add .
git commit -m "Add Estimation Engineer module"
git push origin main

# Deploy via Vercel
vercel deploy
```

Ensure environment variables in Vercel dashboard:
- `SAMA_AI_KEY` = Your Anthropic API key

### File-Based Storage Note

`.rates-data.json` and `.boq-data.json` files will persist in Vercel serverless environment during a deployment. For production, recommend migrating to Supabase or AWS DynamoDB for scalability.

## Future Enhancements

1. **Supabase Integration** - Replace file-based storage with database
2. **Rate Categories** - Dynamic category management
3. **Project Integration** - Link BOQs to projects, track costs vs. actual
4. **Multi-Drawing** - One estimation with multiple files (plan + elevation + section)
5. **Approval Workflow** - Draft → Reviewed → Approved status
6. **Rate Versioning** - Historical rate tracking
7. **Export Formats** - Excel, CSV, JSON export
8. **Mobile Upload** - Mobile app for on-site drawing capture
9. **DWG Smart Parsing** - Automatic layer extraction and dimension reading
10. **Cost Analysis** - Estimated vs. actual cost comparison

## Support

For issues or questions:
1. Check logs in `/api/agents/estimation-engineer` for AI extraction errors
2. Verify `.rates-data.json` exists and contains rates
3. Test API endpoints directly with curl before using UI
4. Check file permissions on `.uploads/` directory

---

**Module Version**: 1.0  
**Last Updated**: 2026-05-24  
**Status**: Ready for Vercel deployment  
**Estimated Time to Production**: 1-2 hours (after npm install)
