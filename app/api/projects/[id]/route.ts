import { NextResponse }       from 'next/server'
import { getAllStoredProjects, deleteStoredProject, updateStoredProject } from '@/lib/projects-store'
import { getProgress, saveProgress } from '@/lib/project-progress'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const all  = getAllStoredProjects()
    const base = all.find(p => p.id === id)
    if (!base) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Overlay Supabase progress if it exists
    const prog = await getProgress(id)
    if (prog) {
      return NextResponse.json({
        ...base,
        progress_percent: prog.progress_percent,
        current_stage:    prog.current_stage ?? base.current_stage,
        boq_sections:     prog.boq_sections  ?? (base as any).boq_sections,
      })
    }
    return NextResponse.json(base)
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

    // If qb_class_name is being updated, save it to the file store
    if (qb_class_name !== undefined) {
      updateStoredProject(id, { qb_class_name })
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

    const updated = updateStoredProject(id, {
      name:                (body.name               || base.name).trim(),
      client_name:         (body.client_name        ?? base.client_name).trim(),
      location:            (body.location           || base.location).trim(),
      type:                body.type               ?? base.type,
      status:              body.status             ?? base.status,
      contract_value:      body.contract_value     != null ? Number(body.contract_value)    : base.contract_value,
      received_amount:     body.received_amount    != null ? Number(body.received_amount)   : base.received_amount,
      progress_percent:    body.progress_percent   != null ? Number(body.progress_percent)  : base.progress_percent,
      current_stage:       body.current_stage      ?? base.current_stage,
      notes:               body.notes              ?? base.notes,
      start_date:          body.start_date         ?? base.start_date,
      expected_completion: body.expected_completion ?? base.expected_completion,
      qb_class_name:       body.qb_class_name      ?? base.qb_class_name,
    })
    return NextResponse.json(updated)
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
