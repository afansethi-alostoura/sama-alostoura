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
    // Daily rate = salary / working days (total days minus Sundays)
    // Sundays are included in salary automatically; only absent (non-Sunday missed) days are deducted
    const salary        = parseFloat(monthlySalary) || 0
    const sundayCount   = sundays.size
    const presentDays   = attendance.filter(d => d.status === 'worked').length
    const absentDays    = attendance.filter(d => d.status === 'absent').length
    const workingDays   = daysInMonth > 0 ? daysInMonth - sundayCount : presentDays
    const dailyRate     = workingDays > 0 ? Math.round((salary / workingDays) * 100) / 100 : 0
    const absentDeduction = Math.round(absentDays * dailyRate * 100) / 100
    const salaryEarned  = salary - absentDeduction
    const totalAdvances = Math.round(attendance.reduce((s: number, d) => s + (d.advance ?? 0), 0) * 100) / 100
    const netPayment    = Math.round((salaryEarned - totalAdvances) * 100) / 100

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

// GET — list records, or fetch single record by ?id=X (includes qb_lines)
export async function GET(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json([])
  try {
    await ensureTable()
    const id = req.nextUrl.searchParams.get('id')
    if (id) {
      const rows = await query(
        `SELECT id, employee_name, month, monthly_salary, working_days,
                daily_rate, total_advances, net_payment, payment_date,
                payment_account, payment_method, attendance_data, qb_lines, created_at
         FROM salary_records WHERE id = $1 LIMIT 1`, [id]
      )
      return NextResponse.json(rows[0] ?? null)
    }
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

// PUT — update an existing salary record by ?id=X
export async function PUT(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 500 })
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { employeeName, month, monthlySalary, attendance, paymentDate, paymentAccount, paymentMethod } = await req.json()
    await ensureTable()
    const salary      = parseFloat(monthlySalary) || 0
    // month is "October 2026" — derive working days from calendar
    const monthNames  = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const parts       = (month as string).split(' ')
    const mIdx        = monthNames.indexOf(parts[0]) + 1
    const yr          = parseInt(parts[1]) || 0
    const daysInMonth = (mIdx > 0 && yr > 0) ? new Date(yr, mIdx, 0).getDate() : attendance.length
    const sundayCount = (mIdx > 0 && yr > 0) ? getSundaysInMonth(yr, mIdx).size : attendance.filter((r: { status: string }) => r.status === 'sunday').length
    const workingDays = daysInMonth - sundayCount
    const absentDays  = attendance.filter((r: { status: string }) => r.status === 'absent').length
    const dailyRate   = workingDays > 0 ? Math.round((salary / workingDays) * 100) / 100 : 0
    const totalAdv    = attendance.reduce((s: number, r: { advance: number }) => s + (r.advance || 0), 0)
    const netPayment  = Math.round((salary - absentDays * dailyRate - totalAdv) * 100) / 100
    await query(
      `UPDATE salary_records SET employee_name=$1, month=$2, monthly_salary=$3, working_days=$4,
       daily_rate=$5, total_advances=$6, net_payment=$7, payment_date=$8, payment_account=$9,
       payment_method=$10, attendance_data=$11 WHERE id=$12`,
      [employeeName, month, salary, workingDays, dailyRate, totalAdv, netPayment,
       paymentDate || null, paymentAccount || 'Cash', paymentMethod || 'Cash',
       JSON.stringify(attendance), id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE — remove a salary record by ?id=X
export async function DELETE(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ error: 'DB not configured' }, { status: 500 })
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await ensureTable()
    await query(`DELETE FROM salary_records WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
