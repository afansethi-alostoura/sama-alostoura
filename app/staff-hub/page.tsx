'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Users, Building2, HardHat, Package, Calculator, Briefcase,
  Plus, X, ChevronRight, Phone, Mail, Loader2, Trash2,
  ClipboardList, Clock, Pencil, Check, ArrowRightLeft,
  MessageSquare, FileText, Activity, Flag,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: number; name: string; role: string; department: string
  email: string | null; phone: string | null
  status: 'active' | 'inactive'
  staff_status: 'Available' | 'On-Site' | 'Busy'
  avatar_color: string; sort_order: number; lead_count: number
}
interface Lead {
  id: number; staff_id: number; lead_name: string; project: string | null
  status: string; priority: string; notes: string | null
  due_date: string | null; created_at: string
}
interface Responsibility { id: number; staff_id: number; responsibility: string; sort_order: number }
interface ActivityLog { id: number; staff_id: number; note: string; created_by: string; created_at: string }

// ── Department config ─────────────────────────────────────────────────────────

const DEPTS = [
  { id: 'Executive & Business Development',    label: 'Executive & Business Development', Icon: Building2,     hdr: 'bg-indigo-800',   bg: 'bg-indigo-50 dark:bg-indigo-950/20',   bdr: 'border-indigo-200 dark:border-indigo-800' },
  { id: 'Engineering, Estimation & Approvals', label: 'Engineering, Estimation & Approvals', Icon: FileText,  hdr: 'bg-sky-700',      bg: 'bg-sky-50 dark:bg-sky-950/20',         bdr: 'border-sky-200 dark:border-sky-800'     },
  { id: 'Site Execution & Supervision',        label: 'Site Execution & Supervision',     Icon: HardHat,       hdr: 'bg-emerald-700',  bg: 'bg-emerald-50 dark:bg-emerald-950/20', bdr: 'border-emerald-200 dark:border-emerald-800' },
  { id: 'Procurement & Logistics',             label: 'Procurement & Logistics',          Icon: Package,       hdr: 'bg-amber-600',    bg: 'bg-amber-50 dark:bg-amber-950/20',     bdr: 'border-amber-200 dark:border-amber-800' },
  { id: 'Finance, HR & Administration',        label: 'Finance, HR & Administration',     Icon: Calculator,    hdr: 'bg-purple-700',   bg: 'bg-purple-50 dark:bg-purple-950/20',   bdr: 'border-purple-200 dark:border-purple-800' },
]

// ── Lead pipeline stages ──────────────────────────────────────────────────────

const LEAD_STATUSES = [
  { value: 'new',        label: 'New',        cls: 'bg-blue-100 text-blue-700 border-blue-200'     },
  { value: 'site_visit', label: 'Site Visit',  cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'quoting',    label: 'Quoting',    cls: 'bg-amber-100 text-amber-700 border-amber-200'  },
  { value: 'won',        label: 'Won',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'on_hold',    label: 'On Hold',    cls: 'bg-slate-100 text-slate-600 border-slate-200'  },
  { value: 'lost',       label: 'Lost',       cls: 'bg-red-100 text-red-600 border-red-200'        },
  { value: 'completed',  label: 'Completed',  cls: 'bg-teal-100 text-teal-700 border-teal-200'     },
]

