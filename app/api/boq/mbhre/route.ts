import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin

// GET /api/boq/mbhre        — list all
// GET /api/boq/mbhre?id=uuid — fetch one
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    const { data, error } = await db()!
      .from('mbhre_boq')
      .select('id, file_no, owner_name, contractor, consultant, date_field, created_at, updated_at')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  const { data, error } = await db()!
    .from('mbhre_boq')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? null)
}

// POST /api/boq/mbhre  — create new
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { date_field, file_no, contract_value_text, owner_name, contractor, consultant, items } = body

  const { data, error } = await db()!
    .from('mbhre_boq')
    .insert({ date_field, file_no, contract_value_text, owner_name, contractor, consultant, items })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT /api/boq/mbhre  — update existing
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, items } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await db()!
    .from('mbhre_boq')
    .update({ date_field, file_no, contract_value_text, owner_name, contractor, consultant, items, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/boq/mbhre?id=uuid
export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db()!.from('mbhre_boq').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
