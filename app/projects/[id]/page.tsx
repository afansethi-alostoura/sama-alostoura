'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Calendar, Building2,
  CheckCircle2, CheckCircle, Clock, AlertCircle, Loader2, Sparkles, Save,
  FolderOpen, Link2, TrendingUp, TrendingDown, Pencil, X, ChevronDown, BarChart2,
} from 'lucide-react'
import { formatCurrency, formatDate, progressBarColor, statusBadge, statusLabel } from '@/lib/utils'
import { broadcastProjectUpdate } from '@/hooks/useAllProjects'
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
  renovation_boq_id?: string
}

interface BOQItem {
  section_no?: number
  section_name: string
  item_code: string
  description: string
  unit: string
  qty: number
  rate: number
  remarks?: string
  // monitoring fields
  quantity_done?: number
  progress?: number
  done?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const params = useParams()
  const id = params.id as string

  const [project,       setProject]       = useState<ProjectData | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [briefing,      setBriefing]      = useState('')
  const [briefingLoad,  setBriefingLoad]  = useState(false)

  // BOQ
  const [boqItems,    setBoqItems]    = useState<BOQItem[]>([])
  const [boqLoad,     setBoqLoad]     = useState(false)
  const [boqSaving,   setBoqSaving]   = useState(false)
  const [boqSaved,    setBoqSaved]    = useState(false)
  const [boqRecord,   setBoqRecord]   = useState<any>(null)
  const [boqExpanded,   setBoqExpanded]   = useState(false)
  const [boqCreating,   setBoqCreating]   = useState(false)
  const saveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boqInitSynced   = useRef(false)

  // Renovation BOQ
  const [renovationBoq, setRenovationBoq] = useState<any>(null)
  const [renovationBoqLoad, setRenovationBoqLoad] = useState(false)

  // Inline edit
  const [editing,    setEditing]    = useState(false)
  const [editForm,   setEditForm]   = useState<Partial<ProjectData & { qb_class_name: string }>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  // QB class linking
  const [qbClasses,         setQbClasses]         = useState<{ id: string; name: string }[]>([])
  const [qbClassName,       setQbClassName]       = useState('')
  const [qbSaving,          setQbSaving]          = useState(false)
  const [qbSaved,           setQbSaved]           = useState(false)
  const [qbIncomeSyncing,   setQbIncomeSyncing]   = useState(false)
  const [qbIncomeSynced,    setQbIncomeSynced]    = useState(false)

  // MBHRE Approved %
  const [mbhreApprovedPct, setMbhreApprovedPct] = useState<number | ''>('')
  const [mbhreEditMode,    setMbhreEditMode]    = useState(false)
  const [mbhreSaving,      setMbhreSaving]      = useState(false)
  const [mbhreSaved,       setMbhreSaved]       = useState(false)

  // Documents — only count loaded here; full UI is on /documents sub-pages
  const [documents, setDocuments] = useState<{ id: string }[]>([])

