import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  try {
    if (id) {
      const row = await queryOne('SELECT * FROM renovation_boq WHERE id = $1', [id])
      return NextResponse.json(row ?? null)
    }
    const rows = await query(
      'SELECT id, project_number, project_name, area, owner, contractor, project_location, client_name, created_at, updated_at FROM renovation_boq ORDER BY created_at DESC',
    )
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { project_number, project_name, area, owner, contractor, client_name, project_location, sections } = await req.json()
  try {
    const row = await queryOne(
      `INSERT INTO renovation_boq (id, project_number, project_name, area, owner, contractor, project_location, client_name, sections)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        project_number ?? '',
        project_name ?? '',
        area ?? project_location ?? '',
        owner ?? client_name ?? '',
        contractor ?? 'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
        area ?? project_location ?? '',
        owner ?? client_name ?? '',
        JSON.stringify(sections ?? []),
      ],
    )
    return NextResponse.json(row)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const { id, project_number, project_name, area, owner, contractor, client_name, project_location, sections } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const pool = getPool()
    const result = await pool.query(
      `UPDATE renovation_boq SET
         project_number   = $2,
         project_name     = $3,
         area             = $4,
         owner            = $5,
         contractor       = $6,
         project_location = $7,
         client_name      = $8,
         sections         = $9,
         updated_at       = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        project_number ?? '',
        project_name ?? '',
        area ?? project_location ?? '',
        owner ?? client_name ?? '',
        contractor ?? 'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
        area ?? project_location ?? '',
        owner ?? client_name ?? '',
        JSON.stringify(sections ?? []),
      ],
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
    await query('DELETE FROM renovation_boq WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
