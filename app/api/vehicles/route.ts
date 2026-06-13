import { NextRequest, NextResponse } from 'next/server'
import { getAllVehicles, createVehicle } from '@/lib/vehicles-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ vehicles: getAllVehicles() })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.plate_number || !body.make || !body.model) {
      return NextResponse.json({ error: 'plate_number, make and model are required' }, { status: 400 })
    }
    const v = createVehicle({
      plate_number:        body.plate_number,
      make:                body.make,
      model:               body.model,
      year:                body.year ? Number(body.year) : null,
      color:               body.color               ?? null,
      type:                body.type                ?? 'Pickup',
      registration_expiry: body.registration_expiry ?? null,
      insurance_expiry:    body.insurance_expiry    ?? null,
      rta_test_expiry:     body.rta_test_expiry     ?? null,
      status:              body.status              ?? 'active',
      notes:               body.notes               ?? null,
    })
    return NextResponse.json({ vehicle: v }, { status: 201 })
  } catch (err) {
    console.error('[Vehicles POST]', err)
    return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 })
  }
}
