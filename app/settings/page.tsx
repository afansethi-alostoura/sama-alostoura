'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams }               from 'next/navigation'
import {
  CheckCircle2, XCircle, Link2, Link2Off, RefreshCw,
  Loader2, ExternalLink, Settings, AlertTriangle, Info,
} from 'lucide-react'
import type { QBStatus } from '@/lib/quickbooks/client'

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
        {done ? '✓' : n}
      </div>
      <div className="flex-1 pb-6 border-l border-slate-100 pl-4 -ml-3.5">
        <p className="font-semibold text-slate-800 text-sm">{title}</p>
        <div className="mt-1 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  )
}

function SettingsInner() {
  const searchParams = useSearchParams()
  const [status, setStatus]     = useState<QBStatus | null>(null)
  const [syncing, setSyncing]   = useState(false)
  const [syncResult, setSyncResult] = useState<string>('')
  const [disconnecting, setDisconnecting] = useState(false)

  const connected  = searchParams.get('qb_connected') === '1'
  const qbError    = searchParams.get('qb_error')

  useEffect(() => {
    fetch('/api/quickbooks/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [connected])

  async function handleSync() {
    setSyncing(true)
    setSyncResult('')
    try {
      const r = await fetch('/api/quickbooks/sync', { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        setSyncResult(`✅ Synced ${d.counts.invoices} invoices, ${d.counts.payments} payments, ${d.counts.customers} customers at ${new Date(d.synced_at).toLocaleTimeString()}`)
        const updated = await fetch('/api/quickbooks/status').then(r => r.json())
        setStatus(updated)
      } else {
        const msg = d.error ?? 'Sync failed'
        setSyncResult(
          msg.includes('invalid_grant') || msg.includes('refresh token')
            ? 'RECONNECT'
            : `❌ Sync failed: ${msg}`
        )
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sync failed'
      setSyncResult(
        msg.includes('invalid_grant') || msg.includes('refresh token')
          ? 'RECONNECT'
          : `❌ ${msg}`
      )
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect QuickBooks? You will need to reconnect and re-sync your data.')) return
    setDisconnecting(true)
    await fetch('/api/quickbooks/disconnect', { method: 'POST' })
    setStatus(prev => prev ? { ...prev, connected: false } : null)
    setDisconnecting(false)
  }

  const clientConfigured = status?.client_configured

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6" /> Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">Integrations and connections</p>
      </div>

      {/* Success / Error banners */}
      {connected && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-emerald-800 text-sm font-medium">QuickBooks connected successfully! Click <strong>Sync Now</strong> to import your data.</p>
        </div>
      )}
      {qbError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-800 text-sm"><strong>Connection error:</strong> {decodeURIComponent(qbError)}</p>
        </div>
      )}

      {/* QuickBooks Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2CA01C] rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-lg">QB</span>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">QuickBooks Online</h2>
              <p className="text-slate-400 text-xs">Invoices · Payments · Cash flow</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <XCircle className="w-3.5 h-3.5" /> Not connected
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {status?.connected ? (
            <>
              {/* Connection info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                {[
                  { label: 'Company',         value: status.company_name ?? 'Fetching…' },
                  { label: 'Realm ID',         value: status.realm_id ?? '—' },
                  { label: 'Environment',      value: status.environment },
                  { label: 'Last Sync',        value: status.synced_at ? new Date(status.synced_at).toLocaleString('en-AE') : 'Not yet synced' },
                  { label: 'Access Token',     value: status.access_token_valid ? '✅ Valid' : '⚠️ Expired (will auto-refresh)' },
                  { label: 'Refresh Token',    value: status.refresh_token_valid ? '⚠️ Locally valid (test by syncing)' : '❌ Expired — reconnect required' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-4 py-3">
                    <p className="text-slate-400 text-xs">{label}</p>
                    <p className="text-slate-800 text-sm font-medium mt-0.5 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {syncResult && (
                syncResult === 'RECONNECT' ? (
                  <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800">QuickBooks session expired</p>
                    <p className="text-xs text-amber-700 mt-0.5">Your connection has expired. Reconnect to continue syncing.</p>
                    <a href="/api/quickbooks/connect"
                      className="mt-2 inline-block px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors">
                      Reconnect QuickBooks
                    </a>
                  </div>
                ) : (
                  <div className="mb-4 bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700">{syncResult}</div>
                )
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 bg-[#2CA01C] hover:bg-[#238016] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync Now</>}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Link2Off className="w-4 h-4" /> Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Setup guide */}
              {!clientConfigured && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">QuickBooks Client ID & Secret not configured</p>
                    <p>Complete Step 1 below, then add them to <code className="bg-amber-100 px-1 rounded">.env.local</code> and restart the server.</p>
                  </div>
                </div>
              )}

              {/* Production vs Sandbox warning */}
              <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-semibold mb-1">⚠️ You must use Production credentials — not Development credentials</p>
                <p className="text-red-700 text-sm">
                  Intuit issues <strong>two separate Client IDs</strong> for every app — one for Development (sandbox only) and one for Production (your real UAE company).
                  The error "no sandbox companies found" means you are using the <strong>Development</strong> key. Follow Step 1 below to get the Production key.
                </p>
              </div>

              <div className="mb-6 space-y-0">
                <Step n={1} title="Get your Production credentials from Intuit" done={clientConfigured}>
                  <ol className="list-decimal list-inside space-y-1 mt-1">
                    <li>Go to <a href="https://developer.intuit.com/app/developer/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">developer.intuit.com/app/developer/dashboard <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Click your app name</li>
                    <li>In the left menu click <strong>Keys &amp; OAuth</strong></li>
                    <li>At the top of that page, click the <strong>"Production"</strong> tab (not Development)</li>
                    <li>Copy the <strong>Production Client ID</strong> and <strong>Production Client Secret</strong></li>
                    <li>Scroll down and add this <strong>Redirect URI</strong> in the Production section:
                      <code className="block mt-1 bg-slate-100 rounded px-3 py-2 text-xs">http://localhost:3000/api/quickbooks/callback</code>
                    </li>
                    <li>Click <strong>Save</strong></li>
                  </ol>
                </Step>

                <Step n={2} title="Update .env.local with the Production credentials" done={clientConfigured}>
                  <p>Open <code className="bg-slate-100 px-1 rounded text-xs">C:\Users\pc\Documents\sama-alostoura\.env.local</code> and set:</p>
                  <pre className="mt-1 bg-slate-900 text-slate-100 rounded px-3 py-2 text-xs overflow-x-auto">
{`QUICKBOOKS_CLIENT_ID=<your PRODUCTION client ID>
QUICKBOOKS_CLIENT_SECRET=<your PRODUCTION client secret>
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=production`}
                  </pre>
                  <p className="mt-1 font-medium text-amber-700">⚠️ Restart the dev server after saving, then come back here.</p>
                </Step>

                <Step n={3} title="Connect your live QuickBooks UAE company">
                  <p>Click below. Intuit will ask you to sign in — use your <strong>QuickBooks Online UAE account</strong> (the same login you use at qbo.intuit.com). You will see your real company name, not a sandbox company.</p>
                  <div className="mt-3">
                    <a
                      href="/api/quickbooks/connect"
                      className={`inline-flex items-center gap-2 bg-[#2CA01C] hover:bg-[#238016] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors ${!clientConfigured ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <Link2 className="w-4 h-4" /> Connect QuickBooks
                    </a>
                    {!clientConfigured && (
                      <p className="text-xs text-slate-400 mt-1">Complete steps 1 &amp; 2 first</p>
                    )}
                  </div>
                </Step>

                <Step n={4} title="Sync your invoices and payments">
                  <p>After connecting, click <strong>Sync Now</strong> to pull your live invoices and payments into the system. The AI Accountant will use this data for financial briefings.</p>
                </Step>
              </div>
            </>
          )}
        </div>
      </div>

      {/* UAE note */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-blue-800 text-xs">
          <strong>UAE QuickBooks:</strong> Use your QuickBooks Online UAE account. Ensure your company's base currency is set to AED and VAT at 5% is configured in QuickBooks before syncing. For live data, set <code className="bg-blue-100 px-1 rounded">QUICKBOOKS_ENVIRONMENT=production</code>.
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading settings…</div>}>
      <SettingsInner />
    </Suspense>
  )
}
