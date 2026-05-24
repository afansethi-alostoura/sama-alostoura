'use client'
import { useState } from 'react'
import { Bot, Loader2, RefreshCw, TrendingUp } from 'lucide-react'

export function AccountantBriefing({ hasQbData }: { hasQbData: boolean }) {
  const [briefing, setBriefing] = useState<string>('')
  const [loading, setLoading]   = useState(false)
  const [hasRun, setHasRun]     = useState(false)

  async function getBriefing() {
    setLoading(true)
    setBriefing('')
    try {
      const r = await fetch('/api/agents/accountant', { method: 'POST' })
      const d = await r.json()
      setBriefing(d.briefing ?? d.error ?? 'No response')
      setHasRun(true)
    } catch {
      setBriefing('Failed to connect. Check your SAMA_AI_KEY in .env.local')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">AI Accountant Briefing</p>
            <p className="text-slate-400 text-xs">Agent 3 — Claude · {hasQbData ? 'QuickBooks data loaded' : 'Project data only (connect QB for live invoices)'}</p>
          </div>
        </div>
        <button
          onClick={getBriefing}
          disabled={loading}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
        >
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
            : hasRun
            ? <><RefreshCw className="w-3.5 h-3.5" /> Refresh</>
            : <><Bot className="w-3.5 h-3.5" /> Get Briefing</>
          }
        </button>
      </div>
      <div className="p-6">
        {briefing ? (
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{briefing}</div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              Click <strong>Get Briefing</strong> for your AI financial analysis.
            </p>
            {!hasQbData && (
              <p className="text-amber-600 text-xs mt-2">
                Connect QuickBooks in Settings for live invoice data.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
