'use client'
import { useEffect, useState } from 'react'
import Link                    from 'next/link'
import { RefreshCw, Loader2, Link2, TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react'
import { AccountantBriefing }  from '@/components/accounting/accountant-briefing'
import { InvoiceTable }        from '@/components/accounting/invoice-table'
import type { QBSnapshot }     from '@/lib/quickbooks/types'
import type { QBStatus }       from '@/lib/quickbooks/client'
import { DEMO_PROJECTS }       from '@/lib/demo-data'

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function AccountingPage() {
  const [status,   setStatus]   = useState<QBStatus | null>(null)
  const [snapshot, setSnapshot] = useState<QBSnapshot | null>(null)
  const [syncing,  setSyncing]  = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/quickbooks/status').then(r => r.json()),
      fetch('/api/quickbooks/sync').then(r => r.json()),
    ]).then(([s, snap]) => {
      setStatus(s)
      if (snap.synced) setSnapshot(snap)
    }).finally(() => setLoading(false))
  }, [])

  async function syncNow() {
    setSyncing(true)
    try {
      const r = await fetch('/api/quickbooks/sync', { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        const snap = await fetch('/api/quickbooks/sync').then(r => r.json())
        if (snap.synced) setSnapshot(snap)
        const s = await fetch('/api/quickbooks/status').then(r => r.json())
        setStatus(s)
      }
    } finally { setSyncing(false) }
  }

  // Financial stats — prefer QB data, fall back to project db
  const projects = DEMO_PROJECTS.filter(p => p.status === 'active')

  const totalBilled      = snapshot?.invoices.reduce((s, i) => s + i.TotalAmt, 0)
    ?? projects.reduce((s, p) => s + p.contract_value, 0)
  const totalOutstanding = snapshot?.invoices.reduce((s, i) => s + i.Balance, 0)
    ?? projects.reduce((s, p) => s + (p.contract_value - p.received_amount), 0)
  const totalReceived    = snapshot?.payments.reduce((s, p) => s + p.TotalAmt, 0)
    ?? projects.reduce((s, p) => s + p.received_amount, 0)
  const overdueCount     = snapshot?.invoices.filter(i => i.Balance > 0 && i.DueDate && new Date(i.DueDate) < new Date()).length ?? 0
  const vatDue           = totalReceived * 0.05  // 5% UAE VAT estimate

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounting</h1>
          <p className="text-slate-500 text-sm mt-1">
            {status?.connected
              ? <>Connected to QuickBooks {status.environment} · {status.synced_at ? `Last sync ${new Date(status.synced_at).toLocaleString('en-AE')}` : 'Not yet synced'}</>
              : 'QuickBooks not connected — showing project database figures'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status?.connected ? (
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-2 bg-[#2CA01C] hover:bg-[#238016] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync QB</>}
            </button>
          ) : (
            <Link href="/settings" className="flex items-center gap-2 bg-[#2CA01C] hover:bg-[#238016] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Link2 className="w-4 h-4" /> Connect QuickBooks
            </Link>
          )}
        </div>
      </div>

      {/* QB not connected banner */}
      {!loading && !status?.connected && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 text-sm font-semibold">QuickBooks not connected</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Showing figures from your project database. {' '}
              <Link href="/settings" className="underline font-medium">Connect QuickBooks</Link> to see live invoices and payments.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Billed"      value={`AED ${(totalBilled / 1000).toFixed(0)}K`}      sub={snapshot ? 'From QuickBooks' : 'From contracts'} color="text-slate-900" />
        <StatCard label="Total Received"    value={`AED ${(totalReceived / 1000).toFixed(0)}K`}    sub={`${Math.round((totalReceived / totalBilled) * 100)}% collected`} color="text-emerald-600" />
        <StatCard label="Outstanding"       value={`AED ${(totalOutstanding / 1000).toFixed(0)}K`} sub={overdueCount > 0 ? `${overdueCount} overdue` : 'All current'} color={overdueCount > 0 ? 'text-red-600' : 'text-amber-600'} />
        <StatCard label="Est. VAT Liability" value={`AED ${(vatDue / 1000).toFixed(0)}K`}         sub="5% on received amounts" color="text-blue-600" />
      </div>

      {/* Project-level summary */}
      <div className="mb-8 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Per-Project Financials</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500">
                <th className="text-left px-5 py-3 font-medium">Project</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-right px-5 py-3 font-medium">Contract</th>
                <th className="text-right px-5 py-3 font-medium">Received</th>
                <th className="text-right px-5 py-3 font-medium">Outstanding</th>
                <th className="text-right px-5 py-3 font-medium">Retention</th>
                <th className="text-left px-5 py-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {DEMO_PROJECTS.map(p => {
                const out = p.contract_value - p.received_amount
                const ret = p.received_amount * 0.1
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-medium text-slate-800">{p.name}</td>
                    <td className="px-5 py-3.5 text-slate-500 capitalize">{p.type}</td>
                    <td className="px-5 py-3.5 text-right text-slate-800 font-medium">AED {p.contract_value.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-700 font-medium">AED {p.received_amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-amber-700 font-medium">AED {out.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500">AED {ret.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${p.progress_percent}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{p.progress_percent}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Accountant Briefing */}
      <div className="mb-8">
        <AccountantBriefing hasQbData={!!snapshot} />
      </div>

      {/* QuickBooks Invoice Table */}
      {snapshot?.invoices && snapshot.invoices.length > 0 && (
        <InvoiceTable invoices={snapshot.invoices} />
      )}
    </div>
  )
}
