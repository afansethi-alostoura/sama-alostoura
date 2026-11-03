import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id                  TEXT PRIMARY KEY DEFAULT 'emp-' || extract(epoch from now())::bigint || '-' || floor(random()*10000)::int,
      name                TEXT NOT NULL,
      role                TEXT NOT NULL,
      nationality         TEXT DEFAULT '',
      phone               TEXT,
      email               TEXT,
      salary              DECIMAL(12,2) DEFAULT 0,
      join_date           DATE,
      visa_expiry         DATE,
      emirates_id_expiry  DATE,
      passport_expiry     DATE,
      labour_card_expiry  DATE,
      status              TEXT DEFAULT 'active',
      notes               TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await query(`SELECT * FROM employees ORDER BY name`)
    return NextResponse.json({ employees: rows })
  } catch (err) {
    console.error('[Staff GET]', err)
    return NextResponse.json({ employees: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const b = await req.json()
    if (!b.name || !b.role) return NextResponse.json({ error: 'Name and role required' }, { status: 400 })
    const rows = await query(
      `INSERT INTO employees (name,role,nationality,phone,email,salary,join_date,visa_expiry,emirates_id_expiry,passport_expiry,labour_card_expiry,status,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [b.name, b.role, b.nationality??'', b.phone??null, b.email??null, Number(b.salary)||0,
       b.join_date||null, b.visa_expiry||null, b.emirates_id_expiry||null,
       b.passport_expiry||null, b.labour_card_expiry||null, b.status??'active', b.notes??null]
    )
    return NextResponse.json({ employee: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[Staff POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
