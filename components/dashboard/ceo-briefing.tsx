'use client'
import { useState } from 'react'
import { Bot, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { Project } from '@/types'
import { formatCurrency } from '@/lib/utils'

export function CeoBriefing({ projects }: { projects: Project[] }) {
  const [briefing, setBriefing]   = useState<string>('')
  const [loading, setLoading]     = useState(false)
  const [expanded, setExpanded]   = useState(true)
  const [hasRun, setHasRun]       = useState(false)

  async function getBriefing() {
    setLoading(true)
    setBriefing('')
    try {
      const res = await fetch('/api/agents/ceo-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects }),
      })
      const data = await res.json()
      setBriefing(data.briefing ?? data.error ?? 'No response.')
      setHasRun(true)
    } catch {
      setBriefing('Failed to connect to AI. Please check your ANTHROPIC_API_KEY in .env.local')
    } finally {
      setLoading(false)
    }
  }

  const active      = projects.filter(p => p.status === 'active')
  const outstanding = active.reduce((s, p) => s + (p.contract_value - p.received_amount), 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">AI CEO Morning Briefing</h2>
            <p className="text-slate-400 text-xs">Agent 10 — Powered by Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); getBriefing() }}
            disabled={loading}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
              : hasRun
              ? <><RefreshCw className="w-3.5 h-3.5" /> Refresh</>
              : <><Bot className="w-3.5 h-3.5" /> Get Briefing</>
            }
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-5">
          {briefing ? (
            <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
              {briefing}
            </div>
          ) : (
            <div className="text-center py-6">
              <Bot className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Click <strong>Get Briefing</strong> for your AI morning summary.
              </p>
              <p className="text-slate-400 text-xs mt-1">
                {active.length} active projects · {formatCurrency(outstanding)} outstanding
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
