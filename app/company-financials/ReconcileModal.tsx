'use client'
import React, { useState, useCallback, useRef } from 'react'
import {
  X, Upload, RefreshCw, CheckCircle, AlertCircle,
  Info, Download, FileText, Sparkles,
} from 'lucide-react'
import type { MatchStatus, MatchResult, NormalizedTxn } from '@/app/api/reconcile/route'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReconcileSummary {
  bankCount: number; qbCount: number
  matched: number; unmatched: number
  missingInQB: number; missingInBank: number
  mismatch: number; possible: number; duplicates: number
  accuracy: number
  totalBankAmt: number; totalQBAmt: number; difference: number
}

interface ReconcileResponse {
  qbFileName:   string
  bankFileName: string
  from:  string | null
  to:    string | null
  analysis: string
  summary: ReconcileSummary
  results: MatchResult[]
}

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS: Record<MatchStatus, { label: string; color: string; bg: string; dot: string }> = {
  MATCHED:         { label: 'Matched',          color: 'text-emerald-700', bg: 'bg-emerald-50 ring-emerald-200',  dot: 'bg-emerald-500' },
  POSSIBLE_MATCH:  { label: 'Possible Match',   color: 'text-amber-700',   bg: 'bg-amber-50 ring-amber-200',      dot: 'bg-amber-400'   },
  MISSING_IN_QB:   { label: 'Not in QB',        color: 'text-red-700',     bg: 'bg-red-50 ring-red-200',          dot: 'bg-red-500'     },
  MISSING_IN_BANK: { label: 'Not in Bank',      color: 'text-blue-700',    bg: 'bg-blue-50 ring-blue-200',        dot: 'bg-blue-500'    },
  AMOUNT_MISMATCH: { label: 'Amount Mismatch',  color: 'text-orange-700',  bg: 'bg-orange-50 ring-orange-200',    dot: 'bg-orange-500'  },
  DUPLICATE:       { label: 'Duplicate',        color: 'text-purple-700',  bg: 'bg-purple-50 ring-purple-200',    dot: 'bg-purple-500'  },
}

const TABS: { key: MatchStatus | 'issues' | 'matched'; label: string }[] = [
  { key: 'issues',          label: 'All Issues'      },
  { key: 'MISSING_IN_QB',   label: 'Not in QB'       },
  { key: 'MISSING_IN_BANK', label: 'Not in Bank'     },
  { key: 'AMOUNT_MISMATCH', label: 'Amount Mismatch' },
  { key: 'POSSIBLE_MATCH',  label: 'Possible Match'  },
  { key: 'DUPLICATE',       label: 'Duplicates'      },
  { key: 'matched',         label: 'Matched'         },
]