const STAFF_STATUSES = [
  { value: 'Available', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  { value: 'On-Site',   dot: 'bg-orange-400',  text: 'text-orange-600'  },
  { value: 'Busy',      dot: 'bg-red-500',     text: 'text-red-600'     },
]

function leadStatusCls(s: string) {
  return LEAD_STATUSES.find(x => x.value === s)?.cls ?? 'bg-slate-100 text-slate-600 border-slate-200'
}
function leadStatusLabel(s: string) {
  return LEAD_STATUSES.find(x => x.value === s)?.label ?? s
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

// ── Staff Card ────────────────────────────────────────────────────────────────

function StaffCard({ s, onClick }: { s: StaffMember; onClick: () => void }) {
  const st = STAFF_STATUSES.find(x => x.value === s.staff_status) ?? STAFF_STATUSES[0]
  const leads = Number(s.lead_count)
  return (
    <button onClick={onClick}
      className="group relative flex flex-col items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl p-4 w-36 text-center shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-pointer">
      {/* Status dot */}
      <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 ${st.dot}`} title={s.staff_status} />
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
        style={{ background: s.avatar_color }}>
        {initials(s.name)}
      </div>
      <div className="w-full">
        <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight truncate">{s.name}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{s.role}</p>
      </div>
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${leads > 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
        <Briefcase className="w-2.5 h-2.5" />{leads} lead{leads !== 1 ? 's' : ''}
      </div>
      <span className={`text-[9px] font-bold ${st.text}`}>{s.staff_status}</span>
      <ChevronRight className="absolute right-1.5 bottom-1.5 w-3 h-3 text-slate-300 group-hover:text-blue-400 transition-colors" />
    </button>
  )
}

// ── Leads Tab ─────────────────────────────────────────────────────────────────

function LeadsTab({ staff, leads, allStaff, onRefresh }: {
  staff: StaffMember; leads: Lead[]
  allStaff: StaffMember[]; onRefresh: () => void
}) {
  const [showAdd, setShowAdd]       = useState(false)
  const [form, setForm]             = useState({ lead_name: '', project: '', status: 'new', priority: 'medium', notes: '', due_date: '' })
  const [saving, setSaving]         = useState(false)
  const [reassigning, setReassigning] = useState<number | null>(null)
  const [deleting, setDeleting]     = useState<number | null>(null)

  async function addLead() {
    if (!form.lead_name.trim()) return
    setSaving(true)
    await fetch(`/api/staff/${staff.id}/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setShowAdd(false)
    setForm({ lead_name: '', project: '', status: 'new', priority: 'medium', notes: '', due_date: '' })
    onRefresh()
  }

  async function reassign(lead: Lead, toStaffId: number) {
    setReassigning(lead.id)
    await fetch(`/api/staff/${staff.id}/leads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: lead.id, reassign_to: toStaffId }) })
    setReassigning(null); onRefresh()
  }

  async function deleteLead(id: number) {
    setDeleting(id)
    await fetch(`/api/staff/${staff.id}/leads?lead_id=${id}`, { method: 'DELETE' })
    setDeleting(null); onRefresh()
  }

  async function updateStatus(lead: Lead, status: string) {
    await fetch(`/api/staff/${staff.id}/leads`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, lead_name: lead.lead_name, project: lead.project, status, priority: lead.priority, notes: lead.notes, due_date: lead.due_date }) })
    onRefresh()
  }

  const F = (label: string, key: keyof typeof form, type = 'text', opts?: string[]) => (
    <div key={key}>
      <label className="block text-xs font-medium text-slate-500 mb-0.5">{label}</label>
      {opts ? (
        <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          {opts.map(o => <option key={o} value={o}>{leadStatusLabel(o)}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      )}
    </div>
  )

  return (
    <div className="p-4 space-y-3">
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Assign New Lead
        </button>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800 space-y-2.5">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-300">New Lead</p>
          {F('Lead / Task Name *', 'lead_name')}
          {F('Project', 'project')}
          <div className="grid grid-cols-2 gap-2">
            {F('Stage', 'status', 'text', LEAD_STATUSES.map(l => l.value))}
            {F('Priority', 'priority', 'text', ['low', 'medium', 'high'])}
          </div>
          {F('Due Date', 'due_date', 'date')}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-0.5">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={addLead} disabled={saving || !form.lead_name.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {leads.length === 0 && !showAdd && (
        <div className="text-center py-10 text-slate-400">
          <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No leads assigned yet</p>
        </div>
      )}

      {leads.map(lead => (
        <div key={lead.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{lead.lead_name}</p>
              {lead.project && <p className="text-xs text-slate-500 mt-0.5">{lead.project}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => deleteLead(lead.id)} disabled={deleting === lead.id}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                {deleting === lead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Stage selector */}
          <div className="flex flex-wrap gap-1 mt-2">
            {LEAD_STATUSES.slice(0, 4).map(ls => (
              <button key={ls.value} onClick={() => updateStatus(lead, ls.value)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${lead.status === ls.value ? ls.cls + ' scale-105' : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300'}`}>
                {ls.label}
              </button>
            ))}
            {LEAD_STATUSES.slice(4).map(ls => (
              <button key={ls.value} onClick={() => updateStatus(lead, ls.value)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${lead.status === ls.value ? ls.cls + ' scale-105' : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300'}`}>
                {ls.label}
              </button>
            ))}
          </div>

          {/* Reassign */}
          <div className="mt-2 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3 h-3 text-slate-400 shrink-0" />
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) reassign(lead, Number(e.target.value)) }}
              disabled={reassigning === lead.id}
              className="flex-1 text-[11px] border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Reassign to...</option>
              {allStaff.filter(m => m.id !== staff.id).map(m => (
                <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
              ))}
            </select>
            {reassigning === lead.id && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
          </div>

          {lead.due_date && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" /> Due {new Date(lead.due_date).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
          {lead.notes && <p className="text-[11px] text-slate-500 mt-1 italic">{lead.notes}</p>}
        </div>
      ))}
    </div>
  )
}

