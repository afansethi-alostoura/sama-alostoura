import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_letter_assets (
      type      TEXT PRIMARY KEY,
      file_data TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// GET /api/hr/letters/assets?type=signature|stamp
export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const type = new URL(req.url).searchParams.get('type')
    if (type) {
      const rows = await query(`SELECT file_data, mime_type FROM hr_letter_assets WHERE type=$1`, [type])
      if (!rows.length) return NextResponse.json({ exists: false })
      const row = rows[0] as { file_data: string; mime_type: string }
      return NextResponse.json({ exists: true, data_url: `data:${row.mime_type};base64,${row.file_data}` })
    }
    const rows = await query(`SELECT type, mime_type FROM hr_letter_assets`)
    const result: Record<string, boolean> = {}
    for (const r of rows as { type: string }[]) result[r.type] = true
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/hr/letters/assets  — multipart: type (signature|stamp), file (PNG)
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const form = await req.formData()
    const type = form.get('type') as string
    const file = form.get('file') as File | null
    if (!type || !file) return NextResponse.json({ error: 'type and file required' }, { status: 400 })
    if (!['signature', 'stamp'].includes(type)) return NextResponse.json({ error: 'type must be signature or stamp' }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Max 5 MB' }, { status: 400 })
    const bytes = await file.arrayBuffer()
    const b64   = Buffer.from(bytes).toString('base64')
    const mime  = file.type || 'image/png'
    await query(
      `INSERT INTO hr_letter_assets (type, file_data, mime_type, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (type) DO UPDATE SET file_data=$2, mime_type=$3, updated_at=NOW()`,
      [type, b64, mime]
    )
    return NextResponse.json({ success: true, type })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const type = new URL(req.url).searchParams.get('type')
    if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })
    await query(`DELETE FROM hr_letter_assets WHERE type=$1`, [type])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