const ISSUE_STATUSES = new Set<MatchStatus>([
  'MISSING_IN_QB', 'MISSING_IN_BANK', 'AMOUNT_MISMATCH', 'POSSIBLE_MATCH', 'DUPLICATE',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAmt = (n: number) =>
  (n < 0 ? '−' : '+') + 'AED ' +
  Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtAmtAbs = (n: number) =>
  'AED ' + Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-AE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try { return JSON.parse(text) }
  catch {
    const clean = text.replace(/<[^>]*>/g, '').trim().slice(0, 300)
    throw new Error(clean || `Server error (${res.status})`)
  }
}

function exportCSV(results: MatchResult[], qbName: string, bankName: string) {
  const rows = [
    ['Status','Reason','Bank Date','Bank Amount','Bank Description','Bank Ref','QB Date','QB Amount','QB Description','QB Ref'],
    ...results.map(r => [
      STATUS[r.status]?.label ?? r.status, r.reason,
      r.bankTxn?.date        ?? '', r.bankTxn?.amount != null ? String(r.bankTxn.amount) : '',
      r.bankTxn?.description ?? '', r.bankTxn?.reference ?? '',
      r.qbTxn?.date          ?? '', r.qbTxn?.amount  != null ? String(r.qbTxn.amount)  : '',
      r.qbTxn?.description   ?? '', r.qbTxn?.reference  ?? '',
    ]),
  ]
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `reconcile_${bankName.replace(/\.[^.]+$/, '')}_vs_${qbName.replace(/\.[^.]+$/, '')}.csv`
  a.click(); URL.revokeObjectURL(url)
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
      {txn.reference && <p className="text-[10px] text-slate-400">Ref: {txn.reference}</p>}
    </div>
  )
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function FileZone({
  label, hint, accept, file, onFile, icon,
}: {
  label: string; hint: string; accept: string
  file: File | null; onFile: (f: File) => void; icon: React.ReactNode
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const handle = (files: FileList | null) => {
    if (!files?.length) return
    onFile(files[0])
  }

  return (
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <div
        onDragOver={e  => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files) }}
        onClick={() => ref.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${drag ? 'border-blue-400 bg-blue-50'
            : file ? 'border-emerald-400 bg-emerald-50'
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={e => handle(e.target.files)} />
        {file ? (
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-700">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              {icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Drop file here</p>
              <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
            </div>
          </div>
        )}
      </div>
      {file && (
        <button
          onClick={e => { e.stopPropagation() /* handled by parent click */ }}
          className="mt-1 text-xs text-slate-400 hover:text-slate-600"
        >
          {/* remove handled via re-upload */}
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReconcileModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<'setup' | 'processing' | 'results'>('setup')

  // Setup state
  const today        = new Date().toISOString().slice(0, 10)
  const firstOfMonth = (() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })()
  const [from,     setFrom]     = useState(firstOfMonth)
  const [to,       setTo]       = useState(today)
  const [qbFile,   setQbFile]   = useState<File | null>(null)
  const [bankFile, setBankFile] = useState<File | null>(null)
  const [runError, setRunError] = useState('')

  // Processing
  const [procMsg, setProcMsg] = useState('')

  // Results
  const [result,    setResult]    = useState<ReconcileResponse | null>(null)
  const [activeTab, setActiveTab] = useState<typeof TABS[0]['key']>('issues')

  // ── Run ─────────────────────────────────────────────────────────────────────

  async function run() {
    if (!qbFile || !bankFile) {
      alert('Please upload both a QuickBooks export file and a bank statement.')
      return
    }

    setRunError(''); setView('processing')

    const steps = [
      'Reading QuickBooks file…',
      'Reading bank statement…',
      'Sending to AI agent…',
      'Comparing transactions…',
      'Building analysis…',
    ]
    let si = 0; setProcMsg(steps[0])
    const tick = setInterval(() => {
      si = Math.min(si + 1, steps.length - 1); setProcMsg(steps[si])
    }, 2000)

    try {
      // Convert XLSX to CSV in browser to avoid serverless import issues
      async function prepareFile(file: File): Promise<File> {
        const ext = file.name.toLowerCase().split('.').pop() ?? ''
        if (ext !== 'xlsx' && ext !== 'xls') return file
        const XLSX   = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const wb  = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
        return new File([csv], file.name.replace(/\.xlsx?$/i, '.csv'), { type: 'text/csv' })
      }

      const [qbReady, bankReady] = await Promise.all([prepareFile(qbFile), prepareFile(bankFile)])

      const fd = new FormData()
      fd.append('qbFile',   qbReady)
      fd.append('bankFile', bankReady)
      fd.append('from', from)
      fd.append('to',   to)

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
      MISSING_IN_QB: s.missingInQB, MISSING_IN_BANK: s.missingInBank,
      AMOUNT_MISMATCH: s.mismatch, POSSIBLE_MATCH: s.possible, DUPLICATE: s.duplicates,
    }
    return map[key as string] ?? 0
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">AI Bank Reconciliation</h2>
            {result && (
              <p className="text-xs text-slate-500">
                {result.qbFileName} vs {result.bankFileName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'results' && result && (
            <button
              onClick={() => exportCSV(result.results, result.qbFileName, result.bankFileName)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
          {view === 'results' && (
            <button
              onClick={() => { setView('setup'); setQbFile(null); setBankFile(null); setResult(null) }}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
            >
              New Check
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ── SETUP ── */}
      {view === 'setup' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            {runError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{runError}</p>
              </div>
            )}

            {/* How it works */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                Upload your <strong>QuickBooks export</strong> and your <strong>bank statement</strong> — the AI agent will compare every transaction and tell you exactly what matches, what's missing, and what needs attention.
              </p>
            </div>

            {/* Date range */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Step 1 · Date Range (optional)
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[{ label:'From', value:from, set:setFrom }, { label:'To', value:to, set:setTo }].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
                    <input type="date" value={f.value} onChange={e => f.set(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* File uploads */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Step 2 · Upload Files
              </p>

              <FileZone
                label="QuickBooks Export"
                hint="Export from QuickBooks → Reports → Transaction List (CSV or Excel)"
                accept=".csv,.xlsx,.xls"
                file={qbFile}
                onFile={setQbFile}
                icon={<FileText className="w-5 h-5 text-slate-400" />}
              />

              <FileZone
                label="Bank Statement"
                hint="CSV or Excel from your online banking portal · PDF also accepted"
                accept=".csv,.xlsx,.xls,.pdf"
                file={bankFile}
                onFile={setBankFile}
                icon={<Upload className="w-5 h-5 text-slate-400" />}
              />

              <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  Supported formats: CSV, Excel (.xlsx / .xls), PDF.
                  QuickBooks: go to Reports → Transaction List by Date → Export to Excel.
                </p>
              </div>
            </div>

            <button
              onClick={run}
              disabled={!qbFile || !bankFile}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Analyze with AI
            </button>
          </div>
        </div>
      )}

      {/* ── PROCESSING ── */}
      {view === 'processing' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-400" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">AI Agent Working</p>
              <p className="text-sm text-slate-500 mt-1">{procMsg}</p>
            </div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Comparing every transaction between your QuickBooks export and bank statement…
            </p>
          </div>
        </div>
      )}

      {/* ── RESULTS ── */}
      {view === 'results' && result && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Summary cards */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <SummaryCard label="Bank Txns"  value={result.summary.bankCount.toString()} accent="text-slate-900" />
              <SummaryCard label="QB Txns"    value={result.summary.qbCount.toString()}   accent="text-slate-900" />
              <SummaryCard label="Matched"    value={result.summary.matched.toString()}
                sub={`${result.summary.accuracy}% accuracy`} accent="text-emerald-600" />
              <SummaryCard label="Issues"     value={result.summary.unmatched.toString()}
                accent={result.summary.unmatched > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <SummaryCard label="Bank Total" value={fmtAmtAbs(result.summary.totalBankAmt)} accent="text-slate-900" />
              <SummaryCard label="Difference" value={fmtAmtAbs(result.summary.difference)}
                accent={result.summary.difference < 1 ? 'text-emerald-600' : 'text-red-600'}
                sub={result.summary.difference < 1 ? 'Balanced ✓' : 'QB vs Bank'} />
            </div>
          </div>

          {/* AI Analysis */}
          {result.analysis && (
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-6 py-4">
              <div className="flex items-start gap-3 max-w-4xl">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">AI Analysis</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{result.analysis}</p>
                </div>
              </div>
            </div>
          )}

          {/* Issue pills */}
          {result.summary.unmatched > 0 && (
            <div className="flex-shrink-0 bg-white border-b border-slate-100 px-6 py-2 flex flex-wrap gap-2">
              {result.summary.missingInQB   > 0 && <Pill label={`${result.summary.missingInQB} not in QB`}     color="bg-red-100 text-red-700"    />}
              {result.summary.missingInBank > 0 && <Pill label={`${result.summary.missingInBank} not in bank`} color="bg-blue-100 text-blue-700"   />}
              {result.summary.mismatch      > 0 && <Pill label={`${result.summary.mismatch} amount mismatch`}  color="bg-orange-100 text-orange-700"/>}
              {result.summary.possible      > 0 && <Pill label={`${result.summary.possible} possible match`}   color="bg-amber-100 text-amber-700"  />}
              {result.summary.duplicates    > 0 && <Pill label={`${result.summary.duplicates} duplicate`}      color="bg-purple-100 text-purple-700" />}
            </div>
          )}

          {/* Tabs */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 overflow-x-auto">
            <div className="flex gap-0.5 py-2 min-w-max">
              {TABS.map(tab => {
                const cnt = tabCount(tab.key)
                if (cnt === 0 && tab.key !== 'issues' && tab.key !== 'matched') return null
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
                      ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    {tab.label}
                    {cnt > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                        ${activeTab === tab.key ? 'bg-white/20 text-white'
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
                  <tr className="bg-slate-50 sticky top-0 z-10">
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-36 border-b border-slate-200">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">Bank Statement</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">QuickBooks</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200">AI Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((r, idx) => {
                    const s = STATUS[r.status]
                    return (
                      <tr key={r.id}
                        className={`border-b border-slate-100 transition-colors hover:bg-white ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
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
                          {r.qbTxn ? <TxnCell txn={r.qbTxn} /> : <span className="text-xs text-slate-300 italic">—</span>}
                        </td>
                        <td className="px-5 py-4 align-top text-xs text-slate-500 max-w-[200px]">
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
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
}
