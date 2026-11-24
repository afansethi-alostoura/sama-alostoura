'use client'
import React, { useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Loader2, RefreshCw,
  AlertCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  label: string
  income: number
  cogs: number
  grossProfit: number
  expenses: number
  otherExpenses: number
  netEarnings: number
}

interface PLData {
  period:    { from: string; to: string }
  projects:  Project[]
  totals:    { income: number; cogs: number; grossProfit: number; expenses: number; netEarnings: number }
  fetchedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAED = (n: number) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}AED ${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}AED ${(abs / 1_000).toFixed(1)}K`
  return `${sign}AED ${abs.toFixed(0)}`
}

const fmtFull = (n: number) =>
  (n < 0 ? '-' : '') + 'AED ' + Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AllProjectsPage() {
  const [data,       setData]       = useState<PLData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [range,      setRange]      = useState<'ytd' | '12m' | 'all'>('ytd')

  function dateParams(r: typeof range) {
    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    const y     = now.getFullYear()
    if (r === 'ytd') return `from=${y}-01-01&to=${today}`
    if (r === '12m') {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
      return `from=${d.toISOString().slice(0, 10)}&to=${today}`
    }
    return `from=2024-01-01&to=${today}`
  }

  async function load(r = range, refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res  = await fetch(`/api/quickbooks/all-projects-pl?${dateParams(r)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  function changeRange(r: typeof range) { setRange(r); load(r) }

  // ── Summary KPIs ─────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Loading project financials from QuickBooks…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className={`border rounded-xl p-6 flex items-start gap-3 ${
        error.includes('not connected') ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
      }`}>
        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          error.includes('not connected') ? 'text-amber-500' : 'text-red-500'
        }`} />
        <div>
          <p className={`font-semibold ${error.includes('not connected') ? 'text-amber-800' : 'text-red-800'}`}>
            {error.includes('not connected') ? 'QuickBooks not connected' : 'Failed to load data'}
          </p>
          <p className={`text-sm mt-1 ${error.includes('not connected') ? 'text-amber-700' : 'text-red-600'}`}>{error}</p>
          {error.includes('not connected') && (
            <a href="/settings" className="mt-3 inline-block px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg">
              Go to Settings → Connect QB
            </a>
          )}
        </div>
      </div>
    </div>
  )

  if (!data) return null

  const { projects, totals } = data
  const maxIncome  = Math.max(...projects.map(p => p.income), 1)
  const maxNetAbs  = Math.max(...projects.map(p => Math.abs(p.netEarnings)), 1)
  const grossMargin = totals.income > 0 ? (totals.grossProfit / totals.income * 100).toFixed(1) : '0'
  const profitable  = projects.filter(p => p.netEarnings > 0).length
  const lossmaking  = projects.filter(p => p.netEarnings < 0).length

  return (
    <div className="p-4 sm:p-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Projects P&amp;L</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Live from QuickBooks · {data.period.from} → {data.period.to}
            {data.fetchedAt && (
              <span className="ml-2 text-slate-400">
                · updated {new Date(data.fetchedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['ytd', '12m', 'all'] as const).map(r => (
            <button key={r} onClick={() => changeRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                range === r ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {r === 'ytd' ? 'YTD' : r === '12m' ? 'Last 12M' : 'All Time'}
            </button>
          ))}
          <button onClick={() => load(range, true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Total Income"   value={fmtAED(totals.income)}      sub={`${projects.length} projects`}  color="blue"  />
        <KPI label="Direct Costs"   value={fmtAED(totals.cogs)}        sub="materials + labour"             color="slate" />
        <KPI label="Gross Profit"   value={fmtAED(totals.grossProfit)} sub={`${grossMargin}% margin`}       color={totals.grossProfit >= 0 ? 'green' : 'red'} />
        <KPI label="Overheads"      value={fmtAED(totals.expenses)}    sub="operating expenses"             color="amber" />
        <KPI label="Net Earnings"   value={fmtAED(totals.netEarnings)} sub={`${profitable} profit · ${lossmaking} loss`} color={totals.netEarnings >= 0 ? 'green' : 'red'} />
      </div>

      {/* ── Projects Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Per-Project Summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">Income · Direct Costs · Overheads · Net Earnings — all from QuickBooks by class</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
            {projects.length} projects
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 700 }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left   text-xs font-semibold text-slate-500 uppercase tracking-wide">Project / Client</th>
                <th className="px-4 py-3 text-right  text-xs font-semibold text-slate-500 uppercase tracking-wide">Income</th>
                <th className="px-4 py-3 text-right  text-xs font-semibold text-slate-500 uppercase tracking-wide">Direct Costs</th>
                <th className="px-4 py-3 text-right  text-xs font-semibold text-slate-500 uppercase tracking-wide">Overheads</th>
                <th className="px-4 py-3 text-right  text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross Profit</th>
                <th className="px-4 py-3 text-right  text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Earnings</th>
                <th className="px-4 py-3 text-left   text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ minWidth: 120 }}>Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((p, i) => {
                const incPct = (p.income / maxIncome * 100)
                const netPct = (Math.abs(p.netEarnings) / maxNetAbs * 100)
                const isPos  = p.netEarnings >= 0
                return (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px]">
                      <span className="block truncate" title={p.label}>{p.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{fmtAED(p.income)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{fmtAED(p.cogs)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{fmtAED(p.expenses)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${p.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtAED(p.grossProfit)}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${isPos ? 'text-emerald-600' : 'text-red-600'}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {isPos
                          ? <ArrowUpRight className="w-3.5 h-3.5" />
                          : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {fmtAED(p.netEarnings)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isPos ? 'bg-emerald-500' : 'bg-red-400'}`}
                            style={{ width: `${netPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{netPct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totals */}
            <tfoot>
              <tr className="bg-slate-800 text-white">
                <td className="px-4 py-3 font-bold">TOTAL — {projects.length} projects</td>
                <td className="px-4 py-3 text-right font-bold font-mono">{fmtAED(totals.income)}</td>
                <td className="px-4 py-3 text-right font-bold font-mono text-slate-300">{fmtAED(totals.cogs)}</td>
                <td className="px-4 py-3 text-right font-bold font-mono text-slate-300">{fmtAED(totals.expenses)}</td>
                <td className={`px-4 py-3 text-right font-bold font-mono ${totals.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtAED(totals.grossProfit)}
                </td>
                <td className={`px-4 py-3 text-right font-bold font-mono ${totals.netEarnings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtAED(totals.netEarnings)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Project Cards ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-bold text-slate-900 mb-4">Project Cards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => {
            const margin = p.income > 0 ? (p.grossProfit / p.income * 100) : 0
            const isPos  = p.netEarnings >= 0
            return (
              <div key={i} className={`bg-white rounded-xl border shadow-sm p-5 ${
                isPos ? 'border-slate-200' : 'border-red-100'
              }`}>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <p className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">{p.label}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {isPos ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                    {isPos ? 'Profit' : 'Loss'}
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <Row label="Income"       value={fmtFull(p.income)}      bold />
                  <Row label="Direct Costs" value={fmtFull(p.cogs)}        muted />
                  <Row label="Overheads"    value={fmtFull(p.expenses)}    muted />
                  <div className="border-t border-slate-100 pt-2.5 mt-2.5" />
                  <Row label="Gross Profit" value={fmtFull(p.grossProfit)}
                    color={p.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                  <Row label="Net Earnings" value={fmtFull(p.netEarnings)}
                    color={isPos ? 'text-emerald-700' : 'text-red-600'} bold />
                </div>

                {p.income > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Gross margin</span>
                      <span className="font-semibold">{margin.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${margin >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.min(Math.abs(margin), 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function KPI({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue:  'text-blue-600',
    green: 'text-emerald-600',
    red:   'text-red-600',
    amber: 'text-amber-600',
    slate: 'text-slate-700',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1.5 ${colors[color] ?? 'text-slate-900'}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

function Row({ label, value, bold, muted, color }: {
  label: string; value: string; bold?: boolean; muted?: boolean; color?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`font-mono text-xs ${bold ? 'font-bold' : ''} ${color ?? (muted ? 'text-slate-500' : 'text-slate-800')}`}>
        {value}
      </span>
    </div>
  )
}
