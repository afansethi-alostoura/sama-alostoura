import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await query(`SELECT * FROM staff_members WHERE id=$1`, [id])
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const resps = await query(
      `SELECT * FROM staff_responsibilities WHERE staff_id=$1 ORDER BY sort_order`,
      [id]
    )
    return NextResponse.json({ ...(rows[0] as object), responsibilities: resps })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, role, department, email, phone, avatar_color, status } = await req.json()
    const rows = await query(
      `UPDATE staff_members SET name=$1, role=$2, department=$3, email=$4, phone=$5,
       avatar_color=$6, status=$7 WHERE id=$8 RETURNING *`,
      [name, role, department, email || null, phone || null, avatar_color, status || 'active', id]
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM staff_members WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
