'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, CheckCircle2,
  Upload, Sparkles, X, FileText,
} from 'lucide-react'

const UNITS = ['m²', 'm', 'm³', 'No', 'Set', 'kg', 'L.S', 'Lot', 'Roll', 'Bag', 'Sheet', 'Point', 'Item', 'Day']

interface BOQItem {
  id: string
  description: string
  unit: string
  quantity: number
  remarks: string
}

interface BOQSection {
  id: string
  name: string
  items: BOQItem[]
}

function genId() { return Math.random().toString(36).slice(2, 11) }

const INPUT = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent'

function RenovationBOQEditor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const boqId = searchParams.get('id')

  const [projectName,     setProjectName]     = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [clientName,      setClientName]      = useState('')
  const [sections,        setSections]        = useState<BOQSection[]>([])

  const [pageLoading, setPageLoading] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')

  const [files,        setFiles]        = useState<File[]>([])
  const [analyzing,    setAnalyzing]    = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing BOQ when editing
  useEffect(() => {
    if (!boqId) return
    setPageLoading(true)
    fetch(`/api/boq/renovation?id=${boqId}`)
      .then(r => r.json())
      .then(data => {
        if (!data) return
        setProjectName(data.project_name     || '')
        setProjectLocation(data.project_location || '')
        setClientName(data.client_name      || '')
        setSections((data.sections || []).map((s: any) => ({
          ...s,
          id:    s.id    || genId(),
          items: (s.items || []).map((i: any) => ({ ...i, id: i.id || genId() })),
        })))
      })
      .catch(() => setError('Failed to load BOQ'))
      .finally(() => setPageLoading(false))
  }, [boqId])

  // ── AI Analysis ────────────────────────────────────────────
  async function analyze() {
    if (files.length === 0) return
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const res  = await fetch('/api/boq/renovation/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setSections((data.sections || []).map((s: any) => ({
        id:    genId(),
        name:  s.name || 'Unnamed Section',
        items: (s.items || []).map((item: any) => ({
          id:          genId(),
          description: item.description || '',
          unit:        item.unit        || 'm²',
          quantity:    Number(item.quantity) || 0,
          remarks:     item.remarks     || '',
        })),
      })))
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Save ───────────────────────────────────────────────────
  async function save() {
    if (!projectName.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')
    try {
      const body = { project_name: projectName, project_location: projectLocation, client_name: clientName, sections }
      const res  = await fetch('/api/boq/renovation', {
        method:  boqId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(boqId ? { id: boqId, ...body } : body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      if (!boqId && data.id) router.replace(`/estimation/boq/renovation?id=${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Section mutations ──────────────────────────────────────
  function addSection() {
    setSections(p => [...p, { id: genId(), name: 'New Section', items: [] }])
  }
  function deleteSection(sId: string) {
    if (!confirm('Delete this section and all its items?')) return
    setSections(p => p.filter(s => s.id !== sId))
  }
  function updateSectionName(sId: string, name: string) {
    setSections(p => p.map(s => s.id === sId ? { ...s, name } : s))
  }

  // ── Item mutations ─────────────────────────────────────────
  function addItem(sId: string) {
    setSections(p => p.map(s => s.id !== sId ? s : {
      ...s, items: [...s.items, { id: genId(), description: '', unit: 'm²', quantity: 0, remarks: '' }],
    }))
  }
  function deleteItem(sId: string, iId: string) {
    setSections(p => p.map(s => s.id !== sId ? s : { ...s, items: s.items.filter(i => i.id !== iId) }))
  }
  function updateItem(sId: string, iId: string, field: keyof BOQItem, value: string | number) {
    setSections(p => p.map(s => s.id !== sId ? s : {
      ...s, items: s.items.map(i => i.id !== iId ? i : { ...i, [field]: value }),
    }))
  }

  if (pageLoading) return (
    <div className="p-8 flex items-center justify-center min-h-96">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  )

  const totalItems = sections.reduce((n, s) => n + s.items.length, 0)

  return (
    <div className="p-4 sm:p-8 max-w-5xl">

      {/* Back */}
      <button onClick={() => router.push('/estimation')}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Estimation
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <h1 className="text-2xl font-bold text-slate-900">Renovation BOQ</h1>
          </div>
          <p className="text-slate-500 text-sm">
            {boqId ? `Editing · ${totalItems} items across ${sections.length} sections` : 'New renovation bill of quantities'}
          </p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 shrink-0">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> :
           saved  ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save BOQ'}
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none ml-3">×</button>
        </div>
      )}

      {/* Project Info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Project Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Project Name <span className="text-red-400">*</span></label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Khalid Villa Renovation" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Location</label>
            <input value={projectLocation} onChange={e => setProjectLocation(e.target.value)}
              placeholder="e.g. Al Barsha, Dubai" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Client Name</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Ahmed Al Mansouri" className={INPUT} />
          </div>
        </div>
      </div>

      {/* AI Analysis Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">AI BOQ Generation</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload renovation scope, drawings, or specifications (PDF)</p>
          </div>
          {sections.length > 0 && (
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
              {sections.length} sections generated
            </span>
          )}
        </div>

        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); setFiles(p => [...p, ...Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')]) }}
          className="border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 rounded-xl p-8 text-center cursor-pointer transition-colors mb-3"
        >
          <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">Click or drag PDF files here</p>
          <p className="text-xs text-slate-400 mt-1">Scope of work · Drawings · Specifications · Survey reports</p>
          <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
            onChange={e => setFiles(p => [...p, ...Array.from(e.target.files || [])])} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                <span className="text-xs text-slate-400 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {analyzeError && (
          <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex justify-between items-start gap-2">
            <span>{analyzeError}</span>
            <button onClick={() => setAnalyzeError('')} className="text-red-400 hover:text-red-600 font-bold shrink-0">×</button>
          </div>
        )}

        <button onClick={analyze} disabled={files.length === 0 || analyzing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
          {analyzing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing… this may take up to 30 seconds</>
            : <><Sparkles className="w-4 h-4" /> Generate BOQ with AI</>}
        </button>
      </div>

      {/* ── BOQ Sections Editor ── */}
      {sections.length > 0 ? (
        <div className="space-y-4 mb-5">
          {sections.map((section, sIdx) => (
            <div key={section.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Section header */}
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                <span className="w-6 text-center text-xs font-bold text-slate-400">{sIdx + 1}</span>
                <input value={section.name} onChange={e => updateSectionName(section.id, e.target.value)}
                  className="flex-1 bg-transparent font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-1 py-0.5" />
                <button onClick={() => deleteSection(section.id)}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-50/60 border-b border-slate-100 text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 w-10">#</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500">Description</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 w-28">Unit</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500 w-24">Qty</th>
                      <th className="px-3 py-2 text-xs font-semibold text-slate-500">Remarks</th>
                      <th className="w-9" />
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, iIdx) => (
                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/40 group">
                        <td className="px-3 py-1.5 text-xs text-slate-400 text-center">{iIdx + 1}</td>
                        <td className="px-2 py-1">
                          <input value={item.description}
                            onChange={e => updateItem(section.id, item.id, 'description', e.target.value)}
                            className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 rounded px-2 py-1.5 text-slate-800"
                            placeholder="Item description" />
                        </td>
                        <td className="px-2 py-1">
                          <select value={item.unit}
                            onChange={e => updateItem(section.id, item.id, 'unit', e.target.value)}
                            className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 rounded px-2 py-1.5 text-slate-700 text-xs">
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input type="number" min="0" value={item.quantity}
                            onChange={e => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 rounded px-2 py-1.5 text-slate-800" />
                        </td>
                        <td className="px-2 py-1">
                          <input value={item.remarks}
                            onChange={e => updateItem(section.id, item.id, 'remarks', e.target.value)}
                            className="w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-400 rounded px-2 py-1.5 text-slate-400 text-xs"
                            placeholder="Optional remarks" />
                        </td>
                        <td className="px-2 py-1">
                          <button onClick={() => deleteItem(section.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {section.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-5 text-center text-slate-400 text-xs italic">
                          No items — click Add Item below
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add item */}
              <div className="px-5 py-3 border-t border-slate-50">
                <button onClick={() => addItem(section.id)}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
            </div>
          ))}

          {/* Add section */}
          <button onClick={addSection}
            className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 rounded-xl text-sm text-slate-500 hover:text-emerald-700 font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Add Section
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-12 text-center mb-5">
          <Sparkles className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-semibold">Upload a PDF and click "Generate BOQ with AI"</p>
          <p className="text-slate-400 text-xs mt-1">Or build the BOQ manually</p>
          <button onClick={addSection}
            className="mt-4 flex items-center gap-2 mx-auto text-sm text-emerald-600 hover:text-emerald-800 font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Add Section Manually
          </button>
        </div>
      )}

      {/* Bottom Save */}
      {sections.length > 0 && (
        <div className="flex justify-end pt-2 pb-8">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> :
             saved  ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save BOQ'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function RenovationBOQPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>}>
      <RenovationBOQEditor />
    </Suspense>
  )
}
