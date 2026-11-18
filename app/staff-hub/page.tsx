'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Users, Building2, HardHat, Package, Calculator,
  Plus, X, ChevronRight, Briefcase, Phone, Mail,
  AlertCircle, CheckCircle2, Clock, Loader2, Pencil,
  Trash2, ClipboardList, Flag, User,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: number; name: string; role: string; department: string
  email: string | null; phone: string | null
  status: 'active' | 'inactive'; avatar_color: string
  sort_order: number; lead_count: number
}

interface Lead {
  id: number; staff_id: number; lead_name: string
  project: string | null; status: 'active' | 'completed' | 'on_hold'
  priority: 'low' | 'medium' | 'high'
  notes: string | null; due_date: string | null; created_at: string
}

// ── Department config ─────────────────────────────────────────────────────────

const DEPARTMENTS = [
  {
    id: 'Management',
    label: 'Management',
    Icon: Building2,
    headerBg: 'bg-blue-700',
    sectionBg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    id: 'Engineering & Site',
    label: 'Engineering & Site Execution',
    Icon: HardHat,
    headerBg: 'bg-emerald-700',
    sectionBg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    id: 'Commercial & Procurement',
    label: 'Commercial & Procurement',
    Icon: Package,
    headerBg: 'bg-amber-600',
    sectionBg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  {
    id: 'Admin & Finance',
    label: 'Admin & Finance',
    Icon: Calculator,
    headerBg: 'bg-purple-700',
    sectionBg: 'bg-purple-50 dark:bg-purple-950/20',
    border: 'border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function priorityColor(p: string) {
  if (p === 'high')   return 'text-red-600 bg-red-50 border-red-200'
  if (p === 'medium') return 'text-amber-600 bg-amber-50 border-amber-200'
  return 'text-slate-500 bg-slate-50 border-slate-200'
}

function statusColor(s: string) {
  if (s === 'completed') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (s === 'on_hold')   return 'text-slate-500 bg-slate-50 border-slate-200'
  return 'text-blue-600 bg-blue-50 border-blue-200'
}

// ── Staff Card ────────────────────────────────────────────────────────────────

function StaffCard({ staff, onClick }: { staff: StaffMember; onClick: () => void }) {
  const leads = Number(staff.lead_count)
  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-150 w-36 text-center cursor-pointer"
    >
      {/* Status dot */}
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${staff.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}/>

      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
        style={{ background: staff.avatar_color }}
      >
        {initials(staff.name)}
      </div>

      {/* Name */}
      <div className="w-full">
        <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight truncate">{staff.name}</p>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-2">{staff.role}</p>
      </div>

      {/* Leads badge */}
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${leads > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>
        <Briefcase className="w-2.5 h-2.5" />
        {leads} {leads === 1 ? 'lead' : 'leads'}
      </div>

      {/* Hover caret */}
      <ChevronRight className="absolute right-2 bottom-2 w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
    </button>
  )
}

// ── Add Lead Form ─────────────────────────────────────────────────────────────

function AddLeadForm({ staffId, onSaved, onCancel }: { staffId: number; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ lead_name: '', project: '', status: 'active', priority: 'medium', notes: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.lead_name.trim()) return
    setSaving(true)
    await fetch(`/api/staff/${staffId}/leads`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    onSaved()
  }

  const field = (label: string, key: keyof typeof form, type = 'text', options?: string[]) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {options ? (
        <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          {options.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      )}
    </div>
  )

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800 mt-3">
      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3">Assign New Lead</p>
      <div className="space-y-2.5">
        {field('Lead / Task Name *', 'lead_name')}
        {field('Project', 'project')}
        <div className="grid grid-cols-2 gap-2">
          {field('Status', 'status', 'text', ['active', 'on_hold', 'completed'])}
          {field('Priority', 'priority', 'text', ['low', 'medium', 'high'])}
        </div>
        {field('Due Date', 'due_date', 'date')}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={save} disabled={saving || !form.lead_name.trim()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Save Lead
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Staff Drawer ──────────────────────────────────────────────────────────────

function StaffDrawer({
  staff, leads, onClose, onLeadChange,
}: {
  staff: StaffMember; leads: Lead[]
  onClose: () => void; onLeadChange: () => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [deletingLead, setDeletingLead] = useState<number | null>(null)

  async function deleteLead(leadId: number) {
    setDeletingLead(leadId)
    await fetch(`/api/staff/${staff.id}/leads?lead_id=${leadId}`, { method: 'DELETE' })
    setDeletingLead(null)
    onLeadChange()
  }

  const active    = leads.filter(l => l.status === 'active')
  const onHold    = leads.filter(l => l.status === 'on_hold')
  const completed = leads.filter(l => l.status === 'completed')

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800" style={{ background: staff.avatar_color }}>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {initials(staff.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">{staff.name}</h2>
            <p className="text-sm text-white/80">{staff.role}</p>
            <span className="text-xs text-white/60">{staff.department}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contact row */}
        {(staff.email || staff.phone) && (
          <div className="flex gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            {staff.email && (
              <a href={`mailto:${staff.email}`} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600">
                <Mail className="w-3.5 h-3.5" />{staff.email}
              </a>
            )}
            {staff.phone && (
              <a href={`tel:${staff.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600">
                <Phone className="w-3.5 h-3.5" />{staff.phone}
              </a>
            )}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
          {[
            { label: 'Active',    value: active.length,    color: 'text-blue-600' },
            { label: 'On Hold',   value: onHold.length,    color: 'text-amber-600' },
            { label: 'Completed', value: completed.length, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center py-3">
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Assign lead button */}
          {!showAdd && (
            <button onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Assign New Lead
            </button>
          )}
          {showAdd && (
            <AddLeadForm
              staffId={staff.id}
              onSaved={() => { setShowAdd(false); onLeadChange() }}
              onCancel={() => setShowAdd(false)}
            />
          )}

          {/* Leads list */}
          {leads.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Leads & Assignments
              </h3>
              <div className="space-y-2">
                {leads.map(lead => (
                  <div key={lead.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{lead.lead_name}</p>
                        {lead.project && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{lead.project}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusColor(lead.status)}`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${priorityColor(lead.priority)}`}>
                          {lead.priority}
                        </span>
                        <button onClick={() => deleteLead(lead.id)} disabled={deletingLead === lead.id}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                          {deletingLead === lead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {lead.due_date && (
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3" /> Due {new Date(lead.due_date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {lead.notes && <p className="text-[11px] text-slate-500 mt-1 italic">{lead.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No leads assigned yet</p>
            </div>
          )}

          {/* Responsibilities section */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Responsibilities & SOPs
            </h3>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 italic">
                Responsibilities for this role will be added soon. Click to edit when ready.
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Add Staff Modal ───────────────────────────────────────────────────────────

function AddStaffModal({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const DEPT_OPTIONS = ['Management', 'Engineering & Site', 'Commercial & Procurement', 'Admin & Finance']
  const COLOR_OPTIONS = ['#1d4ed8','#15803d','#0d9488','#dc2626','#b45309','#7c3aed','#9333ea','#6366f1','#65a30d','#d97706']
  const [form, setForm] = useState({ name: '', role: '', department: 'Management', email: '', phone: '', avatar_color: '#1d4ed8' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name || !form.role) return
    setSaving(true)
    await fetch('/api/staff', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <p className="font-bold text-slate-800 dark:text-white">Add Staff Member</p>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          {(['name', 'role', 'email', 'phone'] as const).map(key => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 capitalize">{key}{key === 'name' || key === 'role' ? ' *' : ''}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Department</label>
            <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Avatar Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.avatar_color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={save} disabled={saving || !form.name || !form.role}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Member
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffHubPage() {
  const [staff,       setStaff]       = useState<StaffMember[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<StaffMember | null>(null)
  const [leads,       setLeads]       = useState<Lead[]>([])
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [showAdd,     setShowAdd]     = useState(false)

  const loadStaff = useCallback(() => {
    setLoading(true)
    fetch('/api/staff').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setStaff(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  async function openDrawer(s: StaffMember) {
    setSelected(s)
    setDrawerOpen(true)
    const data = await fetch(`/api/staff/${s.id}/leads`).then(r => r.json())
    setLeads(Array.isArray(data) ? data : [])
  }

  async function reloadLeads() {
    if (!selected) return
    const data = await fetch(`/api/staff/${selected.id}/leads`).then(r => r.json())
    setLeads(Array.isArray(data) ? data : [])
    // Update lead count in list
    setStaff(prev => prev.map(s => s.id === selected.id
      ? { ...s, lead_count: (Array.isArray(data) ? data : []).filter((l: Lead) => l.status === 'active').length }
      : s
    ))
  }

  const byDept = DEPARTMENTS.map(d => ({
    ...d,
    members: staff.filter(s => s.department === d.id).sort((a, b) => a.sort_order - b.sort_order),
  }))

  const totalActive = staff.filter(s => s.status === 'active').length
  const totalLeads  = staff.reduce((n, s) => n + Number(s.lead_count), 0)

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-20">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Staff &amp; Department Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalActive} active members · {totalLeads} open leads across all departments
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Department sections */}
      {!loading && byDept.map(dept => (
        <section key={dept.id} className={`rounded-2xl border ${dept.border} ${dept.sectionBg} overflow-hidden`}>

          {/* Dept header */}
          <div className={`${dept.headerBg} px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2 text-white">
              <dept.Icon className="w-4 h-4" />
              <span className="font-bold text-sm">{dept.label}</span>
            </div>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white`}>
              {dept.members.length} {dept.members.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          {/* Staff grid */}
          <div className="p-4">
            {dept.members.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-1">No staff assigned to this department yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {dept.members.map(s => (
                  <StaffCard key={s.id} staff={s} onClick={() => openDrawer(s)} />
                ))}
                {/* Empty seat */}
                <button onClick={() => setShowAdd(true)}
                  className="w-36 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px]">Add seat</span>
                </button>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Staff drawer */}
      {drawerOpen && selected && (
        <StaffDrawer
          staff={selected}
          leads={leads}
          onClose={() => { setDrawerOpen(false); setSelected(null) }}
          onLeadChange={reloadLeads}
        />
      )}

      {/* Add staff modal */}
      {showAdd && (
        <AddStaffModal
          onSaved={() => { setShowAdd(false); loadStaff() }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
