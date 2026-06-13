import { NextRequest, NextResponse } from 'next/server'
import { getAllEmployees, createEmployee } from '@/lib/staff-store'
import { DEMO_STAFF } from '@/lib/demo-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  const stored = getAllEmployees()
  // Seed demo data on first load if store is empty
  if (stored.length === 0) {
    return NextResponse.json({ employees: DEMO_STAFF })
  }
  return NextResponse.json({ employees: stored })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 })
    }
    const emp = createEmployee({
      name:               body.name,
      role:               body.role,
      nationality:        body.nationality        ?? '',
      phone:              body.phone              ?? null,
      email:              body.email              ?? null,
      salary:             Number(body.salary)     || 0,
      join_date:          body.join_date          ?? null,
      visa_expiry:        body.visa_expiry        ?? null,
      emirates_id_expiry: body.emirates_id_expiry ?? null,
      passport_expiry:    body.passport_expiry    ?? null,
      labour_card_expiry: body.labour_card_expiry ?? null,
      status:             body.status             ?? 'active',
      notes:              body.notes              ?? null,
    })
    return NextResponse.json({ employee: emp }, { status: 201 })
  } catch (err) {
    console.error('[Staff POST]', err)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
