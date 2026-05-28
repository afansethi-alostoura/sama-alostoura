/**
 * Global Documents API
 * GET /api/documents          — all docs across all projects (with project_name)
 * GET /api/documents?folder=  — filtered by folder
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getAllStoredProjects } from '@/lib/projects-store'

export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get('folder')

  // Build project name lookup from file store
  const projects = getAllStoredProjects()
  const projectMap: Record<string, string> = Object.fromEntries(
    projects.map(p => [p.id, p.name])
  )

  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json([])
  }

  let query = supabaseAdmin
    .from('project_documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (folder) query = query.eq('folder', folder)

  const { data, error } = await query

  if (error) {
    console.error('GET /api/documents error:', error.message)
    return NextResponse.json([])
  }

  const docs = (data ?? []).map((d: Record<string, unknown>) => ({
    ...d,
    project_name: projectMap[d.project_id as string] ?? 'Unknown Project',
  }))

  return NextResponse.json(docs)
}
