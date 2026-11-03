import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const rows = await query(
      `UPDATE employees SET
        name=$1, role=$2, nationality=$3, phone=$4, email=$5, salary=$6,
        join_date=$7, visa_expiry=$8, emirates_id_expiry=$9,
        passport_expiry=$10, labour_card_expiry=$11, status=$12, notes=$13,
        updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [b.name, b.role, b.nationality??'', b.phone??null, b.email??null, Number(b.salary)||0,
       b.join_date||null, b.visa_expiry||null, b.emirates_id_expiry||null,
       b.passport_expiry||null, b.labour_card_expiry||null, b.status??'active', b.notes??null, id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ employee: rows[0] })
  } catch (err) {
    console.error('[Staff PATCH]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM employees WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Staff DELETE]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
