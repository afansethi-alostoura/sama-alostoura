import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS company_docs (
      id                TEXT PRIMARY KEY DEFAULT 'doc-' || extract(epoch from now())::bigint || '-' || floor(random()*10000)::int,
      name              TEXT NOT NULL,
      category          TEXT NOT NULL,
      issuing_authority TEXT DEFAULT '',
      doc_number        TEXT,
      issue_date        DATE,
      expiry_date       DATE,
      reminder_days     INTEGER DEFAULT 30,
      notes             TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await query(`SELECT * FROM company_docs ORDER BY name`)
    return NextResponse.json({ docs: rows })
  } catch (err) {
    console.error('[CompanyDocs GET]', err)
    return NextResponse.json({ docs: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const b = await req.json()
    if (!b.name || !b.category)
      return NextResponse.json({ error: 'name and category required' }, { status: 400 })
    const rows = await query(
      `INSERT INTO company_docs (name,category,issuing_authority,doc_number,issue_date,expiry_date,reminder_days,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.name, b.category, b.issuing_authority??'', b.doc_number??null,
       b.issue_date||null, b.expiry_date||null, Number(b.reminder_days)||30, b.notes??null]
    )
    return NextResponse.json({ doc: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[CompanyDocs POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
