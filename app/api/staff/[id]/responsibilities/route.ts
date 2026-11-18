import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await query(`SELECT * FROM staff_responsibilities WHERE staff_id=$1 ORDER BY sort_order`, [id])
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { responsibility } = await req.json()
  if (!responsibility) return NextResponse.json({ error: 'responsibility required' }, { status: 400 })
  const rows = await query(
    `INSERT INTO staff_responsibilities (staff_id, responsibility, sort_order)
     SELECT $1,$2,COALESCE(MAX(sort_order)+1,0) FROM staff_responsibilities WHERE staff_id=$1
     RETURNING *`,
    [id, responsibility]
  )
  return NextResponse.json(rows[0], { status: 201 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { resp_id, responsibility } = await req.json()
  const rows = await query(
    `UPDATE staff_responsibilities SET responsibility=$1 WHERE id=$2 AND staff_id=$3 RETURNING *`,
    [responsibility, resp_id, id]
  )
  return NextResponse.json(rows[0])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resp_id = new URL(req.url).searchParams.get('resp_id')
  await query(`DELETE FROM staff_responsibilities WHERE id=$1 AND staff_id=$2`, [resp_id, id])
  return NextResponse.json({ success: true })
}
