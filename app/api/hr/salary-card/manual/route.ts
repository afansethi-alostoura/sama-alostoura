import { NextRequest, NextResponse } from 'next/server'
import { query, isDbConfigured } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { employeeName, month, year, monthlySalary, attendance, paymentDate, paymentAccount, paymentMethod } = await req.json()
    if (!isDbConfigured()) return NextResponse.json({ ok: true })

    const salary      = parseFloat(monthlySalary) || 0
    const workingDays = attendance.filter((r: { status: string }) => r.status !== 'sunday' && r.status !== 'off').length
    const presentDays = attendance.filter((r: { status: string }) => r.status === 'worked').length
    const absentDays  = workingDays - presentDays
    const dailyRate   = workingDays > 0 ? Math.round((salary / workingDays) * 100) / 100 : 0
    const totalAdv    = attendance.reduce((s: number, r: { advance: number }) => s + (r.advance || 0), 0)
    const netPayment  = salary - absentDays * dailyRate - totalAdv

    await query(
      `CREATE TABLE IF NOT EXISTS salary_records (
        id SERIAL PRIMARY KEY, employee_name TEXT, month TEXT, monthly_salary DECIMAL(12,2),
        working_days INTEGER, daily_rate DECIMAL(12,2), total_advances DECIMAL(12,2),
        net_payment DECIMAL(12,2), payment_date DATE, payment_account TEXT DEFAULT 'Cash',
        payment_method TEXT DEFAULT 'Cash', attendance_data JSONB DEFAULT '[]',
        qb_lines JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW())`
    )
    await query(
      `INSERT INTO salary_records (employee_name, month, monthly_salary, working_days, daily_rate, total_advances, net_payment, payment_date, payment_account, payment_method, attendance_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [`${employeeName}`, `${month} ${year}`, salary, workingDays, dailyRate, totalAdv, netPayment, paymentDate || null, paymentAccount || 'Cash', paymentMethod || 'Cash', JSON.stringify(attendance)]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[salary-card/manual]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
