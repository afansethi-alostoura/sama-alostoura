'use client'
import { useEffect, useState } from 'react'
import Link                    from 'next/link'
import { Building2, Plus, Clock, Loader2 } from 'lucide-react'
import { DEMO_PROJECTS }       from '@/lib/demo-data'
import { formatCurrency, progressBarColor, statusBadge, statusLabel } from '@/lib/utils'
import type { Project }        from '@/types'
import type { StoredProject }  from '@/lib/projects-store'

function toProjectShape(s: StoredProject): Project {
  const normalizeStatus = (st: string) => st.replace('-', '_') as any
  return {
    id: s.id, name: s.name, client_id: s.id,
    type: s.type as any, location: s.location,
    contract_value: s.contract_value, received_amount: s.received_amount,
    progress_percent: s.progress_percent, current_stage: s.current_stage,
    start_date: s.start_date, expected_completion: s.expected_completion,
    status: normalizeStatus(s.status), notes: s.notes || null,
    created_at: s.created_at, updated_at: s.updated_at,
    client: { id: s.id, name: s.client_name || 'Client', phone: null, email: null,
      nationality: 'UAE', location: s.location, type: 'owner', created_at: s.created_at },
  }
}

export default function ProjectsPage() {
  const [realProjects, setRealProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: StoredProject[]) => setRealProjects(data.map(toProjectShape)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Real projects shown first, then demo projects (excluding any with same name)
  const realNames = new Set(realProjects.map(p => p.name.toLowerCase()))
  const demoFallbacks = DEMO_PROJECTS.filter(p => !realNames.has(p.name.toLowerCase()))
  const projects = [...realProjects, ...demoFallbacks]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-1">
            {loading ? 'Loading…' : `${projects.length} projects · ${projects.filter(p => p.status === 'active').length} active`}
            {realProjects.length > 0 && <span className="ml-2 text-brand-500 font-medium">· {realProjects.length} real</span>}
          </p>
        </div>
        <Link
          href="/projects/add"
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
        </div>
      )}

      <div className="space-y-4">
        {projects.map(project => {
          const outstanding = project.contract_value - project.received_amount
          const isReal = realNames.has(project.name.toLowerCase())
          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-brand-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {project.name} {project.type === 'villa' ? 'Villa' : project.type === 'renovation' ? 'Renovation' : 'Project'}
                      </h2>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${statusBadge(project.status)}`}>
                        {statusLabel(project.status)}
                      </span>
                      {isReal && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-600 ring-1 ring-brand-200">
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">{project.location}</p>
                    {project.current_stage && (
                      <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {project.current_stage}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-8 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Contract</p>
                      <p className="font-semibold text-slate-900">{formatCurrency(project.contract_value)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Received</p>
                      <p className="font-semibold text-emerald-600">{formatCurrency(project.received_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Outstanding</p>
                      <p className="font-semibold text-amber-600">{formatCurrency(outstanding)}</p>
                    </div>
                    <div className="w-24">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-semibold text-slate-700">{project.progress_percent}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progressBarColor(project.progress_percent)}`}
                          style={{ width: `${project.progress_percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