// ── Responsibilities Tab ──────────────────────────────────────────────────────

function ResponsibilitiesTab({ staff, resps, onRefresh }: { staff: StaffMember; resps: Responsibility[]; onRefresh: () => void }) {
  const [editing, setEditing]     = useState(false)
  const [texts, setTexts]         = useState<Record<number, string>>({})
  const [newText, setNewText]     = useState('')
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    const m: Record<number, string> = {}
    resps.forEach(r => { m[r.id] = r.responsibility })
    setTexts(m)
  }, [resps])

  async function saveEdit(r: Responsibility) {
    await fetch(`/api/staff/${staff.id}/responsibilities`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resp_id: r.id, responsibility: texts[r.id] }) })
    onRefresh()
  }

  async function addResp() {
    if (!newText.trim()) return
    setSaving(true)
    await fetch(`/api/staff/${staff.id}/responsibilities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responsibility: newText.trim() }) })
    setNewText(''); setSaving(false); onRefresh()
  }

  async function deleteResp(id: number) {
    await fetch(`/api/staff/${staff.id}/responsibilities?resp_id=${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role Responsibilities & SOPs</h3>
        <button onClick={() => setEditing(e => !e)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${editing ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <Pencil className="w-3 h-3" /> {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      <ul className="space-y-2">
        {resps.map(r => (
          <li key={r.id} className="flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            {editing ? (
              <div className="flex-1 flex gap-1">
                <input value={texts[r.id] ?? r.responsibility}
                  onChange={e => setTexts(t => ({ ...t, [r.id]: e.target.value }))}
                  onBlur={() => saveEdit(r)}
                  className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                <button onClick={() => deleteResp(r.id)} className="p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{r.responsibility}</p>
            )}
          </li>
        ))}
      </ul>

      {resps.length === 0 && !editing && (
        <div className="text-center py-8 text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No responsibilities defined yet</p>
          <button onClick={() => setEditing(true)} className="mt-2 text-xs text-blue-600 hover:underline">Add responsibilities</button>
        </div>
      )}

      {editing && (
        <div className="mt-3 flex gap-2">
          <input value={newText} onChange={e => setNewText(e.target.value)}
            placeholder="Add responsibility..." onKeyDown={e => { if (e.key === 'Enter') addResp() }}
            className="flex-1 text-sm border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          <button onClick={addResp} disabled={saving || !newText.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({ staff, activities, onRefresh }: { staff: StaffMember; activities: ActivityLog[]; onRefresh: () => void }) {
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)

  async function addNote() {
    if (!note.trim()) return
    setSaving(true)
    await fetch(`/api/staff/${staff.id}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) })
    setNote(''); setSaving(false); onRefresh()
  }

  return (
    <div className="p-4 space-y-3">
      {/* Add note */}
      <div className="flex gap-2">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note or follow-up..."
          onKeyDown={e => { if (e.key === 'Enter') addNote() }}
          className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        <button onClick={addNote} disabled={saving || !note.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {activities.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity logged yet</p>
        </div>
      )}

      <div className="space-y-2">
        {activities.map(a => (
          <div key={a.id} className="flex gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-slate-700 dark:text-slate-300">{a.note}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {a.created_by} · {new Date(a.created_at).toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Staff Drawer ──────────────────────────────────────────────────────────────

type DrawerTab = 'leads' | 'responsibilities' | 'activity'

function StaffDrawer({ staff, allStaff, onClose, onStatusChange }: {
  staff: StaffMember; allStaff: StaffMember[]
  onClose: () => void; onStatusChange: () => void
}) {
  const [tab, setTab]           = useState<DrawerTab>('leads')
  const [leads, setLeads]       = useState<Lead[]>([])
  const [resps, setResps]       = useState<Responsibility[]>([])
  const [acts, setActs]         = useState<ActivityLog[]>([])
  const [loadingTab, setLoading] = useState(false)
  const [staffStatus, setStaffStatus] = useState(staff.staff_status)

  const loadLeads   = useCallback(async () => { const d = await fetch(`/api/staff/${staff.id}/leads`).then(r => r.json()); setLeads(Array.isArray(d) ? d : []) }, [staff.id])
  const loadResps   = useCallback(async () => { const d = await fetch(`/api/staff/${staff.id}/responsibilities`).then(r => r.json()); setResps(Array.isArray(d) ? d : []) }, [staff.id])
  const loadActs    = useCallback(async () => { const d = await fetch(`/api/staff/${staff.id}/activities`).then(r => r.json()); setActs(Array.isArray(d) ? d : []) }, [staff.id])

  useEffect(() => {
    setLoading(true)
    loadLeads().finally(() => setLoading(false))
  }, [loadLeads])

  async function switchTab(t: DrawerTab) {
    setTab(t); setLoading(true)
    if (t === 'leads')           await loadLeads()
    if (t === 'responsibilities') await loadResps()
    if (t === 'activity')        await loadActs()
    setLoading(false)
  }

  async function updateStatus(val: string) {
    setStaffStatus(val as typeof staffStatus)
    await fetch(`/api/staff/${staff.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: staff.name, role: staff.role, department: staff.department, email: staff.email, phone: staff.phone, avatar_color: staff.avatar_color, status: staff.status, staff_status: val }) })
    onStatusChange()
  }

  const active    = leads.filter(l => !['won','completed','lost'].includes(l.status)).length
  const won       = leads.filter(l => l.status === 'won').length
  const completed = leads.filter(l => l.status === 'completed').length

  const TABS: { id: DrawerTab; label: string; Icon: React.ElementType }[] = [
    { id: 'leads',           label: 'Leads',         Icon: Briefcase    },
    { id: 'responsibilities', label: 'Responsibilities', Icon: ClipboardList },
    { id: 'activity',        label: 'Activity',      Icon: Activity     },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4" style={{ background: staff.avatar_color }}>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
            {initials(staff.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">{staff.name}</h2>
            <p className="text-sm text-white/80">{staff.role}</p>
            <p className="text-xs text-white/60">{staff.department}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"><X className="w-4 h-4" /></button>
            <select value={staffStatus} onChange={e => updateStatus(e.target.value)}
              className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-lg px-2 py-0.5 focus:outline-none cursor-pointer">
              <option value="Available">● Available</option>
              <option value="On-Site">● On-Site</option>
              <option value="Busy">● Busy</option>
            </select>
          </div>
        </div>

        {/* Contact */}
        {(staff.email || staff.phone) && (
          <div className="flex gap-4 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            {staff.email && <a href={`mailto:${staff.email}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600"><Mail className="w-3.5 h-3.5" />{staff.email}</a>}
            {staff.phone && <a href={`tel:${staff.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600"><Phone className="w-3.5 h-3.5" />{staff.phone}</a>}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
          {[{ label: 'Active', value: active, cls: 'text-blue-600' }, { label: 'Won', value: won, cls: 'text-emerald-600' }, { label: 'Completed', value: completed, cls: 'text-teal-600' }].map(s => (
            <div key={s.label} className="flex flex-col items-center py-2.5">
              <span className={`text-lg font-bold ${s.cls}`}>{s.value}</span>
              <span className="text-[10px] text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-700 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              <t.Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">
          {loadingTab ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : (
            <>
              {tab === 'leads'            && <LeadsTab staff={staff} leads={leads} allStaff={allStaff} onRefresh={loadLeads} />}
              {tab === 'responsibilities' && <ResponsibilitiesTab staff={staff} resps={resps} onRefresh={loadResps} />}
              {tab === 'activity'         && <ActivityTab staff={staff} activities={acts} onRefresh={loadActs} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffHubPage() {
  const [staff,      setStaff]      = useState<StaffMember[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<StaffMember | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [deptFilter, setDeptFilter] = useState<string | null>(null)

  const loadStaff = useCallback(() => {
    setLoading(true)
    fetch('/api/staff').then(r => r.json()).then(d => { if (Array.isArray(d)) setStaff(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  const byDept = DEPTS.map(d => ({
    ...d, members: staff.filter(s => s.department === d.id).sort((a, b) => a.sort_order - b.sort_order),
  })).filter(d => !deptFilter || d.id === deptFilter)

  const totalActive = staff.filter(s => s.status === 'active').length
  const totalLeads  = staff.reduce((n, s) => n + Number(s.lead_count), 0)

  return (
    <div className="p-4 sm:p-6 space-y-5 pb-20">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Staff &amp; Department Hub
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{totalActive} active staff · {totalLeads} open leads</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors whitespace-nowrap">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {/* Department filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setDeptFilter(null)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${!deptFilter ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
          All Departments
        </button>
        {DEPTS.map(d => (
          <button key={d.id} onClick={() => setDeptFilter(deptFilter === d.id ? null : d.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${deptFilter === d.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}>
            {d.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}

      {/* Department sections */}
      {!loading && byDept.map(dept => (
        <section key={dept.id} className={`rounded-2xl border ${dept.bdr} ${dept.bg} overflow-hidden`}>
          <div className={`${dept.hdr} px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2 text-white">
              <dept.Icon className="w-4 h-4" />
              <span className="font-bold text-sm">{dept.label}</span>
            </div>
            <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full">
              {dept.members.length} {dept.members.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <div className="p-4">
            {dept.members.length === 0 ? (
              <p className="text-xs text-slate-400 italic px-1">No staff in this department.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {dept.members.map(s => (
                  <StaffCard key={s.id} s={s} onClick={() => setSelected(s)} />
                ))}
                <button onClick={() => setShowAdd(true)}
                  className="w-36 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <Plus className="w-5 h-5" /><span className="text-[10px]">Add seat</span>
                </button>
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Staff drawer */}
      {selected && (
        <StaffDrawer
          key={selected.id}
          staff={selected}
          allStaff={staff}
          onClose={() => { setSelected(null); loadStaff() }}
          onStatusChange={loadStaff}
        />
      )}

      {/* Add staff modal */}
      {showAdd && <AddStaffModal onSaved={() => { setShowAdd(false); loadStaff() }} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ── Add Staff Modal ───────────────────────────────────────────────────────────

function AddStaffModal({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const DEPT_OPTIONS = DEPTS.map(d => d.id)
  const COLORS = ['#1e3a8a','#3730a3','#0369a1','#0891b2','#15803d','#16a34a','#0d9488','#65a30d','#dc2626','#b45309','#d97706','#7c3aed','#9333ea','#6366f1']
  const [form, setForm]   = useState({ name: '', role: '', department: DEPT_OPTIONS[0], email: '', phone: '', avatar_color: '#1e3a8a' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name || !form.role) return
    setSaving(true)
    await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <p className="font-bold text-slate-800 dark:text-white">Add Staff Member</p>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          {(['name', 'role', 'email', 'phone'] as const).map(k => (
            <div key={k}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 capitalize">{k}{(k === 'name' || k === 'role') ? ' *' : ''}</label>
              <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
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
              {COLORS.map(c => (
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Cancel</button>
        </div>
      </div>
    </div>
  )
}
