'use client'
import { useEffect, useState } from 'react'
import { Copy, CheckCheck, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'

export default function SetupTOTPPage() {
  const [data,    setData]    = useState<{ secret: string; qrCodeUrl: string; isConfigured: boolean } | null>(null)
  const [copied,  setCopied]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/setup-totp')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  function copy() {
    if (!data) return
    navigator.clipboard.writeText(data.secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="bg-blue-600 px-8 py-8 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Setup Google Authenticator</h1>
          <p className="text-blue-200 text-sm mt-1">One-time setup for 2FA login</p>
        </div>

        <div className="px-8 py-8 space-y-6">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && data && (
            <>
              {data.isConfigured && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    A TOTP secret is already configured. Scanning this QR code will <strong>replace</strong> your existing authenticator entry.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Step 1 — Scan QR code</p>
                <p className="text-xs text-slate-500">Open <strong>Google Authenticator</strong> → tap + → Scan QR code</p>
                <div className="flex justify-center mt-3">
                  <div className="p-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm">
                    <img src={data.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Step 2 — Or enter key manually</p>
                <p className="text-xs text-slate-500">In Google Authenticator → Enter a setup key</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <code className="text-sm font-mono text-slate-800 flex-1 tracking-widest break-all">{data.secret}</code>
                  <button onClick={copy} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 flex-shrink-0">
                    {copied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-blue-900">Step 3 — Add to Vercel</p>
                <p className="text-xs text-blue-700">Go to your Vercel project → Settings → Environment Variables → add:</p>
                <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 font-mono text-xs text-slate-700 mt-1">
                  <span className="text-blue-600">TOTP_SECRET</span> = <span className="text-slate-500 break-all">{data.secret}</span>
                </div>
                <p className="text-xs text-blue-600 font-medium">Then redeploy. After that, this setup page is no longer needed.</p>
              </div>

              <a href="/login"
                className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors">
                Go to Login
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
