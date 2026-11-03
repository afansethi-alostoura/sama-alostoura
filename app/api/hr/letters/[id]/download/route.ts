import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await query(`SELECT file_data, title, ref_no FROM hr_letters WHERE id=$1`, [id])
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const row = rows[0] as { file_data: string; title: string | null; ref_no: string | null }
    const buffer = Buffer.from(row.file_data, 'base64')
    const name = ((row.ref_no || row.title || id) as string).replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf'
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