  // ── Load project ────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    fetch('/api/projects')
      .then(r => r.json())
      .then((list: StoredProject[]) => {
        const found = list.find(p => p.id === id)
        if (found) setProject(found as unknown as ProjectData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  // ── Load QB classes + set initial class name from project ───────────────────
  useEffect(() => {
    fetch('/api/quickbooks/class-list')
      .then(r => r.ok ? r.json() : { classes: [] })
      .then(d => setQbClasses(d.classes ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (project) setQbClassName((project as any).qb_class_name ?? '')
  }, [project])

  useEffect(() => {
    if (project) setMbhreApprovedPct(project.mbhre_approved_progress ?? '')
  }, [project])

  function openEdit() {
    if (!project) return
    setEditForm({
      name:               project.name,
      client_name:        project.client_name ?? '',
      location:           project.location,
      type:               project.type as any,
      status:             project.status as any,
      contract_value:     project.contract_value,
      received_amount:    project.received_amount,
      progress_percent:   project.progress_percent,
      current_stage:      project.current_stage ?? '',
      notes:              project.notes ?? '',
      start_date:         project.start_date ?? '',
      expected_completion: project.expected_completion ?? '',
      qb_class_name:      (project as any).qb_class_name ?? '',
    })
    setEditError('')
    setEditing(true)
  }

  async function saveEdit() {
    if (!project) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      const updated = await res.json()
      setProject(prev => prev ? { ...prev, ...updated } : prev)
      setQbClassName(updated.qb_class_name ?? '')
      setEditing(false)
      broadcastProjectUpdate()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function saveMbhreApproved() {
    if (!project || mbhreApprovedPct === '') return
    setMbhreSaving(true)
    try {
      const val = Math.max(0, Math.min(100, Number(mbhreApprovedPct)))
      await fetch(`/api/projects/${project.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mbhre_approved_progress: val }),
      })
      setProject(prev => prev ? { ...prev, mbhre_approved_progress: val } : prev)
      setMbhreEditMode(false)
      setMbhreSaved(true)
      setTimeout(() => setMbhreSaved(false), 3000)
      broadcastProjectUpdate()
    } catch {}
    finally { setMbhreSaving(false) }
  }

  async function saveQbClass() {
    if (!project) return
    setQbSaving(true)
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qb_class_name: qbClassName }),
      })
      setQbSaved(true)
      setTimeout(() => setQbSaved(false), 3000)
      broadcastProjectUpdate()
    } catch {}
    finally { setQbSaving(false) }
  }

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

  // ── Load Renovation BOQ ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.renovation_boq_id) return
    setRenovationBoqLoad(true)
    fetch(`/api/boq/renovation?id=${project.renovation_boq_id}`)
      .then(r => r.json())
      .then(data => { if (data?.id) setRenovationBoq(data) })
      .catch(() => {})
      .finally(() => setRenovationBoqLoad(false))
  }, [project?.renovation_boq_id])

  // ── Auto-sync BOQ progress → project.progress_percent on first load ─────────
  useEffect(() => {
    if (boqInitSynced.current || !project || boqItems.length === 0 || !boqRecord) return
    boqInitSynced.current = true
    const totalAmt = boqItems.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0)
    const newPct   = totalAmt > 0
      ? Math.round(boqItems.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0) * ((i.progress || 0) / 100), 0) / totalAmt * 100)
      : 0
    if (newPct === project.progress_percent) return
    fetch(`/api/projects/${project.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ progress_percent: newPct, current_stage: project.current_stage ?? '', boq_sections: [] }),
    }).then(() => {
      setProject(prev => prev ? { ...prev, progress_percent: newPct } : prev)
      broadcastProjectUpdate()
    }).catch(() => {})
  }, [boqItems, project, boqRecord])

  // ── Load Documents count (for badge on button) ─────────────────────────────
  useEffect(() => {
    if (!project?.id) return
    fetch(`/api/projects/${project.id}/documents`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [project?.id])

  // ── BOQ: weighted overall completion ────────────────────────────────────────
  const totalBOQAmt = boqItems.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0)
  const overallBOQPct = totalBOQAmt > 0
    ? Math.round(boqItems.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0) * ((i.progress || 0) / 100), 0) / totalBOQAmt * 100)
    : 0

  // ── BOQ: core save function ─────────────────────────────────────────────────
  const doSave = useCallback(async (updated: BOQItem[], record: any, proj: ProjectData) => {
    if (!record) return
    setBoqSaving(true)
    setBoqSaved(false)
    try {
      const totalAmt = updated.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0)
      const newPct   = totalAmt > 0
        ? Math.round(updated.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0) * ((i.progress || 0) / 100), 0) / totalAmt * 100)
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
      setBoqSaved(true)
      setTimeout(() => setBoqSaved(false), 3000)
      broadcastProjectUpdate()
    } catch {}
    finally { setBoqSaving(false) }
  }, [])

