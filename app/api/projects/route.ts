import { NextResponse }       from 'next/server'
import { getAllStoredProjects, addStoredProject } from '@/lib/projects-store'
import { getAllProgress } from '@/lib/project-progress'
import { DEMO_PROJECTS } from '@/lib/demo-data'

export async function GET() {
  // 1. Load real (file-based) projects + Supabase progress overrides
  const stored    = getAllStoredProjects()
  const overrides = await getAllProgress()

  const realProjects = stored.map(p => {
    const prog = overrides[p.id]
    return {
      ...p,
      status:           p.status.replace('-', '_'),   // normalise on-hold → on_hold
      progress_percent: prog?.progress_percent ?? p.progress_percent,
      current_stage:    prog?.current_stage    ?? p.current_stage,
      boq_sections:     prog?.boq_sections     ?? (p as any).boq_sections ?? [],
    }
  })

  // 2. Add DEMO_PROJECTS as fallbacks for any project not already present by id or name
  const realIds   = new Set(realProjects.map(p => p.id))
  const realNames = new Set(realProjects.map(p => p.name.toLowerCase()))

  const demoFallbacks = DEMO_PROJECTS
    .filter(p => !realIds.has(p.id) && !realNames.has(p.name.toLowerCase()))
    .map(p => ({
      id:               p.id,
      name:             p.name,
      client_name:      p.client?.name ?? 'Client',
      location:         p.location     ?? '',
      type:             p.type,
      status:           p.status,                     // already on_hold format
      contract_value:   p.contract_value,
      received_amount:  p.received_amount,
      progress_percent: p.progress_percent,
      current_stage:    p.current_stage    ?? '',
      notes:            p.notes            ?? '',
      start_date:       p.start_date       ?? '',
      expected_completion: p.expected_completion ?? '',
      created_at:       p.created_at,
      updated_at:       p.updated_at,
      boq_sections:     [],
    }))

  return NextResponse.json([...realProjects, ...demoFallbacks])
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, client_name, location, type, status, contract_value,
            received_amount, progress_percent, current_stage, notes,
            start_date, expected_completion } = body

    if (!name || !location || !contract_value) {
      return NextResponse.json({ error: 'name, location, and contract_value are required' }, { status: 400 })
    }

    const project = addStoredProject({
      name:               name.trim(),
      client_name:        (client_name || '').trim(),
      location:           location.trim(),
      type:               type               || 'villa',
      status:             status             || 'active',
      contract_value:     Number(contract_value),
      received_amount:    Number(received_amount  || 0),
      progress_percent:   Number(progress_percent || 0),
      current_stage:      (current_stage || '').trim(),
      notes:              (notes         || '').trim(),
      start_date:         start_date          || new Date().toISOString().split('T')[0],
      expected_completion: expected_completion || '',
    })

    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
