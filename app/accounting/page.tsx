'use client'
import { useEffect, useState, useCallback } from 'react'
import Link                                   from 'next/link'
import {
  RefreshCw, Loader2, Link2, AlertCircle, Tag,
  TrendingDown, ChevronDown, ChevronRight,
  BrainCircuit, TriangleAlert, Info, CircleX,
  CalendarRange,
} from 'lucide-react'
import { AccountantBriefing } from '@/components/accounting/accountant-briefing'
import { InvoiceTable }       from '@/components/accounting/invoice-table'
import type { QBSnapshot, QBClassExpenseRow, QBClass } from '@/lib/quickbooks/types'
import type { QBStatus }      from '@/lib/quickbooks/client'
import { useAllProjects }     from '@/hooks/useAllProjects'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Finding {
  severity: 'danger' | 'warning' | 'info'
  title:    string
  detail:   string
  amount?:  number | null
  project?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-card card-hover">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function aed(v: number) {
  if (v === 0) return '—'
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(1)}K`
  return `AED ${Math.round(v).toLocaleString()}`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function yearStartStr() {
  return `${new Date().getFullYear()}-01-01`
}

// ── AI Findings Panel ─────────────────────────────────────────────────────────
function FindingsPanel({ findings, onClose }: { findings: Finding[]; onClose: () => void }) {
  const sevMeta = {
    danger:  { icon: CircleX,       bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',    label: 'DANGER'  },
    warning: { icon: TriangleAlert, bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  label: 'WARNING' },
    info:    { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   label: 'INFO'    },
  }

  const dangers  = findings.filter(f => f.severity === 'danger')
  const warnings = findings.filter(f => f.severity === 'warning')
  const infos    = findings.filter(f => f.severity === 'info')

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-indigo-700">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-indigo-200" />
          <div>
            <p className="font-semibold text-white text-sm">AI Accountant Analysis</p>
            <p className="text-indigo-300 text-xs mt-0.5">
              {dangers.length > 0 && <span className="text-red-300 font-bold">{dangers.length} danger · </span>}
              {warnings.length > 0 && <span className="text-amber-300">{warnings.length} warning · </span>}
              {infos.length} info · {findings.length} total findings
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors text-xs">
          Dismiss
        </button>
      </div>

      {/* Findings */}
      <div className="divide-y divide-slate-100">
        {findings.map((f, i) => {
          const m = sevMeta[f.severity]
          const Icon = m.icon
          return (
            <div key={i} className={`px-5 py-4 flex items-start gap-4 ${m.bg}`}>
              <div className={`flex-shrink-0 mt-0.5 ${m.text}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${m.badge}`}>
                    {m.label}
                  </span>
                  {f.project && (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {f.project}
                    </span>
                  )}
                  {f.amount != null && f.amount > 0 && (
                    <span className={`text-[10px] font-bold ${m.text}`}>
                      AED {Number(f.amount).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{f.detail}</p>
              </div>
            </div>
          )
        })}
      </div>

      {findings.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-500">No findings — financials look healthy for this period.</p>
        </div>
      )}
    </div>
  )
}

// ── Class Expenses Section ────────────────────────────────────────────────────
function ClassExpensesSection({
  expenses,
  accountNames,
  classes,
  projects,
  syncedAt,
  dateRange,
  onDateChange,
  onAiAnalyse,
  aiLoading,
}: {
  expenses:      QBClassExpenseRow[]
  accountNames:  string[]
  classes:       QBClass[]
  projects:      Array<{ id: string; name: string; contract_value: number; progress_percent: number; received_amount: number }>
  syncedAt?:     string
  dateRange:     { from: string; to: string }
  onDateChange:  (range: { from: string; to: string }) => void
  onAiAnalyse:   () => void
  aiLoading:     boolean
}) {
  const [expanded,   setExpanded]   = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const totalExpenses = expenses.reduce((s, r) => s + r.total, 0)
  const hasData       = expenses.length > 0

  function findProject(className: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    return projects.find(p =>
      norm(p.name).includes(norm(className)) || norm(className).includes(norm(p.name))
    )
  }

  const filtered = expenses.filter(r =>
    !searchTerm || r.className.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Column totals
  const colTotals: Record<string, number> = {}
  for (const row of filtered) {
    for (const acc of accountNames) {
      colTotals[acc] = (colTotals[acc] ?? 0) + (row.accounts[acc] ?? 0)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-8">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-700 transition-colors">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <Tag className="w-4 h-4 text-indigo-500" />
          <div>
            <h3 className="font-semibold text-slate-900">Expenses by Project (QB Classes)</h3>
            {syncedAt && (
              <p className="text-xs text-slate-400 mt-0.5">
                {expenses.length} class{expenses.length !== 1 ? 'es' : ''} ·
                {accountNames.length} account type{accountNames.length !== 1 ? 's' : ''} ·
                Total {aed(totalExpenses)} ·
                Synced {new Date(syncedAt).toLocaleString('en-AE')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range filters */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="date"
              value={dateRange.from}
              onChange={e => onDateChange({ ...dateRange, from: e.target.value })}
              className="text-xs bg-transparent border-0 outline-none text-slate-600 w-28"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => onDateChange({ ...dateRange, to: e.target.value })}
              className="text-xs bg-transparent border-0 outline-none text-slate-600 w-28"
            />
          </div>

          {hasData && (
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter class…"
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 w-32"
            />
          )}

          {/* AI Accountant button */}
          <button
            onClick={onAiAnalyse}
            disabled={aiLoading || !hasData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {aiLoading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
              : <><BrainCircuit className="w-3.5 h-3.5" /> AI Accountant</>
            }
          </button>
        </div>
      </div>

      {!expanded ? null : !hasData ? (
        <div className="px-5 py-8 text-center">
          <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No class-based expenses found</p>
          <p className="text-xs text-slate-400 mt-1">
            {classes.length === 0
              ? 'No QB Classes found. Create Classes in QuickBooks and tag expense lines with a Class to see the breakdown here.'
              : 'Classes exist but no expense transactions are tagged with a Class in this date range.'}
          </p>
          <div className="mt-4 text-left max-w-sm mx-auto bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700">
            <p className="font-semibold mb-1">How to set up:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>In QuickBooks, go to <strong>Settings → All Lists → Classes</strong></li>
              <li>Create a Class for each project (e.g. &ldquo;Villa Al Khawaneej&rdquo;)</li>
              <li>When entering Bills or Expenses, select the Class on each line</li>
              <li>Run a QuickBooks Sync here — expenses will appear by project</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="text-left px-4 py-3 font-medium sticky left-0 bg-slate-50 z-10 min-w-[160px]">
                  QB Class / Project
                </th>
                <th className="text-left px-4 py-3 font-medium min-w-[140px]">Linked Project</th>
                {accountNames.map(acc => (
                  <th key={acc} className="text-right px-3 py-3 font-medium whitespace-nowrap max-w-[120px]">
                    <span className="block truncate" title={acc}>{acc}</span>
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium whitespace-nowrap">Total</th>
                <th className="text-right px-4 py-3 font-medium whitespace-nowrap">% Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(row => {
                const linked  = findProject(row.className)
                const pct     = linked && linked.contract_value > 0
                  ? Math.round((row.total / linked.contract_value) * 100) : null
                const pctColor = pct === null ? '' : pct > 90 ? 'text-red-600 font-bold' : pct > 70 ? 'text-amber-600 font-semibold' : 'text-emerald-600'

                return (
                  <tr key={row.classId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white hover:bg-slate-50">
                      {row.className}
                    </td>
                    <td className="px-4 py-3">
                      {linked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          ✓ {linked.name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
                          Unlinked
                        </span>
                      )}
                    </td>
                    {accountNames.map(acc => {
                      const val = row.accounts[acc] ?? 0
                      return (
                        <td key={acc} className={`px-3 py-3 text-right font-mono ${val > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                          {val > 0 ? aed(val) : '—'}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {aed(row.total)}
                    </td>
                    <td className={`px-4 py-3 text-right ${pctColor}`}>
                      {pct !== null ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Totals row */}
            {filtered.length > 1 && (
              <tfoot>
                <tr className="bg-indigo-50 font-bold text-indigo-900">
                  <td className="px-4 py-3 sticky left-0 bg-indigo-50">Totals ({filtered.length})</td>
                  <td className="px-4 py-3" />
                  {accountNames.map(acc => (
                    <td key={acc} className="px-3 py-3 text-right font-mono">
                      {aed(colTotals[acc] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    {aed(filtered.reduce((s, r) => s + r.total, 0))}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {expanded && accountNames.length > 0 && (
        <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-2 flex-wrap">
          <span className="font-medium">Account types:</span>
          {accountNames.map(a => (
            <span key={a} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{a}</span>
          ))}
          <span className="ml-auto">% Budget = total expenses ÷ contract value</span>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const [status,   setStatus]   = useState<QBStatus | null>(null)
  const [snapshot, setSnapshot] = useState<QBSnapshot | null>(null)
  const [syncing,  setSyncing]  = useState(false)
  const [loading,  setLoading]  = useState(true)

  // Classes / expense state
  const [expenses,         setExpenses]         = useState<QBClassExpenseRow[]>([])
  const [accountNames,     setAccountNames]     = useState<string[]>([])
  const [classes,          setClasses]          = useState<QBClass[]>([])
  const [classesSyncedAt,  setClassesSyncedAt]  = useState<string | undefined>(undefined)
  const [classesLoading,   setClassesLoading]   = useState(false)
  const [dateRange,        setDateRange]        = useState({ from: yearStartStr(), to: todayStr() })

  // AI findings
  const [findings,   setFindings]   = useState<Finding[] | null>(null)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiError,    setAiError]    = useState('')

  const { projects: allProjects, loading: projectsLoading } = useAllProjects()

  // Fetch class expense data (re-runs when date range changes)
  const fetchClasses = useCallback(async (range: { from: string; to: string }) => {
    setClassesLoading(true)
    try {
      const params = new URLSearchParams()
      if (range.from) params.set('from', range.from)
      if (range.to)   params.set('to',   range.to)
      const res  = await fetch(`/api/quickbooks/classes?${params}`)
      const data = await res.json()
      if (data.synced) {
        setExpenses(data.expenses     ?? [])
        setAccountNames(data.accountNames ?? [])
        setClasses(data.classes       ?? [])
        setClassesSyncedAt(data.synced_at)
      }
    } catch (e) {
      console.error('fetchClasses error:', e)
    } finally {
      setClassesLoading(false)
    }
  }, [])

  async function loadAll() {
    const [statusRes, snapRes] = await Promise.allSettled([
      fetch('/api/quickbooks/status').then(r => r.json()),
      fetch('/api/quickbooks/sync').then(r => r.json()),
    ])
    if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
    if (snapRes.status  === 'fulfilled' && snapRes.value.synced) setSnapshot(snapRes.value)
    await fetchClasses(dateRange)
  }

  useEffect(() => {
    loadAll().catch(console.error).finally(() => setLoading(false))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch expenses when date range changes
  function handleDateChange(range: { from: string; to: string }) {
    setDateRange(range)
    setFindings(null)
    fetchClasses(range)
  }

  async function syncNow() {
    setSyncing(true)
    try {
      const r = await fetch('/api/quickbooks/sync', { method: 'POST' })
      const d = await r.json()
      if (d.success) await loadAll()
    } finally { setSyncing(false) }
  }

  async function runAiAnalysis() {
    setAiLoading(true)
    setAiError('')
    setFindings(null)
    try {
      const res = await fetch('/api/agents/accountant-qb', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses,
          accountNames,
          projects: allProjects.map(p => ({
            name:             p.name,
            contract_value:   p.contract_value,
            progress_percent: p.progress_percent,
            received_amount:  p.received_amount,
          })),
          dateRange,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setFindings(data.findings ?? [])
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setAiLoading(false)
    }
  }

  // Financial stats
  const totalBilled      = snapshot?.invoices.reduce((s, i) => s + i.TotalAmt, 0)
    ?? allProjects.reduce((s, p) => s + p.contract_value, 0)
  const totalOutstanding = snapshot?.invoices.reduce((s, i) => s + i.Balance, 0)
    ?? allProjects.reduce((s, p) => s + (p.contract_value - p.received_amount), 0)
  const totalReceived    = snapshot?.payments.reduce((s, p) => s + p.TotalAmt, 0)
    ?? allProjects.reduce((s, p) => s + p.received_amount, 0)
  const overdueCount     = snapshot?.invoices.filter(i => i.Balance > 0 && i.DueDate && new Date(i.DueDate) < new Date()).length ?? 0
  const vatDue           = totalReceived * 0.05

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {status?.connected
              ? <>Connected to QuickBooks {status.environment} · {status.synced_at ? `Last sync ${new Date(status.synced_at).toLocaleString('en-AE')}` : 'Not yet synced'}</>
              : 'QuickBooks not connected — showing project database figures'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status?.connected ? (
            <button onClick={syncNow} disabled={syncing}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync QB</>}
            </button>
          ) : (
            <Link href="/settings"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <Link2 className="w-4 h-4" /> Connect QuickBooks
            </Link>
          )}
        </div>
      </div>

      {/* Not-connected banner */}
      {!loading && !status?.connected && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-900 text-sm font-semibold">QuickBooks not connected</p>
            <p className="text-blue-700 text-sm mt-0.5">
              Showing figures from your project database.{' '}
              <Link href="/settings" className="underline font-medium">Connect QuickBooks</Link> for live invoices,
              payments and expense breakdowns.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Billed"       value={`AED ${(totalBilled / 1000).toFixed(0)}K`}      sub={snapshot ? 'From QuickBooks' : 'From contracts'} color="text-slate-900" />
        <StatCard label="Total Received"     value={`AED ${(totalReceived / 1000).toFixed(0)}K`}    sub={`${totalBilled ? Math.round((totalReceived / totalBilled) * 100) : 0}% collected`} color="text-emerald-600" />
        <StatCard label="Outstanding"        value={`AED ${(totalOutstanding / 1000).toFixed(0)}K`} sub={overdueCount > 0 ? `${overdueCount} overdue` : 'All current'} color={overdueCount > 0 ? 'text-red-600' : 'text-amber-600'} />
        <StatCard label="Est. VAT Liability" value={`AED ${(vatDue / 1000).toFixed(0)}K`}          sub="5% on received amounts" color="text-blue-600" />
      </div>

      {/* Per-Project Financials */}
      <div className="mb-8 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Per-Project Financials</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left px-5 py-3 font-medium">Project</th>
                <th className="text-left px-5 py-3 font-medium">Client</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-right px-5 py-3 font-medium">Contract</th>
                <th className="text-right px-5 py-3 font-medium">Received</th>
                <th className="text-right px-5 py-3 font-medium">Outstanding</th>
                <th className="text-right px-5 py-3 font-medium">Retention</th>
                <th className="text-left px-5 py-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projectsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="skeleton h-4 rounded" style={{ width: `${60 + (j * 7) % 40}%` }} /></td>
                    ))}</tr>
                  ))
                : allProjects.map(p => {
                    const out  = p.contract_value - p.received_amount
                    const ret  = p.received_amount * 0.1
                    const pct  = p.progress_percent
                    const barC = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-blue-500'
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-medium text-slate-800">{p.name}</td>
                        <td className="px-5 py-3.5 text-slate-500 text-xs">{p.client_name}</td>
                        <td className="px-5 py-3.5 text-slate-500 capitalize">{p.type}</td>
                        <td className="px-5 py-3.5 text-right text-slate-800 font-medium">AED {p.contract_value.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right text-emerald-700 font-medium">AED {p.received_amount.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right text-amber-700 font-medium">AED {out.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right text-slate-500">AED {ret.toLocaleString()}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barC}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Findings (shown above the expense table when available) */}
      {aiError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{aiError}</p>
        </div>
      )}
      {findings !== null && (
        <FindingsPanel findings={findings} onClose={() => setFindings(null)} />
      )}

      {/* Expenses by Project (QB Classes) */}
      {classesLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading expense data…
        </div>
      )}
      {!classesLoading && (
        <ClassExpensesSection
          expenses={expenses}
          accountNames={accountNames}
          classes={classes}
          projects={allProjects}
          syncedAt={classesSyncedAt}
          dateRange={dateRange}
          onDateChange={handleDateChange}
          onAiAnalyse={runAiAnalysis}
          aiLoading={aiLoading}
        />
      )}

      {/* AI Accountant Briefing */}
      <div className="mb-8">
        <AccountantBriefing hasQbData={!!snapshot} />
      </div>

      {/* QuickBooks Invoice Table */}
      {snapshot?.invoices && snapshot.invoices.length > 0 && (
        <InvoiceTable invoices={snapshot.invoices} />
      )}
    </div>
  )
}
