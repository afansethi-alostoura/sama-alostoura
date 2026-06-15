'use client'
import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { Building2, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

const STAGES = [
  'Site Clearance & Excavation',
  'Foundations',
  'Substructure / Ground Slab',
  'Superstructure — Ground Floor',
  'Superstructure — First Floor',
  'Superstructure — Roof Slab',
  'Block Work & External Walls',
  'MEP Rough-In (1st Fix)',
  'Plastering & Internal Walls',
  'MEP Works & Internal Finishes',
  'Tiling & Flooring',
  'Joinery & Fit-Out',
  'AC Installation',
  'Painting',
  'External Works & Landscaping',
  'Snagging & External Works',
  'Handover',
  'Other',
]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent placeholder:text-slate-400'

export default function AddProjectPage() {
  const router = useRouter()
  const [saving,   setSaving]   = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')

  const [qbClasses,     setQbClasses]     = useState<{ id: string; name: string }[]>([])
  const [qbClassesLoad, setQbClassesLoad] = useState(false)

  useEffect(() => {
    setQbClassesLoad(true)
    fetch('/api/quickbooks/class-list')
      .then(r => r.ok ? r.json() : { classes: [] })
      .then(d => setQbClasses(d.classes ?? []))
      .catch(() => {})
      .finally(() => setQbClassesLoad(false))
  }, [])

  const [form, setForm] = useState({
    name:               '',
    client_name:        '',
    location:           '',
    type:               'villa' as 'villa' | 'renovation' | 'commercial',
    status:             'active' as 'active' | 'completed' | 'on-hold',
    contract_value:     '',
    received_amount:    '',
    progress_percent:   '',
    current_stage:      '',
    notes:              '',
    start_date:         '',
    expected_completion: '',
    qb_class_name:      '',
  })

  function set(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contract_value:   parseFloat(form.contract_value.replace(/,/g, '')) || 0,
          received_amount:  parseFloat(form.received_amount.replace(/,/g, '')) || 0,
          progress_percent: parseFloat(form.progress_percent) || 0,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to save')
      }
      setSuccess(true)
      setTimeout(() => router.push('/projects'), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  if (success) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Project Added!</h2>
          <p className="text-slate-500 text-sm mt-1">Redirecting to projects…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Add Project</h1>
            <p className="text-slate-500 text-sm">Enter your project details below</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">

        {/* Project name + type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Project Name" required>
            <input
              className={INPUT}
              placeholder="e.g. Khalid"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
            />
          </Field>
          <Field label="Type">
            <select className={INPUT} value={form.type} onChange={e => set('type', e.target.value as typeof form.type)}>
              <option value="villa">Villa</option>
              <option value="renovation">Renovation</option>
              <option value="commercial">Commercial</option>
            </select>
          </Field>
        </div>

        {/* Client + location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Client Name">
            <input
              className={INPUT}
              placeholder="e.g. Khalid Al Mansouri"
              value={form.client_name}
              onChange={e => set('client_name', e.target.value)}
            />
          </Field>
          <Field label="Location" required>
            <input
              className={INPUT}
              placeholder="e.g. Al Khawaneej, Dubai"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              required
            />
          </Field>
        </div>

        {/* Financials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Contract Value (AED)" required>
            <input
              className={INPUT}
              placeholder="e.g. 1,250,000"
              value={form.contract_value}
              onChange={e => set('contract_value', e.target.value)}
              required
            />
          </Field>
          <Field label="Amount Received (AED)">
            <input
              className={INPUT}
              placeholder="e.g. 520,000"
              value={form.received_amount}
              onChange={e => set('received_amount', e.target.value)}
            />
          </Field>
        </div>

        {/* Progress + stage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Progress (%)">
            <input
              className={INPUT}
              type="number"
              min="0" max="100"
              placeholder="e.g. 75"
              value={form.progress_percent}
              onChange={e => set('progress_percent', e.target.value)}
            />
          </Field>
          <Field label="Current / Next Stage">
            <select
              className={INPUT}
              value={form.current_stage}
              onChange={e => set('current_stage', e.target.value)}
            >
              <option value="">— Select stage —</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date">
            <input
              className={INPUT}
              type="date"
              value={form.start_date}
              onChange={e => set('start_date', e.target.value)}
            />
          </Field>
          <Field label="Expected Completion">
            <input
              className={INPUT}
              type="date"
              value={form.expected_completion}
              onChange={e => set('expected_completion', e.target.value)}
            />
          </Field>
        </div>

        {/* Status */}
        <Field label="Status">
          <select className={INPUT} value={form.status} onChange={e => set('status', e.target.value as typeof form.status)}>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </Field>

        {/* QuickBooks Class */}
        <Field label="QuickBooks Class">
          <select
            className={INPUT}
            value={form.qb_class_name}
            onChange={e => set('qb_class_name', e.target.value)}
            disabled={qbClassesLoad}
          >
            <option value="">{qbClassesLoad ? 'Loading QB classes…' : '— Not linked to QB class —'}</option>
            {qbClasses.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Link to a QuickBooks class so payments and expenses sync automatically.</p>
        </Field>

        {/* Notes */}
        <Field label="Notes">
          <textarea
            className={`${INPUT} resize-none`}
            rows={3}
            placeholder="Any additional details…"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Save Project</>}
          </button>
          <button
            type="button"
            onClick={() => router.push('/projects')}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
