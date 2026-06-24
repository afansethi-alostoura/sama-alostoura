import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin!

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ entries: [] })
  const date = req.nextUrl.searchParams.get('date')
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')

  let q = db().from('site_labour').select('*').order('expense_date', { ascending: false }).order('created_at', { ascending: false })
  if (date)        q = q.eq('expense_date', date)
  else if (from && to) q = q.gte('expense_date', from).lte('expense_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  const body = await req.json()
  const { expense_date, project_id, project_name, trade, worker_count, daily_rate, payment_method, notes } = body
  const total_amount = Number(worker_count) * Number(daily_rate)

  const { data, error } = await db()
    .from('site_labour')
    .insert([{ expense_date, project_id: project_id || null, project_name, trade, worker_count, daily_rate, total_amount, payment_method, notes }])
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await db().from('site_labour').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
