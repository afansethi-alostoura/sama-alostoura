import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_documents (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      label       TEXT,
      file_name   TEXT NOT NULL,
      file_type   TEXT NOT NULL,
      file_data   TEXT NOT NULL,
      file_size   INTEGER,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS hr_documents_entity ON hr_documents(entity_type, entity_id)`)
}

// GET /api/hr/documents?entity_id=xxx&entity_type=employee
export async function GET(req: NextRequest) {
  try {
    await ensureTable()
    const { searchParams } = new URL(req.url)
    const entity_id   = searchParams.get('entity_id')
    const entity_type = searchParams.get('entity_type')
    if (!entity_id || !entity_type) return NextResponse.json([])
    const rows = await query(
      `SELECT id, entity_type, entity_id, label, file_name, file_type, file_size, created_at
       FROM hr_documents WHERE entity_id=$1 AND entity_type=$2 ORDER BY created_at DESC`,
      [entity_id, entity_type]
    )
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[hr/documents GET]', err)
    return NextResponse.json([])
  }
}

// POST /api/hr/documents  — multipart form: entity_id, entity_type, label, file
export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const form        = await req.formData()
    const entity_id   = form.get('entity_id')   as string
    const entity_type = form.get('entity_type') as string
    const label       = form.get('label')       as string | null
    const file        = form.get('file')        as File | null

    if (!entity_id || !entity_type || !file) {
      return NextResponse.json({ error: 'entity_id, entity_type and file are required' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })
    }

    const bytes    = await file.arrayBuffer()
    const base64   = Buffer.from(bytes).toString('base64')

    const rows = await query(
      `INSERT INTO hr_documents (entity_type, entity_id, label, file_name, file_type, file_data, file_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, entity_type, entity_id, label, file_name, file_type, file_size, created_at`,
      [entity_type, entity_id, label || null, file.name, file.type || 'application/octet-stream', base64, file.size]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error('[hr/documents POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
