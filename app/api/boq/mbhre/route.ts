import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  try {
    if (id) {
      const row = await queryOne('SELECT * FROM mbhre_boq WHERE id = $1', [id])
      return NextResponse.json(row ?? null)
    }
    const rows = await query(
      'SELECT id, file_no, owner_name, contractor, consultant, date_field, created_at, updated_at FROM mbhre_boq ORDER BY created_at DESC',
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { date_field, file_no, contract_value_text, owner_name, contractor, consultant, items } = await req.json()
  try {
    const row = await queryOne(
      `INSERT INTO mbhre_boq (id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, items)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [date_field, file_no, contract_value_text, owner_name, contractor, consultant, JSON.stringify(items ?? [])],
    )
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, items } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const pool = getPool()
    const result = await pool.query(
      `UPDATE mbhre_boq SET
         date_field          = $2,
         file_no             = $3,
         contract_value_text = $4,
         owner_name          = $5,
         contractor          = $6,
         consultant          = $7,
         items               = $8,
         updated_at          = NOW()
       WHERE id = $1 RETURNING *`,
      [id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, JSON.stringify(items ?? [])],
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await query('DELETE FROM mbhre_boq WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
