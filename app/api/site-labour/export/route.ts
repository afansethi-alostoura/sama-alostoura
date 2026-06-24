import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const db = () => supabaseAdmin!

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const from = req.nextUrl.searchParams.get('from') ?? ''
  const to   = req.nextUrl.searchParams.get('to')   ?? ''

  let q = db().from('site_labour').select('*').order('expense_date').order('project_name').order('trade')
  if (from) q = q.gte('expense_date', from)
  if (to)   q = q.lte('expense_date', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  // QuickBooks-compatible CSV columns
  const headers = [
    'Date', 'Vendor', 'Account', 'Class', 'Description', 'Qty', 'Rate', 'Amount', 'Payment Method', 'Memo'
  ]

  function fmtDate(d: string) {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  function csvCell(v: string | number) {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const lines = [
    headers.join(','),
    ...rows.map(r => [
      csvCell(fmtDate(r.expense_date)),
      csvCell('Site Labour'),
      csvCell('Labour & Subcontract'),
      csvCell(r.project_name || ''),
      csvCell(`${r.trade} (${r.worker_count} worker${r.worker_count !== 1 ? 's' : ''})`),
      csvCell(r.worker_count),
      csvCell(Number(r.daily_rate).toFixed(2)),
      csvCell(Number(r.total_amount).toFixed(2)),
      csvCell((r.payment_method || 'cash').replace('_', ' ')),
      csvCell(r.notes || ''),
    ].join(','))
  ]

  const csv = lines.join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="site-labour-${from ?? 'all'}-to-${to ?? 'all'}.csv"`,
    },
  })
}
