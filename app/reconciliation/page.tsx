'use client'
import { useState, useCallback, useRef } from 'react'
import {
  Scale, Upload, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Copy, Check, Loader2, FileText,
  ArrowLeftRight, Info, Download, Tag, Search,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BankTxn {
  id:          string
  date:        string   // YYYY-MM-DD
  amount:      number   // positive = in, negative = out
  description: string
  reference:   string
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
  split:       string   // Chart of Accounts category (the contra-account)
  accountName: string   // which QB account the txn is posted to (populated in global mode)
}

// Status for each bank row
type TxnStatus = 'found' | 'uncategorized' | 'missing' | 'transfer'

interface TxnRow {
  bank:            BankTxn
  qb:              QBTxn | null
  status:          TxnStatus
  accountLocation: string   // qb.split or empty
  daysDiff:        number   // 0 if missing
}

interface Duplicate { date: string; amount: number; entries: QBTxn[] }

interface MatchResult {
  rows:        TxnRow[]      // every bank txn — the primary view
  extraInQB:   QBTxn[]       // QB txns with no bank counterpart
  duplicates:  Duplicate[]   // QB txns with same date+|amount|
}

interface QBAccount { id: string; name: string; type: string; subtype: string; balance: number }

// ─── Categorisation helpers ───────────────────────────────────────────────────

const UNCATEGORIZED_KEYWORDS = [
  'uncategorized', 'ask my accountant', 'unassigned', 'miscellaneous expense',
  'miscellaneous income', 'opening balance equity',
]
const TRANSFER_KEYWORDS = [
  'transfer', 'trf', 'aani', 'funds trf', 'internal', 'own account', 'self transfer',
]

function assessStatus(qb: QBTxn | null, bank: BankTxn): TxnStatus {
  if (!qb) {
    return TRANSFER_KEYWORDS.some(k => bank.description.toLowerCase().includes(k))
      ? 'transfer'
      : 'missing'
  }
  const split = (qb.split ?? '').toLowerCase()
  if (!split || UNCATEGORIZED_KEYWORDS.some(k => split.includes(k))) return 'uncategorized'
  return 'found'
}

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
      field += ' '
    } else {
      field += ch
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }
  return rows
}

function parseDateToISO(raw: string): string | null {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  const mon: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  }
  const dmonth = raw.match(/^(\d{1,2})[\/\- ]([A-Za-z]{3})[\/\- ](\d{4})$/)
  if (dmonth) {
    const m = mon[dmonth[2].toLowerCase()]
    if (m) return `${dmonth[3]}-${m}-${dmonth[1].padStart(2,'0')}`
  }
  return null
}

function parseBankCSV(text: string): BankTxn[] {
  const rows = tokenizeCSV(text)
  let headerIdx = -1
  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const j = rows[r].join(' ').toLowerCase()
    if ((j.includes('date') || j.includes('txn')) &&
        (j.includes('amount') || j.includes('debit') || j.includes('credit') ||
         j.includes('withdrawal') || j.includes('deposit'))) {
      headerIdx = r; break
    }
  }
  if (headerIdx === -1)
    throw new Error('Could not find header row. Expected columns: Date, Amount (or Withdrawal/Deposit).')

  const headers = rows[headerIdx].map(h => h.toLowerCase().replace(/\s+/g,' ').trim())
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex(h => h === n || h.includes(n))
      if (i !== -1) return i
    }
    return -1
  }

  const dateCol = col('date','txn date','value date','posting date','transaction date')
  const descCol = col('description','narration','particulars','memo','payee','details')
  const refCol  = col('transaction id','reference','ref no','cheque','check number','num')
  const wdCol   = col('withdrawal','debit','dr','money out','debit amount')
  const depCol  = col('deposit','credit','cr','money in','credit amount')
  const amtCol  = col('amount','net amount')

  if (dateCol === -1) throw new Error('Could not find Date column in the uploaded file.')

  const parseNum = (s: string) => parseFloat((s ?? '').replace(/,/g,'').replace(/[^\d.-]/g,'')) || 0

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

    results.push({
      id:    `b${r}`,
      date,
      amount,
      description: (c[descCol] ?? '').replace(/\s+/g,' ').trim().slice(0,120),
      reference:   (c[refCol]  ?? '').trim().slice(0,40),
    })
  }
  if (results.length === 0)
    throw new Error('No transactions found. Check the date and amount columns.')
  return results
}

