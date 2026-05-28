'use client'
import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2,
  AlertCircle, Building2, X, Zap, Wrench, Map, HardHat,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CategoryKey = 'architectural' | 'structural' | 'mep' | 'site'
type Stage = 'idle' | 'uploading' | 'analyzing' | 'saving' | 'done' | 'error'

interface LocalFile { id: string; file: File }

const MAX_FILE_BYTES  = 50  * 1024 * 1024
const MAX_TOTAL_BYTES = 200 * 1024 * 1024

// Client-side image compression (keeps drawings readable for Claude)
async function compressImage(file: File): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['jpg','jpeg','png','webp'].includes(ext)) return file
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 2000  // px — large enough to read dimension text
      let { width, height } = img
      if (width <= MAX && height <= MAX && file.size < 3*1024*1024) { resolve(file); return }
      if (width > height) { height = Math.round(height * MAX / width);  width = MAX }
      else                { width  = Math.round(width  * MAX / height); height = MAX }
      const c = document.createElement('canvas')
      c.width = width; c.height = height
      c.getContext('2d')!.drawImage(img, 0, 0, width, height)
      c.toBlob(blob => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type:'image/jpeg' }))
      }, 'image/jpeg', 0.88)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const CATEGORIES: {
  key: CategoryKey; label: string; sublabel: string; hint: string
  Icon: React.ElementType; bg: string; border: string; iconColor: string; badgeColor: string
}[] = [
  { key:'architectural', label:'Architectural', sublabel:'Floor plans, elevations, sections',
    hint:'Room dimensions, wall layout, doors & windows', Icon:Building2,
    bg:'bg-blue-50', border:'border-blue-200', iconColor:'text-blue-600', badgeColor:'bg-blue-100 text-blue-700' },
  { key:'structural', label:'Structural', sublabel:'Foundation, columns, slabs, beams',
    hint:'Footing depth, column grid, slab thickness', Icon:Wrench,
    bg:'bg-slate-50', border:'border-slate-200', iconColor:'text-slate-600', badgeColor:'bg-slate-100 text-slate-700' },
  { key:'mep', label:'MEP / Drainage', sublabel:'Electrical, plumbing, AC',
    hint:'Confirms scope of MEP services', Icon:Zap,
    bg:'bg-amber-50', border:'border-amber-200', iconColor:'text-amber-600', badgeColor:'bg-amber-100 text-amber-700' },
  { key:'site', label:'Site Plan', sublabel:'Plot boundary, compound wall',
    hint:'Plot area, perimeter, compound wall length', Icon:Map,
    bg:'bg-green-50', border:'border-green-200', iconColor:'text-green-600', badgeColor:'bg-green-100 text-green-700' },
]

