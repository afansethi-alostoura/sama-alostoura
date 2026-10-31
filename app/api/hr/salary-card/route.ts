import { NextRequest, NextResponse } from 'next/server'
import { generateWithImage } from '@/lib/gemini'
import { query, isDbConfigured } from '@/lib/db'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS salary_records (
      id               SERIAL PRIMARY KEY,
      employee_name    TEXT,
      month            TEXT,
      monthly_salary   DECIMAL(12,2),
      working_days     INTEGER,
      daily_rate       DECIMAL(12,2),
      total_advances   DECIMAL(12,2),
      net_payment      DECIMAL(12,2),
      payment_date     DATE,
      payment_account  TEXT DEFAULT 'Cash',
      payment_method   TEXT DEFAULT 'Cash',
      attendance_data  JSONB DEFAULT '[]',
      qb_lines         JSONB DEFAULT '[]',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageBase64, mimeType, monthlySalary, paymentDate, paymentAccount, paymentMethod, projectMap } = body

    if (!imageBase64) return NextResponse.json({ error: 'No image' }, { status: 400 })

    // Ask Gemini to read the salary card
    const prompt = `Read this handwritten Dubai construction attendance card.
Columns: DATE, project site columns (e.g. Khalid, Fahid, Mansoor, Madinat Hind), Advance AED.
"L" in a project column = worked there. "OFF" = day off. Number in Advance column = cash advance in AED.

First line: EMPLOYEE_NAME|MONTH|YEAR|COMPANY
Then one line per date: DATE|PROJECT|ADVANCE
- PROJECT = project column name where L appears, or OFF or ABSENT
- ADVANCE = number (0 if none)

Example:
VenKatesh Beema|August|2026|Sama Alostoura
1-Aug|Khalid|0
2-Aug|OFF|0
3-Aug|Fahid|100

Output ONLY the data lines, no explanation, no markdown.`

    const raw = await generateWithImage(prompt, imageBase64, mimeType ?? 'image/jpeg', undefined, 2000)
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean)

    // Parse header line
    const header = lines[0].split('|')
    const employeeName = header[0]?.trim() ?? ''
    const month        = header[1]?.trim() ?? ''
    const year         = header[2]?.trim() ?? ''
    const company      = header[3]?.trim() ?? ''

    // Parse attendance lines
    const attendance: Array<{ date: string; project: string | null; status: string; advance: number }> = []
    const projectColumnsSet = new Set<string>()
    for (const line of lines.slice(1)) {
      const parts = line.split('|')
      if (parts.length < 2) continue
      const date    = parts[0].trim()
      const proj    = parts[1].trim()
      const advance = parseFloat(parts[2]) || 0
      const isOff   = /^off$/i.test(proj) || /^absent$/i.test(proj) || proj === '-' || proj === ''
      const status  = isOff ? (proj.toLowerCase() === 'absent' ? 'absent' : 'off') : 'worked'
      const project = isOff ? null : proj
      if (project) projectColumnsSet.add(project)
      attendance.push({ date, project, status, advance })
    }

    const parsed = {
      employee_name:   employeeName,
      month, year, company,
      project_columns: Array.from(projectColumnsSet),
      attendance,
    }

    const workingDays = attendance.filter(d => d.status === 'worked').length
    const totalAdvances = attendance.reduce((s: number, d) => s + (d.advance ?? 0), 0)

    const salary = parseFloat(monthlySalary) || 0
    const dailyRate = workingDays > 0 ? Math.round((salary / workingDays) * 100) / 100 : 0
    const netPayment = salary - totalAdvances

    // Build QB line items (one per working day)
    const qbLines = attendance
      .filter(d => d.status === 'worked')
      .map(d => {
        // Map short project name to full QB class name
        const fullClass = (projectMap && projectMap[d.project ?? '']) ?? d.project ?? ''
        return {
          date:        paymentDate ?? new Date().toISOString().slice(0, 10),
          category:    'Wage expenses',
          description: parsed.employee_name ?? '',
          amount:      dailyRate,
          tax:         'ZR Zero Rated',
          class:       fullClass,
          day:         d.date,
          advance:     d.advance ?? 0,
        }
      })

    // Save to DB
    if (isDbConfigured()) {
      await ensureTable()
      await query(
        `INSERT INTO salary_records
           (employee_name, month, monthly_salary, working_days, daily_rate,
            total_advances, net_payment, payment_date, payment_account, payment_method,
            attendance_data, qb_lines)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          parsed.employee_name, `${parsed.month} ${parsed.year}`,
          salary, workingDays, dailyRate, totalAdvances, netPayment,
          paymentDate || null, paymentAccount || 'Cash', paymentMethod || 'Cash',
          JSON.stringify(attendance), JSON.stringify(qbLines),
        ]
      )
    }

    return NextResponse.json({
      employee_name:  parsed.employee_name,
      month:          `${parsed.month} ${parsed.year}`,
      company:        parsed.company,
      project_columns: parsed.project_columns,
      attendance,
      working_days:   workingDays,
      daily_rate:     dailyRate,
      total_advances: totalAdvances,
      net_payment:    netPayment,
      qb_lines:       qbLines,
    })

  } catch (e) {
    console.error('[salary-card]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET — list recent salary records
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json([])
  try {
    await ensureTable()
    const rows = await query(
      `SELECT id, employee_name, month, monthly_salary, working_days,
              daily_rate, total_advances, net_payment, payment_date,
              payment_account, payment_method, created_at
       FROM salary_records ORDER BY created_at DESC LIMIT 50`
    )
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}
