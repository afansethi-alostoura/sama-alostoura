'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useParams }    from 'next/navigation'
import Link             from 'next/link'
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, DollarSign, AlertCircle,
  ChevronDown, ChevronRight, Building2, Loader2, Calendar,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IncomeTransaction {
  id:          string
  date:        string
  description: string
  reference:   string
  amount:      number
  account:     string
}

interface ExpenseTransaction {
  id:          string
  date:        string
  vendor:      string
  description: string
  reference:   string
  amount:      number
  type:        'purchase' | 'bill' | 'vendor_credit'
  account:     string
}

interface CategoryGroup {
  total:        number
  transactions: ExpenseTransaction[]
}

interface FinancialsData {
  class_name: string
  income: {
    total:        number
    transactions: IncomeTransaction[]
  }
  expenses: {
    total:      number
    byCategory: Record<string, CategoryGroup>
  }
  summary: {
    totalIncome:   number
    totalExpenses: number
    netProfit:     number
  }
  fetchedAt: string
}

interface Project {
  id:             string
  name:           string
  client_name?:   string
  qb_class_name?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return 'AED ' + Math.abs(amount).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function typeLabel(type: ExpenseTransaction['type']) {
  if (type === 'vendor_credit') return 'Credit'
  if (type === 'bill')          return 'Bill'
  return 'Payment'
}

function typeBadge(type: ExpenseTransaction['type']) {
  if (type === 'vendor_credit') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (type === 'bill')          return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-slate-50 text-slate-600 ring-slate-200'
}

// ── Components ────────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string
  value: string
  sub?:  string
  icon:  React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function ExpenseCategoryRow({ name, group }: { name: string; group: CategoryGroup }) {
  const [open, setOpen] = useState(false)
  const isCredit = group.total < 0

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden mb-3">
      {/* Category header — clickable */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <span className="font-medium text-sm text-slate-800">{name}</span>
          <span className="text-xs text-slate-400 ml-1">({group.transactions.length} txn{group.transactions.length !== 1 ? 's' : ''})</span>
        </div>
        <span className={`text-sm font-bold ${isCredit ? 'text-blue-600' : 'text-red-600'}`}>
          {isCredit ? '−' : ''}{fmt(group.total)}
        </span>
      </button>

      {/* Drill-down transactions */}
      {open && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-24">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">Vendor</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">Description</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-16">Type</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-16">Ref #</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-500 w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {group.transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-medium max-w-[140px] truncate">{tx.vendor || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">{tx.description || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ring-1 ${typeBadge(tx.type)}`}>
                        {typeLabel(tx.type)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono">{tx.reference}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${tx.amount < 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {tx.amount < 0 ? '−' : ''}{fmt(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function IncomeSection({ income }: { income: FinancialsData['income'] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          <span className="font-medium text-sm text-slate-800">Project Income / Deposits</span>
          <span className="text-xs text-slate-400 ml-1">({income.transactions.length} txn{income.transactions.length !== 1 ? 's' : ''})</span>
        </div>
        <span className="text-sm font-bold text-emerald-600">{fmt(income.total)}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-24">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">Account</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">Description</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-16">Ref #</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-500 w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {income.transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-2.5 text-slate-800 font-medium max-w-[160px] truncate">{tx.account || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate">{tx.description || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono">{tx.reference}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{fmt(tx.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectAccountingPage() {
  const params = useParams()
  const id = params.id as string

  const [project,    setProject]    = useState<Project | null>(null)
  const [data,       setData]       = useState<FinancialsData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [projLoad,   setProjLoad]   = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')

  // Load project to get qb_class_name
  useEffect(() => {
    setProjLoad(true)
    fetch(`/api/projects/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setProject(p) })
      .catch(() => {})
      .finally(() => setProjLoad(false))
  }, [id])

  const loadFinancials = useCallback(async (className: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ class_name: className })
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo)   params.set('to',   dateTo)
      const res = await fetch(`/api/quickbooks/project-financials?${params}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? `Request failed (${res.status})`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load financials')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  // Auto-load when project + QB class is known
  useEffect(() => {
    const cls = (project as any)?.qb_class_name
    if (cls) loadFinancials(cls)
  }, [project, loadFinancials])

  // ── Render ────────────────────────────────────────────────────────────────────
  if (projLoad) {
    return (
      <div className="p-8 flex items-center gap-2 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading project…
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-8">
        <Link href="/projects" className="text-slate-500 hover:text-slate-700 text-sm">← Back to Projects</Link>
        <p className="mt-4 text-slate-500">Project not found.</p>
      </div>
    )
  }

  const qbClass = (project as any).qb_class_name

  return (
    <div className="p-4 sm:p-8 max-w-6xl">

      {/* Back */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Project
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {qbClass
                ? <>QB Class: <span className="font-medium text-slate-700">{qbClass}</span></>
                : <span className="text-amber-600">No QuickBooks class linked — go to Edit Project to set one</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="From"
            />
            <span>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="To"
            />
          </div>
          {qbClass && (
            <button
              onClick={() => loadFinancials(qbClass)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* No QB class linked */}
      {!qbClass && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-amber-800">No QuickBooks Class Linked</p>
          <p className="text-xs text-amber-600 mt-1">
            Edit the project and select a QB Class to enable financial tracking.
          </p>
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            Go to Project Settings
          </Link>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-slate-100 rounded-xl h-24 animate-pulse" />
            ))}
          </div>
          <div className="bg-slate-100 rounded-xl h-48 animate-pulse" />
        </div>
      )}

      {/* Dashboard */}
      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SummaryCard
              label="Total Revenue"
              value={fmt(data.summary.totalIncome)}
              sub={`${data.income.transactions.length} deposits`}
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
            />
            <SummaryCard
              label="Total Expenses"
              value={fmt(data.summary.totalExpenses)}
              sub={`${Object.keys(data.expenses.byCategory).length} categories`}
              icon={TrendingDown}
              color="bg-red-50 text-red-500"
            />
            <SummaryCard
              label="Outstanding"
              value={fmt(Math.max(0, data.summary.totalExpenses - data.summary.totalIncome))}
              sub="Expenses not yet covered"
              icon={AlertCircle}
              color="bg-amber-50 text-amber-500"
            />
            <SummaryCard
              label={data.summary.netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
              value={fmt(data.summary.netProfit)}
              sub={data.summary.netProfit >= 0 ? 'Income exceeds expenses' : 'Expenses exceed income'}
              icon={DollarSign}
              color={data.summary.netProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}
            />
          </div>

          {/* Income Section */}
          <div className="mb-8">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Income
            </h2>
            {data.income.transactions.length === 0
              ? (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-sm text-slate-400">
                  No income deposits found for this project class.
                </div>
              )
              : <IncomeSection income={data.income} />}
          </div>

          {/* Expenses by Category */}
          <div>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Expenses by Category
            </h2>
            {Object.keys(data.expenses.byCategory).length === 0
              ? (
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-center text-sm text-slate-400">
                  No expense transactions found for this project class.
                </div>
              )
              : Object.entries(data.expenses.byCategory).map(([name, group]) => (
                <ExpenseCategoryRow key={name} name={name} group={group} />
              ))}
          </div>

          {/* Footer */}
          <p className="text-xs text-slate-400 mt-8 text-center">
            Data from QuickBooks · Last fetched {new Date(data.fetchedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  )
}
