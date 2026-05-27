'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Calendar, Building2,
  CheckCircle2, Clock, AlertCircle, Loader2, Sparkles,
} from 'lucide-react'
import { getDemoProject } from '@/lib/demo-data'
import { formatCurrency, formatDate, progressBarColor, statusBadge, statusLabel } from '@/lib/utils'
import type { StoredProject } from '@/lib/projects-store'

interface ProjectData {
  id: string
  name: string
  client_name?: string
  location: string
  type: string
  status: string
  contract_value: number
  received_amount: number
  progress_percent: number
  current_stage?: string
  notes?: string
  start_date?: string
  expected_completion: string
  completed_works?: string[]
  partial_works?: Array<{ name: string; progress: number }>
  pending_works?: string[]
  scope_changes?: string
  mbhre_approved_amount?: number
  mbhre_approved_progress?: number
  plot_number?: string
  company_boq_id?: string
}

interface BOQItem {
  itemNo: string | number
  section: string
  description: string
  unit: string
  quantity: number
  unitRate: number
  amount: number
  progress?: number  // 0–100, how much of this item is complete
  done?: boolean
}

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string>('')
  const [briefingLoading, setBriefingLoading] = useState(false)

  // BOQ state
  const [boqItems, setBoqItems] = useState<BOQItem[]>([])
  const [boqLoading, setBoqLoading] = useState(false)
  const [boqSaving, setBoqSaving] = useState(false)
  const [boqRecord, setBoqRecord] = useState<any>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load project
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((projects: StoredProject[]) => {
        const stored = projects.find(p => p.id === id)
        if (stored) setProject(stored as unknown as ProjectData)
        else {
          const demo = getDemoProject(id)
          if (demo) setProject(demo as unknown as ProjectData)
        }
      })
      .catch(() => {
        const demo = getDemoProject(id)
        if (demo) setProject(demo as unknown as ProjectData)
      })
      .finally(() => setLoading(false))
  }, [id])

  // Load BOQ when project has company_boq_id
  useEffect(() => {
    if (!project?.company_boq_id) return
    setBoqLoading(true)
    fetch(`/api/boq/company?id=${project.company_boq_id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.items) {
          setBoqRecord(data)
          // Migrate any old done:boolean items to progress:number
          const migrated = data.items.map((item: BOQItem) => ({
            ...item,
            progress: item.progress ?? (item.done ? 100 : 0),
          }))
          setBoqItems(migrated)
        }
      })
      .catch(() => {})
      .finally(() => setBoqLoading(false))
  }, [project?.company_boq_id])

  // Weighted overall completion from BOQ items
  const totalBOQAmount = boqItems.reduce((s, i) => s + (i.amount || 0), 0)
  const overallBOQPct = totalBOQAmount > 0
    ? Math.round(boqItems.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / totalBOQAmount * 100)
    : 0

  // Save BOQ items + PATCH project progress (debounced 800 ms)
  const scheduleSave = useCallback((updatedItems: BOQItem[], record: any, proj: ProjectData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!record) return
      setBoqSaving(true)
      try {
        const totalAmt = updatedItems.reduce((s, i) => s + (i.amount || 0), 0)
        const newPct = totalAmt > 0
          ? Math.round(updatedItems.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / totalAmt * 100)
          : 0

        await Promise.all([
          fetch('/api/boq/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: record.id,
              project_number: record.project_number,
              project_name: record.project_name,
              area: record.area,
              owner: record.owner,
              contractor: record.contractor,
              items: updatedItems,
            }),
          }),
          fetch(`/api/projects/${proj.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              progress_percent: newPct,
              current_stage: proj.current_stage ?? '',
              boq_sections: [],
            }),
          }),
        ])

        setProject(prev => prev ? { ...prev, progress_percent: newPct } : prev)
      } catch {}
      finally { setBoqSaving(false) }
    }, 800)
  }, [])

  function updateItemProgress(globalIdx: number, raw: string) {
    const val = Math.max(0, Math.min(100, Number(raw) || 0))
    const updated = boqItems.map((item, i) =>
      i === globalIdx ? { ...item, progress: val, done: val === 100 } : item
    )
    setBoqItems(updated)
    if (project && boqRecord) scheduleSave(updated, boqRecord, project)
  }

  async function handleBriefMe() {
    if (!project) return
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/agents/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, projectData: project }),
      })
      const data = await res.json()
      setBriefing(data.briefing || 'No briefing available')
    } catch (err) {
      setBriefing(`Error: ${err instanceof Error ? err.message : 'Failed to get briefing'}`)
    } finally {
      setBriefingLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Loading project…</div>

  if (!project) {
    return (
      <div className="p-8">
        <Link href="/projects" className="text-slate-500 hover:text-slate-700">← Back to Projects</Link>
        <p className="mt-4 text-slate-500">Project not found.</p>
      </div>
    )
  }

  const outstanding = project.contract_value - project.received_amount
  const pctCollected = Math.round((project.received_amount / project.contract_value) * 100)
  const isMBHRE = project.mbhre_approved_amount !== undefined

  // Effective progress: BOQ-computed if available, otherwise stored value
  const effectivePct = project.company_boq_id && boqItems.length > 0 ? overallBOQPct : project.progress_percent

  // Group items by section
  const sections = boqItems.reduce<Record<string, { items: BOQItem[]; indices: number[] }>>((acc, item, idx) => {
    const sec = item.section || 'General'
    if (!acc[sec]) acc[sec] = { items: [], indices: [] }
    acc[sec].items.push(item)
    acc[sec].indices.push(idx)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Projects
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div className="flex items-start gap-4 flex-1">
            <div className="w-14 h-14 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-brand-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${statusBadge(project.status)}`}>
                  {statusLabel(project.status)}
                </span>
                {isMBHRE && (
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                    MBHRE Funded
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 flex-wrap">
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {project.location}</span>
                {project.plot_number && <span>Plot: {project.plot_number}</span>}
                {project.start_date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDate(project.start_date)}</span>}
              </div>
              <p className="mt-2 text-sm"><strong>Client:</strong> {project.client_name}</p>
              {project.current_stage && <p className="mt-1 text-sm text-slate-600"><strong>Current:</strong> {project.current_stage}</p>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-slate-500 text-xs">Contract Value</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(project.contract_value)}</p>
            {isMBHRE && project.mbhre_approved_amount && (
              <p className="text-xs text-slate-500 mt-1">MBHRE: {formatCurrency(project.mbhre_approved_amount)}</p>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5 space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-600">
                <strong>Overall Completion</strong>
                {boqSaving && <span className="ml-2 text-xs text-slate-400 font-normal">saving…</span>}
              </span>
              <span className="font-bold text-slate-800 text-lg">{effectivePct}%</span>
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBarColor(effectivePct)}`}
                style={{ width: `${effectivePct}%` }}
              />
            </div>
            {project.company_boq_id && boqItems.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">Weighted by AED value across {boqItems.length} BOQ items</p>
            )}
          </div>

          {isMBHRE && project.mbhre_approved_progress !== undefined && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600"><strong>MBHRE Approved Progress</strong></span>
                <span className="font-bold text-indigo-800">{project.mbhre_approved_progress}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all bg-indigo-500" style={{ width: `${project.mbhre_approved_progress}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-1">What MBHRE has officially approved &amp; paid against</p>
            </div>
          )}

          {isMBHRE && project.mbhre_approved_progress !== undefined && project.mbhre_approved_progress < effectivePct && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              💡 <strong>{effectivePct - project.mbhre_approved_progress}% ahead of MBHRE approval</strong> — Ready to submit stage report for next payment
            </div>
          )}
        </div>

        {/* Financials Grid */}
        <div className={`grid gap-4 grid-cols-2 ${isMBHRE ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          <div className="bg-emerald-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Received</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(project.received_amount)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{pctCollected}% collected</p>
          </div>
          <div className="bg-amber-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Outstanding</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(outstanding)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{100 - pctCollected}% remaining</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Retention (10%)</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(project.received_amount * 0.1)}</p>
            <p className="text-xs text-slate-500 mt-0.5">At handover</p>
          </div>
          <div className="bg-blue-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Expected End</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatDate(project.expected_completion)}</p>
          </div>
          {isMBHRE && (
            <div className="bg-indigo-50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-600">MBHRE Approved</p>
              <p className="font-bold text-slate-900 mt-0.5">
                {project.mbhre_approved_progress != null ? `${project.mbhre_approved_progress}%` : 'Pending'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Progress</p>
            </div>
          )}
        </div>
      </div>

      {/* Brief Me button */}
      <div className="mb-6">
        <button
          onClick={handleBriefMe}
          disabled={briefingLoading}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 shadow-sm"
        >
          {briefingLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Briefing…</>
            : <><Sparkles className="w-4 h-4" /> Brief Me</>
          }
        </button>
      </div>

      {/* AI Briefing */}
      {briefing && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" /> Project Briefing
          </h2>
          <div className="prose prose-slate max-w-none text-sm">
            {briefing.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} className="h-2" />
              if (line.startsWith('###')) return <h3 key={i} className="font-bold text-slate-900 mt-4 mb-2">{line.replace('### ', '')}</h3>
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-slate-800 mt-2">{line.replace(/\*\*/g, '')}</p>
              if (line.startsWith('• ') || line.startsWith('- ')) return <li key={i} className="ml-4 text-slate-700">{line.substring(2)}</li>
              return <p key={i} className="text-slate-700 leading-relaxed">{line}</p>
            })}
          </div>
        </div>
      )}

      {/* ── BOQ Progress Editor (projects with company_boq_id) ── */}
      {project.company_boq_id && (
        <div className="space-y-4">
          {boqLoading ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading BOQ…
            </div>
          ) : boqItems.length > 0 ? (
            <>
              {/* Section cards */}
              {Object.entries(sections).map(([sectionName, { items, indices }]) => {
                const secTotalAmt = items.reduce((s, i) => s + (i.amount || 0), 0)
                const secPct = secTotalAmt > 0
                  ? Math.round(items.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / secTotalAmt * 100)
                  : 0
                const allDone = secPct === 100
                const anyStarted = secPct > 0

                return (
                  <div key={sectionName} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Section header */}
                    <div className={`px-5 py-3 border-b border-slate-100 ${allDone ? 'bg-emerald-50' : anyStarted ? 'bg-amber-50' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {allDone
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            : anyStarted
                              ? <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              : <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          }
                          <span className="font-semibold text-slate-800 text-sm">{sectionName}</span>
                          <span className="text-xs text-slate-500">{items.length} items · {formatCurrency(secTotalAmt)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Section mini progress bar */}
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-emerald-500' : anyStarted ? 'bg-amber-400' : 'bg-slate-300'}`}
                              style={{ width: `${secPct}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold w-10 text-right ${allDone ? 'text-emerald-600' : anyStarted ? 'text-amber-600' : 'text-slate-400'}`}>
                            {secPct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="divide-y divide-slate-50">
                      {items.map((item, localIdx) => {
                        const globalIdx = indices[localIdx]
                        const pct = item.progress || 0
                        const isDone = pct === 100
                        const isStarted = pct > 0

                        return (
                          <div key={localIdx} className={`px-5 py-3 transition-colors ${isDone ? 'bg-emerald-50/30' : ''}`}>
                            <div className="flex items-center gap-3">
                              {/* Item No */}
                              <span className="text-xs text-slate-400 font-mono w-10 flex-shrink-0">{item.itemNo}</span>

                              {/* Description */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'} truncate`}>
                                  {item.description}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {item.unit} · Qty {item.quantity?.toLocaleString()} · Rate {item.unitRate?.toLocaleString()} · <strong>AED {item.amount?.toLocaleString()}</strong>
                                </p>
                              </div>

                              {/* Progress input + bar */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Mini bar */}
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : isStarted ? 'bg-amber-400' : 'bg-slate-300'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {/* Percentage input */}
                                <div className="relative flex items-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={pct}
                                    onChange={e => updateItemProgress(globalIdx, e.target.value)}
                                    onFocus={e => e.target.select()}
                                    className={`w-16 text-right pr-5 pl-2 py-1 text-sm font-semibold rounded-md border transition-colors outline-none focus:ring-2 focus:ring-brand-400
                                      ${isDone
                                        ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                        : isStarted
                                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                                          : 'bg-slate-100 border-slate-300 text-slate-500'
                                      }`}
                                  />
                                  <span className={`absolute right-1.5 text-xs font-medium pointer-events-none
                                    ${isDone ? 'text-emerald-600' : isStarted ? 'text-amber-600' : 'text-slate-400'}`}>
                                    %
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          ) : null}
        </div>
      )}

      {/* ── Legacy work lists (projects without company_boq_id) ── */}
      {!project.company_boq_id && (
        <div className="space-y-6">
          {project.completed_works && project.completed_works.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-slate-900">Completed Works ({project.completed_works.length})</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {project.completed_works.map((work, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{work}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {project.partial_works && project.partial_works.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-amber-50">
                <Clock className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-slate-900">In Progress</h2>
              </div>
              <div className="p-6 space-y-4">
                {project.partial_works.map((work, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{work.name}</span>
                      <span className="text-xs font-bold text-slate-600">{work.progress}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressBarColor(work.progress)}`}
                        style={{ width: `${work.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.pending_works && project.pending_works.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-red-50">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h2 className="font-semibold text-slate-900">Pending Works ({project.pending_works.length})</h2>
              </div>
              <div className="p-6">
                <ul className="space-y-2">
                  {project.pending_works.map((work, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{work}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scope Changes */}
      {project.scope_changes && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mt-6">
          <h2 className="font-semibold text-slate-900 mb-3">Scope Changes</h2>
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700">{project.scope_changes}</div>
        </div>
      )}

      {/* Notes */}
      {project.notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
          <p className="text-sm text-blue-800">{project.notes}</p>
        </div>
      )}
    </div>
  )
}
