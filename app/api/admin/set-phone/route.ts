import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string; phone?: string
    role?: string; department?: string
  }
  const { name, phone, role, department } = body

  if (!name || !phone) {
    const all = await query(`SELECT id, name, role, department, phone, status FROM staff_members ORDER BY name`)
    return NextResponse.json({ staff: all })
  }

  // Try to update existing staff by name
  const updated = await query(
    `UPDATE staff_members SET phone=$1 WHERE LOWER(name) LIKE LOWER($2) RETURNING id, name, role, phone`,
    [phone, `%${name}%`]
  ) as Array<{ id: number; name: string; role: string; phone: string }>

  if (updated.length) return NextResponse.json({ updated })

  // Not found — insert new staff member
  const inserted = await query(
    `INSERT INTO staff_members (name, role, department, phone, status)
     VALUES ($1, $2, $3, $4, 'active') RETURNING id, name, role, phone`,
    [
      name,
      role       ?? 'General Foreman / Site Supervisor',
      department ?? 'Site Execution & Supervision',
      phone,
    ]
  ) as Array<{ id: number; name: string; role: string; phone: string }>

  return NextResponse.json({ inserted })
}
