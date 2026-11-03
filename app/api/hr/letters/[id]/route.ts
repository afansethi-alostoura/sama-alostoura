import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await query(`SELECT id, ref_no, title, issued_to, issued_by, letter_date, file_data FROM hr_letters WHERE id=$1`, [id])
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = rows[0]
    // If ?meta=1 return JSON metadata (for verify page)
    return NextResponse.json({
      id: row.id,
      ref_no: row.ref_no,
      title: row.title,
      issued_to: row.issued_to,
      issued_by: row.issued_by,
      letter_date: row.letter_date,
      has_file: !!row.file_data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM hr_letters WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
