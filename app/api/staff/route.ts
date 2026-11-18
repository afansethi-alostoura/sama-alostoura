import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ── Seed roster ───────────────────────────────────────────────────────────────
const SEED_STAFF = [
  { name: 'Managing Director',                role: 'Managing Director',                department: 'Executive & Business Development', avatar_color: '#1e3a8a', sort_order: 1  },
  { name: 'Sales Executive',                  role: 'Sales & Client Relations Executive', department: 'Executive & Business Development', avatar_color: '#3730a3', sort_order: 2  },
  { name: 'Estimation Engineer',              role: 'Estimation Engineer / QS',          department: 'Engineering, Estimation & Approvals', avatar_color: '#0369a1', sort_order: 3  },
  { name: 'Draftsman',                        role: 'Draftsman',                         department: 'Engineering, Estimation & Approvals', avatar_color: '#0891b2', sort_order: 4  },
  { name: 'PRO / Authority Liaison',          role: 'PRO / Authority Liaison Engineer',  department: 'Engineering, Estimation & Approvals', avatar_color: '#0e7490', sort_order: 5  },
  { name: 'Project Manager',                  role: 'Project Manager',                   department: 'Site Execution & Supervision',         avatar_color: '#15803d', sort_order: 6  },
  { name: 'Site Civil Engineer',              role: 'Site Civil Engineer',               department: 'Site Execution & Supervision',         avatar_color: '#16a34a', sort_order: 7  },
  { name: 'MEP Engineer',                     role: 'MEP Engineer / Coordinator',        department: 'Site Execution & Supervision',         avatar_color: '#0d9488', sort_order: 8  },
  { name: 'General Foreman',                  role: 'General Foreman / Site Supervisor', department: 'Site Execution & Supervision',         avatar_color: '#65a30d', sort_order: 9  },
  { name: 'Safety Officer',                   role: 'HSE / Safety Officer',              department: 'Site Execution & Supervision',         avatar_color: '#dc2626', sort_order: 10 },
  { name: 'Procurement Officer',              role: 'Procurement Officer',               department: 'Procurement & Logistics',              avatar_color: '#b45309', sort_order: 11 },
  { name: 'Storekeeper',                      role: 'Storekeeper / Logistics Coordinator', department: 'Procurement & Logistics',            avatar_color: '#d97706', sort_order: 12 },
  { name: 'Accountant',                       role: 'Accountant',                        department: 'Finance, HR & Administration',         avatar_color: '#7c3aed', sort_order: 13 },
  { name: 'HR Coordinator',                   role: 'HR & Admin Coordinator',            department: 'Finance, HR & Administration',         avatar_color: '#9333ea', sort_order: 14 },
]

// ── Default responsibilities per role ─────────────────────────────────────────
const ROLE_RESP: Record<string, string[]> = {
  'Managing Director': [
    'Final sign-off on high-value villa/renovation contracts',
    'Key client closing and strategic partnerships',
    'Banking & credit line approvals',
    'Strategic business growth planning',
    'Resolving escalated project disputes',
  ],
  'Sales & Client Relations Executive': [
    'Capturing incoming project inquiries (WhatsApp, phone, web)',
    'Qualifying client budgets and project requirements',
    'Scheduling and attending initial site visits',
    'Sending proposals and following up until contract signing',
  ],
  'Estimation Engineer / QS': [
    'Preparing detailed Bills of Quantities (BOQ)',
    'Conducting material take-offs from architectural/structural drawings',
    'Pricing tenders and comparing subcontractor quotes',
    'Tracking project profit margins vs. actual costs',
    'Value-engineering revisions and cost optimization',
  ],
  'Draftsman': [
    'Producing shop drawings and as-built drawings',
    'Municipality submission layouts and AutoCAD drawings',
    '3D interior/elevation renders for client approvals',
    'Design-and-build concept layouts',
  ],
  'PRO / Authority Liaison Engineer': [
    'Managing building permits and NOC applications (DEWA, Etisalat/du, Civil Defense)',
    'Submitting drawings on authority portals (Dubai Municipality / DDA / Trakhees)',
    'Booking municipality inspections',
    'Permit and authority clearance tracking',
  ],
  'Project Manager': [
    'Managing multiple active villa/fit-out sites simultaneously',
    'Maintaining project schedules and Gantt timelines',
    'Leading weekly client site meetings',
    'Coordinating between office engineers and field teams',
  ],
  'Site Civil Engineer': [
    'Supervising daily structural and finishing execution (excavation, concrete, blockwork, plastering, tiling)',
    'Verifying site measurements against approved drawings',
    'Ensuring QA/QC compliance before municipality inspections',
    'Handling site technical queries and inspection checklists',
  ],
  'MEP Engineer / Coordinator': [
    'Overseeing Mechanical, Electrical, and Plumbing works (HVAC, DB boards, drainage, pumps)',
    'Reviewing MEP shop drawings',
    'Managing testing and commissioning of MEP systems',
    'Coordinating specialized MEP subcontractors',
  ],
  'General Foreman / Site Supervisor': [
    'Direct daily supervision of labor crew and trade teams',
    'Assigning daily targets and tracking material consumption',
    'Enforcing site discipline and productivity',
    'Coordinating subcontractor crew allocation and manpower',
  ],
  'HSE / Safety Officer': [
    'Enforcing Dubai Municipality safety regulations on-site',
    'Scaffolding tags, PPE compliance, fire extinguisher checks',
    'Heat-stress protocols compliance',
    'Ensuring zero accidents and zero authority fines',
    'Safety audit tasks and site compliance sign-offs',
  ],
  'Procurement Officer': [
    'Sourcing building materials (tiles, sanitary ware, steel, cement, fixtures)',
    'Negotiating supplier credit terms',
    'Comparing minimum 3 quotes per item before purchase',
    'Issuing Local Purchase Orders (LPOs)',
  ],
  'Storekeeper / Logistics Coordinator': [
    'Receiving and verifying material deliveries against LPOs',
    'Preventing material wastage and theft on-site',
    'Tracking inventory across multiple active sites',
    'Scheduling company pickup/van dispatches',
  ],
  'Accountant': [
    'Recording daily project expenses',
    'Managing client progress payment certificates (invoices)',
    'Verifying subcontractor payment certificates',
    'Reconciling supplier bills',
    'Handling UAE VAT & Corporate Tax compliance',
  ],
  'HR & Admin Coordinator': [
    'Managing employee visas, Emirates IDs, and medical insurance',
    'WPS monthly payroll processing',
    'Leave tracking and HR record management',
    'Labor accommodation logistics',
    'Recruitment and manpower agency coordination',
  ],
}