  // ── BOQ: debounced auto-save on input change ─────────────────────────────────
  const scheduleSave = useCallback((updated: BOQItem[], record: any, proj: ProjectData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(updated, record, proj), 800)
  }, [doSave])

  function updateItemProgress(globalIdx: number, raw: string) {
    const item    = boqItems[globalIdx]
    const val     = Math.max(0, Math.min(100, Number(raw) || 0))
    const qtyDone = item.qty > 0 ? Math.round((val / 100) * item.qty * 100) / 100 : (item.quantity_done ?? 0)
    const updated = boqItems.map((bi, i) => i === globalIdx ? { ...bi, progress: val, quantity_done: qtyDone, done: val === 100 } : bi)
    setBoqItems(updated)
    if (project && boqRecord) scheduleSave(updated, boqRecord, project)
  }

  function updateItemQuantityDone(globalIdx: number, raw: string) {
    const item    = boqItems[globalIdx]
    const done    = Math.max(0, Math.min(item.qty || 999999, Number(raw) || 0))
    const pct     = item.qty > 0 ? Math.min(100, Math.round((done / item.qty) * 100)) : 0
    const updated = boqItems.map((bi, i) => i === globalIdx ? { ...bi, quantity_done: done, progress: pct, done: pct === 100 } : bi)
    setBoqItems(updated)
    if (project && boqRecord) scheduleSave(updated, boqRecord, project)
  }

  // ── Create Company BOQ ──────────────────────────────────────────────────────
  async function createCompanyBOQ() {
    if (!project) return
    setBoqCreating(true)
    try {
      const res = await fetch('/api/boq/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_number: project.id.slice(0, 8),
          project_name:   project.name,
          area:           project.location,
          owner:          project.client_name || '',
          contractor:     'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
          items:          [],
        }),
      })
      const newBoq = await res.json()
      await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...project, company_boq_id: newBoq.id }),
      })
      setProject(prev => prev ? { ...prev, company_boq_id: newBoq.id } : prev)
      setBoqRecord(newBoq)
      setBoqItems([])
      setBoqExpanded(true)
      broadcastProjectUpdate()
    } catch {}
    finally { setBoqCreating(false) }
  }

  // ── Sync income from QB ─────────────────────────────────────────────────────
  async function syncIncomeFromQB() {
    if (!project) return
    const cls = (project as any).qb_class_name
    if (!cls) return
    setQbIncomeSyncing(true)
    try {
      const res  = await fetch(`/api/quickbooks/project-financials?class_name=${encodeURIComponent(cls)}`)
      if (!res.ok) return
      const data = await res.json()
      const received = Math.round((data.summary?.totalIncome    ?? 0) * 100) / 100
      const expenses = Math.round((data.summary?.totalExpenses  ?? 0) * 100) / 100
      await fetch(`/api/projects/${project.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ received_amount: received, total_expenses: expenses }),
      })
      setProject(prev => prev ? { ...prev, received_amount: received } : prev)
      setQbIncomeSynced(true)
      setTimeout(() => setQbIncomeSynced(false), 3000)
      broadcastProjectUpdate()
    } catch {}
    finally { setQbIncomeSyncing(false) }
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
  const boqSections = boqItems.reduce<Record<string, { items: BOQItem[]; indices: number[]; section_no: number }>>((acc, item, idx) => {
    const s = item.section_name || 'General'
    if (!acc[s]) acc[s] = { items: [], indices: [], section_no: item.section_no ?? 99 }
    acc[s].items.push(item)
    acc[s].indices.push(idx)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-8">

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
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/projects/${id}/accounting`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5" /> Financials
              </Link>
              <button
                onClick={openEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs">Contract Value</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(project.contract_value)}</p>
              {isMBHRE && project.mbhre_approved_amount && (
                <p className="text-xs text-slate-500 mt-1">MBHRE: {formatCurrency(project.mbhre_approved_amount)}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Inline Edit Form ─────────────────────────────────────────────────── */}
        {editing && (
          <div className="border-t border-slate-100 pt-5 mt-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Edit Project</h3>
              <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Project Name',    key: 'name',           type: 'text'   },
                { label: 'Client Name',     key: 'client_name',    type: 'text'   },
                { label: 'Location',        key: 'location',       type: 'text'   },
                { label: 'Contract Value',  key: 'contract_value', type: 'number' },
                { label: 'Start Date',      key: 'start_date',     type: 'date'   },
                { label: 'Expected Completion', key: 'expected_completion', type: 'date' },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(editForm as any)[key] ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={(editForm.status as string) ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current Stage</label>
                <input
                  type="text"
                  value={editForm.current_stage ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, current_stage: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editForm.notes ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
            </div>
            {editError && <p className="text-xs text-red-600 mt-3">{editError}</p>}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}


        {/* Progress & Certification Panel */}
        {(() => {
          const approvedPct = mbhreApprovedPct !== '' ? Number(mbhreApprovedPct) : (project.mbhre_approved_progress ?? null)
          const diff = approvedPct !== null ? effectivePct - approvedPct : null

          let alertBg = '', alertBorder = '', alertIcon = '', alertText = ''
          if (diff !== null) {
            if (diff > 5) {
              alertBg = 'bg-amber-50'; alertBorder = 'border-amber-200'
              alertIcon = '⚠️'
              alertText = `You are ${diff}% ahead of certification. You are eligible to prepare and submit a payment application.`
            } else if (diff >= -5) {
              alertBg = 'bg-emerald-50'; alertBorder = 'border-emerald-200'
              alertIcon = '✅'
              alertText = 'Work progress and certification are aligned. You can proceed with payment application.'
            } else {
              alertBg = 'bg-red-50'; alertBorder = 'border-red-200'
              alertIcon = '⚠️'
              alertText = `Certification is ${Math.abs(diff)}% ahead of actual progress. Review required before further application.`
            }
          }

          return (
            <div className="mb-5 space-y-3">
              {/* Work Completed */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    Work Completed
                    <span className="text-[10px] font-normal text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">System · BOQ weighted</span>
                    {boqSaving && <span className="text-xs text-slate-400">saving…</span>}
                  </span>
                  <span className="font-bold text-slate-900 text-base tabular-nums">{effectivePct}%</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${progressBarColor(effectivePct)}`} style={{ width: `${effectivePct}%` }} />
                </div>
              </div>

              {/* MBHRE Approved */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-600 font-medium flex items-center gap-1.5">
                    MBHRE / Consultant Approved
                    <span className="text-[10px] font-normal text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">Manual</span>
                    {mbhreSaved && <span className="text-[10px] text-emerald-600 font-semibold">Saved ✓</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    {mbhreEditMode ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number" min="0" max="100"
                          value={mbhreApprovedPct}
                          onChange={e => setMbhreApprovedPct(e.target.value === '' ? '' : Math.max(0, Math.min(100, Number(e.target.value))))}
                          onKeyDown={e => { if (e.key === 'Enter') saveMbhreApproved(); if (e.key === 'Escape') setMbhreEditMode(false) }}
                          autoFocus
                          className="w-16 text-center text-sm font-bold border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-sm text-slate-600">%</span>
                        <button
                          onClick={saveMbhreApproved}
                          disabled={mbhreSaving}
                          className="text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {mbhreSaving ? '…' : 'Save'}
                        </button>
                        <button onClick={() => setMbhreEditMode(false)} className="text-[10px] text-slate-400 hover:text-slate-600">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-700 text-base tabular-nums">
                          {approvedPct !== null ? `${approvedPct}%` : '—'}
                        </span>
                        <button
                          onClick={() => setMbhreEditMode(true)}
                          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded px-1.5 py-0.5 transition-colors"
                        >
                          {approvedPct !== null ? 'Edit' : '+ Set'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${approvedPct ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Difference row */}
              {diff !== null && (
                <div className="flex items-center gap-3 pt-0.5">
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Completed</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{effectivePct}%</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Approved</p>
                      <p className="text-sm font-bold text-indigo-700 tabular-nums">{approvedPct}%</p>
                    </div>
                    <div className={`rounded-lg px-3 py-2 ${diff > 5 ? 'bg-amber-50' : diff >= -5 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Difference</p>
                      <p className={`text-sm font-bold tabular-nums ${diff > 5 ? 'text-amber-700' : diff >= -5 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {diff > 0 ? '+' : ''}{diff}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment alert */}
              {diff !== null && (
                <div className={`rounded-lg border px-4 py-3 text-sm ${alertBg} ${alertBorder}`}>
                  <span className="mr-1">{alertIcon}</span>
                  <strong>
                    {diff > 5
                      ? `${diff}% ahead of certification`
                      : diff >= -5
                      ? 'Progress aligned with certification'
                      : `${Math.abs(diff)}% behind certification`}
                  </strong>
                  {' — '}
                  {alertText}
                </div>
              )}
            </div>
          )
        })()}

        {/* Financials */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="bg-emerald-50 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-600">Received</p>
              {(project as any).qb_class_name && (
                <button
                  onClick={syncIncomeFromQB}
                  disabled={qbIncomeSyncing}
                  title="Sync received amount from QuickBooks"
                  className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50 transition-colors"
                >
                  {qbIncomeSyncing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : qbIncomeSynced
                    ? <CheckCircle className="w-3 h-3 text-emerald-600" />
                    : <TrendingUp className="w-3 h-3" />}
                  {qbIncomeSynced ? 'Synced' : 'QB Sync'}
                </button>
              )}
            </div>
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
      <div className="mb-8">
        {/* ── Renovation BOQ panel ─────────────────────────────────────────── */}
        {project.renovation_boq_id ? (
          renovationBoqLoad ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading Renovation BOQ…
            </div>
          ) : renovationBoq ? (() => {
            // Compute grand total from sections
            const table = renovationBoq.sections ?? {}
            const rows: any[] = Array.isArray(table) ? [] : (table.rows ?? [])
            const cols: any[] = Array.isArray(table) ? [] : (table.columns ?? [])
            const amountCol = cols.find((c: any) => /amount|total/i.test(c.name))
            const grandTotal = amountCol
              ? rows.filter((r: any) => r.type === 'item').reduce((s: number, r: any) => s + (parseFloat(r.cells?.[amountCol.id]) || 0), 0)
              : 0
            const sectionRows = rows.filter((r: any) => r.type === 'section')
            return (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-800 text-white">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm tracking-wide uppercase">Renovation BOQ</span>
                    <span className="text-slate-400 text-xs">{renovationBoq.project_name || renovationBoq.project_location || ''}</span>
                  </div>
                  <Link
                    href={`/estimation/boq/renovation?id=${project.renovation_boq_id}`}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" /> Open BOQ
                  </Link>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-100 divide-x divide-slate-100">
                  <div className="px-5 py-4">
                    <p className="text-xs text-slate-500 mb-0.5">Project</p>
                    <p className="font-bold text-slate-900 text-sm truncate">{renovationBoq.project_name || '—'}</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-slate-500 mb-0.5">Owner</p>
                    <p className="font-bold text-slate-900 text-sm truncate">{renovationBoq.owner || renovationBoq.client_name || '—'}</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-slate-500 mb-0.5">Sections</p>
                    <p className="font-bold text-slate-900 text-sm">{sectionRows.length} sections</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-slate-500 mb-0.5">Grand Total</p>
                    <p className="font-bold text-emerald-700 text-sm">
                      {grandTotal > 0 ? `AED ${grandTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}` : '—'}
                    </p>
                  </div>
                </div>

                {/* Section list */}
                {sectionRows.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {sectionRows.map((r: any) => (
                      <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-800">{r.label}</span>
                        {amountCol && (() => {
                          const secItems = rows.filter((row: any) => {
                            const sIdx = rows.indexOf(r)
                            const rowIdx = rows.indexOf(row)
                            const nextSec = rows.findIndex((rr: any, i: number) => i > sIdx && rr.type === 'section')
                            return row.type === 'item' && rowIdx > sIdx && (nextSec === -1 || rowIdx < nextSec)
                          })
                          const secTotal = secItems.reduce((s: number, row: any) => s + (parseFloat(row.cells?.[amountCol.id]) || 0), 0)
                          return secTotal > 0 ? (
                            <span className="text-sm font-bold text-slate-700">
                              AED {secTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                            </span>
                          ) : null
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                {grandTotal > 0 && (
                  <div className="bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
                    <span className="font-bold text-sm tracking-wide">GRAND TOTAL</span>
                    <span className="font-bold text-lg">AED {grandTotal.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            )
          })() : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-500">Renovation BOQ could not be loaded.</p>
              <Link
                href={`/estimation/boq/renovation?id=${project.renovation_boq_id}`}
                className="text-sm text-blue-600 hover:underline"
              >
                Open in Estimation →
              </Link>
            </div>
          )
        ) : !project.company_boq_id ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">No Company BOQ</h3>
              <p className="text-sm text-slate-500">Create a BOQ to track quantities, progress, and costs for this project.</p>
            </div>
            <button
              onClick={createCompanyBOQ}
              disabled={boqCreating}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {boqCreating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : '+ Create Company BOQ'}
            </button>
          </div>
        ) : (
          boqLoad ? (
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

              {/* ── Collapsible Header ─────────────────────────────────────── */}
              <button
                onClick={() => setBoqExpanded(e => !e)}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm tracking-wide uppercase">BOQ Progress Tracker</span>
                  <span className="text-slate-400 text-xs">{boqItems.length} items</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${overallBOQPct === 100 ? 'bg-emerald-600' : overallBOQPct > 0 ? 'bg-amber-500' : 'bg-slate-600'}`}>
                    {overallBOQPct}% complete
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {boqSaving && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
                  {boqSaved && !boqSaving && <span className="text-xs text-emerald-400 font-semibold">Saved</span>}
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${boqExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* ── Summary Cards (always visible) ────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-100 divide-x divide-slate-100">
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-500 mb-0.5">Contract BOQ</p>
                  <p className="font-bold text-slate-900">AED {totalBOQAmt.toLocaleString('en-AE', { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-500 mb-0.5">Value Completed</p>
                  <p className="font-bold text-emerald-700">AED {Math.round(totalBOQAmt * overallBOQPct / 100).toLocaleString('en-AE')}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-500 mb-0.5">Value Remaining</p>
                  <p className="font-bold text-amber-700">AED {Math.round(totalBOQAmt * (100 - overallBOQPct) / 100).toLocaleString('en-AE')}</p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-slate-500 mb-0.5">Items Complete</p>
                  <p className="font-bold text-slate-900">{boqItems.filter(i => (i.progress || 0) === 100).length} <span className="text-slate-400 font-normal">/ {boqItems.length}</span></p>
                </div>
              </div>

              {/* Overall progress bar */}
              <div className="px-5 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${overallBOQPct === 100 ? 'bg-emerald-500' : overallBOQPct > 0 ? 'bg-amber-400' : 'bg-slate-300'}`}
                      style={{ width: `${overallBOQPct}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">{overallBOQPct}%</span>
                </div>
              </div>

              {/* ── Expanded Detail ────────────────────────────────────────── */}
              {boqExpanded && (
                <>
                  {/* BOQ Monitoring Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white">
                          <th className="px-3 py-2.5 text-left font-semibold border border-slate-600 w-16">ITEM</th>
                          <th className="px-3 py-2.5 text-left font-semibold border border-slate-600">DESCRIPTION</th>
                          <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-14">UNIT</th>
                          <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-20">TOTAL QTY</th>
                          <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-24 bg-emerald-900">QTY DONE</th>
                          <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-24 bg-amber-900">REMAINING</th>
                          <th className="px-3 py-2.5 text-right font-semibold border border-slate-600 w-28">VALUE (AED)</th>
                          <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-32">PROGRESS %</th>
                          <th className="px-3 py-2.5 text-center font-semibold border border-slate-600 w-28">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(boqSections)
                          .sort((a, b) => (a[1].section_no ?? 99) - (b[1].section_no ?? 99))
                          .map(([sectionName, { items, indices }]) => {
                          const secAmt     = items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0)
                          const secPct     = secAmt > 0
                            ? Math.round(items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0) * ((i.progress || 0) / 100), 0) / secAmt * 100)
                            : 0
                          const secNo      = items[0]?.section_no ?? ''
                          const allDone    = secPct === 100
                          const anyStarted = secPct > 0

                          return (
                            <React.Fragment key={sectionName}>
                              {/* Section header */}
                              <tr className="bg-blue-50 border-t-2 border-blue-200">
                                <td className="px-3 py-2 font-bold text-blue-800 border border-blue-200 text-xs">{secNo}</td>
                                <td colSpan={5} className="px-3 py-2 font-bold text-blue-800 uppercase tracking-wide border border-blue-200 text-sm">{sectionName}</td>
                                <td className="px-3 py-2 text-right font-bold text-blue-800 border border-blue-200 text-sm">
                                  {secAmt > 0 ? secAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                                </td>
                                <td className="px-3 py-2 border border-blue-200">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-500' : anyStarted ? 'bg-amber-400' : 'bg-slate-300'}`} style={{ width: `${secPct}%` }} />
                                    </div>
                                    <span className={`text-xs font-bold w-8 text-right ${allDone ? 'text-emerald-600' : anyStarted ? 'text-amber-600' : 'text-slate-400'}`}>{secPct}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 border border-blue-200 text-center">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${allDone ? 'bg-emerald-100 text-emerald-700' : anyStarted ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {allDone ? 'Completed' : anyStarted ? 'In Progress' : 'Not Started'}
                                  </span>
                                </td>
                              </tr>

                              {/* Item rows */}
                              {items.map((item, localIdx) => {
                                const globalIdx    = indices[localIdx]
                                const pct          = item.progress || 0
                                const isDone       = pct === 100
                                const isStarted    = pct > 0
                                const itemAmt      = (item.qty || 0) * (item.rate || 0)
                                const qtyDone      = item.quantity_done ?? (item.qty > 0 ? Math.round((pct / 100) * item.qty * 100) / 100 : 0)
                                const qtyRemaining = Math.max(0, (item.qty || 0) - qtyDone)
                                const status       = isDone ? 'Completed' : isStarted ? 'In Progress' : 'Not Started'
                                const statusClass  = isDone ? 'bg-emerald-100 text-emerald-700' : isStarted ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'

                                return (
                                  <tr key={`${globalIdx}-${item.item_code}`} className={`${isDone ? 'bg-emerald-50/40' : localIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/20 transition-colors`}>
                                    <td className="px-3 py-1.5 border border-slate-100 font-mono text-xs text-slate-500">{item.item_code}</td>
                                    <td className="px-3 py-1.5 border border-slate-100 text-slate-800 text-xs">{item.description}</td>
                                    <td className="px-3 py-1.5 border border-slate-100 text-center text-slate-500 font-mono text-xs">{item.unit}</td>
                                    <td className="px-3 py-1.5 border border-slate-100 text-center text-slate-600 text-xs font-medium">
                                      {item.qty > 0 ? item.qty.toLocaleString() : '—'}
                                    </td>

                                    {/* QTY DONE — editable */}
                                    <td className="px-2 py-1 border border-slate-100 bg-emerald-50/30">
                                      <input
                                        type="number" min="0" max={item.qty || undefined}
                                        value={qtyDone || ''}
                                        placeholder="0"
                                        onChange={e => updateItemQuantityDone(globalIdx, e.target.value)}
                                        onFocus={e => e.target.select()}
                                        className={`w-full text-center px-1 py-0.5 text-xs font-semibold rounded border outline-none focus:ring-1 focus:ring-emerald-400 transition-colors
                                          ${isDone ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : isStarted ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                      />
                                    </td>

                                    {/* QTY REMAINING */}
                                    <td className={`px-3 py-1.5 border border-slate-100 text-center text-xs font-medium ${isDone ? 'text-emerald-600' : isStarted ? 'text-amber-700' : 'text-slate-400'}`}>
                                      {isDone ? '✓' : item.qty > 0 ? qtyRemaining.toLocaleString() : '—'}
                                    </td>

                                    <td className="px-3 py-1.5 border border-slate-100 text-right font-medium text-slate-700 text-xs">
                                      {itemAmt > 0 ? itemAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                                    </td>

                                    {/* PROGRESS % — editable */}
                                    <td className="px-2 py-1 border border-slate-100">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                          <div className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : isStarted ? 'bg-amber-400' : 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
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

                                    {/* STATUS */}
                                    <td className="px-2 py-1 border border-slate-100 text-center">
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass}`}>{status}</span>
                                    </td>
                                  </tr>
                                )
                              })}

                              {/* Section subtotal */}
                              <tr className="bg-slate-100">
                                <td colSpan={6} className="px-3 py-1.5 text-right text-xs font-semibold text-slate-600 border border-slate-200 uppercase tracking-wide">
                                  {sectionName} — Total
                                </td>
                                <td className="px-3 py-1.5 text-right font-bold text-slate-900 border border-slate-200 text-xs">
                                  {secAmt > 0 ? secAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 }) : '—'}
                                </td>
                                <td className="px-3 py-1.5 border border-slate-200 text-center text-xs font-bold text-slate-600">{secPct}%</td>
                                <td className="px-3 py-1.5 border border-slate-200" />
                              </tr>
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grand Total + Save */}
                  <div className="border-t-2 border-slate-800 bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-sm tracking-wide">GRAND TOTAL</span>
                      <button
                        onClick={() => { if (project && boqRecord) doSave(boqItems, boqRecord, project) }}
                        disabled={boqSaving}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60
                          ${boqSaved ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
                      >
                        {boqSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : boqSaved ? <><CheckCircle className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save Progress</>}
                      </button>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Overall Progress</p>
                        <p className="text-lg font-bold">{overallBOQPct}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Contract BOQ</p>
                        <p className="text-lg font-bold">AED {totalBOQAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Summary Schedule */}
                  <div className="border-t border-slate-200">
                    <div className="bg-slate-700 text-white px-5 py-2.5">
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
                        {Object.entries(boqSections)
                          .sort((a, b) => (a[1].section_no ?? 99) - (b[1].section_no ?? 99))
                          .map(([sectionName, { items }], secIdx) => {
                          const secAmt = items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0), 0)
                          const secPct = secAmt > 0
                            ? Math.round(items.reduce((s, i) => s + (i.qty || 0) * (i.rate || 0) * ((i.progress || 0) / 100), 0) / secAmt * 100)
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
                          <td className="px-4 py-2.5 text-right font-bold text-base">{totalBOQAmt.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-base">{overallBOQPct}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          )
        )}
      </div>

      {/* ── Legacy work lists ────────────────────────────────────────────────── */}
      {!project.company_boq_id && !project.renovation_boq_id && (
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

      {/* ── Documents Button → new page ───────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          href={`/projects/${id}/documents`}
          className="inline-flex items-center gap-2.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-5 py-3 rounded-xl shadow-sm text-sm font-semibold transition-all"
        >
          <FolderOpen className="w-5 h-5" />
          Project Documents
          {documents.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{documents.length}</span>
          )}
        </Link>
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
