'use client'
import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2,
  AlertCircle, Sparkles, Building2, X, Zap, Wrench, Map,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Prevent Vercel from serving a stale cached HTML snapshot of this page
export const dynamic = 'force-dynamic'

type CategoryKey = 'architectural' | 'structural' | 'mep' | 'site'
type Stage = 'idle' | 'uploading' | 'analyzing' | 'saving' | 'done' | 'error'

interface UploadedFile {
  id:   string
  file: File
}

const CATEGORIES: {
  key:         CategoryKey
  label:       string
  sublabel:    string
  Icon:        React.ElementType
  color:       string
  bg:          string
  border:      string
  iconColor:   string
  badgeColor:  string
  accept:      string
  hint:        string
}[] = [
  {
    key:        'architectural',
    label:      'Architectural Drawings',
    sublabel:   'Floor plans, elevations, sections',
    Icon:       Building2,
    color:      'blue',
    bg:         'bg-blue-50',
    border:     'border-blue-200',
    iconColor:  'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-700',
    accept:     '.pdf,.jpg,.jpeg,.png,.webp',
    hint:       'Room dimensions, wall lengths, door/window counts',
  },
  {
    key:        'structural',
    label:      'Structural Drawings',
    sublabel:   'Foundation, columns, slabs',
    Icon:       Wrench,
    color:      'slate',
    bg:         'bg-slate-50',
    border:     'border-slate-200',
    iconColor:  'text-slate-600',
    badgeColor: 'bg-slate-100 text-slate-700',
    accept:     '.pdf,.jpg,.jpeg,.png,.webp',
    hint:       'Footing sizes, column grid, beam & slab thicknesses',
  },
  {
    key:        'mep',
    label:      'MEP Drawings',
    sublabel:   'Electrical, plumbing, HVAC',
    Icon:       Zap,
    color:      'amber',
    bg:         'bg-amber-50',
    border:     'border-amber-200',
    iconColor:  'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-700',
    accept:     '.pdf,.jpg,.jpeg,.png,.webp',
    hint:       'Confirms electrical, plumbing, AC scope (L.S items)',
  },
  {
    key:        'site',
    label:      'Site Plan',
    sublabel:   'Plot boundary, compound wall',
    Icon:       Map,
    color:      'green',
    bg:         'bg-green-50',
    border:     'border-green-200',
    iconColor:  'text-green-600',
    badgeColor: 'bg-green-100 text-green-700',
    accept:     '.pdf,.jpg,.jpeg,.png,.webp',
    hint:       'Plot perimeter → compound wall (R.M), driveway area',
  },
]

const STAGE_LABEL: Record<Stage, string> = {
  idle:      '',
  uploading: 'Uploading drawings to secure storage…',
  analyzing: 'AI is analyzing all drawings and calculating quantities…',
  saving:    'Saving BOQ…',
  done:      'BOQ generated! Opening editor…',
  error:     '',
}

const MAX_FILE_BYTES  = 50  * 1024 * 1024   // 50 MB per file
const MAX_TOTAL_BYTES = 200 * 1024 * 1024   // 200 MB total

function fileId() {
  return Math.random().toString(36).slice(2)
}

function fmtBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function CreateEstimationPage() {
  const router = useRouter()

  // Per-category file lists
  const [uploads, setUploads] = useState<Record<CategoryKey, UploadedFile[]>>({
    architectural: [], structural: [], mep: [], site: [],
  })

  // One hidden file input per category, keyed by category
  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement>>>({})

  // Project details
  const [projectName, setProjectName] = useState('')
  const [ownerName,   setOwnerName]   = useState('')
  const [plotNo,      setPlotNo]      = useState('')
  const [plotSize,    setPlotSize]    = useState('')
  const [floors,      setFloors]      = useState('')
  const [bedrooms,    setBedrooms]    = useState('')
  const [bathrooms,   setBathrooms]   = useState('')
  const [notes,       setNotes]       = useState('')

  // Processing
  const [stage,         setStage]         = useState<Stage>('idle')
  const [errorMsg,      setErrorMsg]      = useState('')
  const [analysis,      setAnalysis]      = useState('')
  const [uploadedCount, setUploadedCount] = useState(0)

  const busy       = stage !== 'idle' && stage !== 'error'
  const totalFiles = Object.values(uploads).reduce((s, a) => s + a.length, 0)
  const totalBytes = Object.values(uploads).reduce((s, a) => s + a.reduce((x, u) => x + u.file.size, 0), 0)

  // ── File helpers ────────────────────────────────────────────────────────────
  function addFiles(cat: CategoryKey, newFiles: FileList | null) {
    if (!newFiles) return
    const tooLarge: string[] = []
    const valid = Array.from(newFiles).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (!['pdf','jpg','jpeg','png','webp'].includes(ext ?? '')) return false
      if (f.size > MAX_FILE_BYTES) { tooLarge.push(`${f.name} (${fmtBytes(f.size)})`) ; return false }
      return true
    })
    if (tooLarge.length) {
      setErrorMsg(`File${tooLarge.length > 1 ? 's' : ''} exceed 50 MB limit: ${tooLarge.join(', ')}`)
    }
    setUploads(prev => ({
      ...prev,
      [cat]: [...prev[cat], ...valid.map(f => ({ id: fileId(), file: f }))].slice(0, 10),
    }))
    const inp = inputRefs.current[cat]
    if (inp) inp.value = ''
  }

  function removeFile(cat: CategoryKey, id: string) {
    setUploads(prev => ({ ...prev, [cat]: prev[cat].filter(u => u.id !== id) }))
  }

  // ── Drag-and-drop ───────────────────────────────────────────────────────────
  function onDrop(cat: CategoryKey, e: React.DragEvent) {
    e.preventDefault()
    addFiles(cat, e.dataTransfer.files)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalFiles === 0)    { setErrorMsg('Upload at least one drawing file.'); return }
    if (!projectName.trim()) { setErrorMsg('Enter a project name.'); return }
    if (totalBytes > MAX_TOTAL_BYTES) {
      setErrorMsg(`Total size ${fmtBytes(totalBytes)} exceeds 200 MB limit. Please remove some files.`)
      return
    }

    setErrorMsg('')
    setAnalysis('')
    setUploadedCount(0)

    const allEntries = (Object.entries(uploads) as [CategoryKey, UploadedFile[]][])
      .flatMap(([cat, list]) => list.map(u => ({ cat, u })))

    try {
      // ── Phase 1: Upload files to Supabase Storage via signed URLs ────────────
      setStage('uploading')

      const uploadedFiles: Array<{ path: string; name: string; category: string }> = []

      for (const { cat, u } of allEntries) {
        // 1a. Ask server for a signed upload URL
        const urlRes = await fetch('/api/estimations/signed-upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filename: u.file.name }),
        })

        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error ?? `Failed to get upload URL for ${u.file.name}`)
        }

        const { signedUrl, token, path } = await urlRes.json()

        // 1b. Upload file directly to Supabase using signed URL
        if (supabase) {
          const { error: uploadErr } = await supabase.storage
            .from('estimation-drawings')
            .uploadToSignedUrl(path, token, u.file, {
              contentType: u.file.type || 'application/octet-stream',
            })
          if (uploadErr) throw new Error(`Upload failed for ${u.file.name}: ${uploadErr.message}`)
        } else {
          // Fallback: PUT directly to signed URL (works without Supabase client)
          const putRes = await fetch(signedUrl, {
            method:  'PUT',
            headers: { 'Content-Type': u.file.type || 'application/octet-stream' },
            body:    u.file,
          })
          if (!putRes.ok) throw new Error(`Upload failed for ${u.file.name} (${putRes.status})`)
        }

        uploadedFiles.push({ path, name: u.file.name, category: cat })
        setUploadedCount(prev => prev + 1)
      }

      // ── Phase 2: Send file paths to AI agent ─────────────────────────────────
      setStage('analyzing')

      const aiRes = await fetch('/api/agents/estimation-engineer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files:       uploadedFiles,
          projectName,
          ownerName,
          plotSize,
          floors,
          bedrooms,
          bathrooms,
          notes,
        }),
      })

      let aiData: Record<string, unknown>
      try {
        aiData = await aiRes.json()
      } catch {
        throw new Error(`Server error (${aiRes.status}) — please try again.`)
      }

      if (!aiRes.ok || !aiData.success) {
        throw new Error((aiData.error as string) || 'AI analysis failed')
      }

      setAnalysis((aiData.analysis as string) ?? '')

      // ── Phase 3: Save BOQ ─────────────────────────────────────────────────────
      setStage('saving')
      const areaLabel = [plotNo, plotSize ? `${plotSize} M2` : ''].filter(Boolean).join(' — ')

      const saveRes = await fetch('/api/boq/company', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_number: plotNo || '',
          project_name:   projectName,
          area:           areaLabel,
          owner:          ownerName,
          contractor:     'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
          items:          aiData.items,
        }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Failed to save BOQ')
      }

      const saved = await saveRes.json()
      setStage('done')
      setTimeout(() => router.push(`/estimation/boq/company?id=${saved.id}`), 800)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error')
      setStage('error')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center gap-4">
        <Link href="/estimation"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Sparkles className="w-5 h-5 text-brand-500" />
        <h1 className="text-lg font-bold text-slate-900">AI Estimation Engineer</h1>
        {totalFiles > 0 && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 bg-brand-100 text-brand-700 rounded-full">
            {totalFiles} file{totalFiles !== 1 ? 's' : ''} · {fmtBytes(totalBytes)}
          </span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">

        {/* Hero */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Upload All Drawings — Get a Complete BOQ</h2>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                Upload architectural, structural, MEP and site drawings together.
                The AI cross-references all of them to calculate the most accurate quantities
                across all 24 BOQ sections.
              </p>
              <p className="text-slate-400 text-xs mt-2">
                PDF, JPG, PNG · Up to 50 MB per file · Up to 200 MB total · Up to 10 files per category
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Drawing upload cards (2×2 grid) ──────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
              Upload Drawings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CATEGORIES.map(({ key, label, sublabel, Icon, bg, border, iconColor, badgeColor, accept, hint }) => {
                const list = uploads[key]
                return (
                  <div key={key} className={`rounded-xl border-2 ${border} ${bg} overflow-hidden`}>

                    {/* Card header */}
                    <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{label}</p>
                        <p className="text-xs text-slate-500">{sublabel}</p>
                      </div>
                    </div>

                    {/* Drop zone */}
                    <div
                      className={`mx-3 mb-2 border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer
                        ${busy ? 'opacity-50 cursor-not-allowed' : 'border-slate-300 hover:border-slate-400 bg-white/60 hover:bg-white'}`}
                      onClick={() => !busy && inputRefs.current[key]?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => !busy && onDrop(key, e)}
                    >
                      <input
                        type="file"
                        multiple
                        accept={accept}
                        className="hidden"
                        disabled={busy}
                        ref={el => { if (el) inputRefs.current[key] = el }}
                        onChange={e => addFiles(key, e.target.files)}
                      />
                      {list.length === 0 ? (
                        <div className="flex flex-col items-center gap-1 py-1">
                          <Upload className="w-5 h-5 text-slate-300" />
                          <p className="text-xs font-medium text-slate-500">Click or drag files here</p>
                          <p className="text-xs text-slate-400">{hint}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {list.length} file{list.length > 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-slate-400">+ add more</span>
                        </div>
                      )}
                    </div>

                    {/* File list */}
                    {list.length > 0 && (
                      <ul className="px-3 pb-3 space-y-1.5">
                        {list.map(({ id, file }) => (
                          <li key={id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-700 truncate flex-1">{file.name}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {fmtBytes(file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFile(key, id)}
                              disabled={busy}
                              className="ml-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Total size indicator */}
            {totalFiles > 0 && (
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="text-xs text-slate-400">
                  Total: {fmtBytes(totalBytes)} / 200 MB
                </span>
                <div className="h-1.5 w-24 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${totalBytes > MAX_TOTAL_BYTES * 0.9 ? 'bg-red-400' : 'bg-brand-400'}`}
                    style={{ width: `${Math.min(100, (totalBytes / MAX_TOTAL_BYTES) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Project details ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" /> Project Details
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Villa (G+1) Al Khawaneej" disabled={busy}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Owner Name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Mohammed Al Rashid" disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plot Number</label>
                <input type="text" value={plotNo} onChange={e => setPlotNo(e.target.value)}
                  placeholder="e.g. 2815139" disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Plot Size (M2)', value: plotSize, set: setPlotSize, ph: '500' },
                { label: 'Floors',         value: floors,    set: setFloors,   ph: '2'   },
                { label: 'Bedrooms',       value: bedrooms,  set: setBedrooms, ph: '6'   },
                { label: 'Bathrooms',      value: bathrooms, set: setBathrooms,ph: '5'   },
              ].map(({ label, value, set, ph }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type="number" min="0" value={value} onChange={e => set(e.target.value)}
                    placeholder={ph} disabled={busy}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={busy}
                placeholder="e.g. Includes service block, swimming pool by owner, special stone cladding..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60 resize-none" />
            </div>
          </div>

          {/* ── Error ──────────────────────────────────────────────────────────── */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* ── Progress ──────────────────────────────────────────────────────── */}
          {busy && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {stage === 'done'
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  : <Loader2 className="w-5 h-5 text-brand-500 animate-spin flex-shrink-0" />
                }
                <p className="text-sm font-semibold text-slate-800">{STAGE_LABEL[stage]}</p>
              </div>

              {stage === 'uploading' && (
                <div className="pl-8 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{uploadedCount} of {totalFiles} files uploaded</span>
                    <span>{Math.round((uploadedCount / totalFiles) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((uploadedCount / totalFiles) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {stage === 'analyzing' && (
                <div className="space-y-1.5 pl-8">
                  {[
                    `Reading ${totalFiles} drawing file${totalFiles > 1 ? 's' : ''}…`,
                    'Extracting dimensions from architectural plans…',
                    'Reading structural drawings for concrete volumes…',
                    'Confirming MEP scope from services drawings…',
                    'Measuring compound wall from site plan…',
                    'Calculating all 24 BOQ sections…',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"
                        style={{ animationDelay: `${i * 0.25}s` }} />
                      {step}
                    </div>
                  ))}
                </div>
              )}

              {analysis && stage === 'saving' && (
                <p className="text-xs text-slate-500 pl-8 italic">"{analysis}"</p>
              )}
            </div>
          )}

          {/* ── Submit ────────────────────────────────────────────────────────── */}
          <button type="submit" disabled={busy || totalFiles === 0 || !projectName.trim()}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
            {busy
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
              : <><Sparkles className="w-5 h-5" />
                  {totalFiles > 0
                    ? `Analyze ${totalFiles} Drawing${totalFiles > 1 ? 's' : ''} & Generate BOQ`
                    : 'Upload drawings to continue'
                  }
                </>
            }
          </button>

          <p className="text-center text-xs text-slate-400">
            Files upload directly to secure storage · AI analyzes all drawings · 24 BOQ sections · typically 30–90 seconds
          </p>
        </form>
      </div>
    </div>
  )
}
