'use client'
import React, { useEffect, useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Loader2, RefreshCw, X, ChevronRight, ChevronDown, Calendar,
  BarChart2, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  date: string
  vendor: string
  description: string
  reference: string
  amount: number
  type: string
  account: string
}

interface CategoryGroup {
  total: number
  transactions: Transaction[]
}

interface FinancialsData {
  expenses: {
    total: number
    byCategory: Record<string, CategoryGroup>
  }
  income: { total: number; transactions: any[] }
  summary: { totalIncome: number; totalExpenses: number; netProfit: number }
  fetchedAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  'AED ' + Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmtFull = (n: number) =>
  'AED ' + Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function monthKey(date: string) { return date.slice(0, 7) }
function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleString('en-AE', { month: 'short', year: '2-digit' })
}

const CATEGORY_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#06b6d4','#84cc16','#f97316','#6366f1',
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CompanyFinancialsPage() {
  const [data,         setData]         = useState<FinancialsData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [selectedCat,  setSelectedCat]  = useState<string | null>(null)
  const [expandedCat,  setExpandedCat]  = useState<string | null>(null)
  const [dateRange,    setDateRange]    = useState<'ytd' | '3m' | '6m' | '12m' | 'all'>('ytd')
  const [refreshing,   setRefreshing]   = useState(false)

  function dateParams(range: typeof dateRange) {
    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    const y     = now.getFullYear()
    switch (range) {
      case 'ytd': return `from=${y}-01-01&to=${today}`
      case '3m': {
        const d = new Date(now); d.setMonth(d.getMonth() - 3)
        return `from=${d.toISOString().slice(0, 10)}&to=${today}`
      }
      case '6m': {
        const d = new Date(now); d.setMonth(d.getMonth() - 6)
        return `from=${d.toISOString().slice(0, 10)}&to=${today}`
      }
      case '12m': {
        const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
        return `from=${d.toISOString().slice(0, 10)}&to=${today}`
      }
      case 'all': return ''
    }
  }

  async function load(range = dateRange, refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const params = dateParams(range)
      const url    = `/api/quickbooks/project-financials?class_name=Sama%20Alostoura${params ? '&' + params : ''}`
      const res    = await fetch(url)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  function changeRange(r: typeof dateRange) {
    setDateRange(r)
    load(r)
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    if (!data) return []
    return Object.entries(data.expenses.byCategory)
      .map(([name, g]) => ({ name, total: g.total, count: g.transactions.length }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [data])

  const monthlyData = useMemo(() => {
    if (!data) return []
    const map: Record<string, number> = {}
    for (const [, g] of Object.entries(data.expenses.byCategory)) {
      for (const t of g.transactions) {
        if (t.amount <= 0) continue
        const k = monthKey(t.date)
        map[k] = (map[k] ?? 0) + t.amount
      }
    }
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: monthLabel(k), key: k, amount: Math.round(v) }))
  }, [data])

  const thisMonthKey  = new Date().toISOString().slice(0, 7)
  const lastMonthKey  = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) })()
  const thisMonth     = monthlyData.find(m => m.key === thisMonthKey)?.amount ?? 0
  const lastMonth     = monthlyData.find(m => m.key === lastMonthKey)?.amount ?? 0
  const momChange     = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0
  const totalExpenses = data?.expenses.total ?? 0
  const txnCount      = categories.reduce((s, c) => s + c.count, 0)

  const recentMajor = useMemo(() => {
    if (!data) return []
    const all: Transaction[] = []
    for (const g of Object.values(data.expenses.byCategory)) {
      all.push(...g.transactions.filter(t => t.amount > 0))
    }
    return all.sort((a, b) => b.amount - a.amount).slice(0, 10)
  }, [data])

  const selectedTransactions: Transaction[] = selectedCat
    ? (data?.expenses.byCategory[selectedCat]?.transactions ?? [])
        .filter(t => t.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Loading company financials…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-800">Failed to load financials</p>
          <p className="text-sm text-red-600 mt-1">{error}</p>
          <button onClick={() => load()} className="mt-3 text-sm font-semibold text-red-700 hover:underline">Try again</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 sm:p-8 space-y-8">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Financials</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            QB Class: <span className="font-semibold text-slate-700">Sama Alostoura</span>
            {data?.fetchedAt && (
              <span className="ml-2 text-slate-400">· updated {new Date(data.fetchedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range pills */}
          {(['ytd', '3m', '6m', '12m', 'all'] as const).map(r => (
            <button
              key={r}
              onClick={() => changeRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${dateRange === r ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {r === 'ytd' ? 'YTD' : r === 'all' ? 'All Time' : r.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => load(dateRange, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Expenses</p>
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(totalExpenses)}</p>
          <p className="text-xs text-slate-500 mt-1">{txnCount} transactions</p>
        </div>

        {/* This Month */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">This Month</p>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(thisMonth)}</p>
          <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${momChange > 10 ? 'text-red-600' : momChange < -10 ? 'text-emerald-600' : 'text-slate-500'}`}>
            {momChange > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : momChange < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {Math.abs(momChange)}% vs last month
          </div>
        </div>

        {/* Last Month */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Month</p>
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-slate-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(lastMonth)}</p>
          <p className="text-xs text-slate-500 mt-1">{new Date(lastMonthKey + '-01').toLocaleString('en-AE', { month: 'long', year: 'numeric' })}</p>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categories</p>
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{categories.length}</p>
          <p className="text-xs text-slate-500 mt-1">expense accounts</p>
        </div>
      </div>

      {/* ── Monthly Trend ─────────────────────────────────────────────────────── */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-slate-900">Monthly Expenses</h2>
              <p className="text-xs text-slate-500 mt-0.5">Company operating expenses per month</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                formatter={(v: number) => [fmtFull(v), 'Expenses']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {monthlyData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.key === thisMonthKey ? '#3b82f6' : entry.key === lastMonthKey ? '#93c5fd' : '#e2e8f0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 justify-end">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> This month</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-200 inline-block" /> Last month</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Previous</span>
          </div>
        </div>
      )}

      {/* ── Top Categories + Pie ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bar chart — top categories */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-1">Top Expense Categories</h2>
          <p className="text-xs text-slate-500 mb-5">Click any category to view transactions</p>
          <div className="space-y-3">
            {categories.slice(0, 8).map((cat, i) => {
              const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
                  className={`w-full text-left group transition-all rounded-lg px-3 py-2 -mx-3
                    ${selectedCat === cat.name ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      <span className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{cat.name}</span>
                      <span className="text-xs text-slate-400">{cat.count} txns</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{fmt(cat.total)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(1)}%</span>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${selectedCat === cat.name ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Pie chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-1">Expense Breakdown</h2>
          <p className="text-xs text-slate-500 mb-4">Share of total spend by category</p>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categories.slice(0, 8).map((c, i) => ({ name: c.name, value: Math.round(c.total), fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(d) => setSelectedCat(selectedCat === d.name ? null : d.name)}
                  style={{ cursor: 'pointer' }}
                >
                  {categories.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [fmtFull(v), 'Amount']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v.length > 22 ? v.slice(0, 22) + '…' : v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-400 text-sm">No expense data</div>
          )}
        </div>
      </div>

      {/* ── Category Drill-down ──────────────────────────────────────────────── */}
      {selectedCat && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-blue-50 border-b border-blue-200">
            <div>
              <h2 className="font-bold text-slate-900">{selectedCat}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedTransactions.length} transactions ·{' '}
                <strong className="text-slate-700">{fmtFull(data?.expenses.byCategory[selectedCat]?.total ?? 0)}</strong> total
              </p>
            </div>
            <button
              onClick={() => setSelectedCat(null)}
              className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">DATE</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">VENDOR</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">DESCRIPTION</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-600 text-center">TYPE</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {selectedTransactions.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="px-4 py-2.5 text-slate-600 text-xs font-mono whitespace-nowrap">{t.date}</td>
                    <td className="px-4 py-2.5 text-slate-800 text-xs font-medium max-w-[160px] truncate">{t.vendor || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[240px] truncate">{t.description || '—'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                        ${t.type === 'bill' ? 'bg-amber-100 text-amber-700' : t.type === 'purchase' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 text-sm whitespace-nowrap">{fmtFull(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan={4} className="px-4 py-2.5 font-bold text-sm">Total — {selectedCat}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-sm">
                    {fmtFull(data?.expenses.byCategory[selectedCat]?.total ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── All Categories Accordion ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-900">All Expense Categories</h2>
          <p className="text-xs text-slate-500 mt-0.5">Expand any category to see all transactions</p>
        </div>
        <div className="divide-y divide-slate-100">
          {categories.map((cat, i) => {
            const isOpen = expandedCat === cat.name
            const txns   = (data?.expenses.byCategory[cat.name]?.transactions ?? [])
              .filter(t => t.amount > 0)
              .sort((a, b) => b.amount - a.amount)
            const pct    = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0
            return (
              <div key={cat.name}>
                <button
                  onClick={() => setExpandedCat(isOpen ? null : cat.name)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="text-sm font-semibold text-slate-800 truncate">{cat.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{cat.count} transactions</span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <div className="hidden sm:flex items-center gap-2 w-32">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right">{pct.toFixed(0)}%</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-28 text-right">{fmt(cat.total)}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-6 py-2 text-left text-xs font-semibold text-slate-500">DATE</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">VENDOR</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">DESCRIPTION</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {txns.map(t => (
                          <tr key={t.id} className="hover:bg-blue-50/20">
                            <td className="px-6 py-2 text-xs text-slate-500 font-mono">{t.date}</td>
                            <td className="px-4 py-2 text-xs text-slate-700 font-medium max-w-[160px] truncate">{t.vendor || '—'}</td>
                            <td className="px-4 py-2 text-xs text-slate-500 max-w-[240px] truncate">{t.description || '—'}</td>
                            <td className="px-4 py-2 text-right text-xs font-bold text-slate-800">{fmtFull(t.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100">
                          <td colSpan={3} className="px-6 py-2 text-xs font-bold text-slate-600 uppercase">Category Total</td>
                          <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">{fmtFull(cat.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Recent Major Expenses ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Recent Major Expenses</h2>
            <p className="text-xs text-slate-500 mt-0.5">Top 10 largest individual transactions</p>
          </div>
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">DATE</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">VENDOR</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">CATEGORY</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">DESCRIPTION</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentMajor.map((t, i) => (
                <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-800 font-medium max-w-[160px] truncate">{t.vendor || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{t.account}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{t.description || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900 text-sm whitespace-nowrap">{fmtFull(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Monthly Comparison ───────────────────────────────────────────────── */}
      {monthlyData.length >= 2 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-900 mb-1">Monthly Comparison</h2>
          <p className="text-xs text-slate-500 mb-5">Month-over-month expense change</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500">MONTH</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500">EXPENSES</th>
                  <th className="pb-2 text-right text-xs font-semibold text-slate-500">CHANGE</th>
                  <th className="pb-2 text-left text-xs font-semibold text-slate-500 pl-4">TREND</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...monthlyData].reverse().map((m, i, arr) => {
                  const prev   = arr[i + 1]
                  const change = prev ? Math.round(((m.amount - prev.amount) / prev.amount) * 100) : null
                  return (
                    <tr key={m.key} className={m.key === thisMonthKey ? 'bg-blue-50' : ''}>
                      <td className="py-2 font-medium text-slate-800">
                        {m.month}
                        {m.key === thisMonthKey && <span className="ml-2 text-xs text-blue-600 font-semibold">current</span>}
                      </td>
                      <td className="py-2 text-right font-bold text-slate-900">{fmt(m.amount)}</td>
                      <td className="py-2 text-right">
                        {change !== null ? (
                          <span className={`text-xs font-semibold ${change > 10 ? 'text-red-600' : change < -10 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {change > 0 ? '+' : ''}{change}%
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="py-2 pl-4">
                        {change !== null && (
                          change > 10
                            ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><TrendingUp className="w-3.5 h-3.5" /> Higher</span>
                            : change < -10
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><TrendingDown className="w-3.5 h-3.5" /> Lower</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Minus className="w-3.5 h-3.5" /> Stable</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AI Insights Placeholder ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">AI Insights — Coming Soon</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              When AI analysis is enabled, this section will automatically detect unusual spending patterns,
              flag categories growing too quickly, identify cost-saving opportunities, and provide
              month-over-month recommendations to improve profitability.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Unusual spending patterns','Growing cost categories','Cost-saving opportunities','Spending trend analysis','Profitability recommendations'].map(tag => (
                <span key={tag} className="text-xs bg-white/10 text-slate-300 px-3 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
