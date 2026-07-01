'use client'
import React, { useState, useCallback, useRef } from 'react'
import {
  X, Upload, RefreshCw, CheckCircle, AlertCircle, XCircle,
  HelpCircle, Info, Download,
} from 'lucide-react'
import type { MatchStatus, MatchResult, NormalizedTxn } from '@/app/api/reconcile/route'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QBAccount { id: string; name: string; balance: number }

interface ReconcileSummary {
  bankCount: number; qbCount: number
  matched: number; unmatched: number
  missingInQB: number; missingInBank: number
  mismatch: number; possible: number; duplicates: number
  accuracy: number
  totalBankAmt: number; totalQBAmt: number; difference: number
}

interface ReconcileResponse {
  summary:     ReconcileSummary
  results:     MatchResult[]
  accountName: string
  from: string
  to:   string
}

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS: Record<MatchStatus, { label: string; color: string; bg: string; dot: string }> = {
  MATCHED:         { label: 'Matched',         color: 'text-emerald-700', bg: 'bg-emerald-50 ring-emerald-200',  dot: 'bg-emerald-500' },
  POSSIBLE_MATCH:  { label: 'Possible Match',  color: 'text-amber-700',   bg: 'bg-amber-50 ring-amber-200',      dot: 'bg-amber-400'   },
  MISSING_IN_QB:   { label: 'Missing in QB',   color: 'text-red-700',     bg: 'bg-red-50 ring-red-200',          dot: 'bg-red-500'     },
  MISSING_IN_BANK: { label: 'Missing in Bank', color: 'text-blue-700',    bg: 'bg-blue-50 ring-blue-200',        dot: 'bg-blue-500'    },
  AMOUNT_MISMATCH: { label: 'Amount Mismatch', color: 'text-orange-700',  bg: 'bg-orange-50 ring-orange-200',    dot: 'bg-orange-500'  },
  DUPLICATE:       { label: 'Duplicate',       color: 'text-purple-700',  bg: 'bg-purple-50 ring-purple-200',    dot: 'bg-purple-500'  },
}

const TABS: { key: MatchStatus | 'issues' | 'matched'; label: string }[] = [
  { key: 'issues',          label: 'Issues'           },
  { key: 'MISSING_IN_QB',   label: 'Missing in QB'    },
  { key: 'MISSING_IN_BANK', label: 'Missing in Bank'  },
  { key: 'AMOUNT_MISMATCH', label: 'Amount Mismatch'  },
  { key: 'POSSIBLE_MATCH',  label: 'Possible Match'   },
  { key: 'DUPLICATE',       label: 'Duplicates'       },
  { key: 'matched',         label: 'Matched'          },
]

const ISSUE_STATUSES = new Set<MatchStatus>(['MISSING_IN_QB','MISSING_IN_BANK','AMOUNT_MISMATCH','POSSIBLE_MATCH','DUPLICATE'])

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAmt = (n: number) =>
  (n < 0 ? '−' : '+') +
  'AED ' + Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtAmtAbs = (n: number) =>
  'AED ' + Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(s: string) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
}

