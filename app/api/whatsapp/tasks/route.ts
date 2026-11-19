/**
 * GET  /api/whatsapp/tasks   — list department tasks (dashboard)
 * PATCH /api/whatsapp/tasks  — update task status
 */
import { NextRequest, NextResponse } from 'next/server'
import { query as dbQuery, isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ tasks: [] })

  const { searchParams } = new URL(req.url)
  const projectId  = searchParams.get('project_id')
  const department = searchParams.get('department')
  const status     = searchParams.get('status') // null = all
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200)

  try {
    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (status && status !== 'all') { conditions.push(`status = $${idx++}`); params.push(status) }
    if (projectId)                  { conditions.push(`project_id = $${idx++}`); params.push(projectId) }
    if (department)                 { conditions.push(`department = $${idx++}`); params.push(department) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(limit)

    const tasks = await dbQuery(
      `SELECT * FROM department_tasks ${where} ORDER BY
         CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         created_at DESC
       LIMIT $${idx}`,
      params,
    )
    return NextResponse.json({ tasks })
  } catch (err) {
    console.error('[tasks GET]', err)
    return NextResponse.json({ tasks: [], error: String(err) })
  }
}

export async function PATCH(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 500 })

  const { id, status } = await req.json() as { id: number; status: string }
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  const VALID = ['open', 'in_progress', 'completed', 'blocked']
  if (!VALID.includes(status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })

  try {
    await dbQuery(
      `UPDATE department_tasks
       SET status=$1, updated_at=NOW(),
           completed_at = CASE WHEN $1='completed' THEN NOW() ELSE NULL END
       WHERE id=$2`,
      [status, id],
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
