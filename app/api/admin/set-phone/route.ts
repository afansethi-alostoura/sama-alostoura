import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { name, phone } = await req.json()
  if (name && phone) {
    const rows = await query(
      `UPDATE staff_members SET phone=$1 WHERE LOWER(name) LIKE LOWER($2) RETURNING id, name, role, phone`,
      [phone, `%${name}%`]
    ) as Array<{ id: number; name: string; role: string; phone: string }>
    return NextResponse.json({ updated: rows })
  }
  // List all staff if no name/phone provided
  const all = await query(`SELECT id, name, role, department, phone, status FROM staff_members ORDER BY name`)
  return NextResponse.json({ staff: all })
}