// ─── Matching Engine ──────────────────────────────────────────────────────────

function daysDiff(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

function runMatching(bankTxns: BankTxn[], qbTxns: QBTxn[]): MatchResult {
  const usedQB = new Set<string>()
  const rows:  TxnRow[] = []

  for (const bank of bankTxns) {
    let bestQB: QBTxn | null = null
    let bestDiff = 99
    for (const qb of qbTxns) {
      if (usedQB.has(qb.id)) continue
      if (Math.abs(bank.amount - qb.amount) > 0.01) continue
      const diff = Math.abs(daysDiff(bank.date, qb.date))
      if (diff <= 1 && diff < bestDiff) { bestQB = qb; bestDiff = diff }
    }
    if (bestQB) usedQB.add(bestQB.id)

    const status = assessStatus(bestQB, bank)
    rows.push({
      bank,
      qb:              bestQB,
      status,
      accountLocation: bestQB?.split ?? '',
      daysDiff:        bestQB ? daysDiff(bank.date, bestQB.date) : 0,
    })
  }

  const extraInQB = qbTxns.filter(q => !usedQB.has(q.id))

  const dupeMap = new Map<string, QBTxn[]>()
  for (const qb of qbTxns) {
    const key = `${qb.date}_${Math.abs(qb.amount).toFixed(2)}`
    const arr = dupeMap.get(key) ?? []; arr.push(qb); dupeMap.set(key, arr)
  }
  const duplicates: Duplicate[] = []
  for (const [key, entries] of dupeMap) {
    if (entries.length > 1) {
      const [date] = key.split('_')
      duplicates.push({ date, amount: Math.abs(entries[0].amount), entries })
    }
  }

  return { rows, extraInQB, duplicates }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  return `${n < 0 ? '-' : '+'}${Math.abs(n).toLocaleString('en-AE',{ minimumFractionDigits:2, maximumFractionDigits:2 })} AED`
}
function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AE',{ day:'2-digit', month:'short', year:'numeric' })
}
function getDefaultDates() {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1
  const from = `${y}-${String(m).padStart(2,'0')}-01`
  const last = new Date(y, m, 0).getDate()
  const to   = `${y}-${String(m).padStart(2,'0')}-${last}`
  return { from, to }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TxnStatus }) {
  const cfg = {
    found:          { cls: 'bg-emerald-100 text-emerald-800', label: '✓ Recorded' },
    uncategorized:  { cls: 'bg-amber-100  text-amber-800',   label: '⚠ Check Category' },
    missing:        { cls: 'bg-red-100    text-red-800',     label: '✗ Missing' },
    transfer:       { cls: 'bg-blue-100   text-blue-800',    label: '↔ Transfer?' },
  }[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Account Location cell ────────────────────────────────────────────────────

function LocationCell({
  location, status, accountName,
}: { location: string; status: TxnStatus; accountName?: string }) {
  if (status === 'missing' || status === 'transfer') {
    return <span className="text-xs font-bold text-red-500 tracking-wide">MISSING</span>
  }
  if (!location && !accountName) {
    return <span className="text-xs text-slate-400 italic">—</span>
  }
  const isUncategorized = location
    ? UNCATEGORIZED_KEYWORDS.some(k => location.toLowerCase().includes(k))
    : false
  return (
    <div className="space-y-0.5">
      {/* In global-search mode show which QB account the txn is posted to */}
      {accountName && (
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <span className="font-medium text-slate-500">In:</span> {accountName}
        </div>
      )}
      {location && (
        <span className={`text-sm flex items-center gap-1 ${isUncategorized ? 'text-amber-700 font-medium' : 'text-slate-700'}`}>
          <Tag className="w-3 h-3 flex-shrink-0 opacity-60" />
          {location}
          {isUncategorized && <span className="ml-1 text-xs text-amber-500">(needs review)</span>}
        </span>
      )}
    </div>
  )
}

// ─── Expandable transaction row ───────────────────────────────────────────────

function TxnTableRow({ row, idx }: { row: TxnRow; idx: number }) {
  const [open, setOpen] = useState(false)
  const { bank, qb, status, accountLocation, daysDiff: dd } = row
  const canExpand = !!qb

  const rowBg =
    status === 'missing'       ? 'bg-red-50/50 hover:bg-red-50'
    : status === 'transfer'    ? 'bg-blue-50/30 hover:bg-blue-50/60'
    : status === 'uncategorized'? 'bg-amber-50/40 hover:bg-amber-50'
    : idx % 2 === 0            ? 'bg-white hover:bg-slate-50'
    : 'bg-slate-50/50 hover:bg-slate-50'

  return (
    <>
      <tr
        className={`border-b border-slate-100 transition-colors ${rowBg} ${canExpand ? 'cursor-pointer' : ''}`}
        onClick={() => canExpand && setOpen(v => !v)}
      >
        {/* Date */}
        <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(bank.date)}</td>

        {/* Amount */}
        <td className={`py-2.5 px-3 font-mono text-sm font-semibold whitespace-nowrap ${bank.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {fmtAmt(bank.amount)}
        </td>

        {/* Bank description */}
        <td className="py-2.5 px-3 text-slate-700 text-sm max-w-[180px]">
          <div className="truncate">{bank.description || '—'}</div>
          {bank.reference && <div className="text-xs text-slate-400 font-mono truncate">{bank.reference}</div>}
        </td>

        {/* QB Status */}
        <td className="py-2.5 px-3"><StatusBadge status={status} /></td>

        {/* Account Location */}
        <td className="py-2.5 px-3 max-w-[220px]">
          <LocationCell location={accountLocation} status={status} accountName={qb?.accountName} />
        </td>

        {/* QB Type */}
        <td className="py-2.5 px-3">
          {qb
            ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{qb.txnType || '—'}</span>
            : <span className="text-xs text-slate-300">—</span>
          }
        </td>

        {/* Expand toggle */}
        <td className="py-2.5 px-3 text-center w-8">
          {canExpand && (
            <span className="text-slate-400">
              {open ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" />}
            </span>
          )}
        </td>
      </tr>

      {/* Expanded QB detail panel */}
      {open && qb && (
        <tr className="border-b border-slate-100">
          <td colSpan={7} className="px-4 pb-3 pt-0">
            <div className="ml-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> QuickBooks Detail
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  { label: 'QB Date',           value: fmtDate(qb.date),  highlight: Math.abs(dd) > 0 },
                  { label: 'Type',              value: qb.txnType || '—' },
                  { label: 'Vendor / Customer', value: qb.name    || '—' },
                  { label: 'Memo',              value: qb.memo    || '—' },
                  { label: 'Reference / TxnID', value: qb.reference || '—' },
                  ...(qb.accountName ? [{
                    label:   'QB Account (Posted to)',
                    value:   qb.accountName,
                    isAcct:  true,
                  }] : []),
                  {
                    label: 'Account Category',
                    value:  qb.split || '—',
                    warn:   UNCATEGORIZED_KEYWORDS.some(k => (qb.split ?? '').toLowerCase().includes(k)),
                  },
                ] as Array<{ label: string; value: string; highlight?: boolean; warn?: boolean; isAcct?: boolean }>)
                  .map(({ label, value, highlight, warn, isAcct }) => (
                    <div key={label} className={`rounded-lg px-3 py-2 ${
                      warn   ? 'bg-amber-50 border border-amber-200'
                      : isAcct ? 'bg-blue-50 border border-blue-200'
                      : 'bg-slate-50'
                    }`}>
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className={`text-sm font-medium ${
                        warn   ? 'text-amber-800'
                        : isAcct ? 'text-blue-800'
                        : highlight ? 'text-blue-700'
                        : 'text-slate-800'
                      }`}>
                        {value}
                        {warn      && <span className="ml-1.5 text-xs font-normal text-amber-600">← needs recategorization</span>}
                        {highlight && <span className="ml-1.5 text-xs font-normal text-blue-500">(±{Math.abs(dd)} day)</span>}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).catch(()=>{}); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
      title="Copy" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ─── File zone ────────────────────────────────────────────────────────────────

function FileZone({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f)
  }, [onFile])

  return (
    <div className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all"
      style={{ borderColor: file ? '#10b981' : '#cbd5e1' }}
      onClick={() => ref.current?.click()} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <input ref={ref} type="file" className="hidden" accept=".csv,.xlsx,.xls"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      {file
        ? <div className="flex items-center justify-center gap-2 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium truncate max-w-[220px]">{file.name}</span>
          </div>
        : <>
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">CSV or Excel · drag & drop or click</p>
          </>
      }
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(data: string[][], filename: string) {
  const csv  = data.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Account grouping for dropdown ───────────────────────────────────────────

function groupAccounts(accounts: QBAccount[]): Record<string, QBAccount[]> {
  const groups: Record<string, QBAccount[]> = {}
  for (const a of accounts) {
    const g = groups[a.type] ?? []; g.push(a); groups[a.type] = g
  }
  return groups
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'missing' | 'extra' | 'duplicates'

export default function ReconciliationPage() {
  const def = getDefaultDates()

  // Setup
  const [accounts,     setAccounts]    = useState<QBAccount[]>([])
  const [acctId,       setAcctId]      = useState('__ALL__')   // default = global search
  const [from,         setFrom]        = useState(def.from)
  const [to,           setTo]          = useState(def.to)
  const [bankFile,     setBankFile]    = useState<File | null>(null)
  const [loadingAcct,  setLoadingAcct] = useState(false)
  const [acctError,    setAcctError]   = useState('')
  const [search,       setSearch]      = useState('')

  // Run
  const [phase,  setPhase]  = useState<'setup' | 'loading' | 'done' | 'error'>('setup')
  const [status, setStatus] = useState('')
  const [errMsg, setErrMsg] = useState('')

  // Results
  const [result,         setResult]         = useState<MatchResult | null>(null)
  const [bankTxns,       setBankTxns]       = useState<BankTxn[]>([])
  const [qbTxns,         setQBTxns]         = useState<QBTxn[]>([])
  const [tab,            setTab]            = useState<TabKey>('all')
  const [isGlobalSearch, setIsGlobalSearch] = useState(false)

  // ── Load QB accounts ──────────────────────────────────────────────────────

  async function loadAccounts() {
    setLoadingAcct(true); setAcctError('')
    try {
      const r = await fetch('/api/reconcile/accounts')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Failed to load accounts')
      setAccounts(d.accounts ?? [])
      // Do NOT auto-select — keep __ALL__ as the default so global search is always available
    } catch (e) {
      setAcctError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoadingAcct(false)
    }
  }

  // ── Run reconciliation ────────────────────────────────────────────────────

  async function run() {
    if (!acctId)      { setErrMsg('Please select an account (or keep All Accounts).'); return }
    if (!bankFile)    { setErrMsg('Please upload a bank statement.'); return }
    if (!from || !to) { setErrMsg('Please set the date range.'); return }

    const globalMode = acctId === '__ALL__'
    setPhase('loading'); setErrMsg(''); setResult(null); setSearch('')

    try {
      // Step 1: parse bank file
      setStatus('Parsing bank statement…')
      let csvFile = bankFile
      const ext = bankFile.name.toLowerCase().split('.').pop() ?? ''
      if (ext === 'xlsx' || ext === 'xls') {
        setStatus('Converting Excel to CSV…')
        const buffer = await bankFile.arrayBuffer()
        const XLSX   = await import('xlsx')
        const wb     = XLSX.read(new Uint8Array(buffer), { type:'array', cellDates:true })
        const csv    = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
        csvFile = new File([csv], bankFile.name.replace(/\.xlsx?$/i,'.csv'), { type:'text/csv' })
      }
      const bank = parseBankCSV(await csvFile.text())
      setBankTxns(bank)

      // Step 2: fetch QB transactions
      if (globalMode) {
        setStatus(`Scanning entire QuickBooks ledger (${from} → ${to})…`)
      } else {
        const name = accounts.find(a => a.id === acctId)?.name ?? acctId
        setStatus(`Fetching QuickBooks GL for "${name}" (${from} → ${to})…`)
      }
      const qbRes  = await fetch(`/api/reconciliation/transactions?accountId=${acctId}&from=${from}&to=${to}`)
      const qbData = await qbRes.json()
      if (!qbRes.ok) {
        if (qbData.requiresReconnect) throw new Error('QB_RECONNECT')
        throw new Error(qbData.error ?? 'Failed to fetch QB transactions')
      }
      const qb: QBTxn[] = qbData.transactions ?? []
      setQBTxns(qb)
      setIsGlobalSearch(qbData.isGlobalSearch ?? false)

      // Step 3: match
      setStatus('Running reconciliation…')
      const res = runMatching(bank, qb)
      setResult(res)
      setTab('all')
      setPhase('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reconciliation failed'
      setErrMsg(msg === 'QB_RECONNECT'
        ? 'QuickBooks session expired. Please reconnect in Settings.'
        : msg)
      setPhase('error')
    }
  }

  // ── Derived counts ────────────────────────────────────────────────────────

  const counts = result ? {
    found:         result.rows.filter(r => r.status === 'found').length,
    uncategorized: result.rows.filter(r => r.status === 'uncategorized').length,
    missing:       result.rows.filter(r => r.status === 'missing').length,
    transfer:      result.rows.filter(r => r.status === 'transfer').length,
    extra:         result.extraInQB.length,
    duplicates:    result.duplicates.length,
  } : null

  // ── Filtered rows for "All" tab ───────────────────────────────────────────

  const filteredRows = result
    ? result.rows.filter(r => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
          r.bank.description.toLowerCase().includes(q) ||
          r.bank.reference.toLowerCase().includes(q) ||
          r.accountLocation.toLowerCase().includes(q) ||
          (r.qb?.name ?? '').toLowerCase().includes(q) ||
          (r.qb?.txnType ?? '').toLowerCase().includes(q) ||
          (r.qb?.accountName ?? '').toLowerCase().includes(q)
        )
      })
    : []

  // ── Export ────────────────────────────────────────────────────────────────

  function doExport() {
    if (!result) return
    const rows = [
      ['Bank Date','Bank Amount','Bank Description','Reference','QB Status','QB Account','Account Category','QB Type','QB Date','QB Vendor','QB Memo'],
      ...result.rows.map(r => [
        r.bank.date,
        r.bank.amount.toFixed(2),
        r.bank.description,
        r.bank.reference,
        r.status,
        r.qb?.accountName ?? (r.status === 'missing' ? 'MISSING' : ''),
        r.accountLocation  || (r.status === 'missing' ? 'MISSING' : ''),
        r.qb?.txnType ?? '',
        r.qb?.date ?? '',
        r.qb?.name ?? '',
        r.qb?.memo ?? '',
      ]),
    ]
    exportCSV(rows, `reconciliation_${from}_${to}.csv`)
  }

  const acctName = acctId === '__ALL__'
    ? 'All Accounts (Global Search)'
    : (accounts.find(a => a.id === acctId)?.name ?? '')

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Reconciliation Dashboard</h1>
            </div>
            <p className="text-slate-500 text-sm ml-12">
              For every bank transaction — see its status and exactly where it sits in your Chart of Accounts.
            </p>
          </div>
        </div>

        {/* Setup card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-700 text-xs uppercase tracking-wide mb-4">Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left: account + dates */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Chart of Accounts — Select Account
                </label>
                <div className="flex gap-2">
                  <select value={acctId} onChange={e => setAcctId(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0">
                    {/* Global search always available at top */}
                    <option value="__ALL__">🔍 All Accounts — Global Search</option>
                    {accounts.length > 0 && <option disabled value="">──────────────────────</option>}
                    {Object.entries(groupAccounts(accounts)).map(([type, accts]) => (
                      <optgroup key={type} label={type}>
                        {accts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                            {a.balance !== 0 ? ` (${a.balance.toLocaleString('en-AE',{minimumFractionDigits:2})} AED)` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={loadAccounts} disabled={loadingAcct}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex-shrink-0">
                    {loadingAcct ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {accounts.length === 0 ? 'Load Accounts' : 'Reload'}
                  </button>
                </div>
                {acctError && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />{acctError}
                    {acctError.includes('not connected') && <a href="/settings" className="underline ml-1">Settings</a>}
                  </p>
                )}
                {/* Global search info banner */}
                {acctId === '__ALL__' && (
                  <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
                    <Search className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Global Search mode</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        Searches your entire QuickBooks ledger — every transaction type, every account.
                        The <strong>Account Location</strong> column will show which QB account each bank
                        transaction was recorded in, helping you find entries posted to the wrong place.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date Range</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-slate-400 text-sm flex-shrink-0">→</span>
                  <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Right: file upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Bank Statement</label>
              <FileZone label="Upload Bank Statement (CSV or Excel)" file={bankFile} onFile={setBankFile} />
              <p className="text-xs text-slate-400 mt-1.5 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                Supports RAK Bank CSV export and any bank file with Date + Amount columns.
              </p>
            </div>
          </div>

          {errMsg && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errMsg}</span>
              {errMsg.includes('Settings') && <a href="/settings" className="ml-auto underline flex-shrink-0">Open Settings</a>}
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button onClick={run} disabled={phase === 'loading'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {phase === 'loading'
                ? <><Loader2 className="w-4 h-4 animate-spin" />{status}</>
                : <><ArrowLeftRight className="w-4 h-4" />Run Reconciliation</>}
            </button>
            {phase === 'done' && result && (
              <span className="text-xs text-slate-400">
                {acctName} · {from} → {to} · {bankTxns.length} bank txns · {qbTxns.length} QB txns
              </span>
            )}
          </div>
        </div>

        {/* Results */}
        {phase === 'done' && result && counts && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              {[
                { label: 'Recorded',       value: counts.found,         color: 'emerald', dot: 'bg-emerald-500' },
                { label: 'Check Category', value: counts.uncategorized, color: 'amber',   dot: 'bg-amber-500'  },
                { label: 'Missing in QB',  value: counts.missing,       color: 'red',     dot: 'bg-red-500'    },
                { label: 'Transfer?',      value: counts.transfer,      color: 'blue',    dot: 'bg-blue-400'   },
                { label: 'Extra in QB',    value: counts.extra,         color: 'slate',   dot: 'bg-slate-400'  },
                { label: 'QB Duplicates',  value: counts.duplicates,    color: 'purple',  dot: 'bg-purple-400' },
              ].map(({ label, value, dot }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <p className="text-xs text-slate-500 truncate">{label}</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Recorded — found in QB with a valid category</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Check Category — in QB but marked Uncategorized / needs review</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Missing — not recorded in QuickBooks at all</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Transfer? — likely internal transfer between accounts</span>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100 overflow-x-auto items-center">
                {([
                  { key: 'all',        label: `All Transactions (${result.rows.length})` },
                  { key: 'missing',    label: `⚠️ Needs Action (${counts.missing + counts.uncategorized + counts.transfer})` },
                  { key: 'extra',      label: `+ Extra in QB (${counts.extra})` },
                  { key: 'duplicates', label: `⚡ Duplicates (${counts.duplicates})` },
                ] as { key: TabKey; label: string }[]).map(({ key, label }) => (
                  <button key={key} onClick={() => setTab(key)}
                    className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                      tab === key
                        ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}>
                    {label}
                  </button>
                ))}

                {/* Toolbar */}
                <div className="ml-auto flex items-center gap-2 pr-3">
                  {tab === 'all' && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Filter…"
                        className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                      />
                    </div>
                  )}
                  <button onClick={doExport}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">

                {/* ALL TRANSACTIONS — primary view */}
                {tab === 'all' && (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Description</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Status</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" /> Account Location
                        </th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Type</th>
                        <th className="px-3 py-2.5 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr><td colSpan={7} className="py-12 text-center text-slate-400 text-sm">No transactions match your filter.</td></tr>
                      ) : (
                        filteredRows.map((row, i) => <TxnTableRow key={row.bank.id} row={row} idx={i} />)
                      )}
                    </tbody>
                    {filteredRows.length > 0 && search && (
                      <tfoot>
                        <tr className="border-t border-slate-100 bg-slate-50">
                          <td colSpan={7} className="px-3 py-2 text-xs text-slate-400">
                            Showing {filteredRows.length} of {result.rows.length} transactions
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}

                {/* NEEDS ACTION — missing + uncategorized + transfer */}
                {tab === 'missing' && (() => {
                  const rows = result.rows.filter(r =>
                    r.status === 'missing' || r.status === 'uncategorized' || r.status === 'transfer'
                  )
                  if (rows.length === 0) return (
                    <div className="py-16 text-center">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                      <p className="font-medium text-emerald-700">All transactions are correctly recorded!</p>
                    </div>
                  )
                  return (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Issue</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Account Location</th>
                          <th className="px-3 py-2.5 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <NeedsActionRow key={row.bank.id} row={row} idx={i} />
                        ))}
                      </tbody>
                    </table>
                  )
                })()}

                {/* EXTRA IN QB */}
                {tab === 'extra' && (
                  result.extraInQB.length === 0 ? (
                    <div className="py-16 text-center">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400" />
                      <p className="font-medium text-emerald-700">No extra entries found in QuickBooks.</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">QB Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor / Customer</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Account Location</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Memo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.extraInQB.map((qb, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-amber-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(qb.date)}</td>
                            <td className={`py-2.5 px-3 font-mono text-sm font-semibold ${qb.amount >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {fmtAmt(qb.amount)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{qb.txnType || '—'}</span>
                            </td>
                            <td className="py-2.5 px-3 text-sm text-slate-700">{qb.name || '—'}</td>
                            <td className="py-2.5 px-3">
                              <LocationCell location={qb.split} status="found" accountName={qb.accountName} />
                            </td>
                            <td className="py-2.5 px-3 text-xs text-slate-500 max-w-[200px] truncate">{qb.memo || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {/* DUPLICATES */}
                {tab === 'duplicates' && (
                  result.duplicates.length === 0 ? (
                    <div className="py-16 text-center">
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
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Vendor</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Account Location</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Memo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dup.entries.map((e, j) => (
                                <tr key={j} className="border-b border-purple-50">
                                  <td className="px-4 py-2">
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{e.txnType || '—'}</span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-slate-700">{e.name || '—'}</td>
                                  <td className="px-4 py-2"><LocationCell location={e.split} status="found" /></td>
                                  <td className="px-4 py-2 text-xs text-slate-500">{e.memo || '—'}</td>
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

        {/* Empty setup state */}
        {phase === 'setup' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-4 text-blue-300" />
            <p className="font-medium text-slate-600 mb-1">Ready to reconcile</p>
            <p className="text-sm max-w-md mx-auto">
              <strong>All Accounts (Global Search)</strong> is selected by default — upload your bank statement
              and click Run to search across your entire QuickBooks ledger.
              Or choose a specific account from the dropdown.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Needs-Action row (separate to keep state per row) ────────────────────────

function NeedsActionRow({ row, idx }: { row: TxnRow; idx: number }) {
  const [open, setOpen] = useState(false)
  const { bank, qb, status, accountLocation } = row

  const actionLabel = {
    missing:       'Add to QuickBooks — transaction not recorded',
    transfer:      'Verify — may be an internal transfer between accounts',
    uncategorized: 'Recategorize — currently in an Uncategorized account',
  }[status as 'missing' | 'transfer' | 'uncategorized'] ?? ''

  const copyText = [
    `Date:        ${fmtDate(bank.date)}`,
    `Amount:      ${fmtAmt(bank.amount)}`,
    `Description: ${bank.description || '—'}`,
    `Reference:   ${bank.reference || '—'}`,
    qb ? `QB Category: ${accountLocation || '—'}` : '',
  ].filter(Boolean).join('\n')

  const rowBg =
    status === 'missing'        ? 'bg-red-50/40 hover:bg-red-50'
    : status === 'transfer'     ? 'bg-blue-50/30 hover:bg-blue-50'
    : 'bg-amber-50/40 hover:bg-amber-50'

  return (
    <>
      <tr className={`border-b border-slate-100 cursor-pointer transition-colors ${rowBg}`}
        onClick={() => setOpen(v => !v)}>
        <td className="py-2.5 px-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(bank.date)}</td>
        <td className={`py-2.5 px-3 font-mono text-sm font-semibold whitespace-nowrap ${bank.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {fmtAmt(bank.amount)}
        </td>
        <td className="py-2.5 px-3 text-slate-700 text-sm max-w-[180px]">
          <div className="truncate">{bank.description || '—'}</div>
          {bank.reference && <div className="text-xs text-slate-400 font-mono truncate">{bank.reference}</div>}
        </td>
        <td className="py-2.5 px-3"><StatusBadge status={status} /></td>
        <td className="py-2.5 px-3 max-w-[220px]">
          <LocationCell location={accountLocation} status={status} accountName={qb?.accountName} />
        </td>
        <td className="py-2.5 px-3 text-right w-8" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            <CopyBtn text={copyText} />
            <span className="text-slate-400">
              {open ? <ChevronDown className="w-3.5 h-3.5 inline" /> : <ChevronRight className="w-3.5 h-3.5 inline" />}
            </span>
          </div>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-slate-100">
          <td colSpan={6} className="px-4 pb-3 pt-0">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className={`text-xs font-semibold mb-3 flex items-center gap-1.5 ${
                status === 'missing' ? 'text-red-600' : status === 'uncategorized' ? 'text-amber-700' : 'text-blue-700'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" /> {actionLabel}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { label: 'Date',        value: fmtDate(bank.date) },
                  { label: 'Amount',      value: fmtAmt(bank.amount) },
                  { label: 'Description', value: bank.description || '—' },
                  { label: 'Reference',   value: bank.reference || '—' },
                  ...(qb ? [
                    { label: 'QB Type',              value: qb.txnType || '—' },
                    { label: 'Vendor',               value: qb.name    || '—' },
                    ...(qb.accountName ? [{ label: 'QB Account (Posted to)', value: qb.accountName, isAcct: true }] : []),
                    { label: 'Current Category',     value: accountLocation || '—', warn: true },
                    { label: 'Memo',                 value: qb.memo || '—' },
                  ] : []),
                ] as Array<{ label: string; value: string; warn?: boolean; isAcct?: boolean }>)
                  .map(({ label, value, warn, isAcct }) => (
                    <div key={label} className={`rounded-lg px-3 py-2 ${
                      warn   ? 'bg-amber-50 border border-amber-200'
                      : isAcct ? 'bg-blue-50 border border-blue-200'
                      : 'bg-slate-50'
                    }`}>
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className={`text-sm font-medium ${warn ? 'text-amber-800' : isAcct ? 'text-blue-800' : 'text-slate-800'}`}>
                        {value}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
