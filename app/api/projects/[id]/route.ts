import { NextResponse }       from 'next/server'
import { getAllStoredProjects, deleteStoredProject } from '@/lib/projects-store'
import { getProgress, saveProgress } from '@/lib/project-progress'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const body = await req.json()
    const { progress_percent, current_stage, boq_sections } = body

    // Verify project exists in file store
    const all  = getAllStoredProjects()
    const base = all.find(p => p.id === id)
    if (!base) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Save progress to Supabase (works on Vercel; file system is read-only)
    await saveProgress(
      id,
      Number(progress_percent ?? base.progress_percent),
      String(current_stage   ?? base.current_stage ?? ''),
      boq_sections           ?? [],
    )

    return NextResponse.json({
      ...base,
      progress_percent,
      current_stage,
      boq_sections,
    })
  } catch (err) {
    console.error('PATCH /api/projects/[id] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteStoredProject(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
