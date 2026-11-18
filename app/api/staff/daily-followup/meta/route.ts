import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  try {
    const rows = await query(`
      SELECT f.project_name, f.status, s.name AS staff_name
      FROM staff_followups f
      JOIN staff_members s ON s.id = f.staff_id
      WHERE f.token = $1
    `, [token]) as Array<{ project_name: string; status: string; staff_name: string }>

    if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
