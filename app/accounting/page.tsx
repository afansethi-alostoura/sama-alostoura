'use client'
import { useEffect, useState, useCallback } from 'react'
import Link                                   from 'next/link'
import {
  RefreshCw, Loader2, Link2, AlertCircle, Tag,
  TrendingDown, ChevronDown, ChevronRight,
  BrainCircuit, TriangleAlert, Info, CircleX,
  CalendarRange, Receipt, CreditCard, FileText,
  Building2, Bug, CheckCircle2, Clock,
} from 'lucide-react'
import { AccountantBriefing } from '@/components/accounting/accountant-briefing'
import { InvoiceTable }       from '@/components/accounting/invoice-table'
import type {
  QBSnapshot, QBClassExpenseRow, QBClass, QBClassGroup, QBDebugInfo,
} from '@/lib/quickbooks/types'
import type { QBStatus }  from '@/lib/quickbooks/client'
import { useAllProjects } from '@/hooks/useAllProjects'

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

function aed(v: number, compact = false) {
  if (v === 0) return '—'
  if (compact) {
    if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`
    if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(1)}K`
  }
  return `AED ${Math.round(v).toLocaleString()}`
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function todayStr()    { return new Date().toISOString().slice(0, 10) }
function yearStartStr(){ return `${new Date().getFullYear()}-01-01`   }

// ── Payment type badge ────────────────────────────────────────────────────────
function TypeBadge({ type, paymentType }: { type: 'purchase' | 'bill'; paymentType: string }) {
  if (type === 'bill') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5">
        <FileText className="w-2.5 h-2.5" /> Bill
      </span>
    )
  }
  const isCc = /credit/i.test(paymentType)
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 border ${
      isCc ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'
    }`}>
      {isCc ? <CreditCard className="w-2.5 h-2.5" /> : <Receipt className="w-2.5 h-2.5" />}
      {isCc ? 'Credit Card' : paymentType || 'Purchase'}
    </span>
  )
}

// ── Single Class Accordion Row ────────────────────────────────────────────────
function ClassRow({
  group,
  linkedProjectName,
  linkedContractValue,
}: {
  group:                QBClassGroup
  linkedProjectName?:   string
  linkedContractValue?: number
}) {
  const [open, setOpen] = useState(false)

  const pct = linkedContractValue && linkedContractValue > 0
    ? Math.round((group.total / linkedContractValue) * 100)
    : null
  const pctColor = pct === null ? '' : pct > 90 ? 'text-red-600 font-bold' : pct > 70 ? 'text-amber-600 font-semibold' : 'text-emerald-600'

  // Account subtotals sorted by amount desc
  const acctRows = Object.entries(group.accountTotals).sort((a, b) => b[1] - a[1])

  return (
    <div className="border-b border-slate-100 last:border-0">

      {/* ── Class header row ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
      >
        {/* Arrow */}
        <span className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors">
          {open
            ? <ChevronDown  className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </span>

        {/* Icon */}
        <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-indigo-600" />
        </span>

        {/* Class name + linked project */}
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-slate-900 text-sm">{group.className}</span>
          {linkedProjectName && (
            <span className="ml-2 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              ✓ {linkedProjectName}
            </span>
          )}
        </span>

        {/* Meta */}
        <span className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-500">
          <span>{group.txnCount} line{group.txnCount !== 1 ? 's' : ''}</span>
          <span>{acctRows.length} account{acctRows.length !== 1 ? 's' : ''}</span>
          {pct !== null && (
            <span className={pctColor}>{pct}% of budget</span>
          )}
          <span className="font-bold text-slate-900 text-sm w-28 text-right">
            {aed(group.total)}
          </span>
        </span>
      </button>

      {/* ── Expanded content ── */}
      {open && (
        <div className="bg-slate-50 border-t border-slate-100">

          {/* Account subtotals strip */}
          {acctRows.length > 0 && (
            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide self-center mr-1">
                Breakdown:
              </span>
              {acctRows.map(([acc, amt]) => (
                <span key={acc} className="inline-flex items-center gap-1 text-[11px] font-medium bg-white border border-slate-200 text-slate-700 rounded-full px-2.5 py-1">
                  <span className="text-slate-400">{acc}</span>
                  <span className="font-bold text-slate-900">{aed(amt, true)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Transaction table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="px-5 py-2.5 w-24">Date</th>
                  <th className="px-3 py-2.5">Vendor</th>
                  <th className="px-3 py-2.5">Account / Category</th>
                  <th className="px-3 py-2.5">Note</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.transactions.map((tx, i) => (
                  <tr key={tx.lineId} className={`hover:bg-white transition-colors ${i % 2 === 0 ? '' : 'bg-white/60'}`}>
                    <td className="px-5 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {fmtDate(tx.txnDate)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px]">
                      <span className="block truncate" title={tx.vendor}>{tx.vendor}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-2 py-0.5 text-[10px] font-semibold max-w-[160px] truncate" title={tx.accountName}>
                        {tx.accountName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 max-w-[200px]">
                      {tx.note
                        ? <span className="block truncate italic" title={tx.note}>{tx.note}</span>
                        : <span className="text-slate-200">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <TypeBadge type={tx.type} paymentType={tx.paymentType} />
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {aed(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-indigo-50">
                  <td colSpan={5} className="px-5 py-2.5 text-xs font-bold text-indigo-700">
                    Class Total — {group.className}
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold text-indigo-900 text-sm">
                    {aed(group.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AI Findings Panel ─────────────────────────────────────────────────────────
function FindingsPanel({ findings, onClose }: { findings: Finding[]; onClose: () => void }) {
  const sevMeta = {
    danger:  { icon: CircleX,       bg: 'bg-red-50',   border: 'border-red-200',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700',   label: 'DANGER'  },
    warning: { icon: TriangleAlert, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'WARNING' },
    info:    { icon: Info,          bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-700',  label: 'INFO'    },
  }
  const dangers  = findings.filter(f => f.severity === 'danger').length
  const warnings = findings.filter(f => f.severity === 'warning').length

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-indigo-700">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-indigo-200" />
          <div>
            <p className="font-semibold text-white text-sm">AI Accountant Analysis</p>
            <p className="text-indigo-300 text-xs mt-0.5">
              {dangers  > 0 && <span className="text-red-300 font-bold">{dangers} danger · </span>}
              {warnings > 0 && <span className="text-amber-300">{warnings} warning · </span>}
              {findings.length} total findings
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors text-xs">Dismiss</button>
      </div>
      <div className="divide-y divide-slate-100">
        {findings.map((f, i) => {
          const m = sevMeta[f.severity]
          const Icon = m.icon
          return (
            <div key={i} className={`px-5 py-4 flex items-start gap-4 ${m.bg}`}>
              <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${m.text}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${m.badge}`}>{m.label}</span>
                  {f.project && <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{f.project}</span>}
                  {f.amount != null && Number(f.amount) > 0 && (
                    <span className={`text-[10px] font-bold ${m.text}`}>AED {Number(f.amount).toLocaleString()}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{f.detail}</p>
              </div>
            </div>
          )
        })}
        {findings.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-500">No findings — financials look healthy for this period.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Debug Panel ───────────────────────────────────────────────────────────────
function DebugPanel({ info, onClose }: { info: QBDebugInfo; onClose: () => void }) {
  const { purchases: p, bills: b, combined: c } = info
  const ok = Math.abs(c.discrepancy) < 1   // within AED 1 = fine

  function Row({ label, val, sub, highlight }: { label: string; val: string; sub?: string; highlight?: 'red' | 'green' | 'amber' }) {
    const col = highlight === 'red' ? 'text-red-700 font-bold'
      : highlight === 'green'       ? 'text-emerald-700 font-bold'
      : highlight === 'amber'       ? 'text-amber-700 font-semibold'
      : 'text-slate-800'
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-2 text-xs text-slate-500 w-56">{label}</td>
        <td className={`px-4 py-2 text-xs font-mono ${col}`}>{val}</td>
        {sub && <td className="px-4 py-2 text-[10px] text-slate-400 italic">{sub}</td>}
      </tr>
    )
  }

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-slate-300" />
          <span className="text-sm font-semibold text-white">Debug — Reconciliation Report</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 ${
            info.source === 'live' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
          }`}>
            {info.source === 'live' ? '● LIVE QB API' : '● SNAPSHOT'}
          </span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xs transition-colors">Close</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">

        {/* Purchases */}
        <div>
          <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
            Purchases ({p.fetched} fetched)
          </p>
          <table className="w-full">
            <tbody>
              <Row label="In date range"       val={`${p.inRange} txns`} />
              <Row label="Expense lines"        val={`${p.expenseLines} lines`} sub="SubTotal lines excluded" />
              <Row label="Class-tagged lines"   val={`${p.taggedLines} lines`}  highlight="green" />
              <Row label="Untagged lines"       val={`${p.untaggedLines} lines`} highlight={p.untaggedLines > 0 ? 'amber' : undefined} />
              <Row label="QB header total"      val={`AED ${p.qbHeaderTotal.toLocaleString()}`} sub="sum of TotalAmt" />
              <Row label="Our line total"       val={`AED ${p.ourLineTotal.toLocaleString()}`}  highlight="green" />
            </tbody>
          </table>
        </div>

        {/* Bills */}
        <div>
          <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
            Bills ({b.fetched} fetched)
          </p>
          <table className="w-full">
            <tbody>
              <Row label="In date range"       val={`${b.inRange} txns`} />
              <Row label="Expense lines"        val={`${b.expenseLines} lines`} sub="SubTotal lines excluded" />
              <Row label="Class-tagged lines"   val={`${b.taggedLines} lines`}  highlight="green" />
              <Row label="Untagged lines"       val={`${b.untaggedLines} lines`} highlight={b.untaggedLines > 0 ? 'amber' : undefined} />
              <Row label="QB header total"      val={`AED ${b.qbHeaderTotal.toLocaleString()}`} sub="sum of TotalAmt" />
              <Row label="Our line total"       val={`AED ${b.ourLineTotal.toLocaleString()}`}  highlight="green" />
            </tbody>
          </table>
        </div>

        {/* Combined */}
        <div>
          <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
            Combined Reconciliation
          </p>
          <table className="w-full">
            <tbody>
              <Row label="QB total (header sum)"  val={`AED ${c.qbHeaderTotal.toLocaleString()}`} sub="QB's own figure" />
              <Row label="Our displayed total"     val={`AED ${c.ourTotal.toLocaleString()}`}      highlight="green" />
              <Row label="Untagged (not shown)"    val={`AED ${c.untaggedTotal.toLocaleString()}`} highlight={c.untaggedTotal > 0 ? 'amber' : undefined}
                sub="lines with no Class tag" />
              <Row
                label="Unexplained difference"
                val={`AED ${Math.abs(c.discrepancy).toLocaleString()}`}
                highlight={ok ? 'green' : 'red'}
                sub={ok ? '✓ within rounding' : 'May include tax/VAT on header'}
              />
            </tbody>
          </table>
          <div className={`mx-4 my-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
            ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {ok
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Totals reconcile correctly</>
              : <><TriangleAlert className="w-3.5 h-3.5" /> Discrepancy detected — check QB for tax/VAT on headers</>
            }
          </div>
          <div className="px-4 pb-3 text-[10px] text-slate-400 space-y-0.5">
            <p><Clock className="w-3 h-3 inline mr-1" />Fetched: {new Date(info.fetchedAt).toLocaleString('en-AE')}</p>
            <p>Filter: {info.dateFilter.from ?? 'start'} → {info.dateFilter.to ?? 'today'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Class Expenses Section ────────────────────────────────────────────────────
function ClassExpensesSection({
  classGroups,
  expenses,
  accountNames,
  classes,
  projects,
  syncedAt,
  fetchedAt,
  source,
  dateRange,
  onDateChange,
  onAiAnalyse,
  aiLoading,
  debugInfo,
}: {
  classGroups:   QBClassGroup[]
  expenses:      QBClassExpenseRow[]
  accountNames:  string[]
  classes:       QBClass[]
  projects:      Array<{ id: string; name: string; contract_value: number; progress_percent: number; received_amount: number }>
  syncedAt?:     string
  fetchedAt?:    string
  source?:       'live' | 'snapshot'
  dateRange:     { from: string; to: string }
  onDateChange:  (r: { from: string; to: string }) => void
  onAiAnalyse:   () => void
  aiLoading:     boolean
  debugInfo?:    QBDebugInfo
}) {
  const [expanded,   setExpanded]   = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandAll,  setExpandAll]  = useState(false)
  const [showDebug,  setShowDebug]  = useState(false)

  const totalExpenses = classGroups.reduce((s, g) => s + g.total, 0)
  const hasData       = classGroups.length > 0

  // Fuzzy project match
  function findProject(className: string) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    return projects.find(p => norm(p.name).includes(norm(className)) || norm(className).includes(norm(p.name)))
  }

  const filtered = classGroups.filter(g =>
    !searchTerm || g.className.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-8">

      {/* Section header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        {/* Collapse toggle */}
        <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-700 transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Tag className="w-4 h-4 text-indigo-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">Expenses by Project (QB Classes)</h3>
            {source && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                source === 'live'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100  text-amber-700  border border-amber-200'
              }`}>
                {source === 'live' ? '● Live from QB' : '● Snapshot'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {classGroups.length > 0 && (
              <>
                <span>{classGroups.length} class{classGroups.length !== 1 ? 'es' : ''}</span>
                <span>·</span>
                <span>{classGroups.reduce((s, g) => s + g.txnCount, 0)} transactions</span>
                <span>·</span>
                <span className="font-semibold text-slate-600">Total {aed(totalExpenses)}</span>
                <span>·</span>
              </>
            )}
            {fetchedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Fetched {new Date(fetchedAt).toLocaleString('en-AE')}
              </span>
            )}
            {!fetchedAt && syncedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last sync {new Date(syncedAt).toLocaleString('en-AE')}
              </span>
            )}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="date" value={dateRange.from}
              onChange={e => onDateChange({ ...dateRange, from: e.target.value })}
              className="text-xs bg-transparent border-0 outline-none text-slate-600 w-28"
            />
            <span className="text-xs text-slate-400">→</span>
            <input
              type="date" value={dateRange.to}
              onChange={e => onDateChange({ ...dateRange, to: e.target.value })}
              className="text-xs bg-transparent border-0 outline-none text-slate-600 w-28"
            />
          </div>

          {hasData && (
            <>
              <input
                type="text" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filter class…"
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 w-28"
              />
              <button
                onClick={() => setExpandAll(e => !e)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                {expandAll ? 'Collapse all' : 'Expand all'}
              </button>
            </>
          )}

          {/* AI Accountant */}
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

          {/* Debug */}
          {debugInfo && (
            <button
              onClick={() => setShowDebug(d => !d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                showDebug
                  ? 'bg-slate-800 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              <Bug className="w-3.5 h-3.5" />
              Debug
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!expanded ? null : !hasData ? (
        <div className="px-5 py-10 text-center">
          <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No class-tagged expenses found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {classes.length === 0
              ? 'No QB Classes exist. Create Classes in QuickBooks and tag your expense lines to see the breakdown here.'
              : 'Classes exist but no expense lines are tagged with a Class in this date range. Try a wider date range.'}
          </p>
          <div className="mt-5 text-left max-w-sm mx-auto bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700">
            <p className="font-semibold mb-1.5">Setup guide:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>QuickBooks → <strong>Settings → All Lists → Classes</strong></li>
              <li>Create one Class per project (e.g. &ldquo;Villa Al Khawaneej&rdquo;)</li>
              <li>On every Bill/Expense line, select the Class</li>
              <li>Click <strong>Sync QB</strong> here — data appears instantly</li>
            </ol>
          </div>
        </div>
      ) : (
        <div>
          {/* Debug panel (inline, inside section) */}
          {showDebug && debugInfo && (
            <div className="border-b border-slate-200">
              <DebugPanel info={debugInfo} onClose={() => setShowDebug(false)} />
            </div>
          )}

          {/* Untagged lines warning */}
          {debugInfo && debugInfo.combined.untaggedTotal > 0 && (
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs text-amber-700">
              <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <strong>AED {debugInfo.combined.untaggedTotal.toLocaleString()}</strong> in expenses has no Class tag in QuickBooks
                ({debugInfo.purchases.untaggedLines + debugInfo.bills.untaggedLines} lines) — not shown in the breakdown below.
                Tag those transactions in QB → Sync QB to include them.
              </span>
            </div>
          )}

          {/* Grand total bar */}
          <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs">
            <span className="text-indigo-600 font-medium">
              Showing {filtered.length} of {classGroups.length} classes ·{' '}
              {filtered.reduce((s, g) => s + g.txnCount, 0)} transactions
            </span>
            <span className="font-bold text-indigo-900 text-sm">
              Total: {aed(filtered.reduce((s, g) => s + g.total, 0))}
            </span>
          </div>

          {/* Accordion rows */}
          <div>
            {filtered.map(group => {
              const linked = findProject(group.className)
              return (
                <ExpandableClassRow
                  key={group.classId}
                  group={group}
                  linkedProjectName={linked?.name}
                  linkedContractValue={linked?.contract_value}
                  forceOpen={expandAll}
                />
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
            <span>Click any class row to expand and see individual transactions</span>
            <span>% Budget = total expenses ÷ contract value</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Expandable class row (controlled by forceOpen) ────────────────────────────
function ExpandableClassRow({
  group,
  linkedProjectName,
  linkedContractValue,
  forceOpen,
}: {
  group:                QBClassGroup
  linkedProjectName?:   string
  linkedContractValue?: number
  forceOpen:            boolean
}) {
  const [open, setOpen] = useState(false)
  const isOpen = forceOpen || open

  const pct = linkedContractValue && linkedContractValue > 0
    ? Math.round((group.total / linkedContractValue) * 100)
    : null
  const pctColor = pct === null ? 'text-slate-400'
    : pct > 90 ? 'text-red-600 font-bold'
    : pct > 70 ? 'text-amber-600 font-semibold'
    : 'text-emerald-600'

  const acctRows = Object.entries(group.accountTotals).sort((a, b) => b[1] - a[1])

  return (
    <div className="border-b border-slate-100 last:border-0">

      {/* Class header — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
      >
        <span className="flex-shrink-0 w-5 flex justify-center text-slate-400 group-hover:text-slate-600">
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-indigo-600" />
        </span>

        {/* Name + linked badge */}
        <span className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 text-sm">{group.className}</span>
          {linkedProjectName && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              ✓ {linkedProjectName}
            </span>
          )}
          {!linkedProjectName && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">
              Unlinked
            </span>
          )}
        </span>

        {/* Stats */}
        <span className="flex items-center gap-4 flex-shrink-0">
          <span className="text-xs text-slate-400">{group.txnCount} line{group.txnCount !== 1 ? 's' : ''}</span>
          <span className="text-xs text-slate-400">{acctRows.length} account{acctRows.length !== 1 ? 's' : ''}</span>
          {pct !== null && <span className={`text-xs ${pctColor}`}>{pct}% of budget</span>}
          <span className="font-bold text-slate-900 text-sm text-right w-28">{aed(group.total)}</span>
        </span>
      </button>

      {/* Expanded detail */}
      {isOpen && (
        <div className="border-t border-slate-100">

          {/* Account breakdown chips */}
          {acctRows.length > 0 && (
            <div className="px-14 py-2.5 flex flex-wrap gap-2 bg-indigo-50 border-b border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide self-center">Breakdown:</span>
              {acctRows.map(([acc, amt]) => (
                <span key={acc} className="inline-flex items-center gap-1.5 text-[11px] bg-white border border-indigo-100 text-slate-700 rounded-full px-2.5 py-1">
                  <span className="text-slate-500">{acc}</span>
                  <span className="font-bold text-indigo-900">{aed(amt, true)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Transaction table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[680px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="pl-14 pr-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide w-24">Date</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vendor</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Account / Category</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Note</th>
                  <th className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.transactions.map((tx, i) => (
                  <tr key={tx.lineId} className={`hover:bg-blue-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                    <td className="pl-14 pr-3 py-2.5 text-slate-500 font-mono whitespace-nowrap">
                      {fmtDate(tx.txnDate)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[180px]">
                      <span className="block truncate" title={tx.vendor}>{tx.vendor}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-2 py-0.5 font-medium max-w-[160px] truncate"
                        title={tx.accountName}
                      >
                        {tx.accountName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 max-w-[160px]">
                      {tx.note
                        ? <span className="block truncate italic" title={tx.note}>{tx.note}</span>
                        : <span className="text-slate-200">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <TypeBadge type={tx.type} paymentType={tx.paymentType} />
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {aed(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-indigo-50">
                  <td colSpan={5} className="pl-14 pr-3 py-2.5 font-bold text-indigo-700 text-xs">
                    {group.className} — Total
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold text-indigo-900">{aed(group.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
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

  const [classGroups,     setClassGroups]     = useState<QBClassGroup[]>([])
  const [expenses,        setExpenses]        = useState<QBClassExpenseRow[]>([])
  const [accountNames,    setAccountNames]    = useState<string[]>([])
  const [classes,         setClasses]         = useState<QBClass[]>([])
  const [classesSyncedAt, setClassesSyncedAt] = useState<string | undefined>()
  const [classesFetchedAt, setClassesFetchedAt] = useState<string | undefined>()
  const [classesSource,   setClassesSource]   = useState<'live' | 'snapshot' | undefined>()
  const [classesDebug,    setClassesDebug]    = useState<QBDebugInfo | undefined>()
  const [classesLoading,  setClassesLoading]  = useState(false)
  const [dateRange,       setDateRange]       = useState({ from: yearStartStr(), to: todayStr() })

  const [findings,  setFindings]  = useState<Finding[] | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState('')

  const { projects: allProjects, loading: projectsLoading } = useAllProjects()

  const fetchClasses = useCallback(async (range: { from: string; to: string }) => {
    setClassesLoading(true)
    try {
      const params = new URLSearchParams()
      if (range.from) params.set('from', range.from)
      if (range.to)   params.set('to',   range.to)
      const res  = await fetch(`/api/quickbooks/classes?${params}`)
      const data = await res.json()
      if (data.synced) {
        setClassGroups(data.classGroups   ?? [])
        setExpenses(data.expenses         ?? [])
        setAccountNames(data.accountNames ?? [])
        setClasses(data.classes           ?? [])
        setClassesSyncedAt(data.synced_at)
        setClassesFetchedAt(data.fetched_at)
        setClassesSource(data.source)
        setClassesDebug(data.debug ?? undefined)
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
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

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
          expenses, accountNames, dateRange,
          projects: allProjects.map(p => ({
            name: p.name, contract_value: p.contract_value,
            progress_percent: p.progress_percent, received_amount: p.received_amount,
          })),
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
  const overdueCount     = snapshot?.invoices.filter(
    i => i.Balance > 0 && i.DueDate && new Date(i.DueDate) < new Date()
  ).length ?? 0
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
              <Link href="/settings" className="underline font-medium">Connect QuickBooks</Link> for live invoices, payments and expense breakdowns.
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

      {/* AI Findings */}
      {aiError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{aiError}</p>
        </div>
      )}
      {findings !== null && (
        <FindingsPanel findings={findings} onClose={() => setFindings(null)} />
      )}

      {/* Expenses by Project — accordion tree */}
      {classesLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading expense data…
        </div>
      )}
      {!classesLoading && (
        <ClassExpensesSection
          classGroups={classGroups}
          expenses={expenses}
          accountNames={accountNames}
          classes={classes}
          projects={allProjects}
          syncedAt={classesSyncedAt}
          fetchedAt={classesFetchedAt}
          source={classesSource}
          dateRange={dateRange}
          onDateChange={handleDateChange}
          onAiAnalyse={runAiAnalysis}
          aiLoading={aiLoading}
          debugInfo={classesDebug}
        />
      )}

      {/* AI Accountant Briefing */}
      <div className="mb-8">
        <AccountantBriefing hasQbData={!!snapshot} />
      </div>

      {/* Invoice Table */}
      {snapshot?.invoices && snapshot.invoices.length > 0 && (
        <InvoiceTable invoices={snapshot.invoices} />
      )}
    </div>
  )
}
