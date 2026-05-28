'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Calendar, Building2,
  CheckCircle2, Clock, AlertCircle, Loader2, Sparkles,
  FolderOpen, Upload, Trash2, ExternalLink, FileText,
  BarChart2, FlaskConical, ShieldCheck,
} from 'lucide-react'
import { getDemoProject } from '@/lib/demo-data'
import { formatCurrency, formatDate, progressBarColor, statusBadge, statusLabel } from '@/lib/utils'
import type { StoredProject } from '@/lib/projects-store'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  progress?: number
  done?: boolean
}

type FolderKey = 'drawings' | 'survey-reports' | 'lab-reports' | 'contracts-approvals'

interface DocRecord {
  id: string
  project_id: string
  folder: FolderKey
  original_name: string
  file_size: number
  mime_type: string
  public_url: string
  created_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FOLDERS: { key: FolderKey; label: string; Icon: React.ElementType; color: string }[] = [
  { key: 'drawings',             label: 'Drawings',              Icon: FileText,    color: 'blue'   },
  { key: 'survey-reports',       label: 'Survey Reports',        Icon: BarChart2,   color: 'green'  },
  { key: 'lab-reports',          label: 'Laboratory Reports',    Icon: FlaskConical,color: 'purple' },
  { key: 'contracts-approvals',  label: 'Contracts & Approvals', Icon: ShieldCheck, color: 'amber'  },
]

const FOLDER_COLORS: Record<string, string> = {
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  green:  'bg-green-50 border-green-200 text-green-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  amber:  'bg-amber-50 border-amber-200 text-amber-700',
}

const ACTIVE_COLORS: Record<string, string> = {
  blue:   'bg-blue-600 text-white border-blue-600',
  green:  'bg-green-600 text-white border-green-600',
  purple: 'bg-purple-600 text-white border-purple-600',
  amber:  'bg-amber-500 text-white border-amber-500',
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function fileEmoji(mime: string) {
  if (mime.includes('pdf'))   return '📄'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('word'))  return '📝'
  return '📎'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string

  const [project,       setProject]       = useState<ProjectData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [briefing,      setBriefing]      = useState('')
  const [briefingLoad,  setBriefingLoad]  = useState(false)

  // BOQ
  const [boqItems,  setBoqItems]  = useState<BOQItem[]>([])
  const [boqLoad,   setBoqLoad]   = useState(false)
  const [boqSaving, setBoqSaving] = useState(false)
  const [boqRecord, setBoqRecord] = useState<any>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Documents
  const [documents,    setDocuments]    = useState<DocRecord[]>([])
  const [docsLoad,     setDocsLoad]     = useState(false)
  const [activeFolder, setActiveFolder] = useState<FolderKey>('drawings')
  const [uploading,    setUploading]    = useState(false)
  const [supabaseOk,   setSupabaseOk]   = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Load project ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((list: StoredProject[]) => {
        const found = list.find(p => p.id === id)
        if (found) setProject(found as unknown as ProjectData)
        else {
          const demo = getDemoProject(id)
          if (demo) setProject(demo as unknown as ProjectData)
        }
      })
      .catch(() => { const d = getDemoProject(id); if (d) setProject(d as unknown as ProjectData) })
      .finally(() => setLoading(false))
  }, [id])

  // ── Load BOQ ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.company_boq_id) return
    setBoqLoad(true)
    fetch(`/api/boq/company?id=${project.company_boq_id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.items) {
          setBoqRecord(data)
          setBoqItems(data.items.map((i: BOQItem) => ({
            ...i,
            progress: i.progress ?? (i.done ? 100 : 0),
          })))
        }
      })
      .catch(() => {})
      .finally(() => setBoqLoad(false))
  }, [project?.company_boq_id])

  // ── Load Documents ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return
    setDocsLoad(true)
    fetch(`/api/projects/${project.id}/documents`)
      .then(r => {
        if (r.status === 503) { setSupabaseOk(false); return [] }
        return r.json()
      })
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setDocsLoad(false))
  }, [project?.id])

  // ── BOQ: weighted overall completion ────────────────────────────────────────
  const totalBOQAmt = boqItems.reduce((s, i) => s + (i.amount || 0), 0)
  const overallBOQPct = totalBOQAmt > 0
    ? Math.round(boqItems.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / totalBOQAmt * 100)
    : 0

  // ── BOQ: debounced save ─────────────────────────────────────────────────────
  const scheduleSave = useCallback((updated: BOQItem[], record: any, proj: ProjectData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!record) return
      setBoqSaving(true)
      try {
        const totalAmt = updated.reduce((s, i) => s + (i.amount || 0), 0)
        const newPct   = totalAmt > 0
          ? Math.round(updated.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / totalAmt * 100)
          : 0
        await Promise.all([
          fetch('/api/boq/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: record.id, project_number: record.project_number, project_name: record.project_name, area: record.area, owner: record.owner, contractor: record.contractor, items: updated }),
          }),
          fetch(`/api/projects/${proj.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress_percent: newPct, current_stage: proj.current_stage ?? '', boq_sections: [] }),
          }),
        ])
        setProject(prev => prev ? { ...prev, progress_percent: newPct } : prev)
      } catch {}
      finally { setBoqSaving(false) }
    }, 800)
  }, [])

  function updateItemProgress(globalIdx: number, raw: string) {
    const val     = Math.max(0, Math.min(100, Number(raw) || 0))
    const updated = boqItems.map((item, i) => i === globalIdx ? { ...item, progress: val, done: val === 100 } : item)
    setBoqItems(updated)
    if (project && boqRecord) scheduleSave(updated, boqRecord, project)
  }

  // ── Documents: upload ───────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !project) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', activeFolder)
      const res = await fetch(`/api/projects/${project.id}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const doc = await res.json()
        setDocuments(prev => [doc, ...prev])
      }
    } catch {}
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function handleDelete(docId: string) {
    if (!project) return
    await fetch(`/api/projects/${project.id}/documents?docId=${docId}`, { method: 'DELETE' })
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  // ── Brief Me ────────────────────────────────────────────────────────────────
  async function handleBriefMe() {
    if (!project) return
    setBriefingLoad(true)
    try {
      const res  = await fetch('/api/agents/project-manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, projectData: project }) })
      const data = await res.json()
      setBriefing(data.briefing || 'No briefing available')
    } catch (err) {
      setBriefing(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
    } finally { setBriefingLoad(false) }
  }

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-8 text-slate-500">Loading project…</div>
  if (!project) return (
    <div className="p-8">
      <Link href="/projects" className="text-slate-500 hover:text-slate-700">← Back to Projects</Link>
      <p className="mt-4 text-slate-500">Project not found.</p>
    </div>
  )

  const outstanding  = project.contract_value - project.received_amount
  const pctCollected = Math.round((project.received_amount / project.contract_value) * 100)
  const isMBHRE      = project.mbhre_approved_amount !== undefined
  const effectivePct = project.company_boq_id && boqItems.length > 0 ? overallBOQPct : project.progress_percent

  // Grouped BOQ sections
  const boqSections = boqItems.reduce<Record<string, { items: BOQItem[]; indices: number[] }>>((acc, item, idx) => {
    const s = item.section || 'General'
    if (!acc[s]) acc[s] = { items: [], indices: [] }
    acc[s].items.push(item)
    acc[s].indices.push(idx)
    return acc
  }, {})

  // Docs for active folder
  const folderDocs = documents.filter(d => d.folder === activeFolder)
  const folderMeta = FOLDERS.find(f => f.key === activeFolder)!

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Back */}
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> All Projects
      </Link>

      {/* ── Header Card ──────────────────────────────────────────────────────── */}
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
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">MBHRE Funded</span>
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

        {/* Progress bars */}
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
              <div className={`h-full rounded-full transition-all duration-500 ${progressBarColor(effectivePct)}`} style={{ width: `${effectivePct}%` }} />
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
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${project.mbhre_approved_progress}%` }} />
              </div>
            </div>
          )}

          {isMBHRE && project.mbhre_approved_progress !== undefined && project.mbhre_approved_progress < effectivePct && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              💡 <strong>{effectivePct - project.mbhre_approved_progress}% ahead of MBHRE approval</strong> — Ready to submit stage report for next payment
            </div>
          )}
        </div>

        {/* Financials */}
        <div className={`grid gap-4 grid-cols-2 ${isMBHRE ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          <div className="bg-emerald-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Received</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(project.received_amount)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{pctCollected}% collected</p>
          </div>
          <div className="bg-amber-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Outstanding</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(outstanding)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Retention (10%)</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(project.received_amount * 0.1)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-600">Expected End</p>
            <p className="font-bold text-slate-900 mt-0.5">{formatDate(project.expected_completion)}</p>
          </div>
          {isMBHRE && (
            <div className="bg-indigo-50 rounded-lg px-4 py-3">
              <p className="text-xs text-slate-600">MBHRE Approved</p>
              <p className="font-bold text-slate-900 mt-0.5">{project.mbhre_approved_progress != null ? `${project.mbhre_approved_progress}%` : 'Pending'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Brief Me */}
      <div className="mb-6">
        <button
          onClick={handleBriefMe}
          disabled={briefingLoad}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 shadow-sm"
        >
          {briefingLoad ? <><Loader2 className="w-4 h-4 animate-spin" /> Briefing…</> : <><Sparkles className="w-4 h-4" /> Brief Me</>}
        </button>
      </div>

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

      {/* ── BOQ Progress Tracker ─────────────────────────────────────────────── */}
      {project.company_boq_id && (
        <div className="mb-8">
          {boqLoad ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading BOQ…
            </div>
          ) : boqItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex flex-col items-center justify-center gap-3 text-slate-400">
              <AlertCircle className="w-8 h-8 opacity-40" />
              <p className="text-sm">BOQ items could not be loaded.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-3 py-2.5 text-left font-semibold border border-slate-600 w-8">N</th>
                      <th className="px-3 py-2.5 text-left font-semibold border border-slate-600 w-16">ITEM</th>
                      <th className="px-3 py-2.5 text-left font-semibold border border-slate-600">TASK DESCRIPTION</th>
                      <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-14">UNIT</th>
                      <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-16">QTY</th>
                      <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-20">RATE</th>
                      <th className="px-3 py-2.5 text-right font-semibold border border-slate-600 w-28">AMOUNT (AED)</th>
                      <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-28">PROGRESS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(boqSections).map(([sectionName, { items, indices }], secIdx) => {
                      const secAmt  = items.reduce((s, i) => s + (i.amount || 0), 0)
                      const secPct  = secAmt > 0
                        ? Math.round(items.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / secAmt * 100)
                        : 0
                      const allDone    = secPct === 100
                      const anyStarted = secPct > 0

                      return (
                        <React.Fragment key={sectionName}>
                          {/* Section header row */}
                          <tr className="bg-blue-50 border-t-2 border-blue-200">
                            <td className="px-3 py-2 font-bold text-blue-800 border border-blue-200 text-sm">{secIdx + 1}</td>
                            <td colSpan={5} className="px-3 py-2 font-bold text-blue-800 uppercase tracking-wide border border-blue-200 text-sm">{sectionName}</td>
                            <td className="px-3 py-2 text-right font-bold text-blue-800 border border-blue-200 text-sm">
                              {secAmt > 0 ? secAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className="px-3 py-2 border border-blue-200">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-500' : anyStarted ? 'bg-amber-400' : 'bg-slate-300'}`}
                                    style={{ width: `${secPct}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold w-8 text-right ${allDone ? 'text-emerald-600' : anyStarted ? 'text-amber-600' : 'text-slate-400'}`}>{secPct}%</span>
                              </div>
                            </td>
                          </tr>

                          {/* Item rows */}
                          {items.map((item, localIdx) => {
                            const globalIdx = indices[localIdx]
                            const pct       = item.progress || 0
                            const isDone    = pct === 100
                            const isStarted = pct > 0
                            const subTotal  = item.amount || 0

                            return (
                              <tr key={globalIdx} className={`${isDone ? 'bg-emerald-50/40' : localIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/20 transition-colors`}>
                                <td className="px-3 py-1.5 border border-slate-100 text-slate-400 text-xs" />
                                <td className="px-3 py-1.5 border border-slate-100 font-mono text-xs text-slate-500">{item.itemNo}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-slate-800">{item.description}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-center text-slate-500 font-mono text-xs">{item.unit}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-center text-slate-600 text-xs">{item.quantity > 0 ? item.quantity.toLocaleString() : ''}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-center text-slate-600 text-xs">{item.unitRate > 0 ? item.unitRate.toLocaleString() : ''}</td>
                                <td className="px-3 py-1.5 border border-slate-100 text-right font-medium text-slate-700 text-xs">
                                  {subTotal > 0 ? subTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : ''}
                                </td>
                                <td className="px-2 py-1 border border-slate-100">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : isStarted ? 'bg-amber-400' : 'bg-slate-300'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <div className="relative flex-shrink-0">
                                      <input
                                        type="number" min="0" max="100" value={pct}
                                        onChange={e => updateItemProgress(globalIdx, e.target.value)}
                                        onFocus={e => e.target.select()}
                                        className={`w-14 text-right pr-4 pl-1 py-0.5 text-xs font-semibold rounded border outline-none focus:ring-1 focus:ring-blue-400 transition-colors
                                          ${isDone ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : isStarted ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-blue-50/50 border-blue-100 text-slate-600'}`}
                                      />
                                      <span className={`absolute right-1 top-1/2 -translate-y-1/2 text-xs pointer-events-none ${isDone ? 'text-emerald-600' : isStarted ? 'text-amber-600' : 'text-slate-400'}`}>%</span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}

                          {/* Section subtotal row */}
                          <tr className="bg-slate-100">
                            <td colSpan={6} className="px-3 py-1.5 text-right text-xs font-semibold text-slate-600 border border-slate-200 uppercase tracking-wide">
                              {sectionName} — Section Total
                            </td>
                            <td className="px-3 py-1.5 text-right font-bold text-slate-900 border border-slate-200 text-xs">
                              {secAmt > 0 ? secAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className="px-3 py-1.5 border border-slate-200" />
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grand Total bar */}
              <div className="border-t-2 border-slate-800 bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <span className="font-bold text-sm tracking-wide">GRAND TOTAL</span>
                  {boqSaving && <span className="text-xs text-slate-400">saving…</span>}
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Overall Progress</p>
                    <p className="text-lg font-bold">{overallBOQPct}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Contract Value</p>
                    <p className="text-lg font-bold">AED {totalBOQAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Summary Schedule */}
              <div className="border-t border-slate-200">
                <div className="bg-slate-800 text-white px-5 py-2.5">
                  <h3 className="font-bold text-sm tracking-wide">SUMMARY SCHEDULE</h3>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-2 text-left font-semibold text-slate-600 border border-slate-200 w-10">N</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-600 border border-slate-200">DESCRIPTION</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-600 border border-slate-200 w-40">AMOUNT (AED)</th>
                      <th className="px-4 py-2 text-center font-semibold text-slate-600 border border-slate-200 w-36">PROGRESS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(boqSections).map(([sectionName, { items }], secIdx) => {
                      const secAmt = items.reduce((s, i) => s + (i.amount || 0), 0)
                      const secPct = secAmt > 0
                        ? Math.round(items.reduce((s, i) => s + (i.amount || 0) * ((i.progress || 0) / 100), 0) / secAmt * 100)
                        : 0
                      return (
                        <tr key={sectionName} className={secIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="px-4 py-1.5 border border-slate-100 font-medium text-slate-700">{secIdx + 1}</td>
                          <td className="px-4 py-1.5 border border-slate-100 text-slate-700">{sectionName}</td>
                          <td className="px-4 py-1.5 border border-slate-100 text-right font-semibold text-slate-900">
                            {secAmt > 0 ? secAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                          </td>
                          <td className="px-4 py-1.5 border border-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${secPct === 100 ? 'bg-emerald-500' : secPct > 0 ? 'bg-amber-400' : 'bg-slate-300'}`}
                                  style={{ width: `${secPct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold w-8 text-right ${secPct === 100 ? 'text-emerald-600' : secPct > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{secPct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-white">
                      <td colSpan={2} className="px-4 py-2.5 font-bold tracking-wide">GRAND TOTAL</td>
                      <td className="px-4 py-2.5 text-right font-bold text-base">
                        {totalBOQAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-base">{overallBOQPct}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Legacy work lists ────────────────────────────────────────────────── */}
      {!project.company_boq_id && (
        <div className="space-y-6 mb-8">
          {project.completed_works && project.completed_works.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-semibold text-slate-900">Completed Works ({project.completed_works.length})</h2>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {project.completed_works.map((work, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">{work}</span>
                  </div>
                ))}
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
                      <span className="text-xs font-bold">{work.progress}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${progressBarColor(work.progress)}`} style={{ width: `${work.progress}%` }} />
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

      {/* ── Documents Section ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-slate-600" />
            <h2 className="font-semibold text-slate-900">Project Documents</h2>
            <span className="text-xs text-slate-500">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>
          </div>
          {!supabaseOk && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Supabase Storage required
            </span>
          )}
        </div>

        {/* Folder tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-100 overflow-x-auto">
          {FOLDERS.map(({ key, label, Icon, color }) => {
            const count    = documents.filter(d => d.folder === key).length
            const isActive = activeFolder === key
            return (
              <button
                key={key}
                onClick={() => setActiveFolder(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium whitespace-nowrap transition-all ${
                  isActive ? ACTIVE_COLORS[color] : `border-slate-200 text-slate-600 hover:${FOLDER_COLORS[color]}`
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* File list for active folder */}
        <div className="p-4">
          {docsLoad ? (
            <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !supabaseOk ? (
            <div className="text-center py-8 text-slate-400">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Configure Supabase Storage to enable file uploads.</p>
              <p className="text-xs mt-1">Run <code className="bg-slate-100 px-1 rounded">supabase/project-documents-schema.sql</code> in your Supabase SQL Editor.</p>
            </div>
          ) : folderDocs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <folderMeta.Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No files in {folderMeta.label} yet.</p>
              <p className="text-xs mt-1">Upload PDFs, images or Excel files below.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {folderDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                  <span className="text-xl flex-shrink-0">{fileEmoji(doc.mime_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.original_name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={doc.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Open"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          {supabaseOk && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 hover:border-brand-400 text-slate-500 hover:text-brand-600 rounded-lg text-sm font-medium transition-all disabled:opacity-50 w-full justify-center"
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                  : <><Upload className="w-4 h-4" /> Upload to {folderMeta.label}</>
                }
              </button>
              <p className="text-xs text-slate-400 text-center mt-2">PDF, images, Excel — max 50 MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Scope Changes */}
      {project.scope_changes && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-3">Scope Changes</h2>
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700">{project.scope_changes}</div>
        </div>
      )}

      {/* Notes */}
      {project.notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800">{project.notes}</p>
        </div>
      )}
    </div>
  )
}
