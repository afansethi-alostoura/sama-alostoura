/**
 * POST /api/whatsapp/dispatch
 * AI Dispatcher — splits a staff update into per-department tasks
 * and saves them to department_tasks table.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query as dbQuery, isDbConfigured } from '@/lib/db'
import { generate } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { transcript, projectName, projectId, reporterName, reporterPhone, reporterRole } =
    await req.json() as {
      transcript: string
      projectName: string
      projectId?: string
      reporterName?: string
      reporterPhone?: string
      reporterRole?: string
    }

  if (!transcript || !projectName) {
    return NextResponse.json({ error: 'transcript and projectName required' }, { status: 400 })
  }

  // ── AI: split into dept tasks ────────────────────────────────────────────────
  const aiPrompt = `You are an AI construction manager for Sama Alostoura Building Contracting LLC, Dubai UAE.

Staff member sent this update:
Reporter: ${reporterName ?? 'Staff'} (${reporterRole ?? 'Site Staff'})
Project: ${projectName}
Message: "${transcript}"

Analyze and extract specific actionable tasks for each relevant department.
Departments: Civil, MEP, Electrical, Steel, HSE, Finishing, General

Rules:
- If something is blocked or dangerous → priority "urgent"
- If work is behind schedule or needs approval → priority "high"
- Normal progress updates → priority "normal"
- Minor notes → priority "low"
- One entry per distinct issue/task
- If purely a status update with no actions, return one General entry

Return ONLY a valid JSON array — no markdown, no extra text:
[
  {
    "department": "<Civil|MEP|Electrical|Steel|HSE|Finishing|General>",
    "task_description": "<clear one-sentence actionable description>",
    "priority": "<urgent|high|normal|low>",
    "notes": "<extra context or null>"
  }
]`

  interface DispatchTask {
    department: string
    task_description: string
    priority: string
    notes?: string | null
  }

  let tasks: DispatchTask[] = []
  try {
    const raw   = (await generate(aiPrompt, undefined, 700)).trim()
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(clean)
    tasks = Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('[Dispatcher] AI parse error:', err)
    tasks = [{ department: 'General', task_description: transcript.slice(0, 300), priority: 'normal', notes: null }]
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ tasks, saved: false })
  }

  // ── Ensure table exists ──────────────────────────────────────────────────────
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS department_tasks (
      id               SERIAL PRIMARY KEY,
      project_id       TEXT,
      project_name     TEXT NOT NULL,
      department       TEXT NOT NULL,
      task_description TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'open',
      priority         TEXT NOT NULL DEFAULT 'normal',
      assigned_to      TEXT,
      source           TEXT DEFAULT 'ai_dispatcher',
      source_message   TEXT,
      ai_analysis      TEXT,
      reporter_name    TEXT,
      reporter_phone   TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      completed_at     TIMESTAMPTZ
    )
  `)

  // ── Save each task ───────────────────────────────────────────────────────────
  const saved: Array<DispatchTask & { id?: number }> = []
  for (const t of tasks) {
    try {
      const rows = await dbQuery<{ id: number }>(
        `INSERT INTO department_tasks
           (project_id, project_name, department, task_description, priority,
            source, source_message, reporter_name, reporter_phone, ai_analysis)
         VALUES ($1,$2,$3,$4,$5,'ai_dispatcher',$6,$7,$8,$9) RETURNING id`,
        [
          projectId ?? null,
          projectName,
          t.department,
          t.task_description,
          t.priority ?? 'normal',
          transcript,
          reporterName ?? null,
          reporterPhone ?? null,
          t.notes ?? null,
        ],
      )
      saved.push({ ...t, id: rows[0]?.id })
    } catch (err) {
      console.error('[Dispatcher] insert error:', err)
    }
  }

  return NextResponse.json({ tasks: saved, count: saved.length })
}
