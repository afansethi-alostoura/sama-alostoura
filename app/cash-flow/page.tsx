'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Landmark, RefreshCw, Loader2, ArrowDownCircle, ArrowUpCircle,
  ChevronDown, Wallet, TrendingUp, TrendingDown, AlertCircle,
  Building2, CreditCard, FileText, Banknote, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FundEvent } from '@/app/api/cash-flow/route'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClassOption { Id: string; Name: string; FullyQualifiedName: string }
interface CategoryRow { name: string; amount: number }
interface Summary { totalIn: number; totalOut: number; balance: number; txnCount: number }

interface CashFlowData {
  events:     FundEvent[]
  summary:    Summary
  byCategory: CategoryRow[]
  classes:    ClassOption[]
  synced_at:  string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function aed(v: number, compact = false) {
  if (v === 0) return '—'
  if (compact) {
    if (Math.abs(v) >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`
    if (Math.abs(v) >= 1_000)     return `AED ${(v / 1_000).toFixed(1)}K`
  }
  return `AED ${Math.round(v).toLocaleString()}`
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const TYPE_META: Record<string, { label: string; cls: string; Icon: any }> = {
  deposit: { label: 'Bank Deposit',     cls: 'bg-emerald-100 text-emerald-700', Icon: Banknote    },
  payment: { label: 'Invoice Payment',  cls: 'bg-blue-100   text-blue-700',     Icon: FileText    },
  purchase:{ label: 'Purchase',         cls: 'bg-orange-100 text-orange-700',   Icon: CreditCard  },
  bill:    { label: 'Bill',             cls: 'bg-rose-100   text-rose-700',     Icon: FileText    },
}

function TypeBadge({ type }: { type: string }) {
  const m = TYPE_META[type] ?? { label: type, cls: 'bg-slate-100 text-slate-600', Icon: FileText }
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5', m.cls)}>
      <m.Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CashFlowPage() {
  const [classId,    setClassId]    = useState('')
  const [data,       setData]       = useState<CashFlowData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [filterDir,  setFilterDir]  = useState<'all' | 'in' | 'out'>('all')
  const [filterType, setFilterType] = useState<string>('all')

  // Fetch classes on mount (no classId needed)
  useEffect(() => {
    fetch('/api/cash-flow')
      .then(r => r.json())
      .then(d => {
        if (d.classes?.length) setData(d)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/cash-flow?classId=${encodeURIComponent(id)}`)
      const d   = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed to load')
      setData(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleClassChange(id: string) {
    setClassId(id)
    setFilterDir('all')
    setFilterType('all')
    load(id)
  }

  const events = (data?.events ?? []).filter(e => {
    if (filterDir  !== 'all' && e.direction !== filterDir)  return false
    if (filterType !== 'all' && e.type      !== filterType) return false
    return true
  })

  const summary    = data?.summary
  const classes    = data?.classes ?? []
  const syncedAt   = data?.synced_at
  const totalBar   = summary ? summary.totalIn + summary.totalOut : 0
  const inPct      = totalBar > 0 ? (summary!.totalIn  / totalBar) * 100 : 0
  const outPct     = totalBar > 0 ? (summary!.totalOut / totalBar) * 100 : 0

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Fund Traceability</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Track every dirham received from clients and see exactly how it was spent, per project.
            </p>
          </div>
          {syncedAt && (
            <p className="text-xs text-slate-400 shrink-0">
              QB synced {new Date(syncedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Project selector */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Select Project (QuickBooks Class)
          </label>
          <div className="relative max-w-md">
            <select
              value={classId}
              onChange={e => handleClassChange(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— Choose a project —</option>
              {classes.map(c => (
                <option key={c.Id} value={c.Id}>{c.FullyQualifiedName || c.Name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {!classId && !loading && (
            <p className="text-xs text-slate-400 mt-2">
              Select a project above to view its complete fund flow timeline.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading fund flow data…</span>
          </div>
        )}

        {/* Content */}
        {!loading && classId && summary && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Total Received</p>
                </div>
                <p className="text-xl font-bold text-emerald-600">{aed(summary.totalIn)}</p>
                <p className="text-xs text-slate-400 mt-0.5">from client payments</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                    <ArrowUpCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Total Spent</p>
                </div>
                <p className="text-xl font-bold text-rose-600">{aed(summary.totalOut)}</p>
                <p className="text-xs text-slate-400 mt-0.5">on this project</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center',
                    summary.balance >= 0 ? 'bg-blue-50' : 'bg-amber-50')}>
                    <Wallet className={cn('w-4 h-4', summary.balance >= 0 ? 'text-blue-600' : 'text-amber-600')} />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Cash Balance</p>
                </div>
                <p className={cn('text-xl font-bold', summary.balance >= 0 ? 'text-blue-600' : 'text-amber-600')}>
                  {aed(summary.balance)}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {summary.balance >= 0 ? 'funds available' : 'deficit — spending ahead of receipts'}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Transactions</p>
                </div>
                <p className="text-xl font-bold text-slate-700">{summary.txnCount}</p>
                <p className="text-xs text-slate-400 mt-0.5">all in + out movements</p>
              </div>
            </div>

            {/* Flow bar */}
            {totalBar > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Fund Utilisation
                </p>
                <div className="flex rounded-full overflow-hidden h-4 mb-2">
                  <div
                    className="bg-emerald-400 transition-all"
                    style={{ width: `${inPct}%` }}
                    title={`Received: ${aed(summary.totalIn)}`}
                  />
                  <div
                    className="bg-rose-400 transition-all"
                    style={{ width: `${outPct}%` }}
                    title={`Spent: ${aed(summary.totalOut)}`}
                  />
                  {inPct + outPct < 100 && (
                    <div className="flex-1 bg-slate-100" />
                  )}
                </div>
                <div className="flex items-center gap-6 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                    Received {Math.round(inPct)}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" />
                    Spent {Math.round(outPct)}%
                  </span>
                  <span className="ml-auto font-medium text-slate-700">
                    {summary.totalOut > 0
                      ? `${Math.round((summary.totalOut / summary.totalIn) * 100)}% of received funds deployed`
                      : 'No expenses yet'}
                  </span>
                </div>
              </div>
            )}

            {/* Filters + Timeline */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Filter bar */}
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-slate-700 mr-2">Transaction Timeline</p>
                <div className="flex gap-1.5 ml-auto">
                  {(['all', 'in', 'out'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setFilterDir(d)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        filterDir === d
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {d === 'all' ? 'All' : d === 'in' ? '↓ Received' : '↑ Spent'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {(['all', 'deposit', 'payment', 'purchase', 'bill'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        filterType === t
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {t === 'all' ? 'All Types' : TYPE_META[t]?.label ?? t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              {events.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No transactions match the current filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50">
                        <th className="px-5 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Party</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Bank / Account</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-5 py-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {events.map(e => (
                        <tr
                          key={e.id}
                          className={cn(
                            'hover:bg-slate-50 transition-colors',
                            e.direction === 'in' ? 'border-l-2 border-l-emerald-400' : 'border-l-2 border-l-rose-300'
                          )}
                        >
                          <td className="px-5 py-3 whitespace-nowrap text-slate-500 text-xs">
                            {fmtDate(e.date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <TypeBadge type={e.type} />
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <span className="font-medium text-slate-700 truncate block" title={e.party}>
                              {e.party || '—'}
                            </span>
                            {e.ref && (
                              <span className="text-[10px] text-slate-400">Ref: {e.ref}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[180px]">
                            <span className="text-slate-500 truncate block text-xs" title={e.category}>
                              {e.category || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[140px]">
                            <span className="text-slate-400 truncate block text-xs" title={e.bank}>
                              {e.bank || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={cn(
                              'font-semibold',
                              e.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'
                            )}>
                              {e.direction === 'in' ? '+' : '−'} {aed(e.amount)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <span className={cn(
                              'font-medium text-xs',
                              e.runningBalance >= 0 ? 'text-slate-700' : 'text-amber-600'
                            )}>
                              {e.runningBalance >= 0 ? '' : '('}{aed(Math.abs(e.runningBalance))}{e.runningBalance < 0 ? ')' : ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={5} className="px-5 py-3 text-xs font-semibold text-slate-500">
                          Showing {events.length} of {summary.txnCount} transactions
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs font-semibold text-emerald-600">
                              +{aed(events.filter(e => e.direction === 'in').reduce((s, e) => s + e.amount, 0))}
                            </span>
                            <span className="text-xs font-semibold text-rose-600">
                              −{aed(events.filter(e => e.direction === 'out').reduce((s, e) => s + e.amount, 0))}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={cn(
                            'text-sm font-bold',
                            summary.balance >= 0 ? 'text-blue-600' : 'text-amber-600'
                          )}>
                            {aed(summary.balance)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Category breakdown */}
            {data!.byCategory.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-4">
                  Spending by Category
                </p>
                <div className="space-y-2.5">
                  {data!.byCategory.map((cat, i) => {
                    const pct = summary.totalOut > 0 ? (cat.amount / summary.totalOut) * 100 : 0
                    const colors = [
                      'bg-blue-500', 'bg-orange-500', 'bg-violet-500', 'bg-rose-500',
                      'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500',
                    ]
                    const color = colors[i % colors.length]
                    return (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-600 truncate max-w-[60%]" title={cat.name}>
                            {cat.name}
                          </span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
                            <span className="text-xs font-semibold text-slate-700 w-32 text-right">
                              {aed(cat.amount)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', color)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state — no project selected */}
        {!loading && !classId && !error && (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center shadow-sm">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Landmark className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-2">
              Select a project to begin
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Choose a QuickBooks class above to see every fund movement — client payments in,
              supplier payments out — in one chronological view with running balance.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
