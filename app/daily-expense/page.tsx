'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  Plus, Trash2, Download, ChevronLeft, ChevronRight,
  Loader2, HardHat, Users, Wallet, Calendar,
} from 'lucide-react'
import { useAllProjects } from '@/hooks/useAllProjects'

// ── Constants ─────────────────────────────────────────────────────────────────
const TRADES = [
  'Helper', 'Carpenter', 'Steel Fixer', 'Mason / Block Layer',
  'Painter', 'Plumber', 'Electrician', 'Tile Fixer',
  'Plasterer', 'Waterproofing', 'Foreman', 'Supervisor', 'Other',
]
const PAY_METHODS = ['Cash', 'Bank Transfer', 'Cheque']

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10) }

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function shiftDate(date: string, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DailyExpensePage() {
  const { projects } = useAllProjects()

  const [date,       setDate]       = useState(todayStr())
  const [entries,    setEntries]    = useState<any[]>([])
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [showForm,   setShowForm]   = useState(false)

  // Export date range
  const [exportFrom, setExportFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [exportTo, setExportTo] = useState(todayStr())

  // New entry form state
  const BLANK = { project_name: '', trade: '', worker_count: '1', daily_rate: '', payment_method: 'Cash', notes: '' }
  const [form, setForm] = useState(BLANK)

  const fetchEntries = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/site-labour?date=${d}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
    } catch { setEntries([]) }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { fetchEntries(date) }, [date, fetchEntries])

  async function save() {
    if (!form.trade || !form.worker_count || !form.daily_rate) return
    setSaving(true)
    const proj = projects.find(p => p.name === form.project_name)
    try {
      await fetch('/api/site-labour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date:   date,
          project_id:     proj?.id ?? null,
          project_name:   form.project_name,
          trade:          form.trade,
          worker_count:   parseInt(form.worker_count),
          daily_rate:     parseFloat(form.daily_rate),
          payment_method: form.payment_method,
          notes:          form.notes,
        }),
      })
      setForm(BLANK)
      setShowForm(false)
      fetchEntries(date)
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    setEntries(p => p.filter(e => e.id !== id))
    await fetch(`/api/site-labour?id=${id}`, { method: 'DELETE' })
  }

  function exportCSV() {
    const url = `/api/site-labour/export?from=${exportFrom}&to=${exportTo}`
    const a   = document.createElement('a')
    a.href    = url
    a.click()
  }

  // Summary
  const totalWorkers = entries.reduce((s: number, e: any) => s + Number(e.worker_count), 0)
  const totalAmount  = entries.reduce((s: number, e: any) => s + Number(e.total_amount), 0)

  const byTrade = entries.reduce((acc: Record<string, { count: number; amount: number }>, e: any) => {
    if (!acc[e.trade]) acc[e.trade] = { count: 0, amount: 0 }
    acc[e.trade].count  += Number(e.worker_count)
    acc[e.trade].amount += Number(e.total_amount)
    return acc
  }, {})

  const byProject = entries.reduce((acc: Record<string, { count: number; amount: number }>, e: any) => {
    const k = e.project_name || 'No Project'
    if (!acc[k]) acc[k] = { count: 0, amount: 0 }
    acc[k].count  += Number(e.worker_count)
    acc[k].amount += Number(e.total_amount)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <HardHat className="w-6 h-6 text-amber-600" />
            Daily Labour Expense
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Record daily site labour payments — export to CSV for QuickBooks</p>
        </div>

        {/* Export */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
            className="text-xs border-0 outline-none text-slate-600 w-24 bg-transparent" />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
            className="text-xs border-0 outline-none text-slate-600 w-24 bg-transparent" />
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors ml-1"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Date navigator ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(d => shiftDate(d, -1))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button onClick={() => setDate(d => shiftDate(d, 1))}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          {date !== todayStr() && (
            <button onClick={() => setDate(todayStr())}
              className="text-xs text-amber-600 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-lg px-3 py-2 font-semibold transition-colors">
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Labour Entry
        </button>
      </div>

      {/* ── Add form ────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-amber-800 mb-3">
            New entry — {fmtDate(date)}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

            {/* Project */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Project</label>
              <select
                value={form.project_name}
                onChange={e => setForm(p => ({ ...p, project_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">— No project —</option>
                {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>

            {/* Trade */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Trade / Role *</label>
              <select
                value={form.trade}
                onChange={e => setForm(p => ({ ...p, trade: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                <option value="">Select trade…</option>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Workers */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">No. of Workers *</label>
              <input
                type="number" min="1" value={form.worker_count}
                onChange={e => setForm(p => ({ ...p, worker_count: e.target.value }))}
                placeholder="e.g. 5"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>

            {/* Daily rate */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Daily Rate (AED) *</label>
              <input
                type="number" min="0" value={form.daily_rate}
                onChange={e => setForm(p => ({ ...p, daily_rate: e.target.value }))}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>

            {/* Total preview */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Total (AED)</label>
              <div className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm font-bold text-amber-800">
                {form.worker_count && form.daily_rate
                  ? `AED ${(parseInt(form.worker_count || '0') * parseFloat(form.daily_rate || '0')).toLocaleString()}`
                  : '—'}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Payment Method</label>
              <select
                value={form.payment_method}
                onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              >
                {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Notes — full width */}
            <div className="col-span-2 sm:col-span-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Notes (optional)</label>
              <input
                type="text" value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional details…"
                onKeyDown={e => e.key === 'Enter' && save()}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowForm(false); setForm(BLANK) }}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !form.trade || !form.worker_count || !form.daily_rate}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save Entry
            </button>
          </div>
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500">Total Workers</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalWorkers}</p>
            <p className="text-xs text-slate-400 mt-0.5">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
            <p className="text-xs text-slate-500">Total Paid</p>
            <p className="text-2xl font-bold text-red-600 mt-1">AED {Math.round(totalAmount).toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">For {fmtDate(date)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm col-span-2">
            <p className="text-xs text-slate-500 mb-2">By Trade</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byTrade).map(([trade, v]) => (
                <span key={trade} className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-1">
                  <span className="font-semibold">{trade}</span>
                  <span className="text-amber-500">·</span>
                  <span>{(v as any).count} workers</span>
                  <span className="text-amber-500">·</span>
                  <span className="font-bold">AED {Math.round((v as any).amount).toLocaleString()}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── By project summary ──────────────────────────────────────────────── */}
      {Object.keys(byProject).length > 1 && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Labour by Project
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(byProject).map(([proj, v]) => (
              <div key={proj} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-slate-800 truncate max-w-[160px]">{proj}</p>
                  <p className="text-[10px] text-slate-400">{(v as any).count} workers</p>
                </div>
                <p className="text-sm font-bold text-slate-900">AED {Math.round((v as any).amount).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Entries table ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <p className="text-sm font-semibold text-slate-700">
            Entries for {fmtDate(date)}
            {entries.length > 0 && <span className="ml-2 text-slate-400 font-normal">({entries.length})</span>}
          </p>
          {entries.length > 0 && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-amber-500" />
              Total: <strong className="text-slate-800 ml-0.5">AED {Math.round(totalAmount).toLocaleString()}</strong>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-14 text-center">
            <HardHat className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No entries for {fmtDate(date)}</p>
            <p className="text-xs text-slate-300 mt-1">Click "Add Labour Entry" to record today's workers</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Project</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Trade</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">Workers</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Daily Rate</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Total</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Method</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e: any, i: number) => (
                  <tr key={e.id} className={`hover:bg-amber-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                    <td className="px-5 py-3">
                      {e.project_name
                        ? <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-0.5 text-xs font-semibold">{e.project_name}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">{e.trade}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-100 text-amber-800 rounded-full font-bold text-sm">
                        {e.worker_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 text-sm">AED {Number(e.daily_rate).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 text-sm">AED {Number(e.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs capitalize">{(e.payment_method || 'cash').replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs italic max-w-[140px]">
                      <span className="block truncate" title={e.notes}>{e.notes || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => remove(e.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200">
                  <td colSpan={2} className="px-5 py-3 text-xs font-bold text-amber-800">
                    Total — {fmtDate(date)}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-amber-800">{totalWorkers}</td>
                  <td />
                  <td className="px-4 py-3 text-right font-bold text-amber-900">
                    AED {Math.round(totalAmount).toLocaleString()}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── CSV info ────────────────────────────────────────────────────────── */}
      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-700">
        <p className="font-bold mb-1">How to import into QuickBooks</p>
        <ol className="list-decimal list-inside space-y-0.5 text-emerald-600">
          <li>Set the date range above and click <strong>Export CSV</strong></li>
          <li>In QuickBooks → go to <strong>Expenses → Import</strong></li>
          <li>Upload the CSV file and map columns: Date, Vendor, Account, Class, Description, Amount</li>
          <li>Review and confirm the import</li>
        </ol>
      </div>
    </div>
  )
}
