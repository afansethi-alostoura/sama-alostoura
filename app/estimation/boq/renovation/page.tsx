'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Printer, CheckCircle, Link2,
  Plus, Trash2, ChevronLeft, ChevronRight, Hash, AlignLeft, Sigma,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Column {
  id:   string
  name: string
  type: 'text' | 'number' | 'computed' // computed = first-number × second-number
}

type RowType = 'section' | 'subsection' | 'item'

interface BOQRow {
  id:     string
  type:   RowType
  label?: string
  cells?: Record<string, string>
}

interface TableData {
  columns: Column[]
  rows:    BOQRow[]
}

interface BOQHeader {
  project_number: string
  project_name:   string
  area:           string
  owner:          string
  contractor:     string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

function fmt(n: number) {
  return n === 0 ? '' : n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// First two number columns are assumed to be Qty × Rate
function computedValue(row: BOQRow, cols: Column[]): number {
  const numCols = cols.filter(c => c.type === 'number')
  if (numCols.length < 2) return 0
  const a = parseFloat(row.cells?.[numCols[0].id] || '0') || 0
  const b = parseFloat(row.cells?.[numCols[1].id] || '0') || 0
  return a * b
}

// Group flat rows into [{sectionRow, children}] blocks for rendering
function groupRows(rows: BOQRow[]) {
  const groups: { section: BOQRow | null; children: BOQRow[] }[] = []
  let current: { section: BOQRow | null; children: BOQRow[] } = { section: null, children: [] }
  for (const row of rows) {
    if (row.type === 'section') {
      groups.push(current)
      current = { section: row, children: [] }
    } else {
      current.children.push(row)
    }
  }
  groups.push(current)
  return groups.filter(g => g.section !== null || g.children.length > 0)
}

// ── Default columns ────────────────────────────────────────────────────────────
function makeDefaultCols(): Column[] {
  return [
    { id: uid(), name: 'Item',         type: 'text'     },
    { id: uid(), name: 'Description',  type: 'text'     },
    { id: uid(), name: 'Unit',         type: 'text'     },
    { id: uid(), name: 'Qty',          type: 'number'   },
    { id: uid(), name: 'Rate (AED)',   type: 'number'   },
    { id: uid(), name: 'Amount (AED)', type: 'computed' },
    { id: uid(), name: 'Remarks',      type: 'text'     },
  ]
}

// ── Column header cell ─────────────────────────────────────────────────────────
function ColHeader({
  col, idx, total,
  onRename, onDelete, onMoveLeft, onMoveRight, onTypeToggle,
}: {
  col: Column; idx: number; total: number
  onRename:     (n: string) => void
  onDelete:     () => void
  onMoveLeft:   () => void
  onMoveRight:  () => void
  onTypeToggle: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(col.name)

  function commit() {
    setEditing(false)
    onRename(draft.trim() || col.name)
  }

  const TypeIcon = col.type === 'number'   ? <Hash    className="w-3 h-3 opacity-60" /> :
                   col.type === 'computed' ? <Sigma   className="w-3 h-3 opacity-60" /> :
                                             <AlignLeft className="w-3 h-3 opacity-60" />

  return (
    <th className="group relative border border-slate-600 bg-slate-800 text-white px-2 align-middle print:bg-slate-800 print:text-white">
      <div className="py-2 flex flex-col gap-1">
        {/* Name + type icon */}
        <div className="flex items-center gap-1">
          <button onClick={onTypeToggle} title="Toggle type" className="shrink-0 text-slate-300 hover:text-white print:hidden">
            {TypeIcon}
          </button>
          {editing ? (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(col.name) } }}
              autoFocus
              className="flex-1 min-w-0 text-xs font-semibold bg-slate-700 border border-slate-400 rounded px-1 text-white focus:outline-none"
            />
          ) : (
            <span
              onClick={() => { setEditing(true); setDraft(col.name) }}
              title="Click to rename"
              className="flex-1 min-w-0 text-xs font-semibold text-white truncate cursor-text select-none"
            >
              {col.name}
            </span>
          )}
        </div>
        {/* Move / delete — on header hover, hidden when printing */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
          <button onClick={onMoveLeft} disabled={idx === 0}
            className="p-0.5 rounded hover:bg-slate-600 disabled:opacity-20 text-slate-300">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button onClick={onMoveRight} disabled={idx === total - 1}
            className="p-0.5 rounded hover:bg-slate-600 disabled:opacity-20 text-slate-300">
            <ChevronRight className="w-3 h-3" />
          </button>
          <button onClick={onDelete}
            className="p-0.5 rounded hover:bg-red-700 text-red-300 hover:text-white ml-auto">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </th>
  )
}

// ── Main editor ────────────────────────────────────────────────────────────────
function RenovationBOQInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const boqId        = searchParams.get('id')

