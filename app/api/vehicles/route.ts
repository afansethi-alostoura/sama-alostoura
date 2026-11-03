import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id                  TEXT PRIMARY KEY DEFAULT 'veh-' || extract(epoch from now())::bigint || '-' || floor(random()*10000)::int,
      plate_number        TEXT NOT NULL,
      make                TEXT NOT NULL,
      model               TEXT NOT NULL,
      year                INTEGER,
      color               TEXT,
      type                TEXT DEFAULT 'Pickup',
      registration_expiry DATE,
      insurance_expiry    DATE,
      rta_test_expiry     DATE,
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
    const rows = await query(`SELECT * FROM vehicles ORDER BY plate_number`)
    return NextResponse.json({ vehicles: rows })
  } catch (err) {
    console.error('[Vehicles GET]', err)
    return NextResponse.json({ vehicles: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const b = await req.json()
    if (!b.plate_number || !b.make || !b.model)
      return NextResponse.json({ error: 'plate_number, make and model required' }, { status: 400 })
    const rows = await query(
      `INSERT INTO vehicles (plate_number,make,model,year,color,type,registration_expiry,insurance_expiry,rta_test_expiry,status,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.plate_number, b.make, b.model, b.year?Number(b.year):null, b.color??null,
       b.type??'Pickup', b.registration_expiry||null, b.insurance_expiry||null,
       b.rta_test_expiry||null, b.status??'active', b.notes??null]
    )
    return NextResponse.json({ vehicle: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[Vehicles POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
