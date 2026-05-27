'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Calendar, Building2,
  CheckCircle2, Clock, AlertCircle, Loader2,
  Sparkles, TrendingUp, Square, CheckSquare,
} from 'lucide-react'
import { getDemoProject } from '@/lib/demo-data'
import { formatCurrency, formatDate, progressBarColor, statusBadge, statusLabel } from '@/lib/utils'
import type { StoredProject } from '@/lib/projects-store'
import { ProgressUpdateModal, type BOQSection } from '@/components/projects/progress-update-modal'

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
  boq_sections?: BOQSection[]
  company_boq_id?: string
}

interface BOQItem {
  id?: string
  itemNo: string | number
  section: string
  description: string
  unit: string
  quantity: number
  unitRate: number
  amount: number
  done?: boolean
}

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string>('')
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)

  // BOQ tracker state
  const [boqItems, setBoqItems] = useState<BOQItem[]>([])
  const [boqLoading, setBoqLoading] = useState(false)
  const [boqSaving, setBoqSaving] = useState(false)
  const [boqRecord, setBoqRecord] = useState<any>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((projects: StoredProject[]) => {
        const stored = projects.find(p => p.id === id)
        if (stored) {
          setProject(stored as unknown as ProjectData)
        } else {
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
        if (data && data.items) {
          setBoqRecord(data)
          setBoqItems(data.items)
        }
      })
      .catch(() => {})
      .finally(() => setBoqLoading(false))
  }, [project?.company_boq_id])

  const toggleItem = useCallback(async (itemIdx: number) => {
    if (!boqRecord || boqSaving) return

    const updated = boqItems.map((item, i) =>
      i === itemIdx ? { ...item, done: !item.done } : item
    )
    setBoqItems(updated)

    setBoqSaving(true)
    try {
      await fetch('/api/boq/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: boqRecord.id,
          project_number: boqRecord.project_number,
          project_name: boqRecord.project_name,
          area: boqRecord.area,
          owner: boqRecord.owner,
          contractor: boqRecord.contractor,
          items: updated,
        }),
      })
    } catch {}
    finally { setBoqSaving(false) }
  }, [boqItems, boqRecord, boqSaving])

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

  // BOQ tracker computed values
  const doneItems = boqItems.filter(i => i.done)
  const pendingItems = boqItems.filter(i => !i.done)
  const doneAmount = doneItems.reduce((s, i) => s + (i.amount || 0), 0)
  const pendingAmount = pendingItems.reduce((s, i) => s + (i.amount || 0), 0)
  const boqCompletionPct = boqItems.length > 0
    ? Math.round((doneItems.length / boqItems.length) * 100)
    : 0

  // Group items by section
  const sections = boqItems.reduce<Record<string, BOQItem[]>>((acc, item) => {
    const sec = item.section || 'General'
    if (!acc[sec]) acc[sec] = []
    acc[sec].push(item)
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
              <span className="text-slate-600"><strong>Actual Work Completion</strong></span>
              <span className="font-bold text-slate-800">{project.progress_percent}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressBarColor(project.progress_percent)}`}
                style={{ width: `${project.progress_percent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Based on completed &amp; in-progress work items</p>
          </div>

          {isMBHRE && project.mbhre_approved_progress !== undefined && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-600"><strong>MBHRE Approved Progress</strong></span>
                <span className="font-bold text-indigo-800">{project.mbhre_approved_progress}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-indigo-500"
                  style={{ width: `${project.mbhre_approved_progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">What MBHRE has officially approved &amp; paid against</p>
            </div>
          )}

          {isMBHRE && project.mbhre_approved_progress !== undefined && project.mbhre_approved_progress < project.progress_percent && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              💡 <strong>{project.progress_percent - project.mbhre_approved_progress}% ahead of MBHRE approval</strong> — Ready to submit stage report for next payment
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

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowProgressModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <TrendingUp className="w-4 h-4" /> Update Progress
        </button>

<button
          onClick={handleBriefMe}
          disabled={briefingLoading}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 shadow-sm"
        >
          {briefingLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Briefing…</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Brief Me</>
          )}
        </button>
      </div>

      {/* Progress Update Modal */}
      {showProgressModal && project && (
        <ProgressUpdateModal
          projectId={project.id}
          projectName={project.name}
          contractValue={project.contract_value}
          initialSections={project.boq_sections ?? []}
          initialStage={project.current_stage ?? ''}
          onClose={() => setShowProgressModal(false)}
          onSaved={(pct, stage, sections) => {
            setProject(prev => prev
              ? { ...prev, progress_percent: pct, current_stage: stage, boq_sections: sections }
              : prev
            )
          }}
        />
      )}

      {/* AI Briefing Response */}
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

      {/* Work Sections */}
      <div className="space-y-6">

        {/* ── BOQ Item Tracker (projects with company_boq_id) ── */}
        {project.company_boq_id && (
          <>
            {boqLoading ? (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 flex items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading BOQ items…
              </div>
            ) : boqItems.length > 0 ? (
              <>
                {/* Summary bar */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-semibold text-slate-900 text-lg">BOQ Work Tracker</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Tick each item when the work is done</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {boqSaving && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>}
                    </div>
                  </div>

                  {/* Completion bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-600">Items completed</span>
                      <span className="font-bold text-slate-800">{doneItems.length} / {boqItems.length} ({boqCompletionPct}%)</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressBarColor(boqCompletionPct)}`}
                        style={{ width: `${boqCompletionPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Done / Remaining amounts */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-lg px-4 py-3">
                      <p className="text-xs text-slate-600">Done</p>
                      <p className="font-bold text-emerald-700 mt-0.5">{formatCurrency(doneAmount)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{doneItems.length} items</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg px-4 py-3">
                      <p className="text-xs text-slate-600">Remaining</p>
                      <p className="font-bold text-amber-700 mt-0.5">{formatCurrency(pendingAmount)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{pendingItems.length} items</p>
                    </div>
                  </div>
                </div>

                {/* Items by section */}
                {Object.entries(sections).map(([sectionName, items]) => {
                  const secDone = items.filter(i => i.done).length
                  const secTotal = items.length
                  const secDoneAmt = items.filter(i => i.done).reduce((s, i) => s + (i.amount || 0), 0)
                  const secTotalAmt = items.reduce((s, i) => s + (i.amount || 0), 0)
                  const secPct = secTotal > 0 ? Math.round((secDone / secTotal) * 100) : 0

                  return (
                    <div key={sectionName} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                      {/* Section header */}
                      <div className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between ${secDone === secTotal ? 'bg-emerald-50' : secDone > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          {secDone === secTotal
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            : secDone > 0
                              ? <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              : <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          }
                          <h3 className="font-semibold text-slate-800 text-sm">{sectionName}</h3>
                          <span className="text-xs text-slate-500">{secDone}/{secTotal} done</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{formatCurrency(secDoneAmt)} / {formatCurrency(secTotalAmt)}</span>
                          <span className={`text-xs font-bold ${secPct === 100 ? 'text-emerald-600' : secPct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {secPct}%
                          </span>
                        </div>
                      </div>

                      {/* Items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <th className="text-left px-4 py-2 text-slate-500 font-medium w-8">✓</th>
                              <th className="text-left px-4 py-2 text-slate-500 font-medium w-10">No.</th>
                              <th className="text-left px-4 py-2 text-slate-500 font-medium">Description</th>
                              <th className="text-right px-4 py-2 text-slate-500 font-medium w-14">Unit</th>
                              <th className="text-right px-4 py-2 text-slate-500 font-medium w-16">Qty</th>
                              <th className="text-right px-4 py-2 text-slate-500 font-medium w-24">Rate</th>
                              <th className="text-right px-4 py-2 text-slate-500 font-medium w-28">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {items.map((item, itemIdx) => {
                              const globalIdx = boqItems.findIndex(
                                bi => bi.section === item.section && bi.itemNo === item.itemNo && bi.description === item.description
                              )
                              return (
                                <tr
                                  key={itemIdx}
                                  onClick={() => toggleItem(globalIdx)}
                                  className={`cursor-pointer transition-colors hover:bg-slate-50 ${item.done ? 'bg-emerald-50/40' : ''}`}
                                >
                                  <td className="px-4 py-2.5">
                                    {item.done
                                      ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                                      : <Square className="w-4 h-4 text-slate-300" />
                                    }
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-400 font-mono">{item.itemNo}</td>
                                  <td className={`px-4 py-2.5 ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                    {item.description}
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-500">{item.unit}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{item.quantity?.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{item.unitRate?.toLocaleString()}</td>
                                  <td className={`px-4 py-2.5 text-right font-semibold ${item.done ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {item.amount?.toLocaleString()}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : null}
          </>
        )}

        {/* ── Legacy work lists (for projects without company_boq_id) ── */}
        {!project.company_boq_id && (
          <>
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
          </>
        )}

        {/* Scope Changes */}
        {project.scope_changes && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Scope Changes</h2>
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700">
              {project.scope_changes}
            </div>
          </div>
        )}

        {/* Notes */}
        {project.notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">{project.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
