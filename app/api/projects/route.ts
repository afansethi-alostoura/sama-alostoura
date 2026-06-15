import { NextResponse }       from 'next/server'
import { getAllStoredProjects, addStoredProject } from '@/lib/projects-store'
import { getAllProgress } from '@/lib/project-progress'
import { getAllOverrides, getAllStoredFromSupabase, saveNewProjectToSupabase } from '@/lib/project-overrides'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [fileProjects, supabaseProjects, progressMap, overridesMap] = await Promise.all([
    Promise.resolve(getAllStoredProjects()),
    getAllStoredFromSupabase(),
    getAllProgress(),
    getAllOverrides(),
  ])

  // Merge: file projects + Supabase-created projects (deduplicate by id)
  const fileIds = new Set(fileProjects.map(p => p.id))
  const allBase = [...fileProjects, ...supabaseProjects.filter(p => !fileIds.has(p.id))]

  const projects = allBase.map(p => {
    const prog = progressMap[p.id]
    const over = overridesMap[p.id] ?? {}
    return {
      ...p,
      ...over,
      status:           ((over.status ?? p.status) as string).replace('-', '_'),
      progress_percent: prog?.progress_percent ?? (over.progress_percent as number | undefined) ?? p.progress_percent,
      current_stage:    prog?.current_stage    ?? (over.current_stage    as string | undefined) ?? p.current_stage,
      boq_sections:     prog?.boq_sections     ?? (p as any).boq_sections ?? [],
    }
  })

  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, client_name, location, type, status, contract_value,
            received_amount, progress_percent, current_stage, notes,
            start_date, expected_completion, qb_class_name,
            owner_share, mbhre_share } = body

    if (!name || !location || !contract_value) {
      return NextResponse.json({ error: 'name, location, and contract_value are required' }, { status: 400 })
    }

    const now     = new Date().toISOString()
    const project = {
      id:                  crypto.randomUUID(),
      name:                name.trim(),
      client_name:         (client_name || '').trim(),
      location:            location.trim(),
      type:                type               || 'villa',
      status:              status             || 'active',
      contract_value:      Number(contract_value),
      received_amount:     Number(received_amount  || 0),
      progress_percent:    Number(progress_percent || 0),
      current_stage:       (current_stage || '').trim(),
      notes:               (notes         || '').trim(),
      start_date:          start_date          || now.split('T')[0],
      expected_completion: expected_completion || '',
      qb_class_name:       qb_class_name       || '',
      owner_share:         Number(owner_share  || 0),
      mbhre_approved_amount: Number(mbhre_share || 0),
      created_at:          now,
      updated_at:          now,
    }

    // Try local file first (dev), then Supabase (production/Vercel)
    let saved = false
    try {
      addStoredProject(project)
      saved = true
    } catch { /* read-only on Vercel — fall through to Supabase */ }

    if (!saved) {
      const { error: sbErr } = await (supabaseAdmin as any)
        .from('stored_projects')
        .upsert({ id: project.id, data: (() => { const { id: _, ...rest } = project; return rest })(), created_at: project.created_at, updated_at: project.updated_at }, { onConflict: 'id' })
      if (sbErr) {
        console.error('saveNewProject Supabase error:', sbErr.message)
        return NextResponse.json(
          { error: 'Could not save project. Ensure stored_projects table exists in Supabase.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
