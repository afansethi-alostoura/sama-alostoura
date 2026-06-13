import { NextRequest, NextResponse } from 'next/server'
import { updateVehicle, deleteVehicle } from '@/lib/vehicles-store'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }  = await params
    const body    = await req.json()
    const updated = updateVehicle(id, body)
    if (!updated) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    return NextResponse.json({ vehicle: updated })
  } catch (err) {
    console.error('[Vehicles PATCH]', err)
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok     = deleteVehicle(id)
  if (!ok) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
