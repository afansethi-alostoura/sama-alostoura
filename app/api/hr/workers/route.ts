import { NextRequest, NextResponse } from 'next/server'
import { query, isDbConfigured } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS workers (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      monthly_salary DECIMAL(12,2) NOT NULL,
      position       TEXT DEFAULT 'Laborer',
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json([])
  try {
    await ensureTable()
    const rows = await query('SELECT * FROM workers ORDER BY name')
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, monthly_salary, position } = await req.json()
    if (!name || !monthly_salary) {
      return NextResponse.json({ error: 'name and monthly_salary required' }, { status: 400 })
    }
    if (!isDbConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
    await ensureTable()
    const rows = await query(
      'INSERT INTO workers (name, monthly_salary, position) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), parseFloat(monthly_salary), position || 'Laborer']
    )
    return NextResponse.json(rows[0])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, name, monthly_salary, position } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (!isDbConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
    await ensureTable()
    const rows = await query(
      'UPDATE workers SET name=$1, monthly_salary=$2, position=$3 WHERE id=$4 RETURNING *',
      [name.trim(), parseFloat(monthly_salary), position || 'Laborer', id]
    )
    return NextResponse.json(rows[0] ?? {})
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    if (!isDbConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })
    await query('DELETE FROM workers WHERE id=$1', [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
