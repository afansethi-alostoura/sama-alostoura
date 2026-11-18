import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await query(
    `SELECT * FROM staff_activities WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [id]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { note, created_by } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'note required' }, { status: 400 })
  const rows = await query(
    `INSERT INTO staff_activities (staff_id, note, created_by) VALUES ($1,$2,$3) RETURNING *`,
    [id, note.trim(), created_by || 'User']
  )
  return NextResponse.json(rows[0], { status: 201 })
}
