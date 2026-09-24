/**
 * GET /api/debug
 * Diagnostic endpoint — checks env vars, Supabase connection, and table data.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const out: Record<string, unknown> = {}

  // 1. Env vars (redacted)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  out.env = {
    SUPABASE_URL:          url  ? url.slice(0, 40) + '…'  : '❌ MISSING',
    SUPABASE_ANON_KEY:     anon ? anon.slice(0, 20) + '…' : '❌ MISSING',
    SUPABASE_SERVICE_KEY:  svc  ? svc.slice(0, 20) + '…'  : '❌ MISSING',
    isConfigured:          isSupabaseConfigured(),
  }

  if (!isSupabaseConfigured() || !supabaseAdmin) {
    out.error = 'Supabase not configured — set env vars in Vercel dashboard'
    return NextResponse.json(out)
  }

  // 2. Try querying the projects table
  try {
    const { data, error, count } = await supabaseAdmin
      .from('projects')
      .select('id, name, status, contract_value', { count: 'exact' })
    out.projects_table = {
      error:  error?.message ?? null,
      count,
      rows:   data ?? [],
    }
  } catch (e: any) {
    out.projects_table = { error: e.message }
  }

  // 3. Try querying clients
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('id, name')
    out.clients_table = {
      error: error?.message ?? null,
      rows:  data ?? [],
    }
  } catch (e: any) {
    out.clients_table = { error: e.message }
  }

  // 4. Check project_overrides
  try {
    const { data, error } = await supabaseAdmin
      .from('project_overrides')
      .select('project_id, data')
    out.project_overrides = {
      error: error?.message ?? null,
      count: data?.length ?? 0,
      rows:  data ?? [],
    }
  } catch (e: any) {
    out.project_overrides = { error: e.message }
  }

  return NextResponse.json(out)
}
