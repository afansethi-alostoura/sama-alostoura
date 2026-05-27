import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin

// GET /api/boq/company        — list all BOQs (summary, no items)
// GET /api/boq/company?id=uuid — fetch one BOQ by its own ID
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    // List all — exclude the heavy items column for speed
    const { data, error } = await db()!
      .from('company_boq')
      .select('id, project_number, project_name, area, owner, contractor, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const { data, error } = await db()!
    .from('company_boq')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

// POST /api/boq/company  — create new BOQ (returns the new row with its id)
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { project_number, project_name, area, owner, contractor, items } = body

  const { data, error } = await db()!
    .from('company_boq')
    .insert({ project_number, project_name, area, owner, contractor, items })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT /api/boq/company  — update existing BOQ by id
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { id, project_number, project_name, area, owner, contractor, items } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await db()!
    .from('company_boq')
    .update({ project_number, project_name, area, owner, contractor, items, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/boq/company?id=uuid
export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db()!.from('company_boq').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
