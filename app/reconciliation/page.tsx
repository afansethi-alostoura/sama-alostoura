'use client'
import { useState, useCallback, useRef } from 'react'
import {
  Scale, Upload, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Copy, Check, Loader2, FileText,
  ArrowLeftRight, Info, Download,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankTxn {
  id:          string
  date:        string   // YYYY-MM-DD
  amount:      number   // positive = in, negative = out
  description: string
  reference:   string
  raw:         string   // original row for debugging
}

interface QBTxn {
  id:          string
  date:        string
  amount:      number
  description: string
  reference:   string
  txnType:     string
  name:        string
  memo:        string
}

interface Matched   { bank: BankTxn; qb: QBTxn; daysDiff: number }
interface Duplicate { amount: number; date: string; entries: QBTxn[] }

interface MatchResult {
  matched:           Matched[]
  missingInQB:       BankTxn[]
  extraInQB:         QBTxn[]
  duplicates:        Duplicate[]
  internalTransfers: BankTxn[]   // subset of missingInQB flagged as likely transfers
}

interface QBAccount { id: string; name: string; balance: number }

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function tokenizeCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQ = false
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      if (inQ && src[i + 1] === '"') { field += '"'; i++; continue }
      inQ = !inQ
    } else if (ch === ',' && !inQ) {
      row.push(field.trim()); field = ''
    } else if (ch === '\n' && !inQ) {
      row.push(field.trim()); rows.push(row); row = []; field = ''
    } else if (ch === '\n' && inQ) {
      field += ' '   // flatten embedded newlines in quoted fields
    } else {
      field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }
  return rows
}

function parseDateToISO(raw: string): string | null {
  if (!raw) return null
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // MM/DD/YYYY  — treat ambiguous as DD/MM if day > 12
  const mdy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdy && parseInt(mdy[1]) > 12)
    return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  // DD-MMM-YYYY  e.g. 15-Jan-2025
  const mon: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  }
  const dmonth = raw.match(/^(\d{1,2})[\/\- ]([A-Za-z]{3})[\/\- ](\d{4})$/)
  if (dmonth) {
    const m = mon[dmonth[2].toLowerCase()]
    if (m) return `${dmonth[3]}-${m}-${dmonth[1].padStart(2, '0')}`
  }
  return null
}

