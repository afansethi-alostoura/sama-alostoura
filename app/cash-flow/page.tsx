'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Landmark, Loader2, ArrowDownCircle, ArrowUpCircle,
  Wallet, AlertCircle, ChevronDown, ChevronRight,
  LayoutList, GitFork,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FundGroup } from '@/app/api/cash-flow/route'
import type { QBAlostouraTransaction } from '@/lib/quickbooks/types'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlySummary { month: string; label: string; credits: number; debits: number; balance: number }
interface Summary { totalIn: number; totalOut: number; net: number; closingBalance: number; txnCount: number }

interface RakData {
  found:        boolean
  message?:     string
  source?:      string
  fetched_at?:  string
  account?:     { name: string; balance?: number }
  transactions: QBAlostouraTransaction[]
  groups:       FundGroup[]
  monthly:      MonthlySummary[]
  summary:      Summary
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function aed(v: number) {
  if (v === 0) return '—'
  return `AED ${Math.round(Math.abs(v)).toLocaleString()}`
}

function fmtDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-')
  return `${['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo]} ${y}`
}

const CAT_COLORS: Record<string, string> = {
  'Loan / Finance':             'bg-violet-500',
  'Credit Card':                'bg-rose-500',
  'Salaries':                   'bg-amber-500',
  'Petty Cash':                 'bg-orange-400',
  'Project Costs':              'bg-blue-500',
  'Vendor Bills':               'bg-teal-500',
  'Client Payments (internal)': 'bg-slate-400',
  'Bank Transfer':              'bg-indigo-400',
  'Tax / VAT':                  'bg-red-400',
  'Multiple Accounts':          'bg-slate-300',
}
function catColor(name: string) {
  return CAT_COLORS[name] ?? 'bg-slate-400'
}

