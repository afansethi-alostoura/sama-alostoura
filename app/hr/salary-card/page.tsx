'use client'
import { useState, useRef } from 'react'
import { Camera, Upload, Loader2, Download, Save, CheckCircle2, ArrowLeft, Banknote, User, Calendar, Building2 } from 'lucide-react'
import Link from 'next/link'

interface AttendanceRow {
  date: string
  project: string | null
  status: string
  advance: number
}
interface QBLine {
  date: string; category: string; description: string
  amount: number; tax: string; class: string; day: string; advance: number
}
interface Result {
  employee_name: string; month: string; company: string
  project_columns: string[]; attendance: AttendanceRow[]
  working_days: number; daily_rate: number
  total_advances: number; net_payment: number
  qb_lines: QBLine[]
}

// Known project name → QB class mapping
const DEFAULT_PROJECT_MAP: Record<string, string> = {
  'Khalid':      'KHALID MOHD ALAMERI',
  'Fahid':       'Fahad Bin Rashed Bin Essa Bin Abdull',
  'Mansoor':     'Mansoor',
  'Madinat Hind': 'Madinat Hind',
}

export default function SalaryCardPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64]   = useState<string>('')
  const [mimeType, setMimeType]         = useState<string>('image/jpeg')

  const [salary,        setSalary]        = useState('')
  const [paymentDate,   setPaymentDate]   = useState(new Date().toISOString().slice(0, 10))
  const [paymentAcct,   setPaymentAcct]   = useState('Cash')
  const [paymentMethod, setPaymentMethod] = useState('Cash')

  const [loading,  setLoading]  = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState<Result | null>(null)

  function handleFile(file: File) {
    setMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
    setResult(null); setSaved(false); setError('')
  }

  async function analyse() {
    if (!imageBase64) { setError('Please upload a photo first'); return }
    if (!salary)      { setError('Enter the monthly salary amount'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/hr/salary-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64, mimeType,
          monthlySalary: salary,
          paymentDate, paymentAccount: paymentAcct, paymentMethod,
          projectMap: DEFAULT_PROJECT_MAP,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      setSaved(true)
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setLoading(false)
    }
  }

  function downloadCSV() {
    if (!result) return
    const header = ['Date','Day','Category','Employee','Daily Rate (AED)','Tax','Project/Class','Advance (AED)']
    const rows = result.qb_lines.map(l => [
      l.date, l.day, l.category, l.description,
      l.amount.toFixed(2), l.tax, l.class, l.advance > 0 ? l.advance.toFixed(2) : '',
    ])
    const totalsRow = ['','','TOTAL','',
      result.qb_lines.reduce((s, l) => s + l.amount, 0).toFixed(2),'','',
      result.total_advances.toFixed(2),
    ]
    const csv = [header, ...rows, [], totalsRow]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `salary_${result.employee_name?.replace(/\s+/g, '_')}_${result.month?.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/hr" className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Salary Card Scanner</h1>
            <p className="text-sm text-slate-500">Photo → AI reads attendance → QuickBooks transaction</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* LEFT — Upload + Settings */}
          <div className="space-y-4">

            {/* Photo upload */}
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
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

            {/* Payment settings */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-500" /> Payment Details
              </h2>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Monthly Salary (AED) *</label>
                <input type="number" placeholder="e.g. 1800" value={salary} onChange={e => setSalary(e.target.value)}
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
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <button onClick={analyse} disabled={loading || !imageBase64}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Analysing card...</> : <><Camera className="w-5 h-5" /> Analyse Salary Card</>}
            </button>
          </div>

          {/* RIGHT — Results */}
          <div className="space-y-4">
            {result && (
              <>
                {/* Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-500" /> {result.employee_name}
                    </h2>
                    {saved && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Saved</span>}
                  </div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {result.month}
                    {result.company && <> · <Building2 className="w-3 h-3" /> {result.company}</>}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Working Days', value: result.working_days },
                      { label: 'Daily Rate',   value: `AED ${result.daily_rate.toFixed(2)}` },
                      { label: 'Advances',     value: `AED ${result.total_advances.toFixed(2)}`, red: true },
                      { label: 'Net Payment',  value: `AED ${result.net_payment.toFixed(2)}`, green: true },
                    ].map(({ label, value, red, green }) => (
                      <div key={label} className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className={`font-bold text-sm ${red ? 'text-red-600' : green ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <button onClick={downloadCSV}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                    <Download className="w-4 h-4" /> Download for QuickBooks (.csv)
                  </button>
                </div>

                {/* Attendance table */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Attendance Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-500">Date</th>
                          <th className="px-3 py-2 text-left text-slate-500">Project</th>
                          <th className="px-3 py-2 text-right text-slate-500">Amount</th>
                          <th className="px-3 py-2 text-right text-slate-500">Advance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.attendance.map((row, i) => (
                          <tr key={i} className={`border-t border-slate-50 dark:border-slate-700/50 ${row.status === 'off' ? 'opacity-40' : ''}`}>
                            <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{row.date}</td>
                            <td className="px-3 py-1.5">
                              {row.status === 'worked'
                                ? <span className="text-blue-600 dark:text-blue-400">{row.project}</span>
                                : <span className="text-slate-400 uppercase text-[10px]">{row.status}</span>
                              }
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-300">
                              {row.status === 'worked' ? `${result.daily_rate.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {row.advance > 0
                                ? <span className="text-red-500">{row.advance.toFixed(2)}</span>
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-700 sticky bottom-0">
                        <tr className="border-t-2 border-slate-200 dark:border-slate-600">
                          <td colSpan={2} className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">TOTAL</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                            {(result.working_days * result.daily_rate).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-red-500">
                            {result.total_advances.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!result && !loading && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center gap-3 text-center min-h-64">
                <Camera className="w-12 h-12 text-slate-300" />
                <p className="text-slate-500 text-sm">Upload a salary card photo and click Analyse to extract attendance data and generate a QuickBooks transaction.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
