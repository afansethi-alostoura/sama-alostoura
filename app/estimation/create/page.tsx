'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Sparkles, Building2, Calculator, Home, Layers, BedDouble, ShowerHead,
} from 'lucide-react'

type Stage = 'idle' | 'calculating' | 'saving' | 'done' | 'error'

// ── Number input card ─────────────────────────────────────────────────────────
function BigInput({
  label, sublabel, value, onChange, min, max, unit, Icon, color, disabled,
}: {
  label:    string
  sublabel: string
  value:    string
  onChange: (v: string) => void
  min:      number
  max:      number
  unit:     string
  Icon:     React.ElementType
  color:    string
  disabled: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl border-2 border-${color}-100 p-5 flex flex-col gap-3`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 text-${color}-500`} />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm leading-tight">{label}</p>
          <p className="text-xs text-slate-400">{sublabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={`flex-1 text-3xl font-bold text-slate-900 bg-${color}-50 border-0 rounded-xl px-4 py-3
            focus:outline-none focus:ring-2 focus:ring-${color}-300 disabled:opacity-60 text-center`}
        />
        <span className="text-sm font-semibold text-slate-400 w-10 text-center">{unit}</span>
      </div>
    </div>
  )
}

export default function CreateEstimationPage() {
  const router = useRouter()

  // Core inputs
  const [plotSize,  setPlotSize]  = useState('500')
  const [floors,    setFloors]    = useState('2')
  const [bedrooms,  setBedrooms]  = useState('5')
  const [bathrooms, setBathrooms] = useState('4')

  // Project details
  const [projectName, setProjectName] = useState('')
  const [ownerName,   setOwnerName]   = useState('')
  const [plotNo,      setPlotNo]      = useState('')
  const [notes,       setNotes]       = useState('')

  // State
  const [stage,    setStage]    = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const busy = stage !== 'idle' && stage !== 'error'

  // Live preview of key quantities (shown before submit)
  const plotNum    = Math.max(50,  Number(plotSize)  || 500)
  const floorsNum  = Math.max(1,   Number(floors)    || 2)
  const bedsNum    = Math.max(1,   Number(bedrooms)  || 5)
  const bathsNum   = Math.max(1,   Number(bathrooms) || 4)
  const footprint  = Math.round(plotNum * 0.55)
  const bfa        = footprint * floorsNum
  const excavation = Math.round(footprint * 2.0)
  const rccSlab    = Math.round(bfa * 0.2)
  const blockExt   = Math.round(4 * Math.sqrt(footprint) * 3.2 * floorsNum * 0.70)
  const compWall   = Math.max(10, Math.round(4 * Math.sqrt(plotNum) - 6))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) { setErrorMsg('Enter a project name.'); return }

    setErrorMsg('')
    setStage('calculating')

    try {
      const calcRes = await fetch('/api/agents/estimation-engineer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, ownerName, plotNo, plotSize, floors, bedrooms, bathrooms, notes }),
      })

      let calcData: Record<string, unknown>
      try { calcData = await calcRes.json() } catch {
        throw new Error(`Server error (${calcRes.status})`)
      }
      if (!calcRes.ok || !calcData.success) throw new Error((calcData.error as string) || 'Calculation failed')

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
          items:          calcData.items,
        }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Failed to save BOQ')
      }

      const saved = await saveRes.json()
      setStage('done')
      setTimeout(() => router.push(`/estimation/boq/company?id=${saved.id}`), 600)
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
        <Calculator className="w-5 h-5 text-brand-500" />
        <h1 className="text-lg font-bold text-slate-900">New BOQ Estimation</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">

        {/* Hero */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Instant BOQ from Project Details</h2>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                Enter the plot size, number of floors, bedrooms and bathrooms.
                All 24 BOQ sections are calculated automatically using standard Dubai villa construction ratios.
              </p>
              <p className="text-slate-400 text-xs mt-2">Results in under 2 seconds · All quantities calculated · Ready to edit</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── 4 big inputs ──────────────────────────────────────────────── */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
              Building Dimensions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <BigInput
                label="Plot Size"    sublabel="Total land area"
                value={plotSize}     onChange={setPlotSize}
                min={50}             max={10000}    unit="M²"
                Icon={Home}          color="blue"   disabled={busy}
              />
              <BigInput
                label="No. of Floors" sublabel="G = 1, G+1 = 2, G+2 = 3"
                value={floors}         onChange={setFloors}
                min={1}                max={10}      unit="fl."
                Icon={Layers}          color="purple" disabled={busy}
              />
              <BigInput
                label="Bedrooms"     sublabel="Total across all floors"
                value={bedrooms}     onChange={setBedrooms}
                min={1}              max={30}       unit="nos"
                Icon={BedDouble}     color="amber"  disabled={busy}
              />
              <BigInput
                label="Bathrooms"    sublabel="Including en-suites"
                value={bathrooms}    onChange={setBathrooms}
                min={1}              max={20}       unit="nos"
                Icon={ShowerHead}    color="teal"   disabled={busy}
              />
            </div>
          </div>

          {/* ── Live quantity preview ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
              Estimated Key Quantities (preview)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Built Footprint', value: footprint,  unit: 'M²' },
                { label: 'Excavation',      value: excavation, unit: 'M³' },
                { label: 'RCC Slabs',       value: rccSlab,    unit: 'M³' },
                { label: 'Ext Block Work',  value: blockExt,   unit: 'M²' },
                { label: 'Total BFA',       value: bfa,        unit: 'M²' },
                { label: 'Compound Wall',   value: compWall,   unit: 'R.M' },
                { label: 'Bedroom Doors',   value: bedsNum,    unit: 'N.O' },
                { label: 'Bathroom Doors',  value: bathsNum,   unit: 'N.O' },
              ].map(({ label, value, unit }) => (
                <div key={label} className="text-center p-3 bg-slate-50 rounded-xl">
                  <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-brand-600 mt-0.5">{unit}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              Updates live as you change inputs · Full BOQ has all 24 sections
            </p>
          </div>

          {/* ── Project details ────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" /> Project Details
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={projectName} onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. Villa (G+1) — Al Khawaneej" disabled={busy}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Owner Name</label>
                <input
                  type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  placeholder="e.g. Mohammed Al Rashid" disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plot Number</label>
                <input
                  type="text" value={plotNo} onChange={e => setPlotNo(e.target.value)}
                  placeholder="e.g. 2815139" disabled={busy}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={2} disabled={busy}
                placeholder="e.g. Swimming pool by owner, special stone cladding, service block included…"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-60 resize-none"
              />
            </div>
          </div>

          {/* ── Error ──────────────────────────────────────────────────────── */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{errorMsg}</p>
            </div>
          )}

          {/* ── Progress ──────────────────────────────────────────────────── */}
          {busy && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center gap-3">
              {stage === 'done'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                : <Loader2 className="w-5 h-5 text-brand-500 animate-spin flex-shrink-0" />
              }
              <p className="text-sm font-semibold text-slate-800">
                {stage === 'calculating' && 'Calculating all 24 BOQ sections…'}
                {stage === 'saving'      && 'Saving BOQ…'}
                {stage === 'done'        && 'Done! Opening BOQ editor…'}
              </p>
            </div>
          )}

          {/* ── Submit ────────────────────────────────────────────────────── */}
          <button
            type="submit" disabled={busy || !projectName.trim()}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm text-base"
          >
            {busy
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
              : <><Sparkles className="w-5 h-5" /> Generate Full BOQ</>
            }
          </button>

          <p className="text-center text-xs text-slate-400">
            Quantities calculated from standard Dubai villa ratios · All 24 sections · Fully editable after generation
          </p>
        </form>
      </div>
    </div>
  )
}