function parseBankCSV(text: string): BankTxn[] {
  const rows = tokenizeCSV(text)

  // Find header row — must contain 'date' and an amount-like column
  let headerIdx = -1
  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const j = rows[r].join(' ').toLowerCase()
    if ((j.includes('date') || j.includes('txn')) &&
        (j.includes('amount') || j.includes('debit') || j.includes('credit') ||
         j.includes('withdrawal') || j.includes('deposit'))) {
      headerIdx = r; break
    }
  }
  if (headerIdx === -1) throw new Error('Could not find header row. Expected columns: Date, Amount (or Withdrawal/Deposit).')

  const headers = rows[headerIdx].map(h => h.toLowerCase().replace(/\s+/g, ' ').trim())
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex(h => h === n || h.includes(n))
      if (i !== -1) return i
    }
    return -1
  }

  const dateCol = col('date', 'txn date', 'value date', 'posting date', 'transaction date')
  const descCol = col('description', 'narration', 'particulars', 'memo', 'payee', 'details')
  const refCol  = col('transaction id', 'reference', 'ref no', 'cheque', 'check number', 'num')
  const wdCol   = col('withdrawal', 'debit', 'dr', 'money out', 'debit amount')
  const depCol  = col('deposit', 'credit', 'cr', 'money in', 'credit amount')
  const amtCol  = col('amount', 'net amount')

  if (dateCol === -1) throw new Error('Could not find Date column in the uploaded file.')

  const parseNum = (s: string) => parseFloat((s ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0

  const results: BankTxn[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const c = rows[r]
    if (!c || c.length < 2) continue

    const dateRaw = (c[dateCol] ?? '').trim()
    if (!dateRaw || !/\d/.test(dateRaw)) continue

    const date = parseDateToISO(dateRaw)
    if (!date) continue

    let amount: number
    if (amtCol >= 0 && c[amtCol]) {
      amount = parseNum(c[amtCol])
    } else {
      const wd  = parseNum(wdCol  >= 0 ? c[wdCol]  ?? '' : '')
      const dep = parseNum(depCol >= 0 ? c[depCol] ?? '' : '')
      amount = dep > 0 ? dep : (wd > 0 ? -wd : 0)
    }
    if (amount === 0) continue

    const desc = (c[descCol] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
    const ref  = (c[refCol]  ?? '').trim().slice(0, 40)

    results.push({
      id:    `b${r}`,
      date,
      amount,
      description: desc,
      reference:   ref,
      raw:  c.join(','),
    })
  }

  if (results.length === 0)
    throw new Error('No transactions found in the file. Check the date and amount columns.')

  return results
}

// ─── Matching Engine ──────────────────────────────────────────────────────────

const TRANSFER_KEYWORDS = [
  'transfer', 'trf', 'aani', 'funds trf', 'internal', 'own account',
  'self transfer', 'between accounts',
]

function isTransfer(txn: BankTxn): boolean {
  const d = txn.description.toLowerCase()
  return TRANSFER_KEYWORDS.some(k => d.includes(k))
}

function daysDiff(a: string, b: string): number {
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.round((da - db) / 86400000)
}

function runMatching(bankTxns: BankTxn[], qbTxns: QBTxn[]): MatchResult {
  const usedQB    = new Set<string>()
  const matched:     Matched[]   = []
  const missingInQB: BankTxn[]   = []
  const internalTransfers: BankTxn[] = []

  for (const bank of bankTxns) {
    // Find QB txn with exact amount (within 0.01) and date within ±1 day
    let bestMatch: QBTxn | null = null
    let bestDiff  = 99

    for (const qb of qbTxns) {
      if (usedQB.has(qb.id)) continue
      if (Math.abs(bank.amount - qb.amount) > 0.01) continue
      const diff = Math.abs(daysDiff(bank.date, qb.date))
      if (diff <= 1 && diff < bestDiff) {
        bestMatch = qb
        bestDiff  = diff
      }
    }

    if (bestMatch) {
      matched.push({ bank, qb: bestMatch, daysDiff: daysDiff(bank.date, bestMatch.date) })
      usedQB.add(bestMatch.id)
    } else {
      missingInQB.push(bank)
      if (isTransfer(bank)) internalTransfers.push(bank)
    }
  }

  // QB transactions with no bank counterpart
  const extraInQB = qbTxns.filter(q => !usedQB.has(q.id))

  // Duplicate detection: QB entries with same absolute amount on same date
  const dupeMap = new Map<string, QBTxn[]>()
  for (const qb of qbTxns) {
    const key = `${qb.date}_${Math.abs(qb.amount).toFixed(2)}`
    const arr = dupeMap.get(key) ?? []
    arr.push(qb)
    dupeMap.set(key, arr)
  }
  const duplicates: Duplicate[] = []
  for (const [key, entries] of dupeMap) {
    if (entries.length > 1) {
      const [date] = key.split('_')
      duplicates.push({ date, amount: Math.abs(entries[0].amount), entries })
    }
  }

  return { matched, missingInQB, extraInQB, duplicates, internalTransfers }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${Math.abs(n).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' })
}

function getDefaultDates() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  const from = `${y}-${String(m).padStart(2,'0')}-01`
  const last = new Date(y, m, 0).getDate()
  const to   = `${y}-${String(m).padStart(2,'0')}-${last}`
  return { from, to }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} title="Copy details"
      className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function MissingRow({ txn, isTransfer }: { txn: BankTxn; isTransfer: boolean }) {
  const [open, setOpen] = useState(false)
  const details = [
    `Date:        ${fmtDate(txn.date)}`,
    `Amount:      ${fmtAmt(txn.amount)}`,
    `Description: ${txn.description || '—'}`,
    `Reference:   ${txn.reference || '—'}`,
  ].join('\n')

  return (
    <>
      <tr
        className={`border-b border-red-100 cursor-pointer hover:bg-red-50 transition-colors ${isTransfer ? 'bg-amber-50/60' : 'bg-red-50/40'}`}
        onClick={() => setOpen(v => !v)}
      >
        <td className="py-2.5 px-3 text-slate-600 text-sm whitespace-nowrap">{fmtDate(txn.date)}</td>
        <td className={`py-2.5 px-3 font-mono text-sm font-semibold whitespace-nowrap ${txn.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {fmtAmt(txn.amount)}
        </td>
        <td className="py-2.5 px-3 text-slate-700 text-sm max-w-xs truncate">{txn.description || '—'}</td>
        <td className="py-2.5 px-3 text-slate-500 text-xs font-mono">{txn.reference || '—'}</td>
        <td className="py-2.5 px-3 text-center">
          {isTransfer
            ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Transfer?</span>
            : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Missing</span>
          }
        </td>
        <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            <CopyBtn text={details} />
            <button onClick={() => setOpen(v => !v)}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors">
              {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-white border-b border-red-100">
          <td colSpan={6} className="px-4 py-3">
            <div className="bg-slate-50 rounded-lg p-4 text-sm">
              <p className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Quick-View — enter this in QuickBooks:
              </p>
              <pre className="text-slate-600 font-mono text-xs leading-relaxed whitespace-pre">{details}</pre>
              {isTransfer && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                  This may be an internal transfer between your accounts — verify before recording as an expense.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function FileZone({ label, file, onFile }: {
  label: string
  file: File | null
  onFile: (f: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  return (
    <div
      className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all"
      style={{ borderColor: file ? '#10b981' : '#cbd5e1' }}
      onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <input ref={ref} type="file" className="hidden"
        accept=".csv,.xlsx,.xls"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-emerald-700">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
        </div>
      ) : (
        <>
          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">CSV or Excel · drag & drop or click</p>
        </>
      )}
    </div>
  )
}

// ─── Export helper ────────────────────────────────────────────────────────────

function exportCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const def = getDefaultDates()

  // Setup state
  const [accounts,    setAccounts]   = useState<QBAccount[]>([])
  const [acctId,      setAcctId]     = useState('')
  const [from,        setFrom]       = useState(def.from)
  const [to,          setTo]         = useState(def.to)
  const [bankFile,    setBankFile]   = useState<File | null>(null)
  const [loadingAcct, setLoadingAcct] = useState(false)
  const [acctError,   setAcctError]  = useState('')

  // Processing state
  const [phase,  setPhase]  = useState<'setup' | 'loading' | 'done' | 'error'>('setup')
  const [status, setStatus] = useState('')
  const [errMsg, setErrMsg] = useState('')

  // Results
  const [result, setResult] = useState<MatchResult | null>(null)
  const [bankTxns, setBankTxns] = useState<BankTxn[]>([])
  const [qbTxns,   setQBTxns]  = useState<QBTxn[]>([])
  const [tab, setTab] = useState<'missing' | 'matched' | 'extra' | 'duplicates'>('missing')

  async function loadAccounts() {
    setLoadingAcct(true)
    setAcctError('')
    try {
      const r = await fetch('/api/reconcile/accounts')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed to load accounts')
      setAccounts(d.accounts ?? [])
      if (d.accounts?.length > 0 && !acctId) setAcctId(d.accounts[0].id)
    } catch (e) {
      setAcctError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoadingAcct(false)
    }
  }

  async function convertXLSX(file: File): Promise<File> {
    const buffer = await file.arrayBuffer()
    const XLSX   = await import('xlsx')
    const wb     = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
    const csv    = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
    return new File([csv], file.name.replace(/\.xlsx?$/i, '.csv'), { type: 'text/csv' })
  }

  async function run() {
    if (!acctId)    return setErrMsg('Please select a QuickBooks account.')
    if (!bankFile)  return setErrMsg('Please upload a bank statement file.')
    if (!from || !to) return setErrMsg('Please set the date range.')

    setPhase('loading'); setErrMsg(''); setResult(null)

    try {
      // Step 1: parse bank file
      setStatus('Parsing bank statement…')
      let csvFile = bankFile
      const ext = bankFile.name.toLowerCase().split('.').pop() ?? ''
      if (ext === 'xlsx' || ext === 'xls') {
        setStatus('Converting Excel to CSV…')
        csvFile = await convertXLSX(bankFile)
      }
      const bankText = await csvFile.text()
      const bank = parseBankCSV(bankText)
      setBankTxns(bank)

      // Step 2: fetch QB GL
      setStatus(`Fetching QuickBooks transactions (${from} → ${to})…`)
      const qbRes  = await fetch(`/api/reconciliation/transactions?accountId=${acctId}&from=${from}&to=${to}`)
      const qbData = await qbRes.json()
      if (!qbRes.ok) {
        if (qbData.requiresReconnect) {
          throw new Error('QB_RECONNECT')
        }
        throw new Error(qbData.error ?? 'Failed to fetch QB transactions')
      }
      const qb: QBTxn[] = qbData.transactions ?? []
      setQBTxns(qb)

      // Step 3: run matching
      setStatus('Running reconciliation engine…')
      const res = runMatching(bank, qb)
      setResult(res)

      // Default to the most important tab
      setTab(res.missingInQB.length > 0 ? 'missing' : 'matched')
      setPhase('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reconciliation failed'
      if (msg === 'QB_RECONNECT') {
        setErrMsg('QuickBooks session expired. Please reconnect in Settings.')
      } else {
        setErrMsg(msg)
      }
      setPhase('error')
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────────

  function exportMissing() {
    if (!result) return
    const rows = [
      ['Date', 'Amount', 'Description', 'Reference', 'Status'],
      ...result.missingInQB.map(t => [
        t.date,
        t.amount.toFixed(2),
        t.description,
        t.reference,
        result.internalTransfers.includes(t) ? 'Possible Transfer' : 'Missing in QB',
      ]),
    ]
    exportCSV(rows, `missing_in_qb_${from}_${to}.csv`)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const acctName = accounts.find(a => a.id === acctId)?.name ?? ''

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Reconciliation Dashboard</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">
            Compare your bank statement against QuickBooks — find missing entries, duplicates, and discrepancies.
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm uppercase tracking-wide">Setup</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left: QB Account + Date Range */}
            <div className="space-y-4">
              {/* Account */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  QuickBooks Bank Account
                </label>
                <div className="flex gap-2">
                  <select
                    value={acctId}
                    onChange={e => setAcctId(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {accounts.length === 0
                      ? <option value="">— load accounts first —</option>
                      : accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))
                    }
                  </select>
                  <button
                    onClick={loadAccounts}
                    disabled={loadingAcct}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {loadingAcct
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RefreshCw className="w-4 h-4" />
                    }
                    {accounts.length === 0 ? 'Load' : 'Reload'}
                  </button>
                </div>
                {acctError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />{acctError}
                    {acctError.includes('not connected') && (
                      <a href="/settings" className="underline ml-1">Go to Settings</a>
                    )}
                  </p>
                )}
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-sm">→</span>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Right: File Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Bank Statement
              </label>
              <FileZone
                label="Upload Bank Statement (CSV or Excel)"
                file={bankFile}
                onFile={setBankFile}
              />
              <p className="text-xs text-slate-400 mt-1.5 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Supports RAK Bank CSV, any bank export with Date and Amount columns.
              </p>
            </div>
          </div>

          {/* Error */}
          {errMsg && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errMsg}</span>
              {errMsg.includes('Settings') && (
                <a href="/settings" className="ml-auto flex-shrink-0 underline">Open Settings</a>
              )}
            </div>
          )}

          {/* Run Button */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={run}
              disabled={phase === 'loading'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {phase === 'loading'
                ? <><Loader2 className="w-4 h-4 animate-spin" />{status}</>
                : <><ArrowLeftRight className="w-4 h-4" />Run Reconciliation</>
              }
            </button>
            {phase === 'done' && result && (
              <span className="text-xs text-slate-500">
                Last run: {acctName} · {from} → {to} · {bankTxns.length} bank txns · {qbTxns.length} QB txns
              </span>
            )}
          </div>
        </div>

        {/* Results */}
        {phase === 'done' && result && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                {
                  label: 'Matched',
                  value: result.matched.length,
                  color: 'emerald',
                  icon: <CheckCircle2 className="w-5 h-5" />,
                },
                {
                  label: 'Missing in QB',
                  value: result.missingInQB.length,
                  color: 'red',
                  icon: <XCircle className="w-5 h-5" />,
                },
                {
                  label: 'Extra in QB',
                  value: result.extraInQB.length,
                  color: 'amber',
                  icon: <AlertTriangle className="w-5 h-5" />,
                },
                {
                  label: 'Duplicates',
                  value: result.duplicates.length,
                  color: 'purple',
                  icon: <Copy className="w-5 h-5" />,
                },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className={`bg-white border rounded-xl p-4 shadow-sm border-slate-100`}>
                  <div className={`text-${color}-600 mb-1`}>{icon}</div>
                  <p className={`text-2xl font-bold text-${color}-700`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100 overflow-x-auto">
                {([
                  { key: 'missing',    label: `⚠️ Missing in QB (${result.missingInQB.length})`,  active: result.missingInQB.length > 0 },
                  { key: 'matched',    label: `✓ Matched (${result.matched.length})`,              active: true },
                  { key: 'extra',      label: `+ Extra in QB (${result.extraInQB.length})`,        active: true },
                  { key: 'duplicates', label: `⚡ Duplicates (${result.duplicates.length})`,       active: result.duplicates.length > 0 },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      tab === key
                        ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}

                {/* Export button */}
                {tab === 'missing' && result.missingInQB.length > 0 && (
                  <button
                    onClick={exportMissing}
                    className="ml-auto mr-3 my-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}
              </div>

              {/* Tab content */}
              <div className="overflow-x-auto">

                {/* MISSING IN QB */}
                {tab === 'missing' && (
                  result.missingInQB.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                      <p className="font-medium text-emerald-700">All bank transactions are recorded in QuickBooks!</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-red-50/60">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Quick-View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.missingInQB.map(txn => (
                          <MissingRow
                            key={txn.id}
                            txn={txn}
                            isTransfer={result.internalTransfers.includes(txn)}
                          />
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {/* MATCHED */}
                {tab === 'matched' && (
                  result.matched.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <p>No matched transactions found.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-emerald-50/60">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Type</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Description</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">±Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.matched.map(({ bank, qb, daysDiff: dd }, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-emerald-50/20 transition-colors">
                            <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(bank.date)}</td>
                            <td className={`py-2.5 px-3 font-mono text-sm font-semibold whitespace-nowrap ${bank.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {fmtAmt(bank.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 text-sm max-w-[180px] truncate">{bank.description || '—'}</td>
                            <td className="py-2.5 px-3 text-sm text-slate-500 whitespace-nowrap">{fmtDate(qb.date)}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{qb.txnType || '—'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 text-sm max-w-[180px] truncate">{qb.description || '—'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                                Math.abs(dd) === 0 ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {dd === 0 ? '0' : (dd > 0 ? `+${dd}` : dd)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {/* EXTRA IN QB */}
                {tab === 'extra' && (
                  result.extraInQB.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                      <p className="font-medium text-emerald-700">No extra transactions found in QuickBooks.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-amber-50/60">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.extraInQB.map((qb, i) => (
                          <tr key={i} className="border-b border-amber-50 hover:bg-amber-50/40 transition-colors">
                            <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(qb.date)}</td>
                            <td className={`py-2.5 px-3 font-mono text-sm font-semibold whitespace-nowrap ${qb.amount >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {fmtAmt(qb.amount)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{qb.txnType || '—'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 text-sm max-w-xs truncate">{qb.description || '—'}</td>
                            <td className="py-2.5 px-3 text-slate-500 text-xs font-mono">{qb.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {/* DUPLICATES */}
                {tab === 'duplicates' && (
                  result.duplicates.length === 0 ? (
                    <div className="py-16 text-center text-slate-400">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                      <p className="font-medium text-emerald-700">No duplicate transactions detected.</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {result.duplicates.map((dup, i) => (
                        <div key={i} className="border border-purple-100 rounded-xl overflow-hidden">
                          <div className="bg-purple-50 px-4 py-3 flex items-center gap-3">
                            <Copy className="w-4 h-4 text-purple-500" />
                            <span className="font-semibold text-purple-800 text-sm">
                              {fmtDate(dup.date)} · {fmtAmt(dup.amount)} · {dup.entries.length} entries
                            </span>
                          </div>
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-purple-50 bg-white">
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Description</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Reference</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dup.entries.map((e, j) => (
                                <tr key={j} className="border-b border-purple-50">
                                  <td className="px-4 py-2"><span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{e.txnType || '—'}</span></td>
                                  <td className="px-4 py-2 text-sm text-slate-700">{e.description || '—'}</td>
                                  <td className="px-4 py-2 text-xs text-slate-500 font-mono">{e.reference || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {phase === 'setup' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="font-medium text-slate-600 mb-1">Ready to reconcile</p>
            <p className="text-sm">Select a QB account, date range, upload your bank statement, then click Run.</p>
          </div>
        )}
      </div>
    </div>
  )
}
