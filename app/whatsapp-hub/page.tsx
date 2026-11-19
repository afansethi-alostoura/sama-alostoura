'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle2, Clock, AlertCircle, XCircle,
  Building2, Mic, MessageSquare, ChevronDown, ChevronUp,
  Hammer, Zap, Wrench, Shield, Paintbrush, Layers,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeptTask {
  id: number
  project_id: string | null
  project_name: string
  department: string
  task_description: string
  status: 'open' | 'in_progress' | 'completed' | 'blocked'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  reporter_name: string | null
  reporter_phone: string | null
  source_message: string | null
  ai_analysis: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPT_ICONS: Record<string, React.ReactNode> = {
  Civil:      <Hammer    className="w-4 h-4" />,
  MEP:        <Wrench    className="w-4 h-4" />,
  Electrical: <Zap       className="w-4 h-4" />,
  Steel:      <Layers    className="w-4 h-4" />,
  HSE:        <Shield    className="w-4 h-4" />,
  Finishing:  <Paintbrush className="w-4 h-4" />,
  General:    <MessageSquare className="w-4 h-4" />,
}

const DEPT_COLORS: Record<string, string> = {
  Civil:      'bg-orange-100 text-orange-800 border-orange-200',
  MEP:        'bg-cyan-100 text-cyan-800 border-cyan-200',
  Electrical: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Steel:      'bg-slate-100 text-slate-800 border-slate-200',
  HSE:        'bg-green-100 text-green-800 border-green-200',
  Finishing:  'bg-purple-100 text-purple-800 border-purple-200',
  General:    'bg-blue-100 text-blue-800 border-blue-200',
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 border border-red-200',
  high:   'bg-orange-100 text-orange-700 border border-orange-200',
  normal: 'bg-slate-100 text-slate-600 border border-slate-200',
  low:    'bg-gray-50 text-gray-500 border border-gray-200',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open:        <Clock      className="w-3.5 h-3.5" />,
  in_progress: <RefreshCw  className="w-3.5 h-3.5 animate-spin" />,
  completed:   <CheckCircle2 className="w-3.5 h-3.5" />,
  blocked:     <XCircle    className="w-3.5 h-3.5" />,
}

const STATUS_COLORS: Record<string, string> = {
  open:        'text-blue-600 bg-blue-50',
  in_progress: 'text-amber-600 bg-amber-50',
  completed:   'text-emerald-600 bg-emerald-50',
  blocked:     'text-red-600 bg-red-50',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WhatsAppHubPage() {
  const [tasks,      setTasks]      = useState<DeptTask[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterDept, setFilterDept] = useState<string>('All')
  const [filterStatus, setStatus]   = useState<string>('open')
  const [expanded,   setExpanded]   = useState<Record<number, boolean>>({})
  const [simulating, setSimulating] = useState(false)
  const [simInput,   setSimInput]   = useState('')
  const [simProject, setSimProject] = useState('')
  const [simResult,  setSimResult]  = useState<{ tasks?: DeptTask[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const r = await fetch(`/api/whatsapp/tasks?${params}`)
      const d = await r.json()
      setTasks(d.tasks ?? [])
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: number, status: string) {
    await fetch('/api/whatsapp/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: status as DeptTask['status'] } : t))
  }

  async function simulate() {
    if (!simInput.trim() || !simProject.trim()) return
    setSimulating(true)
    setSimResult(null)
    try {
      const r = await fetch('/api/whatsapp/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript:   simInput,
          projectName:  simProject,
          reporterName: 'Simulate',
          reporterRole: 'Site Engineer',
        }),
      })
      const d = await r.json()
      setSimResult(d)
      await load()
    } finally {
      setSimulating(false)
    }
  }

  // Group tasks by project
  const depts = ['All', 'Civil', 'MEP', 'Electrical', 'Steel', 'HSE', 'Finishing', 'General']
  const filtered = filterDept === 'All' ? tasks : tasks.filter(t => t.department === filterDept)

  const byProject: Record<string, DeptTask[]> = {}
  for (const t of filtered) {
    const k = t.project_name
    if (!byProject[k]) byProject[k] = []
    byProject[k].push(t)
  }

  const urgentCount = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length
  const openCount   = tasks.filter(t => t.status === 'open').length
  const doneToday   = tasks.filter(t => t.status === 'completed' && new Date(t.created_at).toDateString() === new Date().toDateString()).length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">WhatsApp Command Hub</h1>
            <p className="text-xs text-slate-400">AI Dispatcher · Department Task Feed</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Open Tasks',   value: openCount,   color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
          { label: 'Urgent',       value: urgentCount, color: 'text-red-400',    bg: 'bg-red-500/10'    },
          { label: 'Done Today',   value: doneToday,   color: 'text-emerald-400',bg: 'bg-emerald-500/10'},
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 border border-white/5`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Dept filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {depts.map(d => (
          <button
            key={d}
            onClick={() => setFilterDept(d)}
            className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filterDept === d
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            {d !== 'All' && DEPT_ICONS[d]}
            {d}
          </button>
        ))}
        <div className="flex-shrink-0 ml-auto flex gap-1">
          {['open', 'in_progress', 'completed', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                filterStatus === s
                  ? 'bg-slate-600 border-slate-500 text-white'
                  : 'border-slate-700 text-slate-500 hover:text-white'
              }`}
            >
              {s === 'in_progress' ? 'active' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Task feed */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      ) : Object.keys(byProject).length === 0 ? (
        <div className="text-center py-16">
          <Mic className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No tasks yet</p>
          <p className="text-slate-500 text-sm mt-1">Staff voice updates will appear here after the dispatcher runs</p>
          <p className="text-xs text-slate-600 mt-2">Use the Simulate panel below to test</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byProject).map(([project, ptasks]) => (
            <div key={project} className="rounded-2xl border border-slate-800 overflow-hidden">
              {/* Project header */}
              <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-white text-sm">{project}</span>
                  <span className="text-xs text-slate-400 ml-1">{ptasks.length} task{ptasks.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex gap-1">
                  {(['urgent','high'] as const).map(p => {
                    const c = ptasks.filter(t => t.priority === p && t.status !== 'completed').length
                    if (!c) return null
                    return (
                      <span key={p} className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[p]}`}>
                        {c} {p}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Tasks */}
              <div className="divide-y divide-slate-800/60">
                {ptasks.map(task => (
                  <div key={task.id} className="bg-slate-900/50 p-3">
                    <div className="flex items-start gap-3">
                      {/* Dept badge */}
                      <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border mt-0.5 ${DEPT_COLORS[task.department] ?? DEPT_COLORS.General}`}>
                        {DEPT_ICONS[task.department]}
                        {task.department}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 leading-snug">{task.task_description}</p>
                        {task.ai_analysis && (
                          <p className="text-xs text-slate-500 mt-0.5 italic">{task.ai_analysis}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_STYLES[task.priority]}`}>
                            {task.priority}
                          </span>
                          <span className="text-xs text-slate-500">
                            {task.reporter_name ?? 'AI Dispatcher'} · {timeAgo(task.created_at)}
                          </span>
                          {task.source_message && (
                            <button
                              onClick={() => setExpanded(e => ({ ...e, [task.id]: !e[task.id] }))}
                              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-0.5"
                            >
                              {expanded[task.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              voice
                            </button>
                          )}
                        </div>
                        {expanded[task.id] && task.source_message && (
                          <div className="mt-2 p-2 bg-slate-800 rounded-lg text-xs text-slate-400 italic">
                            🎙️ "{task.source_message}"
                          </div>
                        )}
                      </div>

                      {/* Status control */}
                      <div className="flex-shrink-0">
                        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${STATUS_COLORS[task.status]}`}>
                          {STATUS_ICONS[task.status]}
                          <span className="hidden sm:inline">{task.status.replace('_', ' ')}</span>
                        </div>
                        {task.status !== 'completed' && (
                          <div className="flex gap-1 mt-1">
                            {task.status === 'open' && (
                              <button
                                onClick={() => updateStatus(task.id, 'in_progress')}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 hover:bg-amber-900/70 transition-colors"
                              >
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => updateStatus(task.id, 'completed')}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/70 transition-colors"
                            >
                              Done
                            </button>
                            {task.status !== 'blocked' && (
                              <button
                                onClick={() => updateStatus(task.id, 'blocked')}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 transition-colors"
                              >
                                Block
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simulate Panel */}
      <div className="mt-8 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
          <Mic className="w-4 h-4 text-green-400" />
          <span className="font-semibold text-white text-sm">Simulate Voice Update</span>
          <span className="text-xs text-slate-400 ml-1">Test the AI Dispatcher</span>
        </div>
        <div className="p-4 space-y-3 bg-slate-900">
          <input
            type="text"
            placeholder="Project name (e.g. Villa Renovation - Al Barsha)"
            value={simProject}
            onChange={e => setSimProject(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <textarea
            rows={3}
            placeholder="Paste transcript or type a site update... (e.g. 'Aaj concrete pouring hogi lekin steel rebar abhi tak nahi aya, MEP wale bhi plumbing test nahi kar sake, koi safety helmet nahi pehen raha tha')"
            value={simInput}
            onChange={e => setSimInput(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          <button
            onClick={simulate}
            disabled={simulating || !simInput.trim() || !simProject.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-900/40 disabled:text-green-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {simulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            {simulating ? 'Dispatching...' : 'Run AI Dispatcher'}
          </button>
          {simResult && (
            <div className="bg-slate-800 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-green-400">✅ Dispatched {simResult.tasks?.length ?? 0} tasks</p>
              {simResult.tasks?.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded-full border ${DEPT_COLORS[t.department] ?? DEPT_COLORS.General}`}>
                    {t.department}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                  <span className="text-slate-300">{t.task_description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
