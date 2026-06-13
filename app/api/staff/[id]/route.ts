import { NextRequest, NextResponse } from 'next/server'
import { updateEmployee, deleteEmployee } from '@/lib/staff-store'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }  = await params
    const body    = await req.json()
    const updated = updateEmployee(id, body)
    if (!updated) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    return NextResponse.json({ employee: updated })
  } catch (err) {
    console.error('[Staff PATCH]', err)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok     = deleteEmployee(id)
  if (!ok) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
