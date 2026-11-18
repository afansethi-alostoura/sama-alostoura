'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, HardHat, AlertCircle } from 'lucide-react'

interface FollowupMeta {
  staff_name: string
  project_name: string
  status: string
}

export default function FollowupPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken]       = useState('')
  const [meta, setMeta]         = useState<FollowupMeta | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [update, setUpdate]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [submitting, setSub]    = useState(false)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    params.then(p => {
      setToken(p.token)
      fetch(`/api/staff/daily-followup/meta?token=${p.token}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) setNotFound(true)
          else { setMeta(d); if (d.status === 'responded') setDone(true) }
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false))
    })
  }, [params])

  async function submit() {
    if (!update.trim()) return
    setSub(true)
    const res = await fetch('/api/staff/daily-followup/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, response: update }),
    })
    if (res.ok) setDone(true)
    setSub(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
      <h1 className="text-xl font-bold text-slate-700">لنک نہیں ملا</h1>
      <p className="text-slate-500 mt-2 font-urdu" dir="rtl">یہ فالو اپ لنک غلط ہے یا میعاد ختم ہو گئی ہے۔</p>
      <p className="text-xs text-slate-400 mt-2">Link Not Found</p>
    </div>
  )

  if (done) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <CheckCircle className="w-20 h-20 text-emerald-500 mb-4" />
      <h1 className="text-2xl font-bold text-slate-800" dir="rtl">اپ ڈیٹ موصول ہو گئی!</h1>
      <p className="text-slate-500 mt-2 max-w-xs" dir="rtl">
        شکریہ{meta?.staff_name ? ` ${meta.staff_name.split(' ')[0]}` : ''}! <strong>{meta?.project_name}</strong> کی آپ کی اپ ڈیٹ محفوظ کر لی گئی ہے۔
      </p>
      <p className="text-sm text-slate-400 mt-1">Update received successfully</p>
      <p className="text-xs text-slate-400 mt-4">Sama Alostoura Building Contracting LLC</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-blue-800 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-blue-200 font-medium">روزانہ سائٹ اپ ڈیٹ</p>
            <p className="text-white font-bold">Sama Alostoura</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Staff & project info */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100" dir="rtl">
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wider mb-1">آپ کی اپ ڈیٹ اس پراجیکٹ کے لیے</p>
            <p className="text-lg font-bold text-blue-800">{meta?.project_name}</p>
            {meta?.staff_name && <p className="text-sm text-slate-500 mt-0.5">{meta.staff_name}</p>}
          </div>

          {/* Questions in Urdu */}
          <div className="space-y-1.5" dir="rtl">
            <p className="text-sm font-bold text-slate-700">براہ کرم آج کا حال بتائیں:</p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>آج کیا کام مکمل ہوا؟</li>
              <li>پراجیکٹ کی پیشرفت کتنے فیصد ہے؟</li>
              <li>کوئی مسئلہ یا رکاوٹ ہے؟</li>
              <li>کل کیا کام ہوگا؟</li>
            </ul>
            <p className="text-xs text-slate-400 pt-1">
              (What was done today? Progress %? Any issues? Tomorrow&apos;s plan?)
            </p>
          </div>

          {/* Text area */}
          <textarea
            rows={6}
            value={update}
            onChange={e => setUpdate(e.target.value)}
            placeholder="یہاں اپنی اپ ڈیٹ لکھیں... (Type your update here)"
            dir="auto"
            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
          />

          <button
            onClick={submit}
            disabled={submitting || !update.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-sm rounded-2xl transition-colors shadow-sm">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            اپ ڈیٹ بھیجیں &nbsp;·&nbsp; Submit Update
          </button>
        </div>
      </div>
    </div>
  )
}
