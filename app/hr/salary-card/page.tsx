'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Camera, Upload, Loader2, Download, CheckCircle2, ArrowLeft, Banknote, User, Calendar, Building2, Plus, X, Users, Pencil, FileText, ClipboardList, Trash2, PenLine } from 'lucide-react'
import Link from 'next/link'

interface SalaryRecord { id: number; employee_name: string; month: string; monthly_salary: string; working_days: number; net_payment: string; payment_date: string | null; created_at: string }
interface Worker { id: number; name: string; monthly_salary: number; position: string }
interface AttendanceRow { date: string; project: string | null; status: string; advance: number }
interface QBLine { date: string; category: string; description: string; amount: number; tax: string; class: string; day: string; advance: number }
interface Result {
  employee_name: string; month: string; company: string
  project_columns: string[]; attendance: AttendanceRow[]
  days_in_month: number | null; sunday_count: number
  working_days: number; present_days: number; absent_days: number
  daily_rate: number; absent_deduction: number; salary_earned: number
  total_advances: number; net_payment: number
  qb_lines: QBLine[]
}
interface Project { id: string; name: string; qb_class_name?: string }
const STATUS_OPTIONS = ['worked', 'absent', 'sunday', 'off']

// fallback if projects API returns nothing
const FALLBACK_PROJECTS: Project[] = [
  { id: 'khalid',  name: 'Khalid',       qb_class_name: 'KHALID MOHD ALAMERI' },
  { id: 'fahid',   name: 'Fahid',        qb_class_name: 'Fahad Bin Rashed Bin Essa Bin Abdull' },
  { id: 'mansoor', name: 'Mansoor',      qb_class_name: 'Mansoor' },
  { id: 'madinat', name: 'Madinat Hind', qb_class_name: 'Madinat Hind' },
]

function getSundays(year: number, month: number): Set<number> {
  const s = new Set<number>()
  const days = new Date(year, month, 0).getDate()
  for (let d = 1; d <= days; d++) if (new Date(year, month - 1, d).getDay() === 0) s.add(d)
  return s
}

function buildManualAttendance(cardMonth: string, firstProject: string | null): AttendanceRow[] {
  if (!cardMonth) return []
  const [y, m] = cardMonth.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const sundays = getSundays(y, m)
  const monthShort = new Date(y, m - 1).toLocaleString('en', { month: 'short' })
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1
    return { date: `${d}-${monthShort}`, project: sundays.has(d) ? null : firstProject, status: sundays.has(d) ? 'sunday' : 'worked', advance: 0 }
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'worked') return <span className="text-blue-600 dark:text-blue-400 font-medium">Worked</span>
  if (status === 'sunday') return <span className="text-slate-400 text-[10px] uppercase">Sunday</span>
  if (status === 'absent') return <span className="text-red-500 text-[10px] uppercase font-semibold">Absent</span>
  return <span className="text-slate-400 text-[10px] uppercase">{status}</span>
}

