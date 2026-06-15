'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, AlertCircle, FileText, ExternalLink, HardHat, Calculator, MessageSquare } from 'lucide-react'
import Link from 'next/link'

interface AIBOQItem {
  id: string
  projectId: string
  drawing_filename: string
  items: any[]
  subtotal: number
  total: number
  createdAt: string
}

interface SavedBOQ {
  id: string
  created_at: string
  updated_at: string
  // company fields
  project_number?: string
  project_name?: string
  area?: string
  owner?: string
  contractor?: string
  // mbhre fields
  file_no?: string
  owner_name?: string
  consultant?: string
  date_field?: string
}

export default function EstimationPage() {
  const router = useRouter()

  const [aiBoqs, setAiBoqs]               = useState<AIBOQItem[]>([])
  const [companyBoqs, setCompanyBoqs]     = useState<SavedBOQ[]>([])
  const [mbhreBoqs, setMbhreBoqs]         = useState<SavedBOQ[]>([])
  const [breakdownBoqs, setBreakdownBoqs] = useState<SavedBOQ[]>([])
  const [loading, setLoading]             = useState(true)
  const [deleting, setDeleting]           = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/boqs').then(r => r.json()).catch(() => ({ boqs: [] })),
      fetch('/api/boq/company').then(r => r.json()).catch(() => []),
      fetch('/api/boq/mbhre').then(r => r.json()).catch(() => []),
      fetch('/api/boq/mbhre-breakdown').then(r => r.json()).catch(() => []),
    ]).then(([ai, company, mbhre, breakdown]) => {
      setAiBoqs(ai.boqs || [])
      setCompanyBoqs(Array.isArray(company) ? company : [])
      setMbhreBoqs(Array.isArray(mbhre) ? mbhre : [])
      setBreakdownBoqs(Array.isArray(breakdown) ? breakdown : [])
    }).finally(() => setLoading(false))
  }, [])

  async function deleteCompany(id: string) {
    if (!confirm('Delete this BOQ?')) return
    setDeleting(id)
    const res = await fetch(`/api/boq/company?id=${id}`, { method: 'DELETE' })
    if (res.ok) setCompanyBoqs(prev => prev.filter(b => b.id !== id))
    setDeleting(null)
  }

  async function deleteMbhre(id: string) {
    if (!confirm('Delete this BOQ?')) return
    setDeleting(id)
    const res = await fetch(`/api/boq/mbhre?id=${id}`, { method: 'DELETE' })
    if (res.ok) setMbhreBoqs(prev => prev.filter(b => b.id !== id))
    setDeleting(null)
  }

  async function deleteBreakdown(id: string) {
    if (!confirm('Delete this Breakdown?')) return
    setDeleting(id)
    const res = await fetch(`/api/boq/mbhre-breakdown?id=${id}`, { method: 'DELETE' })
    if (res.ok) setBreakdownBoqs(prev => prev.filter(b => b.id !== id))
    setDeleting(null)
  }

  async function handleAiDelete(boqId: string) {
    if (!confirm('Delete this estimation?')) return
    setDeleting(boqId)
    const res = await fetch(`/api/boqs?id=${boqId}`, { method: 'DELETE' })
    if (res.ok) setAiBoqs(prev => prev.filter(b => b.id !== boqId))
    setDeleting(null)
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8">
      <div className="w-full">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Estimation Engineer</h1>
          <p className="text-slate-500 text-sm">Create and manage Bills of Quantities</p>
        </div>

        {/* ── New BOQ buttons ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">New BOQ</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/estimation/boq/company"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <FileText className="w-4 h-4" /> Company BOQ
            </Link>
            <Link href="/estimation/boq/mbhre"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <FileText className="w-4 h-4" /> MBHRE BOQ
            </Link>
            <Link href="/estimation/boq/mbhre-breakdown"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <FileText className="w-4 h-4" /> MBHRE Breakdown
            </Link>
          </div>
        </div>

        {/* ── Saved Company BOQs ── */}
        <section className="mb-6">
          <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-700 inline-block" />
            Company BOQs
            <span className="text-xs font-normal text-slate-400 ml-1">({companyBoqs.length})</span>
          </h2>
          {companyBoqs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-slate-400 text-sm">No Company BOQs saved yet</div>
          ) : (
            <div className="grid gap-3">
              {companyBoqs.map(boq => (
                <div key={boq.id} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{boq.owner || boq.project_name || 'Untitled'}</p>
                      <p className="text-sm text-slate-500 truncate">{boq.project_name}{boq.area ? ` — ${boq.area}` : ''}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Saved {fmtDate(boq.updated_at || boq.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/estimation/boq/company?id=${boq.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Link>
                      <button onClick={() => deleteCompany(boq.id)} disabled={deleting === boq.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Saved MBHRE BOQs ── */}
        <section className="mb-6">
          <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
            MBHRE BOQs
            <span className="text-xs font-normal text-slate-400 ml-1">({mbhreBoqs.length})</span>
          </h2>
          {mbhreBoqs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-slate-400 text-sm">No MBHRE BOQs saved yet</div>
          ) : (
            <div className="grid gap-3">
              {mbhreBoqs.map(boq => (
                <div key={boq.id} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{boq.owner_name || 'Untitled'}</p>
                      <p className="text-sm text-slate-500 truncate">File: {boq.file_no || '—'}{boq.consultant ? ` · ${boq.consultant}` : ''}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Saved {fmtDate(boq.updated_at || boq.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/estimation/boq/mbhre?id=${boq.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Link>
                      <button onClick={() => deleteMbhre(boq.id)} disabled={deleting === boq.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Saved MBHRE Breakdowns ── */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-600 inline-block" />
            MBHRE Breakdowns
            <span className="text-xs font-normal text-slate-400 ml-1">({breakdownBoqs.length})</span>
          </h2>
          {breakdownBoqs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-slate-400 text-sm">No Breakdowns saved yet</div>
          ) : (
            <div className="grid gap-3">
              {breakdownBoqs.map(boq => (
                <div key={boq.id} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{boq.owner_name || 'Untitled'}</p>
                      <p className="text-sm text-slate-500 truncate">File: {boq.file_no || '—'}{boq.consultant ? ` · ${boq.consultant}` : ''}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Saved {fmtDate(boq.updated_at || boq.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/estimation/boq/mbhre-breakdown?id=${boq.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium rounded-lg transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </Link>
                      <button onClick={() => deleteBreakdown(boq.id)} disabled={deleting === boq.id}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── New Estimation tools ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Generate BOQ from Project</h2>
          <p className="text-xs text-slate-400 mb-4">Choose how to create a new Bill of Quantities</p>
          <div className="grid sm:grid-cols-3 gap-3">

            {/* Formula calculator */}
            <Link href="/estimation/create"
              className="flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all group">
              <div className="w-10 h-10 bg-slate-100 group-hover:bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <Calculator className="w-5 h-5 text-slate-600 group-hover:text-brand-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Formula Calculator</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Enter plot size, floors, bedrooms, bathrooms → instant BOQ with standard rates
                </p>
                <span className="inline-block mt-2 text-xs font-semibold text-brand-600">
                  Instant · Uses standard rates
                </span>
              </div>
            </Link>

            {/* Civil engineer drawing analysis */}
            <Link href="/estimation/create-from-drawings"
              className="flex items-start gap-4 p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 transition-all group">
              <div className="w-10 h-10 bg-amber-100 group-hover:bg-amber-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <HardHat className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Civil Engineer AI</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Upload drawings → AI reads dimensions → BOQ quantities auto-filled, rates blank
                </p>
                <span className="inline-block mt-2 text-xs font-semibold text-amber-600">
                  Reads drawings · Rates blank
                </span>
              </div>
            </Link>

            {/* Drawing chat */}
            <Link href="/estimation/drawing-chat"
              className="flex items-start gap-4 p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
              <div className="w-10 h-10 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Drawing Chat</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Upload drawings → chat with AI → ask quantity questions → fill BOQ manually
                </p>
                <span className="inline-block mt-2 text-xs font-semibold text-emerald-600">
                  Q&amp;A · You control the BOQ
                </span>
              </div>
            </Link>

          </div>
        </div>

        {/* ── AI Estimations ── */}
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold text-slate-800">AI Estimations</h2>
          <div className="flex gap-2">
            <Link href="/estimation/drawing-chat"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
              <MessageSquare className="w-4 h-4" /> Drawing Chat
            </Link>
            <Link href="/estimation/create-from-drawings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Auto Analysis
            </Link>
          </div>
        </div>

        {aiBoqs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-10 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No AI estimations yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {aiBoqs.map((boq) => (
              <div key={boq.id} className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{boq.drawing_filename}</h3>
                    <p className="text-sm text-slate-500">{boq.items?.length ?? 0} items</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900">
                    AED {boq.total?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <p className="text-xs text-slate-400 mb-4">{fmtDate(boq.createdAt)}</p>
                <div className="flex gap-2">
                  <button onClick={() => router.push(`/estimation/${boq.id}`)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-lg text-sm transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleAiDelete(boq.id)} disabled={deleting === boq.id}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg flex items-center gap-2 text-sm transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                    {deleting === boq.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
