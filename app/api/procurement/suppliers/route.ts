import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const TABLE = 'procurement_suppliers'
const db = () => supabaseAdmin

function notConfigured() {
  return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) return NextResponse.json([])
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const { data, error } = await db()!.from(TABLE).select('*').eq('id', id).single()
    if (error) return NextResponse.json(null)
    return NextResponse.json(data)
  }
  const { data } = await db()!.from(TABLE).select('*').order('name', { ascending: true })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) return notConfigured()
  const body = await req.json()
  const { data, error } = await db()!.from(TABLE).insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) return notConfigured()
  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data, error } = await db()!
    .from(TABLE).update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured() || !db()) return notConfigured()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db()!.from(TABLE).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
