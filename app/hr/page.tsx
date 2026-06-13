'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  Users, Plus, Search, Clock, Phone, Calendar, Banknote,
  Pencil, Trash2, X, Shield, CreditCard, FileText, UserCheck,
  ChevronDown, AlertCircle, Car, Building2, AlertTriangle,
  CheckCircle2, Tag, Hash, Wrench,
} from 'lucide-react'

// ── Shared expiry helpers ─────────────────────────────────────────────────────
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function expiryBadge(dateStr: string | null | undefined, reminderDays = 30) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0)            return { label: 'EXPIRED',      color: 'bg-red-100 text-red-700 border border-red-200',      dot: 'bg-red-500' }
  if (days <= reminderDays) return { label: `${days}d`,    color: 'bg-amber-50 text-amber-700 border border-amber-200',  dot: 'bg-amber-400' }
  if (days <= reminderDays * 3) return { label: `${days}d`, color: 'bg-yellow-50 text-yellow-700 border border-yellow-200', dot: 'bg-yellow-400' }
  return { label: (dateStr ?? '').slice(0, 10), color: 'bg-slate-50 text-slate-500 border border-slate-200', dot: 'bg-emerald-400' }
}

function isCritical(dateStr: string | null | undefined, reminderDays = 30) {
  const d = daysUntil(dateStr)
  return d !== null && d <= reminderDays
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">Remove Record</p>
            <p className="text-sm text-slate-500">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">Remove <strong>{name}</strong>?</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Remove</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// EMPLOYEES TAB
// ════════════════════════════════════════════════════════════════════════════════

interface Employee {
  id: string; name: string; role: string; nationality: string
  phone: string | null; email: string | null; salary: number
  join_date: string | null; visa_expiry: string | null
  emirates_id_expiry: string | null; passport_expiry: string | null
  labour_card_expiry: string | null; status: 'active' | 'inactive'
  notes: string | null
}

const EMP_ROLES = [
  'General Manager','Site Engineer','Project Manager','Civil Engineer',
  'Foreman','Accountant','Procurement Officer','Document Controller',
  'Safety Officer','Site Supervisor','Electrician','Plumber',
  'Carpenter','Mason','Painter','Site Labourer','Driver','Other',
]

const EMP_EMPTY: Omit<Employee,'id'> = {
  name:'',role:'',nationality:'',phone:'',email:'',salary:0,
  join_date:'',visa_expiry:'',emirates_id_expiry:'',passport_expiry:'',
  labour_card_expiry:'',status:'active',notes:'',
}

function EmpModal({ initial, onSave, onClose }: {
  initial: Omit<Employee,'id'> & { id?: string }
  onSave:  (d: Omit<Employee,'id'> & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); await onSave(form); setSaving(false)
  }

  const Field = ({ label, name, type='text', required=false }: { label:string; name: keyof typeof form; type?:string; required?:boolean }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={String(form[name] ?? '')}
        onChange={e => set(name, type==='number' ? Number(e.target.value) : e.target.value)}
        required={required}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Employee' : 'Add Employee'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Basic Information</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" name="name" required />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Role <span className="text-red-500">*</span></label>
                <select value={form.role} onChange={e => set('role', e.target.value)} required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  <option value="">Select role…</option>
                  {EMP_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Field label="Nationality"          name="nationality" />
              <Field label="Phone"                name="phone" type="tel" />
              <Field label="Monthly Salary (AED)" name="salary" type="number" />
              <Field label="Join Date"            name="join_date" type="date" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Left</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Document Expiry Dates</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Visa Expiry"        name="visa_expiry"        type="date" />
              <Field label="Emirates ID Expiry" name="emirates_id_expiry" type="date" />
              <Field label="Passport Expiry"    name="passport_expiry"    type="date" />
              <Field label="Labour Card Expiry" name="labour_card_expiry" type="date" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmpCard({ emp, onEdit, onDelete }: { emp: Employee; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const docs = [
    { label: 'Visa',        expiry: emp.visa_expiry },
    { label: 'Emirates ID', expiry: emp.emirates_id_expiry },
    { label: 'Passport',    expiry: emp.passport_expiry },
    { label: 'Labour Card', expiry: emp.labour_card_expiry },
  ]
  const anyCritical = docs.some(d => isCritical(d.expiry, 30))
  const anyWarning  = docs.some(d => isCritical(d.expiry, 90))
  const border = anyCritical ? 'border-red-300' : anyWarning ? 'border-amber-200' : 'border-slate-200'
  const colors = ['bg-blue-500','bg-purple-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500']
  const avatarBg = colors[emp.name.charCodeAt(0) % colors.length]
  const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={`bg-white rounded-xl border ${border} shadow-sm hover:shadow-md transition-all overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${avatarBg} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>{initials}</div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">{emp.name}</p>
              <p className="text-xs text-slate-500">{emp.role}</p>
              {emp.nationality && <p className="text-[10px] text-slate-400 mt-0.5">{emp.nationality}</p>}
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${emp.status==='active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {emp.status}
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          {emp.phone && <div className="flex items-center gap-2 text-xs text-slate-500"><Phone className="w-3 h-3"/><a href={`tel:${emp.phone}`} className="hover:text-blue-600">{emp.phone}</a></div>}
          <div className="flex items-center gap-2 text-xs text-slate-500"><Banknote className="w-3 h-3"/><span>AED {emp.salary.toLocaleString()} / month</span></div>
          {emp.join_date && <div className="flex items-center gap-2 text-xs text-slate-500"><Calendar className="w-3 h-3"/><span>Since {emp.join_date}</span></div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {docs.map(({ label, expiry }) => {
            const badge = expiryBadge(expiry, 30)
            if (!badge) return null
            return (
              <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}/>{label}: {badge.label}
              </span>
            )
          })}
        </div>
        {emp.notes && (
          <button onClick={() => setExpanded(e => !e)} className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}/>{expanded ? 'Hide' : 'Notes'}
          </button>
        )}
        {expanded && emp.notes && <p className="mt-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{emp.notes}</p>}
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5 flex justify-end gap-2 bg-slate-50/50">
        <button onClick={onEdit}   className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50"><Pencil className="w-3 h-3"/>Edit</button>
        <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3 h-3"/>Remove</button>
      </div>
    </div>
  )
}

function EmployeesTab() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all'|'active'|'inactive'|'expiring'>('all')
  const [modal, setModal]       = useState<null|'add'|'edit'>(null)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [confirmDel, setConfirmDel] = useState<Employee | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/staff'); const d = await r.json(); setEmployees(d.employees ?? []) } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const active   = employees.filter(e => e.status === 'active')
  const payroll  = active.reduce((s, e) => s + e.salary, 0)
  const critical = employees.filter(e =>
    [e.visa_expiry, e.emirates_id_expiry, e.passport_expiry, e.labour_card_expiry].some(d => isCritical(d, 30))
  )
  const warning = employees.filter(e =>
    !critical.includes(e) &&
    [e.visa_expiry, e.emirates_id_expiry, e.passport_expiry, e.labour_card_expiry].some(d => isCritical(d, 90))
  )

  const visible = employees.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || (e.nationality||'').toLowerCase().includes(q)
    const matchFilter = filter==='all' || (filter==='active' && e.status==='active') || (filter==='inactive' && e.status==='inactive') || (filter==='expiring' && (critical.includes(e)||warning.includes(e)))
    return matchSearch && matchFilter
  })

  async function handleSave(form: Omit<Employee,'id'> & { id?: string }) {
    const url = form.id ? `/api/staff/${form.id}` : '/api/staff'
    await fetch(url, { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form) })
    setModal(null); setSelected(null); load()
  }

  async function handleDelete(emp: Employee) {
    await fetch(`/api/staff/${emp.id}`, { method: 'DELETE' })
    setConfirmDel(null); load()
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:'Total Employees',  value: employees.length,                             icon: Users,         color:'text-blue-600',   bg:'bg-blue-50'   },
          { label:'Monthly Payroll',  value:`AED ${payroll.toLocaleString()}`,             icon: Banknote,      color:'text-emerald-600', bg:'bg-emerald-50'},
          { label:'Expiring ≤30d',    value: critical.length, icon: AlertTriangle,         color: critical.length>0?'text-red-600':'text-slate-400', bg: critical.length>0?'bg-red-50':'bg-slate-50' },
          { label:'Expiring 31–90d',  value: warning.length,  icon: Clock,                color: warning.length>0?'text-amber-600':'text-slate-400', bg: warning.length>0?'bg-amber-50':'bg-slate-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${color}`}/></div>
            <div><p className="text-[11px] text-slate-500 font-medium">{label}</p><p className={`text-lg font-bold ${color}`}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Critical alert */}
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-red-800">Action Required — Documents expiring within 30 days</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {critical.map(e => {
                const docs = [
                  { label:'Visa', expiry: e.visa_expiry },
                  { label:'Emirates ID', expiry: e.emirates_id_expiry },
                  { label:'Passport', expiry: e.passport_expiry },
                  { label:'Labour Card', expiry: e.labour_card_expiry },
                ]
                return docs.filter(d => isCritical(d.expiry, 30)).map(d => (
                  <span key={`${e.id}-${d.label}`} className="text-xs bg-white border border-red-200 text-red-700 rounded-full px-2.5 py-1 font-medium">
                    {e.name} — {d.label} {daysUntil(d.expiry)! < 0 ? '(EXPIRED)' : `in ${daysUntil(d.expiry)}d`}
                  </span>
                ))
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
          <input type="text" placeholder="Search name, role, nationality…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"/>
        </div>
        <div className="flex gap-2">
          {(['all','active','inactive','expiring'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${filter===f ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {f==='all' ? `All (${employees.length})` : f==='expiring' ? `Expiring (${critical.length+warning.length})` : f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-40"/>)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">{search ? 'No employees match your search' : 'No employees yet'}</p>
          {!search && <button onClick={() => setModal('add')} className="mt-3 text-sm text-blue-600 hover:underline">Add your first employee</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(emp => (
            <EmpCard key={emp.id} emp={emp}
              onEdit={() => { setSelected(emp); setModal('edit') }}
              onDelete={() => setConfirmDel(emp)} />
          ))}
        </div>
      )}

      {(modal==='add'||modal==='edit') && (
        <EmpModal initial={modal==='edit'&&selected ? {...selected} : {...EMP_EMPTY}} onSave={handleSave} onClose={() => { setModal(null); setSelected(null) }}/>
      )}
      {confirmDel && <DeleteConfirm name={confirmDel.name} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>}

      {/* Add button (bottom) */}
      <div className="flex justify-end">
        <button onClick={() => setModal('add')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4"/> Add Employee
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// VEHICLES TAB
// ════════════════════════════════════════════════════════════════════════════════

interface Vehicle {
  id: string; plate_number: string; make: string; model: string
  year: number | null; color: string | null; type: string
  registration_expiry: string | null; insurance_expiry: string | null
  rta_test_expiry: string | null; status: 'active' | 'inactive'; notes: string | null
}

const VEH_TYPES = ['Pickup','Car','Van','Bus','Heavy Equipment','Crane','Forklift','Other']
const VEH_EMPTY: Omit<Vehicle,'id'> = {
  plate_number:'',make:'',model:'',year:null,color:'',type:'Pickup',
  registration_expiry:'',insurance_expiry:'',rta_test_expiry:'',status:'active',notes:'',
}

function VehModal({ initial, onSave, onClose }: {
  initial: Omit<Vehicle,'id'> & { id?: string }
  onSave:  (d: Omit<Vehicle,'id'> & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string | number | null) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); await onSave(form); setSaving(false)
  }

  const Field = ({ label, name, type='text', required=false }: { label:string; name: keyof typeof form; type?:string; required?:boolean }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={String(form[name] ?? '')}
        onChange={e => set(name, type==='number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
        required={required}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"/>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Vehicle Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Plate Number" name="plate_number" required />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  {VEH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <Field label="Make (e.g. Toyota)" name="make" required />
              <Field label="Model (e.g. Hilux)" name="model" required />
              <Field label="Year"  name="year"  type="number" />
              <Field label="Color" name="color" />
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive / Sold</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Document Expiry Dates</p>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Mulkiya (Registration) Expiry" name="registration_expiry" type="date" />
              <Field label="Insurance Expiry"              name="insurance_expiry"    type="date" />
              <Field label="RTA Test / Inspection Expiry"  name="rta_test_expiry"     type="date" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"/>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VehCard({ veh, onEdit, onDelete }: { veh: Vehicle; onEdit: () => void; onDelete: () => void }) {
  const docs = [
    { label: 'Mulkiya',   expiry: veh.registration_expiry },
    { label: 'Insurance', expiry: veh.insurance_expiry },
    { label: 'RTA Test',  expiry: veh.rta_test_expiry },
  ]
  const anyCritical = docs.some(d => isCritical(d.expiry, 30))
  const anyWarning  = docs.some(d => isCritical(d.expiry, 90))
  const border = anyCritical ? 'border-red-300' : anyWarning ? 'border-amber-200' : 'border-slate-200'

  return (
    <div className={`bg-white rounded-xl border ${border} shadow-sm hover:shadow-md transition-all overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Car className="w-5 h-5 text-slate-500"/>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{veh.plate_number}</p>
              <p className="text-xs text-slate-500">{[veh.year, veh.make, veh.model].filter(Boolean).join(' ')}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{veh.type}{veh.color ? ` · ${veh.color}` : ''}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${veh.status==='active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {veh.status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {docs.map(({ label, expiry }) => {
            const badge = expiryBadge(expiry, 30)
            if (!badge) return null
            return (
              <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}/>{label}: {badge.label}
              </span>
            )
          })}
        </div>
        {veh.notes && <p className="mt-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{veh.notes}</p>}
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5 flex justify-end gap-2 bg-slate-50/50">
        <button onClick={onEdit}   className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-50"><Pencil className="w-3 h-3"/>Edit</button>
        <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-3 h-3"/>Remove</button>
      </div>
    </div>
  )
}

function VehiclesTab() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<null|'add'|'edit'>(null)
  const [selected, setSelected] = useState<Vehicle | null>(null)
  const [confirmDel, setConfirmDel] = useState<Vehicle | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/vehicles'); const d = await r.json(); setVehicles(d.vehicles ?? []) } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const critical = vehicles.filter(v =>
    [v.registration_expiry, v.insurance_expiry, v.rta_test_expiry].some(d => isCritical(d, 30))
  )

  async function handleSave(form: Omit<Vehicle,'id'> & { id?: string }) {
    const url = form.id ? `/api/vehicles/${form.id}` : '/api/vehicles'
    await fetch(url, { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form) })
    setModal(null); setSelected(null); load()
  }
  async function handleDelete(veh: Vehicle) {
    await fetch(`/api/vehicles/${veh.id}`, { method: 'DELETE' })
    setConfirmDel(null); load()
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label:'Total Vehicles',  value: vehicles.length,         icon: Car,           color:'text-blue-600',   bg:'bg-blue-50'   },
          { label:'Active',          value: vehicles.filter(v=>v.status==='active').length, icon: CheckCircle2, color:'text-emerald-600',bg:'bg-emerald-50'},
          { label:'Expiring ≤30d',   value: critical.length,         icon: AlertTriangle, color: critical.length>0?'text-red-600':'text-slate-400', bg: critical.length>0?'bg-red-50':'bg-slate-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${color}`}/></div>
            <div><p className="text-[11px] text-slate-500 font-medium">{label}</p><p className={`text-lg font-bold ${color}`}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-red-800">Vehicle documents expiring within 30 days</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {critical.map(v => {
                const docs = [
                  { label:'Mulkiya', expiry: v.registration_expiry },
                  { label:'Insurance', expiry: v.insurance_expiry },
                  { label:'RTA Test', expiry: v.rta_test_expiry },
                ]
                return docs.filter(d => isCritical(d.expiry, 30)).map(d => (
                  <span key={`${v.id}-${d.label}`} className="text-xs bg-white border border-red-200 text-red-700 rounded-full px-2.5 py-1 font-medium">
                    {v.plate_number} — {d.label} {daysUntil(d.expiry)! < 0 ? '(EXPIRED)' : `in ${daysUntil(d.expiry)}d`}
                  </span>
                ))
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-36"/>)}
        </div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16">
          <Car className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">No vehicles yet</p>
          <button onClick={() => setModal('add')} className="mt-3 text-sm text-blue-600 hover:underline">Add your first vehicle</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => (
            <VehCard key={v.id} veh={v}
              onEdit={() => { setSelected(v); setModal('edit') }}
              onDelete={() => setConfirmDel(v)}/>
          ))}
        </div>
      )}

      {(modal==='add'||modal==='edit') && (
        <VehModal initial={modal==='edit'&&selected ? {...selected} : {...VEH_EMPTY}} onSave={handleSave} onClose={() => { setModal(null); setSelected(null) }}/>
      )}
      {confirmDel && <DeleteConfirm name={`${confirmDel.plate_number} ${confirmDel.make} ${confirmDel.model}`} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>}

      <div className="flex justify-end">
        <button onClick={() => setModal('add')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4"/> Add Vehicle
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// COMPANY DOCUMENTS TAB
// ════════════════════════════════════════════════════════════════════════════════

interface CompanyDoc {
  id: string; name: string; category: string; issuing_authority: string
  doc_number: string | null; issue_date: string | null; expiry_date: string | null
  reminder_days: number; notes: string | null
}

const DOC_CATEGORIES = ['License','Certificate','Insurance','Permit','Bond','Registration','Other']
const DOC_EMPTY: Omit<CompanyDoc,'id'> = {
  name:'',category:'License',issuing_authority:'',doc_number:'',
  issue_date:'',expiry_date:'',reminder_days:30,notes:'',
}

const CATEGORY_COLORS: Record<string, string> = {
  License:      'bg-blue-100 text-blue-700',
  Certificate:  'bg-purple-100 text-purple-700',
  Insurance:    'bg-emerald-100 text-emerald-700',
  Permit:       'bg-amber-100 text-amber-700',
  Bond:         'bg-rose-100 text-rose-700',
  Registration: 'bg-cyan-100 text-cyan-700',
  Other:        'bg-slate-100 text-slate-600',
}

function DocModal({ initial, onSave, onClose }: {
  initial: Omit<CompanyDoc,'id'> & { id?: string }
  onSave:  (d: Omit<CompanyDoc,'id'> & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); await onSave(form); setSaving(false)
  }

  const Field = ({ label, name, type='text', required=false }: { label:string; name: keyof typeof form; type?:string; required?:boolean }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={String(form[name] ?? '')}
        onChange={e => set(name, type==='number' ? Number(e.target.value) : e.target.value)}
        required={required}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"/>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{form.id ? 'Edit Document' : 'Add Company Document'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Field label="Document Name" name="name" required /></div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={e => set('category', e.target.value)} required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Field label="Issuing Authority" name="issuing_authority" />
            <Field label="Document Number"   name="doc_number" />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alert before expiry (days)</label>
              <input type="number" value={form.reminder_days} onChange={e => set('reminder_days', Number(e.target.value))} min={1} max={365}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"/>
            </div>
            <Field label="Issue Date"  name="issue_date"  type="date" />
            <Field label="Expiry Date" name="expiry_date" type="date" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"/>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CompanyDocsTab() {
  const [docs, setDocs]         = useState<CompanyDoc[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState<null|'add'|'edit'>(null)
  const [selected, setSelected] = useState<CompanyDoc | null>(null)
  const [confirmDel, setConfirmDel] = useState<CompanyDoc | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/company-docs'); const d = await r.json(); setDocs(d.docs ?? []) } catch {}
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const critical = docs.filter(d => d.expiry_date && isCritical(d.expiry_date, d.reminder_days))
  const withExpiry = docs.filter(d => d.expiry_date)
  const noExpiry   = docs.filter(d => !d.expiry_date)

  async function handleSave(form: Omit<CompanyDoc,'id'> & { id?: string }) {
    const url = form.id ? `/api/company-docs/${form.id}` : '/api/company-docs'
    await fetch(url, { method: form.id ? 'PATCH' : 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form) })
    setModal(null); setSelected(null); load()
  }
  async function handleDelete(doc: CompanyDoc) {
    await fetch(`/api/company-docs/${doc.id}`, { method: 'DELETE' })
    setConfirmDel(null); load()
  }

  const DocRow = ({ doc }: { doc: CompanyDoc }) => {
    const badge = expiryBadge(doc.expiry_date, doc.reminder_days)
    const catColor = CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.Other
    const anyCritical = doc.expiry_date && isCritical(doc.expiry_date, doc.reminder_days)
    return (
      <div className={`bg-white rounded-xl border ${anyCritical ? 'border-red-300' : 'border-slate-200'} shadow-sm p-4 flex items-center gap-4`}>
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4 text-slate-500"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{doc.name}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catColor}`}>{doc.category}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {doc.issuing_authority && <p className="text-xs text-slate-500">{doc.issuing_authority}</p>}
            {doc.doc_number && <p className="text-xs text-slate-400 flex items-center gap-1"><Hash className="w-2.5 h-2.5"/>{doc.doc_number}</p>}
          </div>
          {doc.notes && <p className="text-[11px] text-slate-400 mt-1 truncate">{doc.notes}</p>}
        </div>
        <div className="flex-shrink-0 text-right">
          {badge ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-full ${badge.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}/>
              {badge.label === (doc.expiry_date ?? '').slice(0, 10) ? `Exp ${badge.label}` : badge.label}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">No expiry</span>
          )}
        </div>
        <div className="flex-shrink-0 flex gap-1">
          <button onClick={() => { setSelected(doc); setModal('edit') }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
          <button onClick={() => setConfirmDel(doc)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label:'Total Documents', value: docs.length,       icon: FileText,      color:'text-blue-600',   bg:'bg-blue-50'   },
          { label:'With Expiry',     value: withExpiry.length, icon: Calendar,      color:'text-slate-600',  bg:'bg-slate-50'  },
          { label:'Expiring Soon',   value: critical.length,   icon: AlertTriangle, color: critical.length>0?'text-red-600':'text-slate-400', bg: critical.length>0?'bg-red-50':'bg-slate-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}><Icon className={`w-5 h-5 ${color}`}/></div>
            <div><p className="text-[11px] text-slate-500 font-medium">{label}</p><p className={`text-lg font-bold ${color}`}>{value}</p></div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-red-800">Company documents require renewal</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {critical.map(d => (
                <span key={d.id} className="text-xs bg-white border border-red-200 text-red-700 rounded-full px-2.5 py-1 font-medium">
                  {d.name} {daysUntil(d.expiry_date)! < 0 ? '(EXPIRED)' : `in ${daysUntil(d.expiry_date)}d`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse h-16"/>)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3"/>
          <p className="text-slate-500 font-medium">No company documents yet</p>
          <button onClick={() => setModal('add')} className="mt-3 text-sm text-blue-600 hover:underline">Add first document</button>
        </div>
      ) : (
        <div className="space-y-3">
          {withExpiry.length > 0 && (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Documents with expiry date</p>
              {withExpiry
                .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
                .map(d => <DocRow key={d.id} doc={d}/>)}
            </>
          )}
          {noExpiry.length > 0 && (
            <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-4">No expiry date</p>
              {noExpiry.map(d => <DocRow key={d.id} doc={d}/>)}
            </>
          )}
        </div>
      )}

      {(modal==='add'||modal==='edit') && (
        <DocModal initial={modal==='edit'&&selected ? {...selected} : {...DOC_EMPTY}} onSave={handleSave} onClose={() => { setModal(null); setSelected(null) }}/>
      )}
      {confirmDel && <DeleteConfirm name={confirmDel.name} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)}/>}

      <div className="flex justify-end">
        <button onClick={() => setModal('add')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
          <Plus className="w-4 h-4"/> Add Document
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ════════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: 'employees',    label: 'Employees',          icon: Users     },
  { id: 'vehicles',     label: 'Vehicles',            icon: Car       },
  { id: 'company-docs', label: 'Company Documents',   icon: Building2 },
] as const

type TabId = typeof TABS[number]['id']

export default function HRPage() {
  const [tab, setTab] = useState<TabId>('employees')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">HR &amp; Admin</h1>
        <p className="text-sm text-slate-500 mt-0.5">Employees, vehicles &amp; company document compliance</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Icon className="w-4 h-4"/>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'employees'    && <EmployeesTab/>}
      {tab === 'vehicles'     && <VehiclesTab/>}
      {tab === 'company-docs' && <CompanyDocsTab/>}
    </div>
  )
}
