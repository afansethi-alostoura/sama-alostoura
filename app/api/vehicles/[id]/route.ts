import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await req.json()
    const rows = await query(
      `UPDATE vehicles SET plate_number=$1,make=$2,model=$3,year=$4,color=$5,type=$6,
        registration_expiry=$7,insurance_expiry=$8,rta_test_expiry=$9,status=$10,notes=$11,updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [b.plate_number, b.make, b.model, b.year?Number(b.year):null, b.color??null,
       b.type??'Pickup', b.registration_expiry||null, b.insurance_expiry||null,
       b.rta_test_expiry||null, b.status??'active', b.notes??null, id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ vehicle: rows[0] })
  } catch (err) {
    console.error('[Vehicles PATCH]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await query(`DELETE FROM vehicles WHERE id=$1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Vehicles DELETE]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
