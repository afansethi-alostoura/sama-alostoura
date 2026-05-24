'use client'
import { useState } from 'react'
import { Bot, Loader2, RefreshCw } from 'lucide-react'
import type { Project, PaymentSchedule, WorkStage } from '@/types'

export function AgentBriefing({
  project,
  stages,
  payments,
}: {
  project: Project
  stages: WorkStage[]
  payments: PaymentSchedule[]
}) {
  const [briefing, setBriefing] = useState<string>('')
  const [loading, setLoading]   = useState(false)
  const [hasRun, setHasRun]     = useState(false)

  async function getBriefing() {
    setLoading(true)
    setBriefing('')
    try {
      const res = await fetch('/api/agents/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, stages, payments }),
      })
      const data = await res.json()
      setBriefing(data.briefing ?? data.error ?? 'No response.')
      setHasRun(true)
    } catch {
      setBriefing('Failed to connect. Check your ANTHROPIC_API_KEY in .env.local')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">AI Project Manager</p>
            <p className="text-slate-400 text-xs">Agent 1 — Claude</p>
          </div>
        </div>
        <button
          onClick={getBriefing}
          disabled={loading}
          className="flex items-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
        >
          {loading
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading…</>
            : hasRun
            ? <><RefreshCw className="w-3 h-3" /> Refresh</>
            : <><Bot className="w-3 h-3" /> Brief Me</>
          }
        </button>
      </div>

      <div className="p-5">
        {briefing ? (
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {briefing}
          </div>
        ) : (
          <div className="text-center py-4">
            <Bot className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 text-xs">
              Click <strong>Brief Me</strong> for an AI project status briefing.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
