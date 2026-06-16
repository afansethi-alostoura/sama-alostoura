'use client'
import React, { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, Plus, X, ChevronRight, Loader2, Trash2, Pencil,
  Package, Truck, Users, ClipboardList, CheckCircle2, Clock,
  Star, Phone, Mail, Building2, AlertCircle, Save, ArrowRight,
  Search, ChevronDown, ChevronUp, History, Tag,
  MessageSquare, Webhook, Copy, CheckCheck,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type PRStatus = 'requested' | 'approved' | 'ordered' | 'delivered'

interface PRItem { description: string; qty: string; unit: string; notes: string }
interface PR {
  id: string; pr_number: string; project_id: string; project_name: string
  title: string; description: string; requested_by: string
  date_requested: string; date_needed: string; status: PRStatus
  items: PRItem[]; source?: string; whatsapp_from?: string; notes: string; created_at: string
}

interface Supplier {
  id: string; name: string; contact_person: string; phone: string; email: string
  category: string; address: string; payment_terms: string; rating: number
  materials: string[]; notes: string
}

interface POItem { description: string; qty: string; unit: string; unit_price: string; total: string }
interface PO {
  id: string; po_number: string; pr_id: string; project_id: string; project_name: string
  supplier_id: string; supplier_name: string; date_issued: string; date_expected: string
  status: PRStatus; items: POItem[]; total_amount: number; notes: string; created_at: string
}

interface DelItem { description: string; qty_ordered: string; qty_delivered: string; unit: string }
interface Delivery {
  id: string; po_id: string; po_number: string; project_id: string; project_name: string
  delivery_date: string; delivered_by: string; received_by: string
  status: PRStatus; items: DelItem[]; notes: string; created_at: string
}

interface Project { id: string; name: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_FLOW: PRStatus[] = ['requested', 'approved', 'ordered', 'delivered']

const STATUS_LABEL: Record<PRStatus, string> = {
  requested: 'Requested', approved: 'Approved', ordered: 'Ordered', delivered: 'Delivered',
}
const STATUS_COLOR: Record<PRStatus, string> = {
  requested: 'bg-slate-100 text-slate-600',
  approved:  'bg-blue-100 text-blue-700',
  ordered:   'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
}
const STATUS_DOT: Record<PRStatus, string> = {
  requested: 'bg-slate-400', approved: 'bg-blue-500',
  ordered: 'bg-amber-500', delivered: 'bg-emerald-500',
}

function nextStatus(s: PRStatus): PRStatus | null {
  const i = STATUS_FLOW.indexOf(s)
  return i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null
}

const fmt = (n: number) => 'AED ' + n.toLocaleString('en-AE', { minimumFractionDigits: 2 })

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PRStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLOR[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Status Flow Bar ───────────────────────────────────────────────────────────

function StatusFlow({ status }: { status: PRStatus }) {
  const idx = STATUS_FLOW.indexOf(status)
  return (
    <div className="flex items-center gap-0">
      {STATUS_FLOW.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold
            ${i <= idx ? STATUS_COLOR[s] : 'bg-slate-100 text-slate-400'}`}>
            {i <= idx && <CheckCircle2 className="w-3 h-3" />}
            {STATUS_LABEL[s]}
          </div>
          {i < STATUS_FLOW.length - 1 && (
            <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${i < idx ? 'text-slate-500' : 'text-slate-300'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-900 text-lg">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
const sel = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label, action }: { icon: any; label: string; action: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <div>
        <p className="font-semibold text-slate-700">No records yet</p>
        <p className="text-sm text-slate-400 mt-0.5">{label}</p>
      </div>
      <button onClick={action} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
        <Plus className="w-4 h-4" /> Add First Record
      </button>
    </div>
  )
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ items }: { items: { status: PRStatus }[] }) {
  const counts = STATUS_FLOW.reduce((acc, s) => ({ ...acc, [s]: items.filter(i => i.status === s).length }), {} as Record<PRStatus, number>)
  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {STATUS_FLOW.map(s => (
        <div key={s} className={`rounded-xl px-4 py-3 ${STATUS_COLOR[s].replace('text-', 'border-').replace('bg-', 'bg-').split(' ')[0]} border`}>
          <p className={`text-2xl font-bold ${STATUS_COLOR[s].split(' ')[1]}`}>{counts[s]}</p>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">{STATUS_LABEL[s]}</p>
        </div>
      ))}
    </div>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

type Tab = 'pr' | 'suppliers' | 'po' | 'delivery'

export default function ProcurementPage() {
  const [tab, setTab] = useState<Tab>('pr')

  // Data
  const [prs,        setPrs]        = useState<PR[]>([])
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [pos,        setPos]        = useState<PO[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  // Modals
  const [prModal,       setPrModal]       = useState<'new' | 'edit' | 'view' | null>(null)
  const [supplierModal, setSupplierModal] = useState<'new' | 'edit' | null>(null)
  const [poModal,       setPoModal]       = useState<'new' | 'edit' | 'view' | null>(null)
  const [delModal,      setDelModal]      = useState<'new' | 'edit' | 'view' | null>(null)

  // Selected record
  const [selPR,  setSelPR]  = useState<PR | null>(null)
  const [selSup, setSelSup] = useState<Supplier | null>(null)
  const [selPO,  setSelPO]  = useState<PO | null>(null)
  const [selDel, setSelDel] = useState<Delivery | null>(null)

  // PR form
  const blankPR = (): Omit<PR, 'id' | 'created_at'> => ({
    pr_number: `PR-${Date.now().toString().slice(-6)}`,
    project_id: '', project_name: '', title: '', description: '',
    requested_by: '', date_requested: new Date().toISOString().slice(0, 10),
    date_needed: '', status: 'requested',
    items: [{ description: '', qty: '', unit: '', notes: '' }], notes: '',
  })
  const [prForm, setPrForm] = useState(blankPR())

  // Supplier form
  const blankSup = (): Omit<Supplier, 'id'> => ({
    name: '', contact_person: '', phone: '', email: '',
    category: '', address: '', payment_terms: '', rating: 0, materials: [], notes: '',
  })
  const [supForm, setSupForm] = useState(blankSup())
  const [matInput, setMatInput] = useState('')
  const [supSearch, setSupSearch] = useState('')
  const [expandedSup, setExpandedSup] = useState<string | null>(null)

  // PO form
  const blankPO = (): Omit<PO, 'id' | 'created_at'> => ({
    po_number: `PO-${Date.now().toString().slice(-6)}`,
    pr_id: '', project_id: '', project_name: '',
    supplier_id: '', supplier_name: '',
    date_issued: new Date().toISOString().slice(0, 10), date_expected: '',
    status: 'requested',
    items: [{ description: '', qty: '', unit: '', unit_price: '', total: '' }],
    total_amount: 0, notes: '',
  })
  const [poForm, setPoForm] = useState(blankPO())

  // Delivery form
  const blankDel = (): Omit<Delivery, 'id' | 'created_at'> => ({
    po_id: '', po_number: '', project_id: '', project_name: '',
    delivery_date: new Date().toISOString().slice(0, 10),
    delivered_by: '', received_by: '', status: 'ordered',
    items: [{ description: '', qty_ordered: '', qty_delivered: '', unit: '' }], notes: '',
  })
  const [delForm, setDelForm] = useState(blankDel())
  const [copied, setCopied] = useState(false)
  const [showWASetup, setShowWASetup] = useState(false)

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [prsRes, supRes, posRes, delRes, projRes] = await Promise.all([
        fetch('/api/procurement/pr').then(r => r.json()),
        fetch('/api/procurement/suppliers').then(r => r.json()),
        fetch('/api/procurement/po').then(r => r.json()),
        fetch('/api/procurement/delivery').then(r => r.json()),
        fetch('/api/projects').then(r => r.json()),
      ])
      setPrs(Array.isArray(prsRes) ? prsRes : [])
      setSuppliers(Array.isArray(supRes) ? supRes : [])
      setPos(Array.isArray(posRes) ? posRes : [])
      setDeliveries(Array.isArray(delRes) ? delRes : [])
      setProjects(Array.isArray(projRes) ? projRes.map((p: any) => ({ id: p.id, name: p.name })) : [])
    } catch { setError('Failed to load data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Advance status ─────────────────────────────────────────────────────────
  async function advanceStatus(type: 'pr' | 'po' | 'delivery', id: string, current: PRStatus) {
    const next = nextStatus(current)
    if (!next) return
    const url = `/api/procurement/${type === 'pr' ? 'pr' : type === 'po' ? 'po' : 'delivery'}`
    await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) })
    loadAll()
  }

  // ── PR CRUD ────────────────────────────────────────────────────────────────
  async function savePR() {
    setSaving(true); setError('')
    try {
      const payload = { ...prForm, project_name: projects.find(p => p.id === prForm.project_id)?.name ?? prForm.project_name }
      if (prModal === 'edit' && selPR) {
        await fetch('/api/procurement/pr', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selPR.id, ...payload }) })
      } else {
        await fetch('/api/procurement/pr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setPrModal(null); loadAll()
    } catch { setError('Save failed') } finally { setSaving(false) }
  }

  async function deletePR(id: string) {
    if (!confirm('Delete this Purchase Request?')) return
    await fetch(`/api/procurement/pr?id=${id}`, { method: 'DELETE' }); loadAll()
  }

  // ── Supplier CRUD ──────────────────────────────────────────────────────────
  async function saveSupplier() {
    setSaving(true); setError('')
    try {
      if (supplierModal === 'edit' && selSup) {
        await fetch('/api/procurement/suppliers', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selSup.id, ...supForm }) })
      } else {
        await fetch('/api/procurement/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supForm) })
      }
      setSupplierModal(null); loadAll()
    } catch { setError('Save failed') } finally { setSaving(false) }
  }

  async function deleteSupplier(id: string) {
    if (!confirm('Delete this Supplier?')) return
    await fetch(`/api/procurement/suppliers?id=${id}`, { method: 'DELETE' }); loadAll()
  }

  // ── PO CRUD ────────────────────────────────────────────────────────────────
  async function savePO() {
    setSaving(true); setError('')
    try {
      const total = poForm.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0)
      const sup = suppliers.find(s => s.id === poForm.supplier_id)
      const proj = projects.find(p => p.id === poForm.project_id)
      const payload = { ...poForm, total_amount: total, supplier_name: sup?.name ?? poForm.supplier_name, project_name: proj?.name ?? poForm.project_name }
      if (poModal === 'edit' && selPO) {
        await fetch('/api/procurement/po', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selPO.id, ...payload }) })
      } else {
        await fetch('/api/procurement/po', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setPoModal(null); loadAll()
    } catch { setError('Save failed') } finally { setSaving(false) }
  }

  async function deletePO(id: string) {
    if (!confirm('Delete this Purchase Order?')) return
    await fetch(`/api/procurement/po?id=${id}`, { method: 'DELETE' }); loadAll()
  }

  // ── Delivery CRUD ──────────────────────────────────────────────────────────
  async function saveDelivery() {
    setSaving(true); setError('')
    try {
      const po = pos.find(p => p.id === delForm.po_id)
      const proj = projects.find(p => p.id === delForm.project_id)
      const payload = { ...delForm, po_number: po?.po_number ?? delForm.po_number, project_name: proj?.name ?? delForm.project_name }
      if (delModal === 'edit' && selDel) {
        await fetch('/api/procurement/delivery', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selDel.id, ...payload }) })
      } else {
        await fetch('/api/procurement/delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setDelModal(null); loadAll()
    } catch { setError('Save failed') } finally { setSaving(false) }
  }

  async function deleteDelivery(id: string) {
    if (!confirm('Delete this delivery record?')) return
    await fetch(`/api/procurement/delivery?id=${id}`, { method: 'DELETE' }); loadAll()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'pr'       as Tab, label: 'Purchase Requests', icon: ClipboardList, count: prs.length },
    { id: 'suppliers'as Tab, label: 'Suppliers',         icon: Users,         count: suppliers.length },
    { id: 'po'       as Tab, label: 'Purchase Orders',   icon: ShoppingCart,  count: pos.length },
    { id: 'delivery' as Tab, label: 'Material Delivery', icon: Truck,         count: deliveries.length },
  ]

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Procurement</h1>
        <p className="text-sm text-slate-500 mt-0.5">Purchase Requests · Suppliers · Purchase Orders · Delivery Tracking</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-1 justify-center
              ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
              ${tab === id ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── PURCHASE REQUESTS ───────────────────────────────────────────────── */}
      {tab === 'pr' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Purchase Requests</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWASetup(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors
                  ${showWASetup ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-300 hover:bg-green-50'}`}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => { setPrForm(blankPR()); setPrModal('new') }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> New PR
              </button>
            </div>
          </div>

          {/* ── WhatsApp Integration Setup Card ─────────────────────────────── */}
          {showWASetup && (
            <div className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-900">WhatsApp → Purchase Request</p>
                  <p className="text-xs text-green-700 mt-0.5">Site staff send a WhatsApp message → AI parses it → PR created automatically</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Webhook URL */}
                <div>
                  <p className="text-xs font-bold text-green-800 mb-1.5 flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5" /> Webhook URL (paste into Twilio)</p>
                  <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                    <code className="text-xs text-slate-700 flex-1 truncate">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/procurement/pr/whatsapp
                    </code>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/procurement/pr/whatsapp`
                        navigator.clipboard.writeText(url)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900 flex-shrink-0"
                    >
                      {copied ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Setup Steps */}
                <div>
                  <p className="text-xs font-bold text-green-800 mb-2">Setup Steps (Meta WhatsApp Business)</p>
                  <ol className="space-y-1.5 text-xs text-green-800">
                    <li className="flex items-start gap-2"><span className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>Go to <strong>developers.facebook.com</strong> → your App → WhatsApp → Configuration</li>
                    <li className="flex items-start gap-2"><span className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>Paste the webhook URL above. Set Verify Token to: <code className="bg-green-100 px-1 rounded font-mono">sama-procurement</code></li>
                    <li className="flex items-start gap-2"><span className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>Add env vars in Vercel: <code className="bg-green-100 px-1 rounded font-mono">WHATSAPP_ACCESS_TOKEN</code>, <code className="bg-green-100 px-1 rounded font-mono">WHATSAPP_PHONE_NUMBER_ID</code></li>
                    <li className="flex items-start gap-2"><span className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">4</span>Subscribe to <strong>messages</strong> webhook field — staff WhatsApp the number and PRs appear instantly</li>
                  </ol>
                </div>

                {/* Message Format */}
                <div>
                  <p className="text-xs font-bold text-green-800 mb-2">Message Formats (both work)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white border border-green-200 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-green-600 mb-1">FREE FORM</p>
                      <p className="text-xs text-slate-600 italic">"Need 50 bags of cement for FAHAD project by next Tuesday"</p>
                    </div>
                    <div className="bg-white border border-green-200 rounded-lg p-3">
                      <p className="text-[10px] font-bold text-green-600 mb-1">STRUCTURED</p>
                      <p className="text-xs text-slate-600 font-mono">Project: FAHAD<br/>Material: Cement<br/>Qty: 50 bags<br/>Date: 2026-07-15</p>
                    </div>
                  </div>
                </div>

                {/* WA PR count */}
                {prs.filter(p => p.source === 'whatsapp').length > 0 && (
                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-800 font-semibold">
                      {prs.filter(p => p.source === 'whatsapp').length} PR{prs.filter(p => p.source === 'whatsapp').length !== 1 ? 's' : ''} received via WhatsApp so far
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {prs.length === 0
            ? <EmptyState icon={ClipboardList} label="Create your first purchase request" action={() => { setPrForm(blankPR()); setPrModal('new') }} />
            : (
              <>
                <StatsRow items={prs} />
                <div className="space-y-3">
                  {prs.map(pr => (
                    <div key={pr.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{pr.pr_number}</span>
                            <StatusBadge status={pr.status} />
                            {pr.source === 'whatsapp' && (
                              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
                                <MessageSquare className="w-3 h-3" /> WhatsApp
                              </span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900 mt-1">{pr.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                            {pr.project_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{pr.project_name}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{pr.date_requested}</span>
                            {pr.requested_by && <span>By: {pr.requested_by}</span>}
                            {pr.date_needed && <span className="text-amber-600">Needed: {pr.date_needed}</span>}
                            {pr.whatsapp_from && <span className="text-green-600 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{pr.whatsapp_from.replace('whatsapp:', '')}</span>}
                          </div>
                          <div className="mt-2">
                            <StatusFlow status={pr.status} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {nextStatus(pr.status) && (
                            <button
                              onClick={() => advanceStatus('pr', pr.id, pr.status)}
                              className="flex items-center gap-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              → {STATUS_LABEL[nextStatus(pr.status)!]}
                            </button>
                          )}
                          <button onClick={() => { setSelPR(pr); setPrForm({ ...pr }); setPrModal('edit') }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deletePR(pr.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {pr.items?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 mb-2">MATERIALS ({pr.items.length})</p>
                          <div className="space-y-1">
                            {pr.items.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                                <span className="w-5 h-5 bg-slate-100 rounded text-center leading-5 text-slate-500 flex-shrink-0">{i + 1}</span>
                                <span className="flex-1 font-medium">{item.description}</span>
                                {item.qty && <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{item.qty} {item.unit}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      )}

      {/* ── SUPPLIERS ───────────────────────────────────────────────────────── */}
      {tab === 'suppliers' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Suppliers</h2>
            <button
              onClick={() => { setSupForm(blankSup()); setMatInput(''); setSupplierModal('new') }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              placeholder="Search by name, phone, category, or material…"
              value={supSearch}
              onChange={e => setSupSearch(e.target.value)}
            />
          </div>

          {suppliers.length === 0
            ? <EmptyState icon={Users} label="Add your first supplier" action={() => { setSupForm(blankSup()); setMatInput(''); setSupplierModal('new') }} />
            : (() => {
                const q = supSearch.toLowerCase()
                const filtered = suppliers.filter(s =>
                  !q ||
                  s.name.toLowerCase().includes(q) ||
                  s.phone.toLowerCase().includes(q) ||
                  s.category.toLowerCase().includes(q) ||
                  (s.materials ?? []).some(m => m.toLowerCase().includes(q)) ||
                  s.contact_person.toLowerCase().includes(q)
                )
                if (filtered.length === 0) return (
                  <div className="text-center py-12 text-slate-400 text-sm">No suppliers match "{supSearch}"</div>
                )
                return (
                  <div className="space-y-4">
                    {filtered.map(sup => {
                      const supPOs = pos.filter(po => po.supplier_id === sup.id)
                      const supPRs = prs.filter(pr => supPOs.some(po => po.pr_id === pr.id))
                      const totalSpend = supPOs.reduce((s, po) => s + (po.total_amount || 0), 0)
                      const isExpanded = expandedSup === sup.id
                      return (
                        <div key={sup.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          {/* Card Header */}
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                  <Building2 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-900">{sup.name}</p>
                                    {sup.category && (
                                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sup.category}</span>
                                    )}
                                    {sup.rating > 0 && (
                                      <div className="flex items-center gap-0.5">
                                        {[1,2,3,4,5].map(i => (
                                          <Star key={i} className={`w-3 h-3 ${i <= sup.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                                    {sup.contact_person && <span className="text-xs text-slate-500">{sup.contact_person}</span>}
                                    {sup.phone && (
                                      <span className="text-xs text-slate-600 flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-slate-400" />{sup.phone}
                                      </span>
                                    )}
                                    {sup.email && (
                                      <span className="text-xs text-slate-600 flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-slate-400" />{sup.email}
                                      </span>
                                    )}
                                    {sup.payment_terms && <span className="text-xs text-slate-400">Terms: {sup.payment_terms}</span>}
                                  </div>

                                  {/* Materials Tags */}
                                  {(sup.materials ?? []).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {(sup.materials ?? []).map((m, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                          <Tag className="w-2.5 h-2.5" />{m}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {sup.notes && <p className="text-xs text-slate-400 italic mt-1.5">{sup.notes}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => setExpandedSup(isExpanded ? null : sup.id)}
                                  className="flex items-center gap-1 text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  {supPOs.length} PO{supPOs.length !== 1 ? 's' : ''}
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                                <button onClick={() => { setSelSup(sup); setSupForm({ ...sup, materials: sup.materials ?? [] }); setMatInput(''); setSupplierModal('edit') }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteSupplier(sup.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Order History — expanded */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Order History</p>
                                {totalSpend > 0 && (
                                  <span className="text-xs font-bold text-slate-900">Total Spend: {fmt(totalSpend)}</span>
                                )}
                              </div>
                              {supPOs.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No purchase orders yet for this supplier.</p>
                              ) : (
                                <div className="space-y-2">
                                  {supPOs.map(po => (
                                    <div key={po.id} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5 flex items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-mono text-slate-500">{po.po_number}</span>
                                          <StatusBadge status={po.status} />
                                          {po.project_name && (
                                            <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                              <Building2 className="w-3 h-3" />{po.project_name}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                                          <span>{po.date_issued}</span>
                                          {po.date_expected && <span>→ {po.date_expected}</span>}
                                          {po.items?.length > 0 && <span>{po.items.length} item{po.items.length !== 1 ? 's' : ''}</span>}
                                        </div>
                                      </div>
                                      <span className="text-sm font-bold text-slate-800 flex-shrink-0">{fmt(po.total_amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()
          }
        </div>
      )}

      {/* ── PURCHASE ORDERS ─────────────────────────────────────────────────── */}
      {tab === 'po' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Purchase Orders</h2>
            <button
              onClick={() => { setPoForm(blankPO()); setPoModal('new') }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> New PO
            </button>
          </div>

          {pos.length === 0
            ? <EmptyState icon={ShoppingCart} label="Create your first purchase order" action={() => { setPoForm(blankPO()); setPoModal('new') }} />
            : (
              <>
                <StatsRow items={pos} />
                <div className="space-y-3">
                  {pos.map(po => (
                    <div key={po.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{po.po_number}</span>
                            <StatusBadge status={po.status} />
                            {po.pr_id && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">From PR</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                            {po.supplier_name && <span className="font-semibold text-slate-700">{po.supplier_name}</span>}
                            {po.project_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{po.project_name}</span>}
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{po.date_issued}</span>
                            {po.date_expected && <span className="text-amber-600">Expected: {po.date_expected}</span>}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <StatusFlow status={po.status} />
                            <span className="font-bold text-slate-900 text-sm ml-3">{fmt(po.total_amount)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {nextStatus(po.status) && (
                            <button
                              onClick={() => advanceStatus('po', po.id, po.status)}
                              className="flex items-center gap-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              → {STATUS_LABEL[nextStatus(po.status)!]}
                            </button>
                          )}
                          <button onClick={() => { setSelPO(po); setPoForm({ ...po }); setPoModal('edit') }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deletePO(po.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {po.items?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 overflow-x-auto">
                          <table className="w-full text-xs min-w-[400px]">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-100">
                                <th className="text-left pb-1 font-semibold">Description</th>
                                <th className="text-center pb-1 font-semibold w-16">Qty</th>
                                <th className="text-center pb-1 font-semibold w-16">Unit</th>
                                <th className="text-right pb-1 font-semibold w-24">Unit Price</th>
                                <th className="text-right pb-1 font-semibold w-24">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {po.items.map((item, i) => (
                                <tr key={i} className="border-b border-slate-50">
                                  <td className="py-1 text-slate-700">{item.description}</td>
                                  <td className="py-1 text-center text-slate-500">{item.qty}</td>
                                  <td className="py-1 text-center text-slate-500">{item.unit}</td>
                                  <td className="py-1 text-right text-slate-500">{item.unit_price}</td>
                                  <td className="py-1 text-right font-semibold text-slate-800">{item.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      )}

      {/* ── MATERIAL DELIVERY ───────────────────────────────────────────────── */}
      {tab === 'delivery' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Material Delivery Tracking</h2>
            <button
              onClick={() => { setDelForm(blankDel()); setDelModal('new') }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Record Delivery
            </button>
          </div>

          {deliveries.length === 0
            ? <EmptyState icon={Truck} label="Record your first material delivery" action={() => { setDelForm(blankDel()); setDelModal('new') }} />
            : (
              <>
                <StatsRow items={deliveries} />
                <div className="space-y-3">
                  {deliveries.map(del => (
                    <div key={del.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {del.po_number && <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">PO: {del.po_number}</span>}
                            <StatusBadge status={del.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                            {del.project_name && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{del.project_name}</span>}
                            <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{del.delivery_date}</span>
                            {del.delivered_by && <span>Delivered by: {del.delivered_by}</span>}
                            {del.received_by && <span>Received by: {del.received_by}</span>}
                          </div>
                          <div className="mt-2">
                            <StatusFlow status={del.status} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {nextStatus(del.status) && (
                            <button
                              onClick={() => advanceStatus('delivery', del.id, del.status)}
                              className="flex items-center gap-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              → {STATUS_LABEL[nextStatus(del.status)!]}
                            </button>
                          )}
                          <button onClick={() => { setSelDel(del); setDelForm({ ...del }); setDelModal('edit') }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteDelivery(del.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {del.items?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 overflow-x-auto">
                          <table className="w-full text-xs min-w-[400px]">
                            <thead>
                              <tr className="text-slate-400 border-b border-slate-100">
                                <th className="text-left pb-1 font-semibold">Description</th>
                                <th className="text-center pb-1 font-semibold w-20">Qty Ordered</th>
                                <th className="text-center pb-1 font-semibold w-24">Qty Delivered</th>
                                <th className="text-center pb-1 font-semibold w-16">Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {del.items.map((item, i) => {
                                const ord = parseFloat(item.qty_ordered) || 0
                                const dlv = parseFloat(item.qty_delivered) || 0
                                const pct = ord > 0 ? Math.min(100, Math.round((dlv / ord) * 100)) : 0
                                return (
                                  <tr key={i} className="border-b border-slate-50">
                                    <td className="py-1 text-slate-700">{item.description}</td>
                                    <td className="py-1 text-center text-slate-500">{item.qty_ordered}</td>
                                    <td className="py-1 text-center">
                                      <span className={pct === 100 ? 'text-emerald-600 font-semibold' : pct > 0 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                                        {item.qty_delivered} {pct > 0 && `(${pct}%)`}
                                      </span>
                                    </td>
                                    <td className="py-1 text-center text-slate-500">{item.unit}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {del.notes && <p className="mt-2 text-xs text-slate-500 italic">{del.notes}</p>}
                    </div>
                  ))}
                </div>
              </>
            )
          }
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ── PR Modal ──────────────────────────────────────────────────────── */}
      {(prModal === 'new' || prModal === 'edit') && (
        <Modal title={prModal === 'new' ? 'New Purchase Request' : 'Edit Purchase Request'} onClose={() => setPrModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="PR Number">
                <input className={inp} value={prForm.pr_number} onChange={e => setPrForm(p => ({ ...p, pr_number: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select className={sel} value={prForm.status} onChange={e => setPrForm(p => ({ ...p, status: e.target.value as PRStatus }))}>
                  {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Title *">
              <input className={inp} placeholder="What do you need?" value={prForm.title} onChange={e => setPrForm(p => ({ ...p, title: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project">
                <select className={sel} value={prForm.project_id} onChange={e => setPrForm(p => ({ ...p, project_id: e.target.value }))}>
                  <option value="">— Select Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Requested By">
                <input className={inp} value={prForm.requested_by} onChange={e => setPrForm(p => ({ ...p, requested_by: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date Requested">
                <input type="date" className={inp} value={prForm.date_requested} onChange={e => setPrForm(p => ({ ...p, date_requested: e.target.value }))} />
              </Field>
              <Field label="Date Needed">
                <input type="date" className={inp} value={prForm.date_needed} onChange={e => setPrForm(p => ({ ...p, date_needed: e.target.value }))} />
              </Field>
            </div>
            <Field label="Description">
              <textarea className={inp + ' resize-none'} rows={2} value={prForm.description} onChange={e => setPrForm(p => ({ ...p, description: e.target.value }))} />
            </Field>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600">ITEMS</label>
                <button onClick={() => setPrForm(p => ({ ...p, items: [...p.items, { description: '', qty: '', unit: '', notes: '' }] }))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold">+ Add Item</button>
              </div>
              <div className="space-y-2">
                {prForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 items-center">
                    <input className={inp} placeholder="Description" value={item.description} onChange={e => setPrForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, description: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Qty" value={item.qty} onChange={e => setPrForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, qty: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Unit" value={item.unit} onChange={e => setPrForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, unit: e.target.value } : it) }))} />
                    <button onClick={() => setPrForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))} className="p-1.5 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Notes">
              <textarea className={inp + ' resize-none'} rows={2} value={prForm.notes} onChange={e => setPrForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>

            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPrModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button onClick={savePR} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Supplier Modal ─────────────────────────────────────────────────── */}
      {(supplierModal === 'new' || supplierModal === 'edit') && (
        <Modal title={supplierModal === 'new' ? 'Add Supplier' : 'Edit Supplier'} onClose={() => setSupplierModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Company Name *">
                <input className={inp} value={supForm.name} onChange={e => setSupForm(p => ({ ...p, name: e.target.value }))} />
              </Field>
              <Field label="Category">
                <input className={inp} placeholder="e.g. Steel, Concrete, MEP…" value={supForm.category} onChange={e => setSupForm(p => ({ ...p, category: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Person">
                <input className={inp} value={supForm.contact_person} onChange={e => setSupForm(p => ({ ...p, contact_person: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <input className={inp} value={supForm.phone} onChange={e => setSupForm(p => ({ ...p, phone: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input className={inp} type="email" value={supForm.email} onChange={e => setSupForm(p => ({ ...p, email: e.target.value }))} />
              </Field>
              <Field label="Payment Terms">
                <input className={inp} placeholder="e.g. Net 30, Cash…" value={supForm.payment_terms} onChange={e => setSupForm(p => ({ ...p, payment_terms: e.target.value }))} />
              </Field>
            </div>
            <Field label="Address">
              <input className={inp} value={supForm.address} onChange={e => setSupForm(p => ({ ...p, address: e.target.value }))} />
            </Field>

            {/* Materials Tag Input */}
            <Field label="Materials Supplied">
              <div className="border border-slate-200 rounded-lg p-2 min-h-[44px] flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-blue-400"
                onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
                {(supForm.materials ?? []).map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Tag className="w-2.5 h-2.5" />{m}
                    <button onClick={() => setSupForm(p => ({ ...p, materials: p.materials.filter((_, j) => j !== i) }))} className="hover:text-red-500 ml-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  className="text-sm outline-none flex-1 min-w-[120px] bg-transparent"
                  placeholder={supForm.materials?.length ? 'Add another…' : 'Type material and press Enter…'}
                  value={matInput}
                  onChange={e => setMatInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && matInput.trim()) {
                      e.preventDefault()
                      const val = matInput.trim().replace(/,$/, '')
                      if (val && !supForm.materials?.includes(val)) {
                        setSupForm(p => ({ ...p, materials: [...(p.materials ?? []), val] }))
                      }
                      setMatInput('')
                    } else if (e.key === 'Backspace' && !matInput && (supForm.materials ?? []).length > 0) {
                      setSupForm(p => ({ ...p, materials: p.materials.slice(0, -1) }))
                    }
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Press Enter or comma to add each material (e.g. Steel, Rebar, Tiles…)</p>
            </Field>

            <Field label="Rating (0–5)">
              <div className="flex items-center gap-2">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setSupForm(p => ({ ...p, rating: p.rating === i ? 0 : i }))}>
                    <Star className={`w-6 h-6 ${i <= supForm.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Notes">
              <textarea className={inp + ' resize-none'} rows={2} value={supForm.notes} onChange={e => setSupForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setSupplierModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button onClick={saveSupplier} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── PO Modal ──────────────────────────────────────────────────────── */}
      {(poModal === 'new' || poModal === 'edit') && (
        <Modal title={poModal === 'new' ? 'New Purchase Order' : 'Edit Purchase Order'} onClose={() => setPoModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="PO Number">
                <input className={inp} value={poForm.po_number} onChange={e => setPoForm(p => ({ ...p, po_number: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select className={sel} value={poForm.status} onChange={e => setPoForm(p => ({ ...p, status: e.target.value as PRStatus }))}>
                  {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project">
                <select className={sel} value={poForm.project_id} onChange={e => setPoForm(p => ({ ...p, project_id: e.target.value }))}>
                  <option value="">— Select Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Supplier">
                <select className={sel} value={poForm.supplier_id} onChange={e => setPoForm(p => ({ ...p, supplier_id: e.target.value }))}>
                  <option value="">— Select Supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Linked PR (optional)">
                <select className={sel} value={poForm.pr_id} onChange={e => setPoForm(p => ({ ...p, pr_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {prs.map(p => <option key={p.id} value={p.id}>{p.pr_number} — {p.title}</option>)}
                </select>
              </Field>
              <Field label="Date Issued">
                <input type="date" className={inp} value={poForm.date_issued} onChange={e => setPoForm(p => ({ ...p, date_issued: e.target.value }))} />
              </Field>
            </div>
            <Field label="Expected Delivery Date">
              <input type="date" className={inp} value={poForm.date_expected} onChange={e => setPoForm(p => ({ ...p, date_expected: e.target.value }))} />
            </Field>

            {/* PO Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600">ITEMS</label>
                <button onClick={() => setPoForm(p => ({ ...p, items: [...p.items, { description: '', qty: '', unit: '', unit_price: '', total: '' }] }))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold">+ Add Item</button>
              </div>
              <div className="space-y-2">
                {poForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_60px_90px_90px_auto] gap-1.5 items-center">
                    <input className={inp} placeholder="Description" value={item.description} onChange={e => setPoForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, description: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Qty" value={item.qty} onChange={e => {
                      const qty = e.target.value
                      setPoForm(p => ({ ...p, items: p.items.map((it, j) => {
                        if (j !== i) return it
                        const total = (parseFloat(qty) || 0) * (parseFloat(it.unit_price) || 0)
                        return { ...it, qty, total: total > 0 ? total.toFixed(2) : '' }
                      })}))
                    }} />
                    <input className={inp} placeholder="Unit" value={item.unit} onChange={e => setPoForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, unit: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Unit Price" value={item.unit_price} onChange={e => {
                      const up = e.target.value
                      setPoForm(p => ({ ...p, items: p.items.map((it, j) => {
                        if (j !== i) return it
                        const total = (parseFloat(it.qty) || 0) * (parseFloat(up) || 0)
                        return { ...it, unit_price: up, total: total > 0 ? total.toFixed(2) : '' }
                      })}))
                    }} />
                    <input className={inp + ' font-semibold'} placeholder="Total" value={item.total} readOnly />
                    <button onClick={() => setPoForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))} className="p-1.5 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-2">
                <span className="text-sm font-bold text-slate-900">
                  Total: {fmt(poForm.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0))}
                </span>
              </div>
            </div>

            <Field label="Notes">
              <textarea className={inp + ' resize-none'} rows={2} value={poForm.notes} onChange={e => setPoForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPoModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button onClick={savePO} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delivery Modal ─────────────────────────────────────────────────── */}
      {(delModal === 'new' || delModal === 'edit') && (
        <Modal title={delModal === 'new' ? 'Record Delivery' : 'Edit Delivery'} onClose={() => setDelModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Linked PO">
                <select className={sel} value={delForm.po_id} onChange={e => setDelForm(p => ({ ...p, po_id: e.target.value }))}>
                  <option value="">— Select PO —</option>
                  {pos.map(po => <option key={po.id} value={po.id}>{po.po_number} — {po.supplier_name}</option>)}
                </select>
              </Field>
              <Field label="Project">
                <select className={sel} value={delForm.project_id} onChange={e => setDelForm(p => ({ ...p, project_id: e.target.value }))}>
                  <option value="">— Select Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Delivery Date">
                <input type="date" className={inp} value={delForm.delivery_date} onChange={e => setDelForm(p => ({ ...p, delivery_date: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select className={sel} value={delForm.status} onChange={e => setDelForm(p => ({ ...p, status: e.target.value as PRStatus }))}>
                  {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Delivered By">
                <input className={inp} placeholder="Driver / Company" value={delForm.delivered_by} onChange={e => setDelForm(p => ({ ...p, delivered_by: e.target.value }))} />
              </Field>
              <Field label="Received By">
                <input className={inp} placeholder="Site foreman / Engineer" value={delForm.received_by} onChange={e => setDelForm(p => ({ ...p, received_by: e.target.value }))} />
              </Field>
            </div>

            {/* Delivery Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600">ITEMS</label>
                <button onClick={() => setDelForm(p => ({ ...p, items: [...p.items, { description: '', qty_ordered: '', qty_delivered: '', unit: '' }] }))}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold">+ Add Item</button>
              </div>
              <div className="space-y-2">
                {delForm.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_90px_70px_auto] gap-2 items-center">
                    <input className={inp} placeholder="Description" value={item.description} onChange={e => setDelForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, description: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Ordered" value={item.qty_ordered} onChange={e => setDelForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, qty_ordered: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Delivered" value={item.qty_delivered} onChange={e => setDelForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, qty_delivered: e.target.value } : it) }))} />
                    <input className={inp} placeholder="Unit" value={item.unit} onChange={e => setDelForm(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, unit: e.target.value } : it) }))} />
                    <button onClick={() => setDelForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))} className="p-1.5 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Notes">
              <textarea className={inp + ' resize-none'} rows={2} value={delForm.notes} onChange={e => setDelForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDelModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button onClick={saveDelivery} disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  )
}
