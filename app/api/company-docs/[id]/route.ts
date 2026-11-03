import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const rows = await query(
      `UPDATE company_docs SET name=$1,category=$2,issuing_authority=$3,doc_number=$4,
        issue_date=$5,expiry_date=$6,reminder_days=$7,notes=$8,updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [b.name, b.category, b.issuing_authority??'', b.doc_number??null,
       b.issue_date||null, b.expiry_date||null, Number(b.reminder_days)||30, b.notes??null, id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ doc: rows[0] })
  } catch (err) {
    console.error('[CompanyDocs PATCH]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM company_docs WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[CompanyDocs DELETE]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
