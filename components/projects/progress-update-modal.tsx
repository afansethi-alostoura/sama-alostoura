'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle2, Loader2, Save, RefreshCw } from 'lucide-react'

export interface BOQSection {
  section:    string
  amount:     number
  percentage: number
  progress:   number   // 0–100
}

interface Props {
  projectId:      string
  projectName:    string
  contractValue:  number
  initialSections: BOQSection[]
  initialStage:   string
  onClose:        () => void
  onSaved:        (pct: number, stage: string, sections: BOQSection[]) => void
}

// Standard construction phases used when a project has no BOQ sections
function buildDefaultSections(contractValue: number): BOQSection[] {
  const names = [
    'Mobilization',
    'Excavation & Backfilling',
    'Substructure',
    'Super Structure',
    'Block Works',
    'Internal Plaster Works',
    'External Plaster Works',
    'Water Proofing Works',
    'Electrical & Etisalat Works',
    'Plumbing & Drainage Works',
    'Air Conditioning',
    'Flooring & Wall Tiling',
    'Internal Paint Works',
    'External Paint Works',
    'Aluminium Works',
    'Joinery Works',
    'Metal Works',
    'Compound Wall',
    'External Finishing Works',
    'Provisional / Snagging',
  ]
  const each = Math.round((contractValue / names.length) * 100) / 100
  return names.map(s => ({ section: s, amount: each, percentage: Math.round(10000 / names.length) / 100, progress: 0 }))
}

function calcOverall(sections: BOQSection[], contractValue: number): number {
  if (!sections.length || !contractValue) return 0
  const weighted = sections.reduce((sum, s) => sum + s.amount * (s.progress / 100), 0)
  return Math.round((weighted / contractValue) * 100)
}

function autoStage(sections: BOQSection[]): string {
  // Find the last section that is in-progress (0 < progress < 100)
  const partial = [...sections].reverse().find(s => s.progress > 0 && s.progress < 100)
  if (partial) return partial.section + ' (in progress)'
  // Find the last completed section and point to the next
  const lastComplete = [...sections].reduce((last, s, i) => s.progress === 100 ? i : last, -1)
  if (lastComplete >= 0 && lastComplete < sections.length - 1) return sections[lastComplete + 1].section
  if (lastComplete === sections.length - 1) return 'Final Completion & Handover'
  return sections[0]?.section ?? 'Mobilization'
}

export function ProgressUpdateModal({
  projectId, projectName, contractValue,
  initialSections, initialStage, onClose, onSaved,
}: Props) {
  const [sections, setSections] = useState<BOQSection[]>(() => {
    if (initialSections && initialSections.length > 0) {
      return initialSections.map(s => ({ ...s, progress: s.progress ?? 0 }))
    }
    return buildDefaultSections(contractValue)
  })
  const [stage,   setStage]   = useState(initialStage ?? '')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const overall = calcOverall(sections, contractValue)

  // Auto-update current stage when sections change
  useEffect(() => {
    setStage(autoStage(sections))
  }, [sections])

  function setProgress(idx: number, val: number) {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, progress: Math.max(0, Math.min(100, val)) } : s))
  }

  function toggleComplete(idx: number) {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, progress: s.progress === 100 ? 0 : 100 } : s))
  }

  function markAllComplete() {
    setSections(prev => prev.map(s => ({ ...s, progress: 100 })))
  }

  function clearAll() {
    setSections(prev => prev.map(s => ({ ...s, progress: 0 })))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        progress_percent: overall,
        current_stage:    stage,
        boq_sections:     sections,
        updated_at:       new Date().toISOString(),
      }
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      onSaved(overall, stage, sections)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const barColor = overall >= 70 ? 'bg-emerald-500' : overall >= 40 ? 'bg-amber-400' : 'bg-blue-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Update Work Progress</h2>
            <p className="text-sm text-slate-500 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Overall Completion</span>
            <span className="text-2xl font-bold text-slate-900">{overall}%</span>
          </div>
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${overall}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-500">Auto-calculated from BOQ section weights</span>
            <div className="flex gap-2">
              <button onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700 underline">Clear all</button>
              <span className="text-slate-300">|</span>
              <button onClick={markAllComplete} className="text-xs text-emerald-600 hover:text-emerald-700 underline">Mark all complete</button>
            </div>
          </div>
        </div>

        {/* Sections table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
              <tr className="text-xs text-slate-500 font-medium">
                <th className="text-left px-6 py-3">BOQ Section</th>
                <th className="text-right px-4 py-3 w-32">Contract Value</th>
                <th className="text-right px-4 py-3 w-20">Weight</th>
                <th className="text-center px-4 py-3 w-40">Progress %</th>
                <th className="text-center px-4 py-3 w-28">Complete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sections.map((s, idx) => {
                const isComplete = s.progress === 100
                const isPartial  = s.progress > 0 && s.progress < 100
                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${isComplete ? 'bg-emerald-50/60' : isPartial ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}
                  >
                    {/* Section name */}
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {isComplete
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          : <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${isPartial ? 'border-amber-400 bg-amber-100' : 'border-slate-300'}`} />
                        }
                        <span className={`font-medium ${isComplete ? 'text-emerald-700' : 'text-slate-800'}`}>
                          {s.section}
                        </span>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right text-slate-600">
                      AED {s.amount.toLocaleString()}
                    </td>

                    {/* Weight % */}
                    <td className="px-4 py-3 text-right text-slate-400 text-xs">
                      {s.percentage.toFixed(1)}%
                    </td>

                    {/* Progress slider + input */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={s.progress}
                          onChange={e => setProgress(idx, Number(e.target.value))}
                          className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={s.progress}
                          onChange={e => setProgress(idx, Number(e.target.value))}
                          className="w-14 text-center border border-slate-200 rounded-lg py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                      </div>
                    </td>

                    {/* Complete toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleComplete(idx)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          isComplete
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {isComplete ? '✓ Done' : 'Mark Done'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Current stage override */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50">
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Current Stage Label <span className="text-slate-400 font-normal">(auto-filled — edit if needed)</span>
          </label>
          <input
            type="text"
            value={stage}
            onChange={e => setStage(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            placeholder="e.g. Super Structure — First Floor Slab"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <p className="text-sm text-slate-500">
              Saving will update the project to <strong className="text-slate-800">{overall}%</strong> overall completion
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Progress</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
