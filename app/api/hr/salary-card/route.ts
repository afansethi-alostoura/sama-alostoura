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

// Returns Set of day-of-month numbers that are Sundays (e.g. {6, 13, 20, 27} for Aug 2026)
function getSundaysInMonth(year: number, month: number): Set<number> {
  const sundays = new Set<number>()
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(year, month - 1, d).getDay() === 0) sundays.add(d)
  }
  return sundays
}

// Extract leading day number from strings like "1-Aug", "15", "15-08"
function parseDayNum(dateStr: string): number {
  const m = dateStr.match(/^(\d+)/)
  return m ? parseInt(m[1]) : 0
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageBase64, mimeType, monthlySalary, paymentDate, paymentAccount, paymentMethod, projectMap, cardMonth } = body

    if (!imageBase64) return NextResponse.json({ error: 'No image' }, { status: 400 })

    // Parse cardMonth (format "YYYY-MM") for Sunday calculation
    let calYear = 0, calMonth = 0
    if (cardMonth) {
      const [y, m] = cardMonth.split('-').map(Number)
      calYear = y; calMonth = m
    }

    // Ask Gemini to read the salary card
    const monthName = cardMonth
      ? new Date(parseInt(cardMonth.split('-')[0]), parseInt(cardMonth.split('-')[1]) - 1).toLocaleString('en', { month: 'long' })
      : ''
    const expectedDays = (calYear && calMonth) ? new Date(calYear, calMonth, 0).getDate() : 31

    // Build column list from the projectMap sent by the client (or fallback)
    const projectNames = projectMap ? Object.keys(projectMap) : ['Khalid', 'Fahid', 'Mansoor', 'Madinat Hind']

    const prompt = `This is a handwritten construction worker attendance card for ${monthName || 'the month shown'} with ${expectedDays} rows.

COLUMN ORDER (left to right): DATE | ${projectNames.join(' | ')} | Advance AED

How to read each row:
- "L" written in a project column = worker was present at that site that day → use the project column NAME
- "OFF", "OFE", "OEE", "OE", dashes (—) = day off → write OFF
- Numbers or "=100=" or "100" in the LAST column (Advance AED) = cash advance amount
- Blank row with no marks = absent → write ABSENT

Output format — line 1 is the header, then EXACTLY ONE LINE PER DAY from day 1 to day ${expectedDays}:
EMPLOYEE_NAME|MONTH|YEAR|COMPANY
1-${monthName.slice(0,3)}|PROJECT_OR_OFF|ADVANCE_NUMBER

Rules:
- PROJECT = exact column header name (e.g. Khalid, Fahid, Mansoor, Madinat Hind)
- ADVANCE = number only, 0 if none
- You MUST output all ${expectedDays} lines, one per day, in order. Do NOT skip any day.
- Output ONLY the lines, no explanation, no markdown, no blank lines.`

    const raw = await generateWithImage(prompt, imageBase64, mimeType ?? 'image/jpeg', undefined, 3000)
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
      const status  = isOff ? 'off' : 'worked'
      const project = isOff ? null : proj
      if (project) projectColumnsSet.add(project)
      attendance.push({ date, project, status, advance })
    }

    // If we know the calendar month, reclassify off days as sunday vs absent
    const sundays = (calYear && calMonth) ? getSundaysInMonth(calYear, calMonth) : new Set<number>()
    const daysInMonth = (calYear && calMonth) ? new Date(calYear, calMonth, 0).getDate() : 0

    if (sundays.size > 0) {
      for (const row of attendance) {
        if (row.status === 'off') {
          const dayNum = parseDayNum(row.date)
          row.status = sundays.has(dayNum) ? 'sunday' : 'absent'
        }
      }
    }

    // Salary calculation
    const salary = parseFloat(monthlySalary) || 0
    const sundayCount   = sundays.size
    const workingDays   = daysInMonth > 0 ? daysInMonth - sundayCount : attendance.filter(d => d.status === 'worked').length
    const presentDays   = attendance.filter(d => d.status === 'worked').length
    const absentDays    = Math.max(0, workingDays - presentDays)
    const dailyRate     = workingDays > 0 ? Math.round((salary / workingDays) * 100) / 100 : 0
    const absentDeduction = Math.round(absentDays * dailyRate * 100) / 100
    const salaryEarned  = salary - absentDeduction
    const totalAdvances = attendance.reduce((s: number, d) => s + (d.advance ?? 0), 0)
    const netPayment    = salaryEarned - totalAdvances

    // Build QB line items (one per worked day)
    const qbLines = attendance
      .filter(d => d.status === 'worked')
      .map(d => {
        const fullClass = (projectMap && projectMap[d.project ?? '']) ?? d.project ?? ''
        return {
          date:        paymentDate ?? new Date().toISOString().slice(0, 10),
          category:    'Wage expenses',
          description: employeeName,
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
          employeeName, `${month} ${year}`,
          salary, workingDays, dailyRate, totalAdvances, netPayment,
          paymentDate || null, paymentAccount || 'Cash', paymentMethod || 'Cash',
          JSON.stringify(attendance), JSON.stringify(qbLines),
        ]
      )
    }

    return NextResponse.json({
      employee_name:    employeeName,
      month:            `${month} ${year}`,
      company,
      project_columns:  Array.from(projectColumnsSet),
      attendance,
      days_in_month:    daysInMonth || null,
      sunday_count:     sundayCount,
      working_days:     workingDays,
      present_days:     presentDays,
      absent_days:      absentDays,
      daily_rate:       dailyRate,
      absent_deduction: absentDeduction,
      salary_earned:    salaryEarned,
      total_advances:   totalAdvances,
      net_payment:      netPayment,
      qb_lines:         qbLines,
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
