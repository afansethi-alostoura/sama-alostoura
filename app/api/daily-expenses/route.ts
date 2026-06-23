import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin!

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ expenses: [] })

  const date = req.nextUrl.searchParams.get('date')
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')

  let query = db()
    .from('daily_expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .order('created_at',   { ascending: false })

  if (date)        query = query.eq('expense_date', date)
  else if (from && to) query = query.gte('expense_date', from).lte('expense_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data ?? [] })
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const body = await req.json()
  const { expense_date, project_id, project_name, category, vendor, description, amount, payment_method } = body

  if (!expense_date || !amount)
    return NextResponse.json({ error: 'expense_date and amount are required' }, { status: 400 })

  const { data, error } = await db()
    .from('daily_expenses')
    .insert([{ expense_date, project_id: project_id || null, project_name, category, vendor, description, amount, payment_method }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data })
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await db().from('daily_expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