function exportCSV(results: MatchResult[], accountName: string, from: string, to: string) {
  const rows = [
    ['Status', 'Reason', 'Bank Date', 'Bank Amount', 'Bank Description', 'Bank Ref', 'QB Date', 'QB Amount', 'QB Description', 'QB Ref'],
    ...results.map(r => [
      STATUS[r.status]?.label ?? r.status,
      r.reason,
      r.bankTxn?.date        ?? '',
      r.bankTxn?.amount != null ? String(r.bankTxn.amount) : '',
      r.bankTxn?.description ?? '',
      r.bankTxn?.reference   ?? '',
      r.qbTxn?.date          ?? '',
      r.qbTxn?.amount != null  ? String(r.qbTxn.amount)   : '',
      r.qbTxn?.description   ?? '',
      r.qbTxn?.reference     ?? '',
    ]),
  ]
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `reconcile_${accountName.replace(/\s+/g,'_')}_${from}_${to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TxnCell({ txn }: { txn: NormalizedTxn }) {
  return (
    <div className="space-y-0.5">
      <p className={`font-semibold text-sm ${txn.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
        {fmtAmt(txn.amount)}
      </p>
      <p className="text-xs text-slate-500">{fmtDate(txn.date)}</p>
      {txn.description && (
        <p className="text-xs text-slate-600 truncate max-w-[220px]" title={txn.description}>
          {txn.description}
        </p>
      )}
      {txn.reference && (
        <p className="text-[10px] text-slate-400">Ref: {txn.reference}</p>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub, accent }:
  { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReconcileModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<'setup' | 'processing' | 'results'>('setup')

  // Setup
  const [accounts,      setAccounts]     = useState<QBAccount[]>([])
  const [accLoading,    setAccLoading]   = useState(false)
  const [accError,      setAccError]     = useState('')
  const [selectedAcc,   setSelectedAcc]  = useState<QBAccount | null>(null)
  const today   = new Date().toISOString().slice(0, 10)
  const firstOfMonth = (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })()
  const [from, setFrom] = useState(firstOfMonth)
  const [to,   setTo]   = useState(today)
  const [file,     setFile]     = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Processing
  const [procMsg, setProcMsg] = useState('')

  // Results
  const [result,    setResult]    = useState<ReconcileResponse | null>(null)
  const [runError,  setRunError]  = useState('')
  const [activeTab, setActiveTab] = useState<typeof TABS[0]['key']>('issues')

  // ── Safe JSON helper ──────────────────────────────────────────────────────

  async function safeJson(res: Response): Promise<any> {
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('json')) {
      const text = await res.text()
      throw new Error(text.replace(/<[^>]*>/g, '').trim().slice(0, 300) || `Server error (${res.status})`)
    }
    return res.json()
  }

  // ── Load QB bank accounts ─────────────────────────────────────────────────

  async function loadAccounts() {
    setAccLoading(true); setAccError('')
    try {
      const res  = await fetch('/api/reconcile/accounts')
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setAccounts(data.accounts)
      if (data.accounts.length === 1) setSelectedAcc(data.accounts[0])
    } catch (e) {
      setAccError(e instanceof Error ? e.message : 'Failed to load accounts')
    } finally {
      setAccLoading(false)
    }
  }

  // ── File handling ─────────────────────────────────────────────────────────

  const onDrop = useCallback((files: FileList | null) => {
    if (!files?.length) return
    const f   = files[0]
    const ext = f.name.toLowerCase().split('.').pop() ?? ''
    if (!['csv', 'xlsx', 'xls', 'pdf'].includes(ext)) {
      alert('Please upload a CSV, Excel (.xlsx / .xls), or PDF file.')
      return
    }
    setFile(f)
  }, [])

  // ── Run reconciliation ────────────────────────────────────────────────────

  async function run() {
    if (!selectedAcc || !file) {
      alert('Please select a QuickBooks bank account and upload your bank statement.')
      return
    }
    setRunError(''); setView('processing')

    const steps = [
      'Reading bank statement…',
      'Fetching QuickBooks transactions…',
      'Normalising data…',
      'Running matching engine…',
      'Computing results…',
    ]
    let si = 0
    setProcMsg(steps[0])
    const tick = setInterval(() => { si = Math.min(si + 1, steps.length - 1); setProcMsg(steps[si]) }, 1800)

    try {
      const fd = new FormData()
      fd.append('accountId',   selectedAcc.id)
      fd.append('accountName', selectedAcc.name)
      fd.append('from', from)
      fd.append('to', to)
      fd.append('file', file)

      const res  = await fetch('/api/reconcile', { method: 'POST', body: fd })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error ?? 'Reconciliation failed')
      setResult(data)
      setActiveTab('issues')
      setView('results')
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Failed')
      setView('setup')
    } finally {
      clearInterval(tick)
    }
  }

  // ── Filtered results ──────────────────────────────────────────────────────

  const filteredResults = result?.results.filter(r => {
    if (activeTab === 'issues')  return ISSUE_STATUSES.has(r.status)
    if (activeTab === 'matched') return r.status === 'MATCHED'
    return r.status === activeTab
  }) ?? []

  const tabCount = (key: typeof TABS[0]['key']): number => {
    if (!result) return 0
    if (key === 'issues')  return result.summary.unmatched
    if (key === 'matched') return result.summary.matched
    const s = result.summary
    const map: Record<string, number> = {
      MISSING_IN_QB:   s.missingInQB,
      MISSING_IN_BANK: s.missingInBank,
      AMOUNT_MISMATCH: s.mismatch,
      POSSIBLE_MATCH:  s.possible,
      DUPLICATE:       s.duplicates,
    }
    return map[key as string] ?? 0
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Bank Reconciliation</h2>
            {result && (
              <p className="text-xs text-slate-500">
                {result.accountName} · {fmtDate(result.from)} – {fmtDate(result.to)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'results' && result && (
            <button
              onClick={() => exportCSV(result.results, result.accountName, result.from, result.to)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          {view === 'results' && (
            <button
              onClick={() => { setView('setup'); setFile(null); setResult(null) }}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              New Check
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SETUP VIEW                                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {view === 'setup' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            {runError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{runError}</p>
              </div>
            )}

            {/* Step 1 — Date range */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Step 1 · Date Range
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'From', value: from, set: setFrom },
                  { label: 'To',   value: to,   set: setTo   },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
                    <input
                      type="date" value={f.value}
                      onChange={e => f.set(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2 — QB account */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Step 2 · QuickBooks Bank Account
                </p>
                <button
                  onClick={loadAccounts}
                  disabled={accLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${accLoading ? 'animate-spin' : ''}`} />
                  {accounts.length ? 'Refresh' : 'Load Accounts'}
                </button>
              </div>

              {accError && (
                <p className="text-xs text-red-600 mb-3">{accError}</p>
              )}

              {accounts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Click "Load Accounts" to fetch your QuickBooks bank accounts
                </p>
              ) : (
                <div className="space-y-2">
                  {accounts.map(a => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAcc(a)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all
                        ${selectedAcc?.id === a.id
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                          : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${selectedAcc?.id === a.id ? 'bg-blue-500' : 'bg-slate-200'}`} />
                        <span className="text-sm font-medium text-slate-800">{a.name}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Balance: {fmtAmtAbs(a.balance)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3 — Bank statement upload */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Step 3 · Bank Statement
              </p>

              <div
                onDragOver={e  => { e.preventDefault(); setDragging(true)  }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); onDrop(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                  ${dragging
                    ? 'border-blue-400 bg-blue-50'
                    : file
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <input
                  ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf"
                  className="hidden"
                  onChange={e => onDrop(e.target.files)}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                    <p className="text-sm font-bold text-emerald-700">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB · Click to change
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Upload className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Drop your bank statement here</p>
                      <p className="text-xs text-slate-400 mt-1">CSV · Excel (.xlsx) · PDF — or click to browse</p>
                    </div>
                  </div>
                )}
              </div>

              {file && (
                <button
                  onClick={e => { e.stopPropagation(); setFile(null) }}
                  className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Remove file
                </button>
              )}

              <div className="mt-3 flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  CSV export from your online banking portal works best. Excel files are also accepted.
                  PDF statements will be processed using AI extraction.
                </p>
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={run}
              disabled={!selectedAcc || !file}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors text-sm tracking-wide"
            >
              Start Reconciliation
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PROCESSING VIEW                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {view === 'processing' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">Reconciling</p>
              <p className="text-sm text-slate-500 mt-1">{procMsg}</p>
            </div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              This compares your bank statement against QuickBooks and identifies discrepancies.
            </p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* RESULTS VIEW                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {view === 'results' && result && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Summary cards */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <SummaryCard
                label="Bank Txns"
                value={result.summary.bankCount.toString()}
                accent="text-slate-900"
              />
              <SummaryCard
                label="QB Txns"
                value={result.summary.qbCount.toString()}
                accent="text-slate-900"
              />
              <SummaryCard
                label="Matched"
                value={result.summary.matched.toString()}
                sub={`${result.summary.accuracy}% accuracy`}
                accent="text-emerald-600"
              />
              <SummaryCard
                label="Issues"
                value={result.summary.unmatched.toString()}
                accent={result.summary.unmatched > 0 ? 'text-red-600' : 'text-emerald-600'}
              />
              <SummaryCard
                label="Bank Total"
                value={fmtAmtAbs(result.summary.totalBankAmt)}
                accent="text-slate-900"
              />
              <SummaryCard
                label="Difference"
                value={fmtAmtAbs(result.summary.difference)}
                accent={result.summary.difference < 1 ? 'text-emerald-600' : 'text-red-600'}
                sub={result.summary.difference < 1 ? 'Balanced ✓' : 'Bank vs QB'}
              />
            </div>
          </div>

          {/* Missing breakdown pills */}
          {result.summary.unmatched > 0 && (
            <div className="flex-shrink-0 bg-white border-b border-slate-100 px-6 py-2 flex flex-wrap gap-2">
              {result.summary.missingInQB   > 0 && <Pill label={`${result.summary.missingInQB} missing in QB`}    color="bg-red-100 text-red-700"    />}
              {result.summary.missingInBank > 0 && <Pill label={`${result.summary.missingInBank} missing in bank`} color="bg-blue-100 text-blue-700"   />}
              {result.summary.mismatch      > 0 && <Pill label={`${result.summary.mismatch} amount mismatch`}      color="bg-orange-100 text-orange-700"/>}
              {result.summary.possible      > 0 && <Pill label={`${result.summary.possible} possible match`}       color="bg-amber-100 text-amber-700"  />}
              {result.summary.duplicates    > 0 && <Pill label={`${result.summary.duplicates} duplicate`}          color="bg-purple-100 text-purple-700" />}
            </div>
          )}

          {/* Tabs */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 overflow-x-auto">
            <div className="flex gap-0.5 py-2 min-w-max">
              {TABS.map(tab => {
                const cnt = tabCount(tab.key)
                if (cnt === 0 && tab.key !== 'issues' && tab.key !== 'matched') return null
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                      ${activeTab === tab.key
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {tab.label}
                    {cnt > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                        ${activeTab === tab.key
                          ? 'bg-white/20 text-white'
                          : tab.key === 'MISSING_IN_QB'   ? 'bg-red-100 text-red-700'
                          : tab.key === 'MISSING_IN_BANK' ? 'bg-blue-100 text-blue-700'
                          : tab.key === 'matched'         ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'}`}
                      >{cnt}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Results table */}
          <div className="flex-1 overflow-auto">
            {filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <CheckCircle className="w-12 h-12 text-emerald-300" />
                <p className="text-sm font-medium">
                  {activeTab === 'issues' ? 'No issues — everything matched!' : 'No items in this category'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-36 border-b border-slate-200">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">Bank Statement</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">QuickBooks</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, idx) => {
                    const s = STATUS[r.status]
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-slate-100 transition-colors hover:bg-white ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-5 py-4 align-top">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${s.bg} ${s.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            {s.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {r.bankTxn ? <TxnCell txn={r.bankTxn} /> : <span className="text-xs text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-5 py-4 align-top">
                          {r.qbTxn  ? <TxnCell txn={r.qbTxn}  /> : <span className="text-xs text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-5 py-4 align-top text-xs text-slate-500 max-w-[240px]">
                          {r.reason}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}
