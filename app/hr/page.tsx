'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  Phone, Mail, Calendar, Banknote, Pencil, Trash2, X,
  Shield, CreditCard, FileText, UserCheck, UserX, ChevronDown,
  AlertCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Employee {
  id:                    string
  name:                  string
  role:                  string
  nationality:           string
  phone:                 string | null
  email:                 string | null
  salary:                number
  join_date:             string | null
  visa_expiry:           string | null
  emirates_id_expiry:    string | null
  passport_expiry:       string | null
  labour_card_expiry:    string | null
  status:                'active' | 'inactive'
  notes:                 string | null
}

// ── Expiry helpers ────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function expiryBadge(dateStr: string | null) {
  const days = daysUntil(dateStr)
  if (days === null)     return null
  if (days < 0)          return { label: 'EXPIRED',       color: 'bg-red-100 text-red-700 border border-red-200',     dot: 'bg-red-500' }
  if (days <= 30)        return { label: `${days}d`,      color: 'bg-red-50  text-red-600  border border-red-200',    dot: 'bg-red-400' }
  if (days <= 90)        return { label: `${days}d`,      color: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400' }
  return                        { label: (dateStr ?? '').slice(0, 10), color: 'bg-slate-50 text-slate-500 border border-slate-200', dot: 'bg-emerald-400' }
}

// ── Empty form ─────────────────────────────────────────────────────────────────
const EMPTY: Omit<Employee, 'id'> = {
  name: '', role: '', nationality: '', phone: '', email: '',
  salary: 0, join_date: '', visa_expiry: '', emirates_id_expiry: '',
  passport_expiry: '', labour_card_expiry: '', status: 'active', notes: '',
}

const ROLES = [
  'General Manager', 'Site Engineer', 'Project Manager', 'Civil Engineer',
  'Foreman', 'Accountant', 'Procurement Officer', 'Document Controller',
  'Safety Officer', 'Site Supervisor', 'Electrician', 'Plumber',
  'Carpenter', 'Mason', 'Painter', 'Site Labourer', 'Driver', 'Other',
]

