import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await db()!
    .from('mbhre_breakdown_boq')
    .select('*')
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? null)
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const body = await req.json()
  const { date_field, file_no, contract_value_text, owner_name, contractor, consultant, items } = body

  const { data, error } = await db()!
    .from('mbhre_breakdown_boq')
    .insert({ date_field, file_no, contract_value_text, owner_name, contractor, consultant, items })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const body = await req.json()
  const { id, date_field, file_no, contract_value_text, owner_name, contractor, consultant, items } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await db()!
    .from('mbhre_breakdown_boq')
    .update({ date_field, file_no, contract_value_text, owner_name, contractor, consultant, items, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db()!.from('mbhre_breakdown_boq').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
