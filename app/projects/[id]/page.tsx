'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Building2, CheckCircle2, Clock, AlertCircle, Loader2, Sparkles, TrendingUp } from 'lucide-react'
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
}

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<string>('')
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)

  useEffect(() => {
    // Try stored projects first, fall back to demo
    fetch('/api/projects')
      .then(r => r.json())
      .then((projects: StoredProject[]) => {
        const stored = projects.find(p => p.id === id)
        if (stored) {
          setProject(stored as unknown as ProjectData)
        } else {
          const demo = getDemoProject(id)
          if (demo) {
            setProject(demo as unknown as ProjectData)
          }
        }
      })
      .catch(() => {
        const demo = getDemoProject(id)
        if (demo) setProject(demo as unknown as ProjectData)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleBriefMe() {
    if (!project) return
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/agents/project-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          projectData: project,
        }),
      })
      const data = await res.json()
      setBriefing(data.briefing || 'No briefing available')
    } catch (err) {
      setBriefing(`Error: ${err instanceof Error ? err.message : 'Failed to get briefing'}`)
    } finally {
      setBriefingLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-slate-500">Loading project…</div>
  }

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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Projects
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-5">
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
          {/* Actual Work Completion */}
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
            <p className="text-xs text-slate-500 mt-1">Based on completed & in-progress work items</p>
          </div>

          {/* MBHRE Approved Progress (if applicable) */}
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
              <p className="text-xs text-slate-500 mt-1">What MBHRE has officially approved & paid against</p>
            </div>
          )}

          {/* Gap indicator */}
          {isMBHRE && project.mbhre_approved_progress !== undefined && project.mbhre_approved_progress < project.progress_percent && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              💡 <strong>{project.progress_percent - project.mbhre_approved_progress}% ahead of MBHRE approval</strong> — Ready to submit stage report for next payment
            </div>
          )}
        </div>

        {/* Financials Grid */}
        <div className={`grid gap-4 ${isMBHRE ? 'grid-cols-5' : 'grid-cols-4'}`}>
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
              <p className="font-bold text-slate-900 mt-0.5">{project.mbhre_approved_progress}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Progress</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Update Progress */}
        <button
          onClick={() => setShowProgressModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <TrendingUp className="w-4 h-4" /> Update Progress
        </button>

        {/* Brief Me */}
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
              // Simple markdown rendering
              if (!line.trim()) return <div key={i} className="h-2" />
              if (line.startsWith('###')) return <h3 key={i} className="font-bold text-slate-900 mt-4 mb-2">{line.replace('### ', '')}</h3>
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-slate-800 mt-2">{line.replace(/\*\*/g, '')}</p>
              if (line.startsWith('• ') || line.startsWith('- ')) return <li key={i} className="ml-4 text-slate-700">{line.substring(2)}</li>
              return <p key={i} className="text-slate-700 leading-relaxed">{line}</p>
            })}
          </div>
        </div>
      )}

      {/* Work Stages */}
      <div className="space-y-6">

        {/* BOQ Sections Progress (shown when sections exist) */}
        {project.boq_sections && project.boq_sections.length > 0 && (() => {
          // Derive all work status sections from boq_sections — single source of truth
          const completedSections = project.boq_sections!.filter(s => (s.progress ?? 0) === 100)
          const partialSections   = project.boq_sections!.filter(s => (s.progress ?? 0) > 0 && (s.progress ?? 0) < 100)
          const pendingSections   = project.boq_sections!.filter(s => (s.progress ?? 0) === 0)

          return (
            <>
              {/* BOQ Section Progress table */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">BOQ Section Progress</h2>
                  <button
                    onClick={() => setShowProgressModal(true)}
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-xs font-semibold transition-colors"
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Update
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {project.boq_sections!.map((s, i) => {
                    const pct = s.progress ?? 0
                    const barC = pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
                    return (
                      <div key={i} className="flex items-center gap-4 px-6 py-3">
                        <div className="w-5 flex-shrink-0">
                          {pct === 100
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            : pct > 0
                              ? <Clock className="w-4 h-4 text-amber-500" />
                              : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                          }
                        </div>
                        <span className="flex-1 text-sm text-slate-700 font-medium">{s.section}</span>
                        <span className="text-xs text-slate-400 w-28 text-right">AED {s.amount.toLocaleString()}</span>
                        <div className="flex items-center gap-2 w-40">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barC}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-semibold w-8 text-right ${pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Completed Works — derived from boq_sections */}
              {completedSections.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-emerald-50">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h2 className="font-semibold text-slate-900">Completed Works ({completedSections.length})</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {completedSections.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-700">{s.section}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* In Progress — derived from boq_sections */}
              {partialSections.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-amber-50">
                    <Clock className="w-5 h-5 text-amber-600" />
                    <h2 className="font-semibold text-slate-900">In Progress ({partialSections.length})</h2>
                  </div>
                  <div className="p-6 space-y-4">
                    {partialSections.map((s, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">{s.section}</span>
                          <span className="text-xs font-bold text-slate-600">{s.progress ?? 0}%</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressBarColor(s.progress ?? 0)}`}
                            style={{ width: `${s.progress ?? 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Works — derived from boq_sections */}
              {pendingSections.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-red-50">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h2 className="font-semibold text-slate-900">Pending Works ({pendingSections.length})</h2>
                  </div>
                  <div className="p-6">
                    <ul className="space-y-2">
                      {pendingSections.map((s, i) => (
                        <li key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-700">{s.section}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {/* Legacy work sections — only shown for projects WITHOUT boq_sections */}
        {(!project.boq_sections || project.boq_sections.length === 0) && (
          <>
            {/* Completed Works */}
            {project.completed_works && project.completed_works.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-emerald-50">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-slate-900">Completed Works ({project.completed_works.length})</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-3">
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

            {/* Partial Works */}
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

            {/* Pending Works */}
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