// ── Employee Form Modal ───────────────────────────────────────────────────────
function EmployeeModal({
  initial, onSave, onClose,
}: {
  initial: Omit<Employee, 'id'> & { id?: string }
  onSave:  (data: Omit<Employee, 'id'> & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  function set(k: keyof typeof form, v: string | number) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const Field = ({ label, name, type = 'text', optional = true }: {
    label: string; name: keyof typeof form; type?: string; optional?: boolean
  }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{!optional && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={String(form[name] ?? '')}
        onChange={e => set(name, type === 'number' ? Number(e.target.value) : e.target.value)}
        required={!optional}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {form.id ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Basic info */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Basic Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" name="name" optional={false} />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  value={form.role}
                  onChange={e => set('role', e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Field label="Nationality"  name="nationality" />
              <Field label="Phone"        name="phone" type="tel" />
              <Field label="Email"        name="email" type="email" />
              <Field label="Monthly Salary (AED)" name="salary" type="number" />
              <Field label="Join Date"    name="join_date" type="date" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Document expiries */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Document Expiry Dates</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Visa Expiry"          name="visa_expiry"        type="date" />
              <Field label="Emirates ID Expiry"   name="emirates_id_expiry" type="date" />
              <Field label="Passport Expiry"      name="passport_expiry"    type="date" />
              <Field label="Labour Card Expiry"   name="labour_card_expiry" type="date" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({
  emp, onEdit, onDelete,
}: {
  emp: Employee
  onEdit:   (e: Employee) => void
  onDelete: (e: Employee) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const docs = [
    { label: 'Visa',        icon: Shield,     expiry: emp.visa_expiry },
    { label: 'Emirates ID', icon: CreditCard, expiry: emp.emirates_id_expiry },
    { label: 'Passport',    icon: FileText,   expiry: emp.passport_expiry },
    { label: 'Labour Card', icon: UserCheck,  expiry: emp.labour_card_expiry },
  ]

  const worstDays = docs
    .map(d => daysUntil(d.expiry))
    .filter((d): d is number => d !== null)
    .reduce((min, d) => Math.min(min, d), Infinity)

  const borderColor = worstDays < 0 ? 'border-red-300' : worstDays <= 30 ? 'border-red-200' : worstDays <= 90 ? 'border-amber-200' : 'border-slate-200'

  const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const colors   = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500']
  const avatarBg = colors[emp.name.charCodeAt(0) % colors.length]

  return (
    <div className={`bg-white rounded-xl border ${borderColor} shadow-sm hover:shadow-md transition-all overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${avatarBg} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">{emp.name}</p>
              <p className="text-xs text-slate-500">{emp.role}</p>
              {emp.nationality && <p className="text-[10px] text-slate-400 mt-0.5">{emp.nationality}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {emp.status}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {emp.phone && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Phone className="w-3 h-3 flex-shrink-0" />
              <a href={`tel:${emp.phone}`} className="hover:text-blue-600 transition-colors">{emp.phone}</a>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Banknote className="w-3 h-3 flex-shrink-0" />
            <span>AED {emp.salary.toLocaleString()} / month</span>
          </div>
          {emp.join_date && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>Since {emp.join_date}</span>
            </div>
          )}
        </div>

        {/* Document expiry pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {docs.map(({ label, expiry }) => {
            const badge = expiryBadge(expiry)
            if (!badge) return null
            return (
              <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                {label}: {badge.label}
              </span>
            )
          })}
        </div>

        {/* Notes toggle */}
        {emp.notes && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Hide notes' : 'Show notes'}
          </button>
        )}
        {expanded && emp.notes && (
          <p className="mt-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed">{emp.notes}</p>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 flex justify-end gap-2 bg-slate-50/50">
        <button
          onClick={() => onEdit(emp)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={() => onDelete(emp)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<'all' | 'active' | 'inactive' | 'expiring'>('all')
  const [modal,     setModal]     = useState<null | 'add' | 'edit'>(null)
  const [selected,  setSelected]  = useState<Employee | null>(null)
  const [confirmDel,setConfirmDel]= useState<Employee | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/staff')
      const data = await res.json()
      setEmployees(data.employees ?? [])
    } catch { /* keep existing */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const active       = employees.filter(e => e.status === 'active')
  const totalPayroll = active.reduce((s, e) => s + e.salary, 0)
  const critical     = employees.filter(e => {
    const dates = [e.visa_expiry, e.emirates_id_expiry, e.passport_expiry, e.labour_card_expiry]
    return dates.some(d => { const days = daysUntil(d); return days !== null && days <= 30 })
  })
  const warning = employees.filter(e => {
    const dates = [e.visa_expiry, e.emirates_id_expiry, e.passport_expiry, e.labour_card_expiry]
    return dates.some(d => { const days = daysUntil(d); return days !== null && days > 30 && days <= 90 })
  }).filter(e => !critical.includes(e))

  // ── Filtered list ──────────────────────────────────────────────────────────
  const visible = employees.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || (e.nationality || '').toLowerCase().includes(q)
    let matchFilter = true
    if (filter === 'active')   matchFilter = e.status === 'active'
    if (filter === 'inactive') matchFilter = e.status === 'inactive'
    if (filter === 'expiring') matchFilter = critical.includes(e) || warning.includes(e)
    return matchSearch && matchFilter
  })

  // ── Save handler ───────────────────────────────────────────────────────────
  async function handleSave(form: Omit<Employee, 'id'> & { id?: string }) {
    const isEdit = !!form.id
    const url    = isEdit ? `/api/staff/${form.id}` : '/api/staff'
    const method = isEdit ? 'PATCH' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    setModal(null)
    setSelected(null)
    load()
  }

  async function handleDelete(emp: Employee) {
    await fetch(`/api/staff/${emp.id}`, { method: 'DELETE' })
    setConfirmDel(null)
    load()
  }

  function openEdit(emp: Employee) { setSelected(emp); setModal('edit') }
  function openAdd()               { setSelected(null); setModal('add')  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">HR &amp; Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employee records, document compliance &amp; payroll</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees',  value: employees.length,                icon: Users,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Monthly Payroll',  value: `AED ${totalPayroll.toLocaleString()}`, icon: Banknote,  color: 'text-emerald-600',bg: 'bg-emerald-50'},
          { label: 'Expiring ≤30d',    value: critical.length,                icon: AlertTriangle, color: critical.length > 0 ? 'text-red-600' : 'text-slate-400', bg: critical.length > 0 ? 'bg-red-50' : 'bg-slate-50' },
          { label: 'Expiring 31–90d',  value: warning.length,                 icon: Clock,     color: warning.length > 0 ? 'text-amber-600' : 'text-slate-400',   bg: warning.length > 0 ? 'bg-amber-50' : 'bg-slate-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Expiry alert strip */}
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Action Required — Documents expiring within 30 days</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {critical.map(e => {
                const docs = [
                  { label: 'Visa', expiry: e.visa_expiry },
                  { label: 'Emirates ID', expiry: e.emirates_id_expiry },
                  { label: 'Passport', expiry: e.passport_expiry },
                  { label: 'Labour Card', expiry: e.labour_card_expiry },
                ]
                const expiring = docs.filter(d => { const days = daysUntil(d.expiry); return days !== null && days <= 30 })
                return expiring.map(d => (
                  <span key={`${e.id}-${d.label}`} className="text-xs bg-white border border-red-200 text-red-700 rounded-full px-2.5 py-1 font-medium">
                    {e.name} — {d.label} {daysUntil(d.expiry)! < 0 ? '(EXPIRED)' : `in ${daysUntil(d.expiry)}d`}
                  </span>
                ))
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, role, or nationality…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive', 'expiring'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f === 'all' ? `All (${employees.length})` : f === 'expiring' ? `Expiring (${critical.length + warning.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Employee grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-3/4" />
                  <div className="h-2 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{search ? 'No employees match your search' : 'No employees yet'}</p>
          {!search && <button onClick={openAdd} className="mt-3 text-sm text-blue-600 hover:underline">Add your first employee</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(emp => (
            <EmployeeCard key={emp.id} emp={emp} onEdit={openEdit} onDelete={setConfirmDel} />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <EmployeeModal
          initial={modal === 'edit' && selected
            ? { ...selected }
            : { ...EMPTY }
          }
          onSave={handleSave}
          onClose={() => { setModal(null); setSelected(null) }}
        />
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Remove Employee</p>
                <p className="text-sm text-slate-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to remove <strong>{confirmDel.name}</strong> from the system?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDel)} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