export default function SalaryCardPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'upload' | 'manual'>('upload')

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64]   = useState<string>('')
  const [mimeType, setMimeType]         = useState<string>('image/jpeg')

  const [projects,     setProjects]     = useState<Project[]>(FALLBACK_PROJECTS)
  const [workers,      setWorkers]      = useState<Worker[]>([])
  const [selectedId,   setSelectedId]   = useState<number | null>(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [newName,      setNewName]      = useState('')
  const [newSalary,    setNewSalary]    = useState('')
  const [newPosition,  setNewPosition]  = useState('Laborer')
  const [savingWorker, setSavingWorker] = useState(false)

  const [salary,        setSalary]        = useState('')
  const [cardMonth,     setCardMonth]     = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [paymentDate,   setPaymentDate]   = useState(new Date().toISOString().slice(0, 10))
  const [paymentAcct,   setPaymentAcct]   = useState('Cash')
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  const [records,     setRecords]     = useState<SalaryRecord[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)

  const [loading,  setLoading]  = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState<Result | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedAttendance, setEditedAttendance] = useState<AttendanceRow[]>([])
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null)

  // Manual mode: worker name typed directly
  const [manualName, setManualName] = useState('')

  function loadRecords() {
    setLoadingRecs(true)
    fetch('/api/hr/salary-card').then(r => r.json()).then(d => { if (Array.isArray(d)) setRecords(d) }).catch(() => {}).finally(() => setLoadingRecs(false))
  }

  async function editRecord(id: number) {
    const rec = await fetch(`/api/hr/salary-card?id=${id}`).then(r => r.json())
    if (!rec) return
    setMode('manual')
    setManualName(rec.employee_name ?? '')
    setSalary(String(rec.monthly_salary ?? ''))
    setPaymentDate(rec.payment_date ? rec.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setPaymentAcct(rec.payment_account ?? 'Cash')
    setPaymentMethod(rec.payment_method ?? 'Cash')
    const att: AttendanceRow[] = rec.attendance_data ?? []
    setEditedAttendance(att)
    setEditingRecordId(id)
    setSaved(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteRecord(id: number, name: string) {
    if (!confirm(`Delete salary record for ${name}?`)) return
    await fetch(`/api/hr/salary-card?id=${id}`, { method: 'DELETE' })
    loadRecords()
  }

  async function downloadRecord(id: number) {
    const rec = await fetch(`/api/hr/salary-card?id=${id}`).then(r => r.json())
    if (!rec) return
    const attendance: AttendanceRow[] = rec.attendance_data ?? []
    const worked = attendance.filter((d: AttendanceRow) => d.status === 'worked')
    const dailyRate = parseFloat(rec.daily_rate) || 0
    const header = ['Date','Day','Category','Employee','Daily Rate (AED)','Tax','Project/Class','Advance (AED)']
    const rows = worked.map((d: AttendanceRow) => [
      rec.payment_date ?? '', d.date, 'Wage expenses', rec.employee_name,
      dailyRate.toFixed(2), 'ZR Zero Rated', d.project ?? '', d.advance > 0 ? d.advance.toFixed(2) : ''
    ])
    const totalsRow = ['','','TOTAL','', (worked.length * dailyRate).toFixed(2), '','', parseFloat(rec.total_advances).toFixed(2)]
    const csv = [header, ...rows, [], totalsRow].map(r => r.map((c: string | number) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `salary_${rec.employee_name.replace(/\s+/g, '_')}_${rec.month.replace(/\s+/g, '_')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetch('/api/hr/workers').then(r => r.json()).then(d => { if (Array.isArray(d)) setWorkers(d) }).catch(() => {})
    fetch('/api/projects').then(r => r.json()).then((d: Project[]) => {
      if (Array.isArray(d) && d.length > 0) setProjects(d)
    }).catch(() => {})
    loadRecords()
  }, [])

  // Sync editable attendance when result arrives (upload mode)
  useEffect(() => {
    if (result) setEditedAttendance(result.attendance.map(r => ({ ...r })))
  }, [result])

  // Manual mode: rebuild attendance grid when month or projects change
  useEffect(() => {
    if (mode === 'manual') setEditedAttendance(buildManualAttendance(cardMonth, projects[0]?.name ?? null))
  }, [cardMonth, mode, projects])

  // Derived month info for manual mode
  const manualMonthInfo = useMemo(() => {
    if (!cardMonth) return { daysInMonth: 0, sundayCount: 0, workingDays: 0, monthLabel: '' }
    const [y, m] = cardMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const sundayCount = getSundays(y, m).size
    return { daysInMonth, sundayCount, workingDays: daysInMonth - sundayCount, monthLabel: new Date(y, m - 1).toLocaleString('en', { month: 'long', year: 'numeric' }) }
  }, [cardMonth])

  // Live-recalculate totals
  const computed = useMemo(() => {
    const sal        = parseFloat(salary) || 0
    const totalDays  = mode === 'manual' ? manualMonthInfo.daysInMonth : (result?.days_in_month ?? 0)
    const workingDays = mode === 'manual' ? manualMonthInfo.workingDays : (result?.working_days ?? 0)
    // Daily rate = salary / total days in month (Sundays paid, absent days deducted)
    const dailyRate      = totalDays > 0 ? Math.round((sal / totalDays) * 100) / 100 : 0
    const presentDays    = editedAttendance.filter(d => d.status === 'worked').length
    const absentDays     = editedAttendance.filter(d => d.status === 'absent').length
    const sundayCount    = editedAttendance.filter(d => d.status === 'sunday').length
    const totalAdvances  = editedAttendance.reduce((s, d) => s + (d.advance || 0), 0)
    const absentDeduction = Math.round(absentDays * dailyRate * 100) / 100
    const netPayment     = sal - absentDeduction - totalAdvances
    return { presentDays, absentDays, sundayCount, totalAdvances, dailyRate, absentDeduction, netPayment, workingDays, sal }
  }, [editedAttendance, salary, mode, manualMonthInfo, result])

  const employeeName = mode === 'manual' ? manualName : (result?.employee_name ?? '')
  const monthLabel   = mode === 'manual' ? manualMonthInfo.monthLabel : (result?.month ?? '')
  const daysInMonth  = mode === 'manual' ? manualMonthInfo.daysInMonth : (result?.days_in_month ?? null)
  const hasResult    = mode === 'manual' ? (editedAttendance.length > 0 && !!salary) : !!result

  function updateRow(i: number, field: keyof AttendanceRow, value: string | number) {
    setEditedAttendance(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [field]: value }
      if (field === 'status' && value !== 'worked') updated.project = null
      if (field === 'status' && value === 'worked' && !updated.project) updated.project = projects[0]?.name ?? null
      return updated
    }))
  }

  function selectWorker(id: number) {
    setSelectedId(id)
    const w = workers.find(w => w.id === id)
    if (w) { setSalary(String(w.monthly_salary)); if (mode === 'manual') setManualName(w.name) }
  }

  async function addWorker() {
    if (!newName || !newSalary) return
    setSavingWorker(true)
    try {
      const res = await fetch('/api/hr/workers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, monthly_salary: newSalary, position: newPosition }),
      })
      const w = await res.json()
      if (w.id) {
        setWorkers(prev => [...prev, w].sort((a, b) => a.name.localeCompare(b.name)))
        setSelectedId(w.id); setSalary(String(w.monthly_salary))
        if (mode === 'manual') setManualName(w.name)
        setShowAdd(false); setNewName(''); setNewSalary(''); setNewPosition('Laborer')
      }
    } finally { setSavingWorker(false) }
  }

  function handleFile(file: File) {
    setMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl); setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
    setResult(null); setSaved(false); setError('')
  }

  async function analyse() {
    if (!imageBase64) { setError('Please upload a photo first'); return }
    if (!salary)      { setError('Enter or select monthly salary'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/hr/salary-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType, monthlySalary: salary, cardMonth, paymentDate, paymentAccount: paymentAcct, paymentMethod, projectMap: Object.fromEntries(projects.map(p => [p.name, p.qb_class_name ?? p.name])) }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data); setSaved(true); setEditMode(false); loadRecords()
    } catch (e: unknown) { setError(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }

  async function saveManual() {
    if (!salary || !manualName) { setError('Enter worker name and salary'); return }
    setLoading(true); setError('')
    try {
      const [y, m] = cardMonth.split('-').map(Number)
      const monthName = new Date(y, m - 1).toLocaleString('en', { month: 'long' })
      let res: Response
      if (editingRecordId) {
        res = await fetch(`/api/hr/salary-card?id=${editingRecordId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeName: manualName, month: `${monthName} ${y}`, monthlySalary: salary, attendance: editedAttendance, paymentDate, paymentAccount: paymentAcct, paymentMethod }),
        })
      } else {
        res = await fetch('/api/hr/salary-card/manual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeName: manualName, month: monthName, year: String(y), monthlySalary: salary, attendance: editedAttendance, paymentDate, paymentAccount: paymentAcct, paymentMethod }),
        })
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSaved(true); setEditingRecordId(null); loadRecords()
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e))
    } finally { setLoading(false) }
  }

  function downloadCSV() {
    if (!hasResult) return
    const header = ['Date','Day','Category','Employee','Daily Rate (AED)','Tax','Project/Class','Advance (AED)']
    const worked = editedAttendance.filter(d => d.status === 'worked')
    const rows = worked.map(d => {
      const proj = projects.find(p => p.name === d.project)
      const fullClass = proj?.qb_class_name ?? d.project ?? ''
      return [paymentDate, d.date, 'Wage expenses', employeeName, computed.dailyRate.toFixed(2), 'ZR Zero Rated', fullClass, d.advance > 0 ? d.advance.toFixed(2) : '']
    })
    const totalsRow = ['','','TOTAL','', (worked.length * computed.dailyRate).toFixed(2), '','', computed.totalAdvances.toFixed(2)]
    const csv = [header, ...rows, [], totalsRow].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `salary_${employeeName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function downloadIIF() {
    if (!hasResult) return
    const worked = editedAttendance.filter(d => d.status === 'worked')
    const total  = Math.round(worked.length * computed.dailyRate * 100) / 100

    // QB date format: MM/DD/YYYY
    const [py, pm, pd] = paymentDate.split('-')
    const qbDate = `${pm}/${pd}/${py}`
    const refNo  = `${employeeName} ${monthLabel}`

    const lines: string[] = [
      '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tCLASS\tTOPRINT',
      '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\tCLASS\tBILLABLE',
      '!ENDTRNS',
      `TRNS\t\tCHECK\t${qbDate}\t${paymentAcct}\t${employeeName}\t${(-total).toFixed(2)}\t${refNo}\t${monthLabel} Salary\t\tN`,
    ]

    worked.forEach(d => {
      const proj      = projects.find(p => p.name === d.project)
      const fullClass = proj?.qb_class_name ?? d.project ?? ''
      lines.push(`SPL\t\tCHECK\t${qbDate}\tWage expenses\t${employeeName}\t${computed.dailyRate.toFixed(2)}\t\t${d.date} ${employeeName}\t${fullClass}\tN`)
    })

    lines.push('ENDTRNS')

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `salary_${employeeName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.iif`
    a.click(); URL.revokeObjectURL(url)
  }

  function printReport() {
    if (!hasResult) return
    const rows = editedAttendance.map(r => {
      const bg = r.status === 'absent' ? '#fff5f5' : r.status === 'sunday' ? '#f8fafc' : '#fff'
      const statusCell = r.status === 'worked'
        ? `<td style="color:#2563eb">${r.project ?? ''}</td>`
        : `<td style="color:${r.status === 'absent' ? '#ef4444' : '#94a3b8'};text-transform:uppercase;font-size:11px">${r.status}</td>`
      const amtCell = r.status === 'worked'
        ? `<td style="text-align:right">${computed.dailyRate.toFixed(2)}</td>`
        : r.status === 'absent'
          ? `<td style="text-align:right;color:#ef4444">-${computed.dailyRate.toFixed(2)}</td>`
          : `<td style="text-align:right;color:#94a3b8">—</td>`
      const advCell = r.advance > 0 ? `<td style="text-align:right;color:#ef4444">${r.advance.toFixed(2)}</td>` : `<td style="text-align:right;color:#94a3b8">—</td>`
      return `<tr style="background:${bg};border-bottom:1px solid #f1f5f9"><td>${r.date}</td>${statusCell}${amtCell}${advCell}</tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Report</title>
<style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1e293b;font-size:13px}h1{font-size:20px;margin:0 0 4px}.sub{color:#64748b;font-size:13px;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}.box{background:#f8fafc;border-radius:8px;padding:12px}.box-label{font-size:11px;color:#64748b;margin-bottom:4px}.box-val{font-size:15px;font-weight:700;color:#1e293b}.box-val.green{color:#059669}.box-val.red{color:#ef4444}.box-val.blue{color:#2563eb}.net{grid-column:span 2;background:#ecfdf5}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase}td{padding:6px 10px}tfoot tr{border-top:2px solid #e2e8f0;font-weight:700}.footer{margin-top:30px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between}@media print{body{padding:12px}}</style></head><body>
<h1>Salary Report — ${employeeName}</h1>
<div class="sub">${monthLabel} · Sama Alostoura · Payment: ${paymentDate}</div>
<div class="grid">
  <div class="box"><div class="box-label">Total Days</div><div class="box-val">${daysInMonth ?? '—'}</div></div>
  <div class="box"><div class="box-label">Sundays (off)</div><div class="box-val">${computed.sundayCount}</div></div>
  <div class="box"><div class="box-label">Working Days</div><div class="box-val">${computed.workingDays}</div></div>
  <div class="box"><div class="box-label">Daily Rate</div><div class="box-val">AED ${computed.dailyRate.toFixed(2)}</div></div>
  <div class="box"><div class="box-label">Days Present</div><div class="box-val blue">${computed.presentDays}</div></div>
  <div class="box"><div class="box-label">Days Absent</div><div class="box-val red">${computed.absentDays}</div></div>
  <div class="box"><div class="box-label">Absent Deduction</div><div class="box-val red">AED ${computed.absentDeduction.toFixed(2)}</div></div>
  <div class="box"><div class="box-label">Advances</div><div class="box-val red">AED ${computed.totalAdvances.toFixed(2)}</div></div>
  <div class="box net"><div class="box-label">Monthly Salary</div><div class="box-val">AED ${computed.sal.toFixed(2)}</div></div>
  <div class="box net"><div class="box-label">Net Payment</div><div class="box-val green">AED ${computed.netPayment.toFixed(2)}</div></div>
</div>
<table><thead><tr><th>Date</th><th>Status / Project</th><th style="text-align:right">Amount (AED)</th><th style="text-align:right">Advance (AED)</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="2">Net Payment</td><td style="text-align:right;color:#059669">${computed.netPayment.toFixed(2)}</td><td style="text-align:right;color:#ef4444">${computed.totalAdvances.toFixed(2)}</td></tr></tfoot>
</table>
<div class="footer"><span>Generated by Sama Alostoura Construction OS</span><span>${new Date().toLocaleDateString('en-AE')}</span></div>
<script>window.onload=()=>{window.print()}</script></body></html>`

    const w = window.open('', '_blank'); w?.document.write(html); w?.document.close()
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/hr" className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Salary Card</h1>
            <p className="text-sm text-slate-500">Attendance → QuickBooks transaction</p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-5 bg-white dark:bg-slate-800 p-1 rounded-2xl shadow-sm w-fit">
          <button
            onClick={() => { setMode('upload'); setResult(null); setSaved(false); setError('') }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <Camera className="w-4 h-4" /> Card Upload
          </button>
          <button
            onClick={() => { setMode('manual'); setSaved(false); setError(''); setEditedAttendance(buildManualAttendance(cardMonth, projects[0]?.name ?? null)) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <ClipboardList className="w-4 h-4" /> Manual Entry
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* LEFT */}
          <div className="space-y-4">

            {/* Upload mode: photo */}
            {mode === 'upload' && (
              <>
                <div
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  {imagePreview ? (
                    <img src={imagePreview} alt="Salary card" className="w-full object-contain max-h-72" />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                      <Camera className="w-12 h-12" />
                      <div className="text-center">
                        <p className="font-medium text-slate-600 dark:text-slate-300">Tap to upload salary card photo</p>
                        <p className="text-sm">JPG, PNG — use camera for best results</p>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {imagePreview && (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Upload className="w-4 h-4" /> Change photo
                  </button>
                )}
              </>
            )}

            {/* Manual mode: worker name */}
            {mode === 'manual' && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
                <label className="text-xs text-slate-500 mb-1 block">Worker Name *</label>
                <input type="text" placeholder="e.g. Mohammed Ali" value={manualName} onChange={e => setManualName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
            )}

            {/* Payment details (shared) */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-500" /> Payment Details
              </h2>

              {/* Worker selector */}
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Saved Workers</label>
                <div className="flex gap-2">
                  <select value={selectedId ?? ''} onChange={e => { const v = e.target.value; v ? selectWorker(Number(v)) : setSelectedId(null) }}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm">
                    <option value="">— select worker —</option>
                    {workers.map(w => <option key={w.id} value={w.id}>{w.name} · AED {w.monthly_salary.toLocaleString()}</option>)}
                  </select>
                  <button onClick={() => setShowAdd(v => !v)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {showAdd && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 space-y-2 border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Add New Worker</span>
                    <button onClick={() => setShowAdd(false)}><X className="w-3.5 h-3.5 text-slate-400" /></button>
                  </div>
                  <input type="text" placeholder="Full name" value={newName} onChange={e => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Monthly salary" value={newSalary} onChange={e => setNewSalary(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white" />
                    <select value={newPosition} onChange={e => setNewPosition(e.target.value)}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white">
                      <option>Laborer</option><option>Mason</option><option>Carpenter</option>
                      <option>Electrician</option><option>Plumber</option><option>Painter</option>
                      <option>Driver</option><option>Supervisor</option>
                    </select>
                  </div>
                  <button onClick={addWorker} disabled={!newName || !newSalary || savingWorker}
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1">
                    {savingWorker ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Save Worker
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Monthly Salary (AED) *</label>
                <input type="number" placeholder="e.g. 1800" value={salary} onChange={e => setSalary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Card Month</label>
                <input type="month" value={cardMonth} onChange={e => setCardMonth(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Payment Date</label>
                <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Payment Account</label>
                <input type="text" placeholder="e.g. Eden Red, Cash" value={paymentAcct} onChange={e => setPaymentAcct(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm">
                  <option>Cash</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
            )}

            {mode === 'upload' ? (
              <button onClick={analyse} disabled={loading || !imageBase64}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Analysing card...</> : <><Camera className="w-5 h-5" /> Analyse Salary Card</>}
              </button>
            ) : (
              <button onClick={saveManual} disabled={loading || !salary || !manualName}
                className={`w-full py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors ${editingRecordId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : editingRecordId ? <><PenLine className="w-5 h-5" /> Update Record</> : <><CheckCircle2 className="w-5 h-5" /> Save Record</>}
              </button>
              {editingRecordId && (
                <button onClick={() => { setEditingRecordId(null); setManualName(''); setSaved(false) }}
                  className="w-full py-2 rounded-2xl border border-slate-300 dark:border-slate-600 text-slate-500 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  Cancel Edit
                </button>
              )}
            )}
          </div>

          {/* RIGHT */}
          <div className="space-y-4">
            {hasResult && (
              <>
                {/* Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-500" /> {employeeName || '—'}
                    </h2>
                    {saved && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
                  </div>
                  {monthLabel && (
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {monthLabel}
                      {result?.company && <> · <Building2 className="w-3 h-3" /> {result.company}</>}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {daysInMonth && <StatBox label="Total Days" value={daysInMonth} />}
                    {computed.sundayCount > 0 && <StatBox label="Sundays (off)" value={computed.sundayCount} />}
                    <StatBox label="Working Days" value={computed.workingDays} />
                    <StatBox label="Days Present"  value={computed.presentDays}  blue />
                    {computed.absentDays > 0 && <StatBox label="Days Absent" value={computed.absentDays} red />}
                    <StatBox label="Daily Rate" value={`AED ${computed.dailyRate.toFixed(2)}`} />
                    {computed.absentDeduction > 0 && <StatBox label="Absent Deduction" value={`AED ${computed.absentDeduction.toFixed(2)}`} red />}
                    <StatBox label="Advances" value={`AED ${computed.totalAdvances.toFixed(2)}`} red />
                    <StatBox label="Net Payment" value={`AED ${computed.netPayment.toFixed(2)}`} green large />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={downloadIIF}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                      <Download className="w-4 h-4" /> QB Import (.iif)
                    </button>
                    <button onClick={printReport}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                      <FileText className="w-4 h-4" /> Salary Report
                    </button>
                  </div>
                  <button onClick={downloadCSV}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs transition-colors">
                    <Download className="w-3 h-3" /> Download CSV
                  </button>
                </div>

                {/* Attendance table */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Attendance Breakdown</h3>
                    {mode === 'upload' && (
                      <button onClick={() => setEditMode(v => !v)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${editMode ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <Pencil className="w-3 h-3" /> {editMode ? 'Done' : 'Edit'}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-slate-500 font-semibold">Date</th>
                          <th className="px-4 py-3 text-left text-slate-500 font-semibold">Status / Project</th>
                          <th className="px-4 py-3 text-right text-slate-500 font-semibold">Amount</th>
                          <th className="px-4 py-3 text-right text-slate-500 font-semibold">Advance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editedAttendance.map((row, i) => {
                          const isEditing = editMode || mode === 'manual'
                          return (
                            <tr key={i} className={`border-t border-slate-100 dark:border-slate-700/50 ${row.status === 'absent' ? 'bg-red-50 dark:bg-red-900/10' : row.status !== 'worked' ? 'opacity-50' : ''}`}>
                              <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{row.date}</td>
                              <td className="px-4 py-2">
                                {isEditing ? (
                                  <div className="flex gap-2">
                                    <select value={row.status} onChange={e => updateRow(i, 'status', e.target.value)}
                                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm">
                                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {row.status === 'worked' && (
                                      <select value={row.project ?? ''} onChange={e => updateRow(i, 'project', e.target.value)}
                                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm flex-1">
                                        {projects.map(p => (
                                          <option key={p.id} value={p.name}>
                                            {p.qb_class_name ?? p.name}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ) : (
                                  row.status === 'worked'
                                    ? <span className="text-blue-600 dark:text-blue-400">{row.project}</span>
                                    : <StatusBadge status={row.status} />
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                                {row.status === 'worked'
                                  ? computed.dailyRate.toFixed(2)
                                  : row.status === 'absent'
                                    ? <span className="text-red-500">-{computed.dailyRate.toFixed(2)}</span>
                                    : '—'}
                              </td>
                              <td className="px-4 py-2 text-right">
                                {isEditing ? (
                                  <input type="number" value={row.advance || ''} placeholder="0"
                                    onChange={e => updateRow(i, 'advance', parseFloat(e.target.value) || 0)}
                                    className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm text-right" />
                                ) : (
                                  row.advance > 0 ? <span className="text-red-500">{row.advance.toFixed(2)}</span> : '—'
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-700 sticky bottom-0">
                        <tr className="border-t-2 border-slate-200 dark:border-slate-600">
                          <td colSpan={2} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">Net Payment</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">{computed.netPayment.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-500">{computed.totalAdvances.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!hasResult && !loading && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center gap-3 text-center min-h-64">
                {mode === 'upload' ? <Camera className="w-12 h-12 text-slate-300" /> : <ClipboardList className="w-12 h-12 text-slate-300" />}
                <p className="text-slate-500 text-sm">
                  {mode === 'upload'
                    ? 'Upload a salary card photo and click Analyse to extract attendance.'
                    : 'Enter worker name, salary and month — the attendance grid will appear automatically.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Records */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-blue-600"/> Saved Salary Records
          {loadingRecs && <Loader2 className="w-3 h-3 animate-spin text-slate-400"/>}
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {!loadingRecs && records.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No salary records saved yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">Employee</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">Month</th>
                    <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">Salary</th>
                    <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">Working Days</th>
                    <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">Net Payment</th>
                    <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">Saved On</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id} className={`border-t border-slate-100 dark:border-slate-700/50 hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-700/20'}`}>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{r.employee_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.month || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">AED {Number(r.monthly_salary).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{r.working_days}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">AED {Number(r.net_payment).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' })}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => editRecord(r.id)} title="Edit"
                            className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => downloadRecord(r.id)} title="Download CSV"
                            className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteRecord(r.id, r.employee_name)} title="Delete"
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

function StatBox({ label, value, red, green, blue, large }: { label: string; value: string | number; red?: boolean; green?: boolean; blue?: boolean; large?: boolean }) {
  return (
    <div className={`bg-slate-50 dark:bg-slate-700 rounded-xl p-3 ${large ? 'col-span-2' : ''}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`font-bold ${large ? 'text-base' : 'text-sm'} ${red ? 'text-red-600' : green ? 'text-emerald-600' : blue ? 'text-blue-600' : 'text-slate-800 dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}