  const [boqDbId, setBoqDbId] = useState<string | null>(boqId)

  const [header, setHeader] = useState<BOQHeader>({
    project_number: '',
    project_name:   '',
    area:           '',
    owner:          '',
    contractor:     'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
  })

  const [table,   setTable]   = useState<TableData>({ columns: makeDefaultCols(), rows: [] })
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [loading, setLoading] = useState(!!boqId)

  // Project linking
  const [projects,        setProjects]        = useState<{ id: string; name: string; client_name?: string }[]>([])
  const [linkedProjectId, setLinkedProjectId] = useState('')
  const [linkSaved,       setLinkSaved]       = useState(false)

  // Add column panel
  const [showAddCol, setShowAddCol] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState<'text' | 'number' | 'computed'>('text')

  // Load project list
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((list: any[]) => setProjects(list.map(p => ({ id: p.id, name: p.name, client_name: p.client_name }))))
      .catch(() => {})
  }, [])

  // Find which project is linked to this BOQ
  useEffect(() => {
    if (!boqId || projects.length === 0) return
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then((list: any[]) => {
        const linked = list.find(p => p.renovation_boq_id === boqId)
        if (linked) setLinkedProjectId(linked.id)
      })
      .catch(() => {})
  }, [boqId, projects.length])

  // Load existing BOQ
  useEffect(() => {
    if (!boqId) { setLoading(false); return }
    fetch(`/api/boq/renovation?id=${boqId}`)
      .then(r => r.json())
      .then(data => {
        if (!data) return
        setHeader({
          project_number: data.project_number ?? '',
          project_name:   data.project_name   ?? '',
          area:           data.area            ?? '',
          owner:          data.owner           ?? data.client_name ?? '',
          contractor:     data.contractor      ?? 'SAMA ALOSTOURA BUILDING CONTRACTING L.L.C',
        })
        const stored = data.sections
        if (stored?.columns) {
          setTable({
            columns: stored.columns,
            rows:    (stored.rows || []).map((r: BOQRow) => ({ ...r, id: r.id || uid() })),
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boqId])

  // ── Column ops ────────────────────────────────────────────────────────────────
  const renameCol = useCallback((id: string, name: string) =>
    setTable(t => ({ ...t, columns: t.columns.map(c => c.id === id ? { ...c, name } : c) })), [])

  const deleteCol = useCallback((id: string) => {
    setTable(t => ({
      columns: t.columns.length > 1 ? t.columns.filter(c => c.id !== id) : t.columns,
      rows: t.rows.map(r => {
        if (!r.cells) return r
        const cells = { ...r.cells }; delete cells[id]; return { ...r, cells }
      }),
    }))
  }, [])

  const moveCol = useCallback((idx: number, dir: -1 | 1) =>
    setTable(t => {
      const cols = [...t.columns]; const target = idx + dir
      if (target < 0 || target >= cols.length) return t
      ;[cols[idx], cols[target]] = [cols[target], cols[idx]]
      return { ...t, columns: cols }
    }), [])

  const toggleColType = useCallback((id: string) =>
    setTable(t => ({
      ...t,
      columns: t.columns.map(c => {
        if (c.id !== id) return c
        const next = c.type === 'text' ? 'number' : c.type === 'number' ? 'computed' : 'text'
        return { ...c, type: next }
      }),
    })), [])

  function addColumn() {
    if (!newColName.trim()) return
    const col: Column = { id: uid(), name: newColName.trim(), type: newColType }
    setTable(t => ({
      columns: [...t.columns, col],
      rows:    t.rows.map(r => r.type !== 'item' ? r : { ...r, cells: { ...r.cells, [col.id]: '' } }),
    }))
    setNewColName(''); setShowAddCol(false)
  }

  // ── Row ops ───────────────────────────────────────────────────────────────────
  const addRow = useCallback((type: RowType) =>
    setTable(t => ({
      ...t,
      rows: [...t.rows, type === 'item'
        ? { id: uid(), type, cells: Object.fromEntries(t.columns.map(c => [c.id, ''])) }
        : { id: uid(), type, label: '' }],
    })), [])

  const deleteRow = useCallback((id: string) =>
    setTable(t => ({ ...t, rows: t.rows.filter(r => r.id !== id) })), [])

  const updateLabel = useCallback((id: string, label: string) =>
    setTable(t => ({ ...t, rows: t.rows.map(r => r.id === id ? { ...r, label } : r) })), [])

  const updateCell = useCallback((rowId: string, colId: string, value: string) =>
    setTable(t => ({
      ...t,
      rows: t.rows.map(r => r.id !== rowId ? r : { ...r, cells: { ...r.cells, [colId]: value } }),
    })), [])

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!header.project_name.trim() && !header.owner.trim()) {
      alert('Please enter a project name.')
      return
    }
    setSaving(true)
    try {
      let savedId = boqDbId
      let res: Response
      const payload = {
        project_number: header.project_number,
        project_name:   header.project_name,
        area:           header.area,
        owner:          header.owner,
        contractor:     header.contractor,
        // store flexible table in sections field
        sections: table,
        // also surface top-level fields for the list view
        client_name:      header.owner,
        project_location: header.area,
      }
      if (boqDbId) {
        res = await fetch('/api/boq/renovation', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: boqDbId, ...payload }),
        })
      } else {
        res = await fetch('/api/boq/renovation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          savedId = data.id
          setBoqDbId(data.id)
          router.replace(`/estimation/boq/renovation?id=${data.id}`, { scroll: false })
        }
      }
      if (!res!.ok) throw new Error('Save failed')

      // Link BOQ to selected project
      if (linkedProjectId && savedId) {
        await fetch(`/api/projects/${linkedProjectId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ renovation_boq_id: savedId }),
        })
        setLinkSaved(true)
        setTimeout(() => setLinkSaved(false), 3000)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to save BOQ')
    } finally {
      setSaving(false)
    }
  }

  // ── Derived totals ─────────────────────────────────────────────────────────────
  const groups       = groupRows(table.rows)
  const hasComputed  = table.columns.some(c => c.type === 'computed')
  const sectionTotalsMap = new Map<string, number>()
  let grand = 0

  // Items with no section
  let noSectionTotal = 0
  const firstGroup = groups[0]
  if (firstGroup && !firstGroup.section) {
    firstGroup.children.filter(r => r.type === 'item').forEach(r => {
      noSectionTotal += computedValue(r, table.columns)
    })
    grand += noSectionTotal
  }

  groups.forEach(g => {
    if (!g.section) return
    const t = g.children.filter(r => r.type === 'item').reduce((s, r) => s + computedValue(r, table.columns), 0)
    sectionTotalsMap.set(g.section.id, t)
    grand += t
  })

  if (loading) return <div className="p-8 text-slate-500">Loading BOQ…</div>

  // ── Render ────────────────────────────────────────────────────────────────────
  const colCount = table.columns.length

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">

      {/* ── Sticky top bar ── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/estimation"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Estimation
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-semibold text-slate-700">
            Renovation BOQ{boqDbId ? '' : ' — New'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {saved
              ? <><CheckCircle className="w-4 h-4" /> Saved</>
              : <><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save BOQ'}</>}
          </button>
        </div>
      </div>

      <div className="max-w-[1300px] mx-auto p-4 sm:p-6">

        {/* ── Header card ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="text-center mb-5">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">SAMA ALOSTOURA BUILDING CONTRACTING L.L.C</h1>
            <h2 className="text-base font-semibold text-slate-600 mt-1">Renovation Bill of Quantities</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {([
              { label: 'PROJECT NUMBER', field: 'project_number' as const, placeholder: 'e.g. R-041' },
              { label: 'PROJECT',        field: 'project_name'   as const, placeholder: 'e.g. VILLA RENOVATION' },
              { label: 'AREA',           field: 'area'           as const, placeholder: 'e.g. Al Barsha, Dubai' },
              { label: 'OWNER',          field: 'owner'          as const, placeholder: 'Owner / Client full name' },
              { label: 'CONTRACTOR',     field: 'contractor'     as const, placeholder: 'Contractor name' },
            ] as const).map(({ label, field, placeholder }) => (
              <div key={field} className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-500 w-32 shrink-0">{label}:</span>
                <input
                  value={header[field]}
                  onChange={e => { setHeader(h => ({ ...h, [field]: e.target.value })); setSaved(false) }}
                  placeholder={placeholder}
                  className="flex-1 text-sm text-slate-900 font-medium bg-transparent outline-none placeholder:text-slate-300"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Link to Project ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 print:hidden">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-4 h-4 text-emerald-500" />
            <h3 className="font-semibold text-slate-900 text-sm">Link to Project</h3>
            {linkSaved && <span className="ml-auto text-xs text-emerald-600 font-semibold">Linked successfully</span>}
          </div>
          <div className="flex items-center gap-3">
            <select
              value={linkedProjectId}
              onChange={e => setLinkedProjectId(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">— Not linked to any project —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.client_name ? ` — ${p.client_name}` : ''}
                </option>
              ))}
            </select>
            {linkedProjectId && (
              <Link href={`/projects/${linkedProjectId}`}
                className="text-xs text-emerald-600 hover:underline whitespace-nowrap">
                View Project →
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Selecting a project here will automatically attach this BOQ to that project when you save.
          </p>
        </div>

        {/* ── BOQ Table ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: colCount * 110 + 200 }}>

              {/* Column headers */}
              <thead>
                <tr>
                  {/* Row-type gutter */}
                  <th className="w-8 border border-slate-600 bg-slate-800 print:hidden" />
                  {table.columns.map((col, idx) => (
                    <ColHeader key={col.id} col={col} idx={idx} total={colCount}
                      onRename={n => renameCol(col.id, n)}
                      onDelete={() => deleteCol(col.id)}
                      onMoveLeft={() => moveCol(idx, -1)}
                      onMoveRight={() => moveCol(idx, 1)}
                      onTypeToggle={() => toggleColType(col.id)}
                    />
                  ))}
                  {/* Add column */}
                  <th className="border border-slate-600 bg-slate-800 px-2 align-middle print:hidden"
                      style={{ minWidth: showAddCol ? 170 : 110 }}>
                    {showAddCol ? (
                      <div className="flex flex-col gap-1 py-1.5">
                        <input value={newColName} onChange={e => setNewColName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setShowAddCol(false) }}
                          placeholder="Column name" autoFocus
                          className="text-xs bg-slate-700 border border-emerald-400 rounded px-1.5 py-0.5 text-white placeholder:text-slate-400 focus:outline-none w-full" />
                        <div className="flex items-center gap-1">
                          <select value={newColType} onChange={e => setNewColType(e.target.value as any)}
                            className="text-xs bg-slate-700 border border-slate-500 rounded px-1 py-0.5 text-white flex-1 focus:outline-none">
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="computed">Computed</option>
                          </select>
                          <button onClick={addColumn}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-0.5 shrink-0">Add</button>
                          <button onClick={() => { setShowAddCol(false); setNewColName('') }}
                            className="text-slate-300 hover:text-white shrink-0">✕</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddCol(true)}
                        className="flex items-center gap-1 text-xs text-slate-300 hover:text-white font-medium py-2 transition-colors w-full">
                        <Plus className="w-3.5 h-3.5" /> Add Column
                      </button>
                    )}
                  </th>
                  {/* Delete-row gutter */}
                  <th className="w-8 border border-slate-600 bg-slate-800 print:hidden" />
                </tr>
              </thead>

              {/* Body */}
              <tbody>
                {table.rows.length === 0 && (
                  <tr>
                    <td colSpan={colCount + 3}
                      className="py-12 text-center text-slate-400 text-sm italic print:hidden">
                      No rows yet — use the buttons below to start building your BOQ
                    </td>
                  </tr>
                )}

                {groups.map((group, gIdx) => {
                  const secTotal = group.section ? (sectionTotalsMap.get(group.section.id) ?? 0) : noSectionTotal
                  let itemNo = 0

                  return (
                    <tr key={group.section?.id ?? `no-sec-${gIdx}`} className="contents">
                      {(() => {
                        const trs: React.ReactNode[] = []

                        /* Section header row */
                        if (group.section) {
                          trs.push(
                            <tr key={`sh-${group.section.id}`} className="group bg-blue-50 border-t-2 border-blue-200">
                              <td className="px-2 py-1.5 text-center print:hidden">
                                <span className="text-[9px] font-bold text-blue-400">S</span>
                              </td>
                              <td colSpan={colCount + 1}
                                className="px-3 py-2 border border-blue-200">
                                <input
                                  value={group.section.label || ''}
                                  onChange={e => updateLabel(group.section!.id, e.target.value)}
                                  placeholder="Section name (e.g. 1. DEMOLITION WORKS)"
                                  className="w-full bg-transparent font-bold text-blue-800 uppercase tracking-wide placeholder:text-blue-300 focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center print:hidden">
                                <button onClick={() => deleteRow(group.section!.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 rounded transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          )
                        }

                        /* Child rows (subsections + items) */
                        group.children.forEach(row => {
                          if (row.type === 'subsection') {
                            trs.push(
                              <tr key={row.id} className="group bg-slate-100">
                                <td className="px-2 py-1.5 text-center print:hidden">
                                  <span className="text-[9px] font-bold text-slate-500">ss</span>
                                </td>
                                <td colSpan={colCount + 1} className="px-3 py-1.5 border border-slate-200">
                                  <input
                                    value={row.label || ''}
                                    onChange={e => updateLabel(row.id, e.target.value)}
                                    placeholder="Sub-section (e.g. 1.1 Internal Walls)"
                                    className="w-full bg-transparent font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none pl-3"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center print:hidden">
                                  <button onClick={() => deleteRow(row.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 rounded transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          } else {
                            // item row
                            itemNo++
                            const computedAmt = computedValue(row, table.columns)
                            trs.push(
                              <tr key={row.id} className={`group border-b border-slate-100 ${itemNo % 2 === 0 ? 'bg-slate-50/40' : 'bg-white'}`}>
                                <td className="px-2 py-1 text-center border border-slate-100 text-slate-300 text-xs print:hidden" />
                                {table.columns.map(col => {
                                  if (col.type === 'computed') {
                                    return (
                                      <td key={col.id} className="px-3 py-1.5 border border-slate-100 text-right font-medium text-slate-700">
                                        {computedAmt > 0 ? fmt(computedAmt) : ''}
                                      </td>
                                    )
                                  }
                                  return (
                                    <td key={col.id} className="px-1 py-0.5 border border-slate-100">
                                      <input
                                        value={row.cells?.[col.id] ?? ''}
                                        onChange={e => updateCell(row.id, col.id, e.target.value)}
                                        type={col.type === 'number' ? 'number' : 'text'}
                                        min={col.type === 'number' ? 0 : undefined}
                                        placeholder={col.type === 'number' ? '0' : ''}
                                        className={`w-full text-sm bg-transparent focus:outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-300 rounded px-1.5 py-1 text-slate-800 ${col.type === 'number' ? 'text-center bg-blue-50/40 border border-blue-100 rounded' : ''} print:bg-transparent print:border-0`}
                                      />
                                    </td>
                                  )
                                })}
                                {/* add-col filler */}
                                <td className="border border-slate-100 print:hidden" />
                                <td className="px-2 py-1 border border-slate-100 text-center print:hidden">
                                  <button onClick={() => deleteRow(row.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          }
                        })

                        /* Section total row */
                        if ((group.section || group.children.some(r => r.type === 'item')) && hasComputed) {
                          const label = group.section?.label
                            ? `${group.section.label} — SECTION TOTAL`
                            : 'SECTION TOTAL'
                          trs.push(
                            <tr key={`st-${group.section?.id ?? 'nosec'}`} className="bg-slate-100">
                              <td colSpan={colCount + 1} className="px-3 py-1.5 text-right text-xs font-semibold text-slate-600 border border-slate-200 print:hidden" />
                              <td className="px-3 py-1.5 text-right text-xs font-semibold text-slate-600 border border-slate-200 print:table-cell print:text-right" colSpan={colCount + 1 + 1}>
                                {label}
                              </td>
                              <td className="px-3 py-1.5 text-right font-bold text-slate-900 border border-slate-200 print:hidden">
                                {fmt(secTotal)}
                              </td>
                              {/* visible in print */}
                              <td className="hidden print:table-cell px-3 py-1.5 text-right font-bold text-slate-900 border border-slate-200">
                                {fmt(secTotal)}
                              </td>
                              <td className="border border-slate-200 print:hidden" />
                            </tr>
                          )
                        }

                        return trs
                      })()}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Grand total bar */}
          {hasComputed && (
            <div className="border-t-2 border-slate-800 bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
              <span className="font-bold text-sm tracking-wide">GRAND TOTAL</span>
              <span className="text-xl font-bold">AED {grand.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Add row buttons */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex-wrap print:hidden">
            <span className="text-xs font-semibold text-slate-400 mr-1">Add:</span>
            <button onClick={() => addRow('item')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Item Row
            </button>
            <button onClick={() => addRow('section')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-slate-200 hover:bg-blue-800 hover:border-blue-700 text-slate-700 hover:text-white rounded-lg transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Section
            </button>
            <button onClick={() => addRow('subsection')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Sub-section
            </button>
          </div>
        </div>

        {/* ── Summary Schedule ── */}
        {hasComputed && groups.some(g => g.section) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="bg-slate-800 text-white px-5 py-2.5">
              <h3 className="font-bold text-sm tracking-wide">SUMMARY SCHEDULE</h3>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-4 py-2 text-left border border-slate-200 w-10">N</th>
                  <th className="px-4 py-2 text-left border border-slate-200">DESCRIPTION</th>
                  <th className="px-4 py-2 text-right border border-slate-200 w-44">TOTAL AMOUNT (AED)</th>
                </tr>
              </thead>
              <tbody>
                {groups.filter(g => g.section).map((g, i) => {
                  const t = sectionTotalsMap.get(g.section!.id) ?? 0
                  return (
                    <tr key={g.section!.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-4 py-1.5 border border-slate-100 font-medium text-slate-700">{i + 1}</td>
                      <td className="px-4 py-1.5 border border-slate-100 text-slate-700">{g.section!.label || `Section ${i + 1}`}</td>
                      <td className="px-4 py-1.5 border border-slate-100 text-right font-semibold text-slate-900">{t > 0 ? fmt(t) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan={2} className="px-4 py-2.5 font-bold tracking-wide">GRAND TOTAL</td>
                  <td className="px-4 py-2.5 text-right font-bold text-lg">
                    {grand.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ── Signatures ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
          <div className="grid grid-cols-2 gap-12 mt-8">
            <div className="text-center">
              <div className="border-t border-slate-400 pt-2 mt-8">
                <p className="text-sm font-semibold text-slate-700">OWNER</p>
                <p className="text-xs text-slate-400 mt-0.5">{header.owner || '___________________________'}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-2 mt-8">
                <p className="text-sm font-semibold text-slate-700">CONTRACTOR</p>
                <p className="text-xs text-slate-400 mt-0.5">{header.contractor}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function RenovationBOQPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    }>
      <RenovationBOQInner />
    </Suspense>
  )
}
