import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SEED_STAFF = [
  { name: 'Managing Director',    role: 'Managing Director',       department: 'Management',               avatar_color: '#1e3a8a', sort_order: 1  },
  { name: 'General Manager',      role: 'General Manager',          department: 'Management',               avatar_color: '#1d4ed8', sort_order: 2  },
  { name: 'Project Manager',      role: 'Project Manager',          department: 'Engineering & Site',       avatar_color: '#15803d', sort_order: 3  },
  { name: 'Site Engineer',        role: 'Site Engineer',            department: 'Engineering & Site',       avatar_color: '#16a34a', sort_order: 4  },
  { name: 'MEP Engineer',         role: 'MEP Engineer',             department: 'Engineering & Site',       avatar_color: '#0d9488', sort_order: 5  },
  { name: 'Safety Officer',       role: 'Safety Officer (HSE)',     department: 'Engineering & Site',       avatar_color: '#dc2626', sort_order: 6  },
  { name: 'Foreman',              role: 'Foreman / Site Supervisor', department: 'Engineering & Site',      avatar_color: '#65a30d', sort_order: 7  },
  { name: 'Quantity Surveyor',    role: 'Quantity Surveyor (QS)',   department: 'Commercial & Procurement', avatar_color: '#b45309', sort_order: 8  },
  { name: 'Procurement Officer',  role: 'Procurement Officer',      department: 'Commercial & Procurement', avatar_color: '#d97706', sort_order: 9  },
  { name: 'Estimator',            role: 'Estimator',                department: 'Commercial & Procurement', avatar_color: '#ca8a04', sort_order: 10 },
  { name: 'Accountant',           role: 'Accountant',               department: 'Admin & Finance',          avatar_color: '#7c3aed', sort_order: 11 },
  { name: 'HR & Admin Officer',   role: 'HR & Admin Officer',       department: 'Admin & Finance',          avatar_color: '#9333ea', sort_order: 12 },
  { name: 'Document Controller',  role: 'Document Controller',      department: 'Admin & Finance',          avatar_color: '#6366f1', sort_order: 13 },
]

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
      avatar_color TEXT NOT NULL DEFAULT '#3b82f6',
      sort_order   INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS staff_leads (
      id         SERIAL PRIMARY KEY,
      staff_id   INTEGER REFERENCES staff_members(id) ON DELETE CASCADE,
      lead_name  TEXT NOT NULL,
      project    TEXT,
      status     TEXT NOT NULL DEFAULT 'active',
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

  // Seed if empty
  const existing = await query(`SELECT COUNT(*) as cnt FROM staff_members`)
  const count = parseInt((existing[0] as { cnt: string }).cnt)
  if (count === 0) {
    for (const s of SEED_STAFF) {
      await query(
        `INSERT INTO staff_members (name, role, department, avatar_color, sort_order)
         VALUES ($1,$2,$3,$4,$5)`,
        [s.name, s.role, s.department, s.avatar_color, s.sort_order]
      )
    }
  }
}

export async function GET() {
  try {
    await ensureTables()
    const rows = await query(`
      SELECT s.*,
             COUNT(l.id) FILTER (WHERE l.status = 'active') AS lead_count
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
