'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, Search, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useAllProjects, type ProjectRow } from '@/hooks/useAllProjects'

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  }
  const labels: Record<string, string> = {
    active: 'Active', on_hold: 'On Hold', completed: 'Completed', cancelled: 'Cancelled'
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : status === 'on_hold' ? 'bg-amber-500' : status === 'completed' ? 'bg-blue-500' : 'bg-red-500'}`} />
      {labels[status] ?? status}
    </span>
  )
}

export default function ProjectsPage() {
  const { projects: allProjects, loading, activeProjects, completedProjects, totalContract: totalValue } = useAllProjects()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const filtered = allProjects
    .filter(p => filter === 'all' || p.status === filter)
    .filter(p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client_name.toLowerCase().includes(search.toLowerCase())
    )

  const activeCount    = activeProjects.length
  const completedCount = completedProjects.length

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {loading ? 'Loading...' : `${allProjects.length} projects · ${activeCount} active · ${completedCount} completed`}
          </p>
        </div>
        <Link
          href="/projects/add"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-sm flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">New </span>Project
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Portfolio Value', value: formatCurrency(totalValue), color: 'text-blue-600' },
          { label: 'Active Projects',       value: String(activeCount),        color: 'text-emerald-600' },
          { label: 'Completed Projects',    value: String(completedCount),     color: 'text-slate-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 px-3 sm:px-5 py-3 sm:py-4 shadow-card min-w-0">
            <p className="text-xs text-slate-500 font-medium leading-tight">{label}</p>
            <p className={`text-base sm:text-2xl font-bold mt-1 truncate ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects or clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>

          <div className="flex gap-1">
            {['all', 'active', 'on_hold', 'completed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f === 'all' ? 'All' : f === 'on_hold' ? 'On Hold' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table — horizontally scrollable on mobile */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {['Project', 'Client', 'Contract Value', 'Received', 'Progress', 'Status', 'Stage', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 px-3 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-slate-400 text-sm">
                  No projects found
                </td>
              </tr>
            ) : (
              filtered.map(project => {
                const pct  = project.progress_percent
                const barC = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                const outstanding = project.contract_value - project.received_amount
                return (
                  <tr key={project.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {project.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-slate-600">{project.client_name || '—'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(project.contract_value)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <span className="text-sm font-medium text-emerald-600">{formatCurrency(project.received_amount)}</span>
                        {outstanding > 0 && (
                          <p className="text-xs text-slate-400">{formatCurrency(outstanding)} outstanding</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 w-28">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barC}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={project.status} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-slate-500 truncate max-w-[120px] block">{project.current_stage ?? '—'}</span>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
