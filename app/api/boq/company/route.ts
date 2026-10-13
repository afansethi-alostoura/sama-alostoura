import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  try {
    if (id) {
      const row = await queryOne('SELECT * FROM company_boq WHERE id = $1', [id])
      return NextResponse.json(row ?? null)
    }
    const rows = await query(
      'SELECT id, project_number, project_name, area, owner, contractor, created_at, updated_at FROM company_boq ORDER BY created_at DESC',
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { project_number, project_name, area, owner, contractor, items } = await req.json()
  try {
    const row = await queryOne(
      `INSERT INTO company_boq (id, project_number, project_name, area, owner, contractor, items)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [project_number, project_name, area, owner, contractor, JSON.stringify(items ?? [])],
    )
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, project_number, project_name, area, owner, contractor, items } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const pool = getPool()
    const result = await pool.query(
      `INSERT INTO company_boq (id, project_number, project_name, area, owner, contractor, items, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         project_number = EXCLUDED.project_number,
         project_name   = EXCLUDED.project_name,
         area           = EXCLUDED.area,
         owner          = EXCLUDED.owner,
         contractor     = EXCLUDED.contractor,
         items          = EXCLUDED.items,
         updated_at     = NOW()
       RETURNING *`,
      [id, project_number, project_name, area, owner, contractor, JSON.stringify(items ?? [])],
    )
    return NextResponse.json(result.rows[0])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    await query('DELETE FROM company_boq WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