const TXN_COLORS: Record<string, string> = {
  'Deposit':          'text-emerald-700 bg-emerald-50',
  'Check':            'text-rose-700 bg-rose-50',
  'Bill Payment':     'text-rose-700 bg-rose-50',
  'Journal Entry':    'text-slate-600 bg-slate-100',
  'Transfer':         'text-indigo-700 bg-indigo-50',
  'Sales Receipt':    'text-emerald-700 bg-emerald-50',
  'Payment':          'text-blue-700 bg-blue-50',
}
function txnColor(type: string) {
  return TXN_COLORS[type] ?? 'text-slate-600 bg-slate-100'
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, color,
}: { icon: any; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', color + '/10')}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
      <p className={cn('text-xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function GroupCard({ group, defaultOpen }: { group: FundGroup; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const isOpening = group.depositId === 'opening'
  const coverage  = group.depositAmt > 0
    ? Math.min(100, Math.round((group.totalDebits / group.depositAmt) * 100))
    : 0

  return (
    <div className={cn(
      'bg-white rounded-xl border shadow-sm overflow-hidden',
      isOpening ? 'border-slate-200' : 'border-l-4 border-l-emerald-400 border-slate-100'
    )}>
      {/* Deposit header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors"
      >
        {/* Date badge */}
        <div className="shrink-0 text-center">
          <div className={cn('rounded-lg px-2.5 py-1', isOpening ? 'bg-slate-100' : 'bg-emerald-50')}>
            <p className={cn('text-[10px] font-semibold uppercase', isOpening ? 'text-slate-500' : 'text-emerald-600')}>
              {fmtDate(group.depositDate).split('/')[1] && fmtDate(group.depositDate).split('/').slice(1).join('/')}
            </p>
            <p className={cn('text-lg font-bold leading-none', isOpening ? 'text-slate-500' : 'text-emerald-700')}>
              {fmtDate(group.depositDate).split('/')[0]}
            </p>
          </div>
        </div>

        {/* Deposit info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!isOpening && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                ↓ DEPOSIT RECEIVED
              </span>
            )}
            <span className="text-sm font-semibold text-slate-800 truncate">{group.depositor}</span>
          </div>
          {group.memo && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{group.memo}</p>
          )}
          {/* Balance timeline: before → deposit → closing */}
          {group.depositAmt > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">Before</span>
                <span className="text-xs font-bold text-slate-700">{aed(group.balanceBeforeDeposit)}</span>
              </div>
              <span className="text-slate-300 text-sm">→</span>
              <div className="flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2.5 py-1">
                <span className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">+Deposit</span>
                <span className="text-xs font-bold text-emerald-700">{aed(group.balanceAfterDeposit)}</span>
              </div>
              {group.debits.length > 0 && (
                <>
                  <span className="text-slate-300 text-sm">→</span>
                  <div className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1',
                    group.endDate ? 'bg-blue-50' : 'bg-amber-50'
                  )}>
                    <span className={cn(
                      'text-[10px] uppercase tracking-wide font-semibold',
                      group.endDate ? 'text-blue-600' : 'text-amber-600'
                    )}>
                      {group.endDate ? 'Before next deposit' : 'Current balance'}
                    </span>
                    <span className={cn(
                      'text-xs font-bold',
                      group.endDate ? 'text-blue-700' : 'text-amber-700'
                    )}>
                      {aed(group.closingBalance)}
                    </span>
                  </div>
                </>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                {group.debits.length} outgoing · until {group.endDate ? fmtDate(group.endDate) : 'present'}
              </span>
            </div>
          )}

          {/* Spent vs deposit bar */}
          {group.depositAmt > 0 && group.debits.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full max-w-xs">
                <div
                  className={cn('h-full rounded-full', group.remaining >= 0 ? 'bg-emerald-400' : 'bg-amber-400')}
                  style={{ width: `${Math.min(coverage, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {aed(group.totalDebits)} spent · {coverage}% of deposit
              </p>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <div className="shrink-0 pt-0.5">
          {open
            ? <ChevronDown className="w-4 h-4 text-slate-400" />
            : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded: debits + category breakdown */}
      {open && (
        <div className="border-t border-slate-100">
          {/* Category breakdown bars */}
          {group.byCategory.length > 0 && (
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-3">
                How these funds were used
              </p>
              <div className="space-y-2">
                {group.byCategory.map(cat => {
                  const pct = group.totalDebits > 0
                    ? Math.round((cat.amount / group.totalDebits) * 100) : 0
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-slate-600 font-medium">{cat.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">{pct}%</span>
                          <span className="text-xs font-semibold text-slate-700 w-28 text-right">
                            {aed(cat.amount)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', catColor(cat.name))}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Individual debit rows */}
          {group.debits.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {group.debits.map((d, i) => (
                <div key={`${d.txnId}-${i}`} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{fmtDate(d.txnDate)}</span>
                  <span className={cn(
                    'text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0',
                    txnColor(d.txnType)
                  )}>
                    {d.txnType || 'Txn'}
                  </span>
                  <span className="text-sm text-slate-700 font-medium flex-1 truncate" title={d.name || d.memo}>
                    {d.name || d.memo || '—'}
                  </span>
                  <span className="text-xs text-slate-400 max-w-[150px] truncate" title={d.split}>{d.split}</span>
                  <span className="text-sm font-semibold text-rose-600 shrink-0 ml-auto">
                    −{aed(Math.abs(d.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-4 text-xs text-slate-400">No outgoing payments in this period.</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CashFlowPage() {
  const today   = new Date().toISOString().slice(0, 10)
  const twoYAgo = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d.toISOString().slice(0, 10) })()

  const [from,    setFrom]    = useState(twoYAgo)
  const [to,      setTo]      = useState(today)
  const [data,    setData]    = useState<RakData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [view,    setView]    = useState<'allocation' | 'timeline'>('allocation')

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/cash-flow?from=${f}&to=${t}`)
      const d   = await res.json()
      setData(d)
      if (!d.found) setError(d.message ?? 'No data found')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(from, to) }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data?.summary
  const groups  = data?.groups ?? []
  const txns    = data?.transactions ?? []

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">RAK Bank Cash Flow</h1>
            </div>
            <p className="text-slate-500 text-sm">
              Track every deposit into the company account and trace exactly how those funds were allocated.
            </p>
            {data?.account?.name && (
              <p className="text-xs text-slate-400 mt-1">
                Account: <span className="font-medium">{data.account.name}</span>
                {data.account.balance != null && (
                  <> · Current balance: <span className="font-semibold text-blue-600">{aed(data.account.balance)}</span></>
                )}
                {data.source && <> · {data.source === 'live' ? '🟢 Live from QB' : '📦 Cached'}</>}
                {data.fetched_at && (
                  <> · {new Date(data.fetched_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                )}
              </p>
            )}
          </div>

          {/* Date range + load button */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <input
              type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => load(from, to)}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Load
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Fetching RAK Bank ledger from QuickBooks…</span>
          </div>
        )}

        {/* Content */}
        {!loading && data?.found && summary && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={ArrowDownCircle} label="Total Received" color="text-emerald-600"
                value={aed(summary.totalIn)} sub="into RAK Bank"
              />
              <StatCard
                icon={ArrowUpCircle} label="Total Disbursed" color="text-rose-600"
                value={aed(summary.totalOut)} sub="outgoing payments"
              />
              <StatCard
                icon={Wallet} label="Closing Balance" color="text-blue-600"
                value={aed(summary.closingBalance)} sub="end of period"
              />
              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <p className="text-xs text-slate-500 font-medium mb-2">Utilisation</p>
                <p className="text-xl font-bold text-slate-700">
                  {summary.totalIn > 0
                    ? `${Math.round((summary.totalOut / summary.totalIn) * 100)}%`
                    : '—'}
                </p>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${summary.totalIn > 0 ? Math.min(100, (summary.totalOut / summary.totalIn) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{summary.txnCount} transactions</p>
              </div>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('allocation')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  view === 'allocation'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <GitFork className="w-4 h-4" />
                Fund Allocation
              </button>
              <button
                onClick={() => setView('timeline')}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  view === 'timeline'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <LayoutList className="w-4 h-4" />
                Timeline
              </button>
              <span className="text-xs text-slate-400 ml-2">
                {view === 'allocation'
                  ? `${groups.length} deposit events — expand each to see how funds were used`
                  : `${txns.length} transactions, newest first`}
              </span>
            </div>

            {/* Fund Allocation view */}
            {view === 'allocation' && (
              <div className="space-y-3">
                {groups.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">
                    <Landmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No transactions found for the selected date range.</p>
                  </div>
                ) : (
                  groups.map((g, i) => (
                    <GroupCard key={g.depositId} group={g} defaultOpen={i === groups.length - 1} />
                  ))
                )}
              </div>
            )}

            {/* Timeline view */}
            {view === 'timeline' && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {txns.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">No transactions in range.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                          <th className="px-5 py-3">Date</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Party</th>
                          <th className="px-4 py-3">Category / Account</th>
                          <th className="px-4 py-3">Memo</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-5 py-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {txns.map((t, i) => (
                          <tr
                            key={`${t.txnId}-${i}`}
                            className={cn(
                              'hover:bg-slate-50 transition-colors',
                              t.amount > 0
                                ? 'border-l-2 border-l-emerald-400'
                                : 'border-l-2 border-l-transparent'
                            )}
                          >
                            <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                              {fmtDate(t.txnDate)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5', txnColor(t.txnType))}>
                                {t.txnType || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[160px]">
                              <span className="font-medium text-slate-700 truncate block" title={t.name}>
                                {t.name || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[150px]">
                              <span className="text-xs text-slate-500 truncate block" title={t.split}>
                                {t.split || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              <span className="text-xs text-slate-400 truncate block" title={t.memo}>
                                {t.memo || ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span className={cn(
                                'font-semibold',
                                t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                              )}>
                                {t.amount > 0 ? '+' : '−'}{aed(Math.abs(t.amount))}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <span className="text-xs font-medium text-slate-600">
                                {aed(Math.abs(t.balance))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Monthly breakdown */}
            {data.monthly.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Summary</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                        <th className="pb-2">Month</th>
                        <th className="pb-2 text-right text-emerald-600">Received</th>
                        <th className="pb-2 text-right text-rose-600">Disbursed</th>
                        <th className="pb-2 text-right">Net</th>
                        <th className="pb-2 text-right">Closing Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[...data.monthly].reverse().map(m => (
                        <tr key={m.month} className="hover:bg-slate-50">
                          <td className="py-2 font-medium text-slate-700">{fmtMonth(m.month)}</td>
                          <td className="py-2 text-right text-emerald-600 font-medium">{m.credits > 0 ? aed(m.credits) : '—'}</td>
                          <td className="py-2 text-right text-rose-600">{m.debits > 0 ? aed(m.debits) : '—'}</td>
                          <td className={cn('py-2 text-right font-medium',
                            m.credits - m.debits >= 0 ? 'text-blue-600' : 'text-amber-600')}>
                            {m.credits - m.debits !== 0
                              ? (m.credits - m.debits > 0 ? '+' : '−') + aed(Math.abs(m.credits - m.debits))
                              : '—'}
                          </td>
                          <td className="py-2 text-right text-slate-600">{aed(Math.abs(m.balance))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty / not loaded */}
        {!loading && !data && !error && (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center shadow-sm">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Landmark className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-2">Loading RAK Bank data…</h3>
          </div>
        )}

      </div>
    </div>
  )
}
