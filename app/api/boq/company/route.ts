import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import {
  listCompanyBOQs, getCompanyBOQ,
  createCompanyBOQ, updateCompanyBOQ, deleteCompanyBOQ,
} from '@/lib/company-boq-store'

const db = () => supabaseAdmin

// GET /api/boq/company        — list all
// GET /api/boq/company?id=uuid — fetch one
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (isSupabaseConfigured() && db()) {
    if (!id) {
      const { data, error } = await db()!
        .from('company_boq')
        .select('id, project_number, project_name, area, owner, contractor, created_at, updated_at')
        .order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Merge file-based records not in Supabase (pre-seeded BOQs)
      const supabaseIds = new Set((data ?? []).map((r: any) => r.id))
      const fileRecords = listCompanyBOQs().filter(r => !supabaseIds.has(r.id))
      return NextResponse.json([...(data ?? []), ...fileRecords])
    }
    const { data, error } = await db()!.from('company_boq').select('*').eq('id', id).single()
    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
    // Fall back to file store if not found in Supabase
    if (!data) {
      const record = getCompanyBOQ(id)
      return NextResponse.json(record ?? null)
    }
    return NextResponse.json(data)
  }

  // ── File-based fallback ──
  if (!id) return NextResponse.json(listCompanyBOQs())
  const record = getCompanyBOQ(id)
  return NextResponse.json(record ?? null)
}

// POST — create new
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { project_number, project_name, area, owner, contractor, items } = body

  if (isSupabaseConfigured() && db()) {
    const { data, error } = await db()!
      .from('company_boq')
      .insert({ project_number, project_name, area, owner, contractor, items })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const record = createCompanyBOQ({ project_number, project_name, area, owner, contractor, items })
  return NextResponse.json(record)
}

// PUT — update existing (upsert so file-seeded records get created in Supabase on first save)
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, project_number, project_name, area, owner, contractor, items } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (isSupabaseConfigured() && db()) {
    const { data, error } = await db()!
      .from('company_boq')
      .upsert(
        { id, project_number, project_name, area, owner, contractor, items, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const record = updateCompanyBOQ(id, { project_number, project_name, area, owner, contractor, items })
  if (!record) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(record)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (isSupabaseConfigured() && db()) {
    const { error } = await db()!.from('company_boq').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  deleteCompanyBOQ(id)
  return NextResponse.json({ success: true })
}