async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS staff_members (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL,
      department   TEXT NOT NULL,
      email        TEXT,
      phone        TEXT,
      status       TEXT NOT NULL DEFAULT 'active',
      staff_status TEXT NOT NULL DEFAULT 'Available',
      avatar_color TEXT NOT NULL DEFAULT '#3b82f6',
      sort_order   INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Add staff_status column if upgrading from old schema
  await query(`ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS staff_status TEXT NOT NULL DEFAULT 'Available'`).catch(() => {})

  await query(`
    CREATE TABLE IF NOT EXISTS staff_leads (
      id         SERIAL PRIMARY KEY,
      staff_id   INTEGER REFERENCES staff_members(id) ON DELETE CASCADE,
      lead_name  TEXT NOT NULL,
      project    TEXT,
      status     TEXT NOT NULL DEFAULT 'new',
      priority   TEXT NOT NULL DEFAULT 'medium',
      notes      TEXT,
      due_date   DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS staff_responsibilities (
      id             SERIAL PRIMARY KEY,
      staff_id       INTEGER REFERENCES staff_members(id) ON DELETE CASCADE,
      responsibility TEXT NOT NULL,
      sort_order     INTEGER DEFAULT 0
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS staff_activities (
      id         SERIAL PRIMARY KEY,
      staff_id   INTEGER REFERENCES staff_members(id) ON DELETE CASCADE,
      note       TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'User',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Insert missing seed staff (idempotent by role name)
  for (const s of SEED_STAFF) {
    await query(
      `INSERT INTO staff_members (name, role, department, avatar_color, sort_order)
       SELECT $1,$2,$3,$4,$5
       WHERE NOT EXISTS (SELECT 1 FROM staff_members WHERE role=$2)`,
      [s.name, s.role, s.department, s.avatar_color, s.sort_order]
    )
  }

  // Seed responsibilities for staff that have none
  const staffRows = await query(`SELECT id, role FROM staff_members`) as { id: number; role: string }[]
  for (const s of staffRows) {
    const existing = await query(`SELECT COUNT(*) as cnt FROM staff_responsibilities WHERE staff_id=$1`, [s.id])
    const count = parseInt((existing[0] as { cnt: string }).cnt)
    if (count === 0 && ROLE_RESP[s.role]) {
      for (let i = 0; i < ROLE_RESP[s.role].length; i++) {
        await query(
          `INSERT INTO staff_responsibilities (staff_id, responsibility, sort_order) VALUES ($1,$2,$3)`,
          [s.id, ROLE_RESP[s.role][i], i]
        )
      }
    }
  }
}

export async function GET() {
  try {
    await ensureTables()
    const rows = await query(`
      SELECT s.*,
             COUNT(l.id) FILTER (WHERE l.status NOT IN ('won','completed','lost')) AS lead_count
      FROM staff_members s
      LEFT JOIN staff_leads l ON l.staff_id = s.id
      GROUP BY s.id
      ORDER BY s.sort_order, s.id
    `)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[GET /api/staff]', err)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables()
    const { name, role, department, email, phone, avatar_color, sort_order } = await req.json()
    if (!name || !role || !department) {
      return NextResponse.json({ error: 'name, role, department required' }, { status: 400 })
    }
    const rows = await query(
      `INSERT INTO staff_members (name, role, department, email, phone, avatar_color, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, role, department, email || null, phone || null, avatar_color || '#3b82f6', sort_order || 99]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