function uid() { return Math.random().toString(36).slice(2) }
function fmtBytes(b: number) {
  return b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`
}

export default function CreateFromDrawingsPage() {
  const router = useRouter()

  const [uploads, setUploads] = useState<Record<CategoryKey, LocalFile[]>>({
    architectural:[], structural:[], mep:[], site:[],
  })
  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement>>>({})

  const [projectName, setProjectName] = useState('')
  const [ownerName,   setOwnerName]   = useState('')
  const [plotNo,      setPlotNo]      = useState('')
  const [plotSize,    setPlotSize]    = useState('')
  const [floors,      setFloors]      = useState('')
  const [bedrooms,    setBedrooms]    = useState('')
  const [bathrooms,   setBathrooms]   = useState('')
  const [notes,       setNotes]       = useState('')

  const [stage,         setStage]         = useState<Stage>('idle')
  const [errorMsg,      setErrorMsg]      = useState('')
  const [analysis,      setAnalysis]      = useState('')
  const [uploadedCount, setUploadedCount] = useState(0)
  const [statusLine,    setStatusLine]    = useState('')

  const busy       = stage !== 'idle' && stage !== 'error'
  const totalFiles = Object.values(uploads).reduce((s,a) => s + a.length, 0)
  const totalBytes = Object.values(uploads).reduce((s,a) => s + a.reduce((x,u) => x+u.file.size,0), 0)

  function addFiles(cat: CategoryKey, list: FileList | null) {
    if (!list) return
    const valid = Array.from(list).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (!['pdf','jpg','jpeg','png','webp'].includes(ext ?? '')) return false
      if (f.size > MAX_FILE_BYTES) {
        setErrorMsg(`"${f.name}" exceeds 50 MB limit`)
        return false
      }
      return true
    })
    setUploads(prev => ({
      ...prev,
      [cat]: [...prev[cat], ...valid.map(f => ({ id:uid(), file:f }))].slice(0, 10),
    }))
    const inp = inputRefs.current[cat]
    if (inp) inp.value = ''
  }

  function removeFile(cat: CategoryKey, id: string) {
    setUploads(prev => ({ ...prev, [cat]: prev[cat].filter(u => u.id !== id) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalFiles === 0)    { setErrorMsg('Add at least one drawing file.'); return }
    if (!projectName.trim()) { setErrorMsg('Enter a project name.'); return }
    if (totalBytes > MAX_TOTAL_BYTES) { setErrorMsg('Total size exceeds 200 MB.'); return }

    setErrorMsg(''); setAnalysis(''); setUploadedCount(0)

    const allEntries = (Object.entries(uploads) as [CategoryKey, LocalFile[]][])
      .flatMap(([cat, list]) => list.map(u => ({ cat, u })))

    try {
      // ── Phase 1: compress + upload to Supabase ──────────────────────────────
      setStage('uploading')
      const uploadedFiles: Array<{ path:string; name:string; category:string }> = []

      for (const { cat, u } of allEntries) {
        setStatusLine(`Uploading ${u.file.name}…`)

        // Compress images client-side
        const compressed = await compressImage(u.file)

        // Get signed upload URL from server
        const urlRes = await fetch('/api/estimations/signed-upload-url', {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ filename: compressed.name }),
        })
        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}))
          throw new Error((err as { error?:string }).error ?? `Upload URL failed for ${u.file.name}`)
        }
        const { signedUrl, token, path } = await urlRes.json()

        // Upload file directly to Supabase
        if (supabase) {
          const { error: upErr } = await supabase.storage
            .from('estimation-drawings')
            .uploadToSignedUrl(path, token, compressed, {
              contentType: compressed.type || 'application/octet-stream',
            })
          if (upErr) throw new Error(`Upload failed for ${u.file.name}: ${upErr.message}`)
        } else {
          const putRes = await fetch(signedUrl, {
            method:'PUT', headers:{ 'Content-Type': compressed.type || 'application/octet-stream' },
            body: compressed,
          })
          if (!putRes.ok) throw new Error(`Upload failed for ${u.file.name} (${putRes.status})`)
        }

        uploadedFiles.push({ path, name: compressed.name, category: cat })
        setUploadedCount(n => n + 1)
      }

      // ── Phase 2: civil engineer AI analysis ────────────────────────────────
      setStage('analyzing')
      setStatusLine('Reading drawings and extracting dimensions…')

      const aiRes = await fetch('/api/agents/civil-engineer', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          files: uploadedFiles,
          projectName, ownerName, plotSize, floors, bedrooms, bathrooms, notes,
        }),
      })

      let aiData: Record<string, unknown>
      try { aiData = await aiRes.json() }
      catch { throw new Error(`Server error (${aiRes.status}) — please try again`) }

      if (!aiRes.ok || !aiData.success)
        throw new Error((aiData.error as string) || 'Analysis failed')

      setAnalysis((aiData.analysis as string) ?? '')

      // ── Phase 3: save BOQ ──────────────────────────────────────────────────
      setStage('saving')
      setStatusLine('Saving BOQ…')
      const areaLabel = [plotNo, plotSize ? `${plotSize} M²` : ''].filter(Boolean).join(' — ')

      const saveRes = await fetch('/api/boq/company', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
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
        throw new Error((err as { error?:string }).error || 'Failed to save BOQ')
      }

      const saved = await saveRes.json()
      setStage('done')
      setTimeout(() => router.push(`/estimation/boq/company?id=${saved.id}`), 700)

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error')
      setStage('error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center gap-4">
        <Link href="/estimation"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <HardHat className="w-5 h-5 text-amber-600" />
        <h1 className="text-lg font-bold text-slate-900">Civil Engineer AI — Drawing Analysis</h1>
        {totalFiles > 0 && (
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
            {totalFiles} file{totalFiles !== 1 ? 's' : ''} · {fmtBytes(totalBytes)}
          </span>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">

        {/* Hero */}
        <div className="bg-gradient-to-r from-amber-700 to-amber-600 rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Upload Drawings → Extract Quantities</h2>
              <p className="text-amber-100 text-sm mt-1 leading-relaxed">
                Claude reads every page of every drawing, extracts actual dimensions
                and quantities, then fills the BOQ automatically. Rates are left
                blank for you to complete.
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-amber-200">
                <span>✓ PDF, JPG, PNG · up to 50 MB/file</span>
                <span>✓ Reads dimension lines & annotations</span>
                <span>✓ Rates left empty for you to fill</span>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Drawing upload grid ───────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Upload Drawings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CATEGORIES.map(({ key, label, sublabel, hint, Icon, bg, border, iconColor, badgeColor }) => {
                const list = uploads[key]
                return (
                  <div key={key} className={`rounded-xl border-2 ${border} ${bg} overflow-hidden`}>
                    <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 leading-tight">{label}</p>
                        <p className="text-xs text-slate-500">{sublabel}</p>
                      </div>
                    </div>

                    <div
                      className={`mx-3 mb-2 border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer
                        ${busy ? 'opacity-50 cursor-not-allowed' : 'border-slate-300 hover:border-slate-400 bg-white/60 hover:bg-white'}`}
                      onClick={() => !busy && inputRefs.current[key]?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); if (!busy) addFiles(key, e.dataTransfer.files) }}
                    >
                      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden" disabled={busy}
                        ref={el => { if (el) inputRefs.current[key] = el }}
                        onChange={e => addFiles(key, e.target.files)}
                      />
                      {list.length === 0 ? (
                        <div className="flex flex-col items-center gap-1 py-1">
                          <Upload className="w-5 h-5 text-slate-300" />
                          <p className="text-xs font-medium text-slate-500">Click or drag files</p>
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

                    {list.length > 0 && (
                      <ul className="px-3 pb-3 space-y-1.5">
                        {list.map(({ id, file }) => (
                          <li key={id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-xs text-slate-700 truncate flex-1">{file.name}</span>
                            <span className="text-xs text-slate-400 flex-shrink-0">{fmtBytes(file.size)}</span>
                            <button type="button" disabled={busy}
                              onClick={() => removeFile(key, id)}
                              className="ml-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
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

            {totalFiles > 0 && (
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className="text-xs text-slate-400">{fmtBytes(totalBytes)} / 200 MB</span>
                <div className="h-1.5 w-24 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width:`${Math.min(100,(totalBytes/MAX_TOTAL_BYTES)*100)}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Project details ───────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" /> Project Details
              <span className="text-xs font-normal text-slate-400 ml-1">
                (used as fallback if not readable in drawings)
              </span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Villa (G+1) — Al Barsha" disabled={busy}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Owner Name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Ahmed Al Rashid" disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plot Number</label>
                <input type="text" value={plotNo} onChange={e => setPlotNo(e.target.value)}
                  placeholder="e.g. 2815139" disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60" />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label:'Plot Size (M²)', value:plotSize, set:setPlotSize, ph:'500' },
                { label:'Floors',         value:floors,   set:setFloors,   ph:'2'  },
                { label:'Bedrooms',       value:bedrooms, set:setBedrooms, ph:'5'  },
                { label:'Bathrooms',      value:bathrooms,set:setBathrooms,ph:'4'  },
              ].map(({ label, value, set, ph }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{label}</label>
                  <input type="number" min="0" value={value} onChange={e => set(e.target.value)}
                    placeholder={ph} disabled={busy}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60" />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={busy}
                placeholder="e.g. Swimming pool by owner, service block included, special finishes…"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60 resize-none" />
            </div>
          </div>

          {/* ── Error ─────────────────────────────────────────────────────── */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* ── Progress ──────────────────────────────────────────────────── */}
          {busy && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                {stage === 'done'
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  : <Loader2 className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0" />
                }
                <p className="text-sm font-semibold text-slate-800">
                  {stage === 'uploading' && `Uploading drawings… (${uploadedCount}/${totalFiles})`}
                  {stage === 'analyzing' && 'Civil engineer AI is reading the drawings…'}
                  {stage === 'saving'    && 'Saving BOQ…'}
                  {stage === 'done'      && 'Done! Opening BOQ editor…'}
                </p>
              </div>

              {stage === 'uploading' && (
                <div className="pl-8">
                  <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{ width:`${Math.round((uploadedCount/totalFiles)*100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{statusLine}</p>
                </div>
              )}

              {stage === 'analyzing' && (
                <div className="space-y-1.5 pl-8">
                  {['Reading dimension lines and annotations…',
                    'Extracting room sizes and floor areas…',
                    'Counting doors, windows, columns…',
                    'Reading foundation and slab details…',
                    'Calculating BOQ quantities from drawings…',
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
                        style={{ animationDelay:`${i*0.3}s` }} />
                      {s}
                    </div>
                  ))}
                </div>
              )}

              {analysis && (
                <p className="text-xs text-slate-600 pl-8 italic border-l-2 border-amber-300">
                  {analysis}
                </p>
              )}
            </div>
          )}

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <button type="submit"
            disabled={busy || totalFiles === 0 || !projectName.trim()}
            className="w-full py-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm text-base">
            {busy
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
              : <><HardHat className="w-5 h-5" />
                  {totalFiles > 0
                    ? `Analyze ${totalFiles} Drawing${totalFiles !== 1 ? 's' : ''} & Generate BOQ`
                    : 'Upload drawings to continue'}
                </>
            }
          </button>

          <p className="text-center text-xs text-slate-400">
            Claude reads every page · Quantities from actual drawings · Rates left blank for you to fill · 30–90 seconds
          </p>
        </form>
      </div>
    </div>
  )
}
