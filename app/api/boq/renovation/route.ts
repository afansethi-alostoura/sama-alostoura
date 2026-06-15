import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!isSupabaseConfigured() || !db()) return NextResponse.json(id ? null : [])

  if (id) {
    const { data, error } = await db()!.from('renovation_boq').select('*').eq('id', id).single()
    if (error) return NextResponse.json(null)
    return NextResponse.json(data)
  }

  const { data } = await db()!
    .from('renovation_boq')
    .select('id, project_name, project_location, client_name, created_at, updated_at')
    .order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const { project_name, project_location, client_name, sections } = await req.json()
  const { data, error } = await db()!
    .from('renovation_boq')
    .insert({ project_name, project_location, client_name, sections })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const { id, project_name, project_location, client_name, sections } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data, error } = await db()!
    .from('renovation_boq')
    .update({ project_name, project_location, client_name, sections, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (!isSupabaseConfigured() || !db()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }
  const { error } = await db()!.from('renovation_boq').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
