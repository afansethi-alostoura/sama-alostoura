import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await query(
      `SELECT * FROM staff_leads WHERE staff_id=$1 ORDER BY created_at DESC`,
      [id]
    )
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { lead_name, project, status, priority, notes, due_date } = await req.json()
    if (!lead_name) return NextResponse.json({ error: 'lead_name required' }, { status: 400 })
    const rows = await query(
      `INSERT INTO staff_leads (staff_id, lead_name, project, status, priority, notes, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, lead_name, project || null, status || 'active', priority || 'medium', notes || null, due_date || null]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { lead_id, lead_name, project, status, priority, notes, due_date } = await req.json()
    const rows = await query(
      `UPDATE staff_leads SET lead_name=$1, project=$2, status=$3, priority=$4, notes=$5, due_date=$6
       WHERE id=$7 AND staff_id=$8 RETURNING *`,
      [lead_name, project || null, status, priority, notes || null, due_date || null, lead_id, id]
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const leadId = new URL(req.url).searchParams.get('lead_id')
    await query(`DELETE FROM staff_leads WHERE id=$1 AND staff_id=$2`, [leadId, id])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
