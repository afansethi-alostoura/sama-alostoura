import { NextResponse }       from 'next/server'
import { getAllStoredProjects, addStoredProject } from '@/lib/projects-store'

export async function GET() {
  const projects = getAllStoredProjects()
  return NextResponse.json(projects)
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
