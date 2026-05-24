import Link from 'next/link'
import {
  Building2, TrendingUp, Wallet, AlertCircle, ArrowRight,
  CheckCircle2, Clock, PauseCircle,
} from 'lucide-react'
import { DEMO_PROJECTS } from '@/lib/demo-data'
import { formatCurrency, progressBarColor, statusBadge, statusLabel } from '@/lib/utils'
import { CeoBriefing } from '@/components/dashboard/ceo-briefing'

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
      <p className="text-slate-500 text-sm font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const projects       = DEMO_PROJECTS
  const active         = projects.filter(p => p.status === 'active')
  const totalContract  = projects.reduce((s, p) => s + p.contract_value, 0)
  const totalReceived  = projects.reduce((s, p) => s + p.received_amount, 0)
  const totalOutstanding = projects
    .filter(p => p.status === 'active')
    .reduce((s, p) => s + (p.contract_value - p.received_amount), 0)

  const today = new Date().toLocaleDateString('en-AE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-slate-500 text-sm">{today}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5">Good morning</h1>
        <p className="text-slate-600 text-sm mt-1">Sama Alostoura Building Contracting LLC — Dubai, UAE</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Projects"
          value={String(active.length)}
          sub={`${projects.length} total`}
          color="text-slate-900"
        />
        <StatCard
          label="Total Contract Value"
          value={formatCurrency(totalContract)}
          sub="All projects"
          color="text-slate-900"
        />
        <StatCard
          label="Total Received"
          value={formatCurrency(totalReceived)}
          sub={`${Math.round((totalReceived / totalContract) * 100)}% collected`}
          color="text-emerald-600"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totalOutstanding)}
          sub="Active projects only"
          color="text-amber-600"
        />
      </div>

      {/* CEO AI Briefing */}
      <CeoBriefing projects={projects} />

      {/* Projects Grid */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Active Projects</h2>
          <Link href="/projects" className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {projects.map(project => {
            const outstanding = project.contract_value - project.received_amount
            const retention   = project.received_amount * 0.1

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5 text-brand-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                            {project.name} Villa
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${statusBadge(project.status)}`}>
                            {statusLabel(project.status)}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${statusBadge(project.type)}`}>
                            {statusLabel(project.type)}
                          </span>
                        </div>
                        <p className="text-slate-500 text-sm mt-0.5">{project.location}</p>
                        {project.current_stage && (
                          <p className="text-slate-600 text-xs mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {project.current_stage}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-900 font-semibold">{formatCurrency(project.contract_value)}</p>
                      <p className="text-slate-500 text-xs mt-0.5">Contract value</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500">Progress</span>
                      <span className="font-semibold text-slate-700">{project.progress_percent}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressBarColor(project.progress_percent)}`}
                        style={{ width: `${project.progress_percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Row */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 rounded-lg px-3 py-2">
                      <p className="text-emerald-700 font-semibold text-sm">{formatCurrency(project.received_amount)}</p>
                      <p className="text-emerald-600 text-xs">Received</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg px-3 py-2">
                      <p className="text-amber-700 font-semibold text-sm">{formatCurrency(outstanding)}</p>
                      <p className="text-amber-600 text-xs">Outstanding</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-slate-700 font-semibold text-sm">{formatCurrency(retention)}</p>
                      <p className="text-slate-500 text-xs">Retention (10%)</p>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
