'use client'
import React, { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2,
  AlertCircle, Sparkles, Building2,
} from 'lucide-react'

type Stage = 'idle' | 'uploading' | 'analyzing' | 'saving' | 'done' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  idle:      '',
  uploading: 'Reading drawing…',
  analyzing: 'AI is extracting quantities — this takes 20–40 seconds…',
  saving:    'Saving BOQ…',
  done:      'BOQ generated! Redirecting…',
  error:     '',
}

export default function CreateEstimationPage() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [file,        setFile]        = useState<File | null>(null)
  const [projectName, setProjectName] = useState('')
  const [ownerName,   setOwnerName]   = useState('')
  const [plotNo,      setPlotNo]      = useState('')
  const [plotSize,    setPlotSize]    = useState('')
  const [floors,      setFloors]      = useState('')
  const [bedrooms,    setBedrooms]    = useState('')
  const [bathrooms,   setBathrooms]   = useState('')
  const [notes,       setNotes]       = useState('')

  // Processing state
  const [stage,    setStage]    = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [analysis, setAnalysis] = useState('')

  const busy = stage !== 'idle' && stage !== 'error'

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
      setErrorMsg('Unsupported file. Upload PDF, JPG, or PNG.')
      return
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrorMsg('File too large — max 50 MB.')
      return
    }
    setFile(f)
    setErrorMsg('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setErrorMsg('Please select a drawing file.'); return }
    if (!projectName.trim()) { setErrorMsg('Please enter a project name.'); return }

    setErrorMsg('')
    setAnalysis('')

    try {
      // ── Step 1: Send file + context to AI ──────────────────────────────────
      setStage('analyzing')
      const fd = new FormData()
      fd.append('file',        file)
      fd.append('projectName', projectName)
      fd.append('ownerName',   ownerName)
      fd.append('plotSize',    plotSize)
      fd.append('floors',      floors)
      fd.append('bedrooms',    bedrooms)
      fd.append('bathrooms',   bathrooms)
      fd.append('notes',       notes)

      const aiRes = await fetch('/api/agents/estimation-engineer', { method: 'POST', body: fd })
      const aiData = await aiRes.json()

      if (!aiRes.ok || !aiData.success) {
        throw new Error(aiData.error || 'AI analysis failed')
      }

      setAnalysis(aiData.analysis)

      // ── Step 2: Save as company BOQ ────────────────────────────────────────
      setStage('saving')
      const plotLabel = plotSize ? `${plotSize} M2` : ''
      const areaLabel = [plotNo, plotLabel].filter(Boolean).join(' — ') || ''

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
        const err = await saveRes.json()
        throw new Error(err.error || 'Failed to save BOQ')
      }

      const saved = await saveRes.json()
      setStage('done')

      // Redirect to the company BOQ editor
      setTimeout(() => router.push(`/estimation/boq/company?id=${saved.id}`), 800)

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred')
      setStage('error')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center gap-4">
        <Link
          href="/estimation"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-500" />
          <h1 className="text-lg font-bold text-slate-900">AI Estimation Engineer</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">

        {/* Intro card */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Upload a Drawing — Get a Full BOQ</h2>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                Our AI quantity surveyor analyzes your architectural drawing and fills in all 24 BOQ sections
                with calculated quantities — excavation in M3, blockwork in M2, doors by count, compound wall in R.M.
              </p>
              <p className="text-slate-400 text-xs mt-2">Supports PDF, JPG, PNG · Max 50 MB</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── File Upload ──────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Architectural Drawing <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
              className="hidden"
              disabled={busy}
            />
            <div
              onClick={() => !busy && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                ${file
                  ? 'border-green-300 bg-green-50'
                  : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50'
                }
                ${busy ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-800">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline"
                    disabled={busy}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-700">Click to upload drawing</p>
                  <p className="text-sm text-slate-400 mt-1">PDF, JPG, PNG, WEBP · max 50 MB</p>
                </>
              )}
            </div>
          </div>

          {/* ── Project Details ──────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" /> Project Details
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Villa (G+1) Al Khawaneej"
                disabled={busy}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Owner Name
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Mohammed Al Rashid"
                  disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Plot Number
                </label>
                <input
                  type="text"
                  value={plotNo}
                  onChange={e => setPlotNo(e.target.value)}
                  placeholder="e.g. 2815139"
                  disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* ── Building Dimensions ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">Building Dimensions</h3>
            <p className="text-xs text-slate-400 mb-4">
              Helps AI if the drawing doesn't show all dimensions clearly
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Plot Size (M2)', value: plotSize, set: setPlotSize, placeholder: '500' },
                { label: 'Floors',          value: floors,    set: setFloors,    placeholder: '2'   },
                { label: 'Bedrooms',        value: bedrooms,  set: setBedrooms,  placeholder: '6'   },
                { label: 'Bathrooms',       value: bathrooms, set: setBathrooms, placeholder: '5'   },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    disabled={busy}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Notes ────────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Includes service block, swimming pool by owner, special finishes..."
              rows={2}
              disabled={busy}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60 resize-none"
            />
          </div>

          {/* ── Error / Status ────────────────────────────────────────────────── */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{errorMsg}</p>
            </div>
          )}

          {busy && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                {stage === 'done'
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  : <Loader2 className="w-5 h-5 text-brand-500 animate-spin flex-shrink-0" />
                }
                <div>
                  <p className="text-sm font-semibold text-slate-800">{STAGE_LABELS[stage]}</p>
                  {analysis && stage === 'saving' && (
                    <p className="text-xs text-slate-500 mt-0.5 italic">"{analysis}"</p>
                  )}
                </div>
              </div>

              {stage === 'analyzing' && (
                <div className="mt-3 space-y-1.5">
                  {[
                    'Reading drawing dimensions…',
                    'Calculating excavation & concrete volumes…',
                    'Measuring block work & plaster areas…',
                    'Counting doors, windows, MEP scope…',
                    'Generating all 24 BOQ sections…',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                      {step}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Submit ────────────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={busy || !file || !projectName.trim()}
            className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {busy
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
              : <><Sparkles className="w-5 h-5" /> Analyze Drawing & Generate BOQ</>
            }
          </button>

          <p className="text-center text-xs text-slate-400">
            AI analysis typically takes 20–40 seconds · All 24 sections will be filled
          </p>
        </form>
      </div>
    </div>
  )
}
