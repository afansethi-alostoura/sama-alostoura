'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, Hash, AlignLeft,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────
interface Column {
  id:   string
  name: string
  type: 'text' | 'number'
}

type RowType = 'section' | 'subsection' | 'item'

interface BOQRow {
  id:     string
  type:   RowType
  label?: string                  // section / subsection header text
  cells?: Record<string, string>  // item cells keyed by column id
}

interface TableData {
  columns: Column[]
  rows:    BOQRow[]
}

// ── Defaults ─────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

const DEFAULT_COLS: Column[] = [
  { id: uid(), name: 'No.',         type: 'text'   },
  { id: uid(), name: 'Description', type: 'text'   },
  { id: uid(), name: 'Unit',        type: 'text'   },
  { id: uid(), name: 'Qty',         type: 'number' },
  { id: uid(), name: 'Remarks',     type: 'text'   },
]

const EMPTY_TABLE: TableData = { columns: DEFAULT_COLS, rows: [] }

// ── Column header cell (editable name + controls) ────────────────────
function ColHeader({
  col, idx, total,
  onRename, onDelete, onMoveLeft, onMoveRight, onTypeToggle,
}: {
  col: Column; idx: number; total: number
  onRename:     (name: string) => void
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

  return (
    <th className="relative group border border-slate-200 bg-slate-50 px-2 align-top"
        style={{ minWidth: col.type === 'number' ? 90 : col.id === DEFAULT_COLS[1]?.id ? 320 : 110 }}>
      <div className="py-1.5 flex flex-col gap-1">
        {/* Type toggle + name */}
        <div className="flex items-center gap-1">
          <button onClick={onTypeToggle} title="Toggle text/number"
            className="shrink-0 text-slate-400 hover:text-indigo-500 transition-colors">
            {col.type === 'number'
              ? <Hash className="w-3 h-3" />
              : <AlignLeft className="w-3 h-3" />}
          </button>
          {editing ? (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(col.name) } }}
              autoFocus
              className="flex-1 min-w-0 text-xs font-semibold border border-emerald-400 rounded px-1 focus:outline-none bg-white"
            />
          ) : (
            <span
              onClick={() => { setEditing(true); setDraft(col.name) }}
              title="Click to rename"
              className="flex-1 min-w-0 text-xs font-semibold text-slate-700 truncate cursor-text select-none"
            >
              {col.name}
            </span>
          )}
        </div>
        {/* Move / delete — appear on header hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onMoveLeft} disabled={idx === 0}
            title="Move left"
            className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-500">
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button onClick={onMoveRight} disabled={idx === total - 1}
            title="Move right"
            className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-20 text-slate-500">
            <ChevronRight className="w-3 h-3" />
          </button>
          <button onClick={onDelete}
            title="Delete column"
            className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600 ml-auto">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </th>
  )
}

// ── Main Editor (needs Suspense for useSearchParams) ─────────────────
function Editor() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const boqId        = searchParams.get('id')

  const [projectName,     setProjectName]     = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [clientName,      setClientName]      = useState('')
  const [table,           setTable]           = useState<TableData>(() => ({
    columns: DEFAULT_COLS.map(c => ({ ...c, id: uid() })),
    rows: [],
  }))

  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')
  const [showAddCol,  setShowAddCol]  = useState(false)
  const [newColName,  setNewColName]  = useState('')
  const [newColType,  setNewColType]  = useState<'text' | 'number'>('text')

  // Load existing BOQ
  useEffect(() => {
    if (!boqId) return
    setLoading(true)
    fetch(`/api/boq/renovation?id=${boqId}`)
      .then(r => r.json())
      .then(data => {
        if (!data) return
        setProjectName(data.project_name || '')
        setProjectLocation(data.project_location || '')
        setClientName(data.client_name || '')
        const stored = data.sections
        if (stored?.columns) {
          setTable({
            columns: stored.columns,
            rows:    (stored.rows || []).map((r: BOQRow) => ({ ...r, id: r.id || uid() })),
          })
        }
      })
      .catch(() => setError('Failed to load BOQ'))
      .finally(() => setLoading(false))
  }, [boqId])

  // ── Column operations ─────────────────────────────────────────────
  const renameCol = (id: string, name: string) =>
    setTable(t => ({ ...t, columns: t.columns.map(c => c.id === id ? { ...c, name } : c) }))

  const deleteCol = (id: string) => {
    if (table.columns.length <= 1) return
    setTable(t => ({
      columns: t.columns.filter(c => c.id !== id),
      rows:    t.rows.map(r => {
        if (!r.cells) return r
        const cells = { ...r.cells }; delete cells[id]
        return { ...r, cells }
      }),
    }))
  }

  const moveCol = (idx: number, dir: -1 | 1) =>
    setTable(t => {
      const cols   = [...t.columns]
      const target = idx + dir
      if (target < 0 || target >= cols.length) return t
      ;[cols[idx], cols[target]] = [cols[target], cols[idx]]
      return { ...t, columns: cols }
    })

  const toggleColType = (id: string) =>
    setTable(t => ({
      ...t,
      columns: t.columns.map(c => c.id === id ? { ...c, type: c.type === 'number' ? 'text' : 'number' } : c),
    }))

  function addColumn() {
    if (!newColName.trim()) return
    const col: Column = { id: uid(), name: newColName.trim(), type: newColType }
    setTable(t => ({
      columns: [...t.columns, col],
      rows:    t.rows.map(r => r.type !== 'item' ? r : { ...r, cells: { ...r.cells, [col.id]: '' } }),
    }))
    setNewColName('')
    setShowAddCol(false)
  }

  // ── Row operations ────────────────────────────────────────────────
  const addRow = (type: RowType) =>
    setTable(t => ({
      ...t,
      rows: [...t.rows, type === 'item'
        ? { id: uid(), type, cells: Object.fromEntries(t.columns.map(c => [c.id, ''])) }
        : { id: uid(), type, label: '' }],
    }))

  const deleteRow = (id: string) =>
    setTable(t => ({ ...t, rows: t.rows.filter(r => r.id !== id) }))

  const updateLabel = (id: string, label: string) =>
    setTable(t => ({ ...t, rows: t.rows.map(r => r.id === id ? { ...r, label } : r) }))

  const updateCell = (rowId: string, colId: string, value: string) =>
    setTable(t => ({
      ...t,
      rows: t.rows.map(r => r.id !== rowId ? r : { ...r, cells: { ...r.cells, [colId]: value } }),
    }))

  // ── Save ──────────────────────────────────────────────────────────
  async function save() {
    if (!projectName.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const body = {
        project_name:     projectName,
        project_location: projectLocation,
        client_name:      clientName,
        sections:         table,
      }
      const res  = await fetch('/api/boq/renovation', {
        method:  boqId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(boqId ? { id: boqId, ...body } : body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      if (!boqId && data.id) router.replace(`/estimation/boq/renovation?id=${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Computed stats ────────────────────────────────────────────────
  const itemCount = table.rows.filter(r => r.type === 'item').length

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-96">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
    </div>
  )

  const SAVE_BTN = (
    <button onClick={save} disabled={saving}
      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 shrink-0">
      {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> :
       saved  ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save BOQ'}
    </button>
  )

  return (
    <div className="p-4 sm:p-6" style={{ maxWidth: '100%' }}>

      {/* Back */}
      <button onClick={() => router.push('/estimation')}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Estimation
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <h1 className="text-2xl font-bold text-slate-900">Renovation BOQ</h1>
          </div>
          <p className="text-slate-400 text-sm">
            {boqId
              ? `${itemCount} item${itemCount !== 1 ? 's' : ''} · ${table.columns.length} columns`
              : 'New renovation bill of quantities'}
          </p>
        </div>
        {SAVE_BTN}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 font-bold text-lg leading-none ml-3">×</button>
        </div>
      )}

      {/* Project info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Project Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Project Name <span className="text-red-400">*</span></label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Villa Renovation — Al Barsha"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
            <input value={projectLocation} onChange={e => setProjectLocation(e.target.value)}
              placeholder="e.g. Al Barsha, Dubai"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client Name</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="e.g. Mansoor Al Mardif"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* ── BOQ Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-5">

        {/* Scrollable table */}
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm w-full">
            <thead>
              <tr>
                {/* Left gutter */}
                <th className="w-7 border-b border-slate-200 bg-slate-50" />

                {/* Column headers */}
                {table.columns.map((col, idx) => (
                  <ColHeader
                    key={col.id}
                    col={col} idx={idx} total={table.columns.length}
                    onRename={name => renameCol(col.id, name)}
                    onDelete={() => deleteCol(col.id)}
                    onMoveLeft={() => moveCol(idx, -1)}
                    onMoveRight={() => moveCol(idx, 1)}
                    onTypeToggle={() => toggleColType(col.id)}
                  />
                ))}

                {/* Add column header */}
                <th className="border-b border-slate-200 bg-slate-50 px-2 align-middle"
                    style={{ minWidth: showAddCol ? 180 : 120 }}>
                  {showAddCol ? (
                    <div className="flex flex-col gap-1 py-1.5">
                      <input
                        value={newColName}
                        onChange={e => setNewColName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setShowAddCol(false) }}
                        placeholder="Column name"
                        autoFocus
                        className="text-xs border border-emerald-400 rounded px-1.5 py-0.5 focus:outline-none w-full"
                      />
                      <div className="flex items-center gap-1">
                        <select value={newColType} onChange={e => setNewColType(e.target.value as 'text' | 'number')}
                          className="text-xs border border-slate-200 rounded px-1 py-0.5 flex-1 focus:outline-none">
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                        </select>
                        <button onClick={addColumn}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-0.5 shrink-0">Add</button>
                        <button onClick={() => { setShowAddCol(false); setNewColName('') }}
                          className="text-slate-400 hover:text-slate-600 shrink-0">✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddCol(true)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 font-medium py-2 transition-colors w-full">
                      <Plus className="w-3.5 h-3.5" /> Add Column
                    </button>
                  )}
                </th>

                {/* Right gutter (delete col) */}
                <th className="w-8 border-b border-slate-200 bg-slate-50" />
              </tr>
            </thead>

            <tbody>
              {table.rows.length === 0 && (
                <tr>
                  <td colSpan={table.columns.length + 3}
                    className="py-14 text-center text-slate-400 text-sm italic">
                    No rows yet — use the buttons below to start building your BOQ
                  </td>
                </tr>
              )}

              {table.rows.map(row => {
                /* ── Section row ─────────────────────────────────── */
                if (row.type === 'section') return (
                  <tr key={row.id} className="group bg-slate-800">
                    <td className="px-1.5 py-2 text-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">S</span>
                    </td>
                    <td colSpan={table.columns.length + 1} className="px-3 py-2">
                      <input
                        value={row.label || ''}
                        onChange={e => updateLabel(row.id, e.target.value)}
                        placeholder="Section header (e.g. 1. DEMOLITION WORKS)"
                        className="w-full bg-transparent text-white font-bold text-sm placeholder:text-slate-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-1.5 py-2 text-center">
                      <button onClick={() => deleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-300 rounded transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )

                /* ── Sub-section row ──────────────────────────────── */
                if (row.type === 'subsection') return (
                  <tr key={row.id} className="group bg-slate-100">
                    <td className="px-1.5 py-1.5 text-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">ss</span>
                    </td>
                    <td colSpan={table.columns.length + 1} className="px-3 py-1.5">
                      <input
                        value={row.label || ''}
                        onChange={e => updateLabel(row.id, e.target.value)}
                        placeholder="Sub-section (e.g. 1.1 Internal Walls)"
                        className="w-full bg-transparent font-semibold text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none pl-3"
                      />
                    </td>
                    <td className="px-1.5 py-1.5 text-center">
                      <button onClick={() => deleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 rounded transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )

                /* ── Item row ─────────────────────────────────────── */
                return (
                  <tr key={row.id} className="group border-b border-slate-100 hover:bg-emerald-50/20">
                    <td className="px-1.5 py-1 text-center">
                      <span className="text-slate-200 text-xs">·</span>
                    </td>
                    {table.columns.map((col, cIdx) => (
                      <td key={col.id}
                        className={`py-0.5 px-1 border-r border-slate-100 last:border-r-0 ${cIdx === 0 ? 'pl-2' : ''}`}>
                        <input
                          value={row.cells?.[col.id] ?? ''}
                          onChange={e => updateCell(row.id, col.id, e.target.value)}
                          type={col.type === 'number' ? 'number' : 'text'}
                          min={col.type === 'number' ? 0 : undefined}
                          placeholder={col.type === 'number' ? '0' : ''}
                          className={`w-full bg-transparent focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-300 rounded px-1.5 py-1.5 text-slate-800 text-sm ${col.type === 'number' ? 'text-right' : ''}`}
                          onKeyDown={e => {
                            // Tab from last column → add new item row
                            if (e.key === 'Tab' && !e.shiftKey && cIdx === table.columns.length - 1) {
                              const isLast = table.rows.indexOf(row) === table.rows.length - 1
                              if (isLast) { e.preventDefault(); addRow('item') }
                            }
                          }}
                        />
                      </td>
                    ))}
                    {/* Add column filler */}
                    <td />
                    {/* Delete button */}
                    <td className="px-1.5 py-1 text-center">
                      <button onClick={() => deleteRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Add row toolbar ── */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 mr-1">Add:</span>

          <button onClick={() => addRow('item')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" /> Item Row
          </button>

          <button onClick={() => addRow('section')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-800 hover:border-slate-700 text-slate-700 hover:text-white rounded-lg transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" /> Section
          </button>

          <button onClick={() => addRow('subsection')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" /> Sub-section
          </button>

          <span className="ml-auto text-xs text-slate-300">
            {itemCount} item{itemCount !== 1 ? 's' : ''}
            {' · '}Tip: Tab from the last column to auto-add a row
          </span>
        </div>
      </div>

      {/* Bottom save */}
      {table.rows.length > 0 && (
        <div className="flex justify-end pb-10">
          {SAVE_BTN}
        </div>
      )}
    </div>
  )
}

export default function RenovationBOQPage() {
  return (
    <Suspense fallback={
      <div className="p-8 flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    }>
      <Editor />
    </Suspense>
  )
}
