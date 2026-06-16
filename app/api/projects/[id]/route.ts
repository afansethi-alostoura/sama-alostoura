import { NextResponse }       from 'next/server'
import { getAllStoredProjects, deleteStoredProject, updateStoredProject } from '@/lib/projects-store'
import { getProgress, saveProgress } from '@/lib/project-progress'
import { getOverride, saveOverride, saveNewProjectToSupabase, deleteProjectFromSupabase, getAllStoredFromSupabase } from '@/lib/project-overrides'

async function findBase(id: string) {
  const file = getAllStoredProjects().find(p => p.id === id)
  if (file) return file
  const supabase = await getAllStoredFromSupabase()
  return supabase.find(p => p.id === id) ?? null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const base = await findBase(id)
    if (!base) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [prog, over] = await Promise.all([getProgress(id), getOverride(id)])
    return NextResponse.json({
      ...base,
      ...(over ?? {}),
      progress_percent: prog?.progress_percent ?? base.progress_percent,
      current_stage:    prog?.current_stage    ?? base.current_stage,
      boq_sections:     prog?.boq_sections     ?? (base as any).boq_sections,
    })
  } catch (err) {
    console.error('GET /api/projects/[id] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const { progress_percent, current_stage, boq_sections, qb_class_name, company_boq_id, renovation_boq_id, received_amount, total_expenses, mbhre_approved_progress } = body

    const base = await findBase(id)
    if (!base) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    if (qb_class_name !== undefined) {
      await saveOverride(id, { qb_class_name })
      try { updateStoredProject(id, { qb_class_name }) } catch {}
    }

    if (company_boq_id !== undefined) {
      await saveOverride(id, { company_boq_id })
      try { updateStoredProject(id, { company_boq_id } as any) } catch {}
    }

    if (renovation_boq_id !== undefined) {
      await saveOverride(id, { renovation_boq_id })
      try { updateStoredProject(id, { renovation_boq_id } as any) } catch {}
    }

    if (received_amount !== undefined) {
      const val = Number(received_amount)
      await saveOverride(id, { received_amount: val })
      try { updateStoredProject(id, { received_amount: val } as any) } catch {}
    }

    if (total_expenses !== undefined) {
      const val = Number(total_expenses)
      await saveOverride(id, { total_expenses: val })
      try { updateStoredProject(id, { total_expenses: val } as any) } catch {}
    }

    if (mbhre_approved_progress !== undefined) {
      const val = Number(mbhre_approved_progress)
      await saveOverride(id, { mbhre_approved_progress: val })
      try { updateStoredProject(id, { mbhre_approved_progress: val } as any) } catch {}
    }

    // Save progress to Supabase (works on Vercel; file system is read-only)
    await saveProgress(
      id,
      Number(progress_percent ?? base.progress_percent),
      String(current_stage   ?? base.current_stage ?? ''),
      boq_sections           ?? [],
    )

    return NextResponse.json({
      ...base,
      qb_class_name: qb_class_name ?? base.qb_class_name,
      progress_percent,
      current_stage,
      boq_sections,
    })
  } catch (err) {
    console.error('PATCH /api/projects/[id] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const base = await findBase(id)
    if (!base) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const fields = {
      name:                (body.name               || base.name).trim(),
      client_name:         (body.client_name        ?? base.client_name ?? '').trim(),
      location:            (body.location           || base.location).trim(),
      type:                body.type               ?? base.type,
      status:              body.status             ?? base.status,
      contract_value:      body.contract_value     != null ? Number(body.contract_value)   : base.contract_value,
      received_amount:     body.received_amount    != null ? Number(body.received_amount)  : base.received_amount,
      progress_percent:    body.progress_percent   != null ? Number(body.progress_percent) : base.progress_percent,
      current_stage:       body.current_stage      ?? base.current_stage,
      notes:               body.notes              ?? base.notes,
      start_date:          body.start_date         ?? base.start_date,
      expected_completion: body.expected_completion ?? base.expected_completion,
      qb_class_name:       body.qb_class_name      ?? (base as any).qb_class_name,
      company_boq_id:      body.company_boq_id     ?? (base as any).company_boq_id,
    }

    // Save to Supabase (Vercel-safe) and try local file (dev)
    await saveOverride(id, fields)
    try { updateStoredProject(id, fields as any) } catch {}
    // Also update stored_projects row if this project was created via Supabase
    try { await saveNewProjectToSupabase({ ...base, ...fields, id } as any) } catch {}

    return NextResponse.json({ ...base, ...fields })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Remove from local file (dev) and Supabase (production)
  deleteStoredProject(id)
  await deleteProjectFromSupabase(id)
  return NextResponse.json({ deleted: true })
}
