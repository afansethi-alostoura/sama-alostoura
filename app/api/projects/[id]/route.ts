import { NextResponse }       from 'next/server'
import { getAllStoredProjects, deleteStoredProject, updateStoredProject } from '@/lib/projects-store'
import { getProgress, saveProgress } from '@/lib/project-progress'
import { getOverride, saveOverride } from '@/lib/project-overrides'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const all  = getAllStoredProjects()
    const base = all.find(p => p.id === id)
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
    const { progress_percent, current_stage, boq_sections, qb_class_name } = body

    // Verify project exists in file store
    const all  = getAllStoredProjects()
    const base = all.find(p => p.id === id)
    if (!base) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // If qb_class_name is being updated, save it to Supabase
    if (qb_class_name !== undefined) {
      await saveOverride(id, { qb_class_name })
      try { updateStoredProject(id, { qb_class_name }) } catch {}
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
    const all  = getAllStoredProjects()
    const base = all.find(p => p.id === id)
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
    }

    // Save to Supabase (works on Vercel; file system is read-only)
    await saveOverride(id, fields)

    // Also try local file (works in dev)
    try { updateStoredProject(id, fields as any) } catch {}

    return NextResponse.json({ ...base, ...fields })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteStoredProject(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
