import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/hr/documents/[id] — stream the file for download/view
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const rows = await query(`SELECT file_name, file_type, file_data FROM hr_documents WHERE id=$1`, [id])
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { file_name, file_type, file_data } = rows[0]
    const buffer = Buffer.from(file_data, 'base64')
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        file_type,
        'Content-Disposition': `attachment; filename="${file_name}"`,
        'Content-Length':      String(buffer.length),
      },
    })
  } catch (err) {
    console.error('[hr/documents/:id GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/hr/documents/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM hr_documents WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[hr/documents/:id DELETE]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
