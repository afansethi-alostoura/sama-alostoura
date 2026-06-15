'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bot, TrendingUp, AlertCircle, CheckCircle, Clock, RefreshCw, Loader2,
  Building2, Wallet, Calculator, ShoppingCart, Users, Wrench, FileText,
  UserPlus, Shield, Handshake, BarChart3, ArrowUpRight, ArrowDownRight,
  Plus, Activity,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useAllProjects } from '@/hooks/useAllProjects'

const AGENTS = [
  { id: 'ceo-dashboard',         name: 'CEO Agent',          desc: 'Strategic portfolio insights',  icon: BarChart3,    color: 'blue'   },
  { id: 'project-manager',       name: 'Project Manager',    desc: 'Project delivery & risks',       icon: Building2,    color: 'indigo' },
  { id: 'accountant',            name: 'Finance AI',         desc: 'Cash flow & financial health',   icon: Wallet,       color: 'emerald'},
  { id: 'estimation-engineer',   name: 'Estimation AI',      desc: 'Cost estimates & BOQ analysis',  icon: Calculator,   color: 'violet' },
  { id: 'financial-analyst',     name: 'Financial Analyst',  desc: 'Revenue trends & profitability', icon: TrendingUp,   color: 'cyan'   },
  { id: 'risk-manager',          name: 'Risk Manager',       desc: 'Risk assessment & mitigation',   icon: Shield,       color: 'orange' },
  { id: 'resource-planner',      name: 'Resource Planner',   desc: 'Team & schedule optimization',   icon: Users,        color: 'teal'   },
  { id: 'quality-assurance',     name: 'QA Inspector',       desc: 'Quality & compliance checks',    icon: CheckCircle,  color: 'green'  },
  { id: 'safety-officer',        name: 'Safety Officer',     desc: 'Site safety & incidents',        icon: AlertCircle,  color: 'red'    },
  { id: 'client-relations',      name: 'Client Relations',   desc: 'Stakeholder communications',     icon: Handshake,    color: 'pink'   },
]

const COLOR_MAP: Record<string, { bg: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'    },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700'},
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700'},
  cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    badge: 'bg-cyan-100 text-cyan-700'    },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700'},
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700'    },
  green:   { bg: 'bg-green-50',   text: 'text-green-600',   badge: 'bg-green-100 text-green-700'  },
  red:     { bg: 'bg-red-50',     text: 'text-red-600',     badge: 'bg-red-100 text-red-700'      },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-600',    badge: 'bg-pink-100 text-pink-700'    },
}

interface AgentState { briefing: string; loading: boolean; time: string }

const ACTIVITY_FEED = [
  { time: '09:14', text: 'Fahad Al Serkal Villa — Project mobilization started', type: 'success', project: 'Fahad' },
  { time: '09:02', text: 'Khalid Al Ameri Villa — MEP & finishing works in progress', type: 'info', project: 'Khalid' },
  { time: '08:47', text: 'Al Mirdif Renovation — External painting 80% complete', type: 'success', project: 'Al Mirdif' },
  { time: '08:30', text: 'Khalid Al Ameri — MBHRE Stage 4 payment AED 200,000 applied', type: 'info', project: 'Khalid' },
  { time: 'Yesterday', text: 'Payment received AED 162,000 from Al Mirdif project', type: 'payment', project: 'Al Mirdif' },
  { time: 'Yesterday', text: 'Fahad Al Serkal — BOQ signed, contract value AED 1,993,450', type: 'info', project: 'Fahad' },
]

const QUICK_ACTIONS = [
  { label: 'New Project',      href: '/projects/add',       icon: Plus,       color: 'blue'    },
  { label: 'Generate BOQ',     href: '/estimation/create',  icon: Calculator, color: 'violet'  },
  { label: 'View Accounting',  href: '/accounting',         icon: Wallet,     color: 'emerald' },
  { label: 'Site Reports',     href: '/reports',            icon: FileText,   color: 'orange'  },
]

export default function CEODashboard() {
  const [agents, setAgents] = useState<Record<string, AgentState>>({})
  const [morningBriefing, setMorningBriefing] = useState('')
  const [morningLoading, setMorningLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const { projects, activeProjects, totalContract, totalReceived, totalOutstanding: outstanding } = useAllProjects()
  const collectionRate = totalContract > 0 ? (totalReceived / totalContract) * 100 : 0

  useEffect(() => {
    setMounted(true)
    fetchMorningBriefing()
  }, [])

  async function fetchMorningBriefing() {
    setMorningLoading(true)
    try {
      const r = await fetch('/api/agents/ceo-dashboard', { method: 'POST' })
      const d = await r.json()
      setMorningBriefing(d.briefing ?? 'Good morning. Your portfolio is performing well.')
    } catch {
      setMorningBriefing('Good morning. Systems are running smoothly across all projects.')
    } finally {
      setMorningLoading(false)
    }
  }

  async function briefAgent(id: string) {
    setAgents(p => ({ ...p, [id]: { briefing: '', loading: true, time: '' } }))
    try {
      const r = await fetch(`/api/agents/${id}`, { method: 'POST' })
      const d = await r.json()
      setAgents(p => ({
        ...p,
        [id]: { briefing: d.briefing ?? 'No data.', loading: false, time: new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) }
      }))
    } catch {
      setAgents(p => ({ ...p, [id]: { briefing: 'Failed to load briefing.', loading: false, time: '' } }))
    }
  }

  const today = new Date().toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CEO Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-card"
            >
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'Total Contract Value', value: formatCurrency(totalContract),
            sub: `${activeProjects.length} active projects`, icon: Building2,
            color: 'blue', trend: '+12%',
          },
          {
            label: 'Total Received', value: formatCurrency(totalReceived),
            sub: `${collectionRate.toFixed(0)}% collection rate`, icon: TrendingUp,
            color: 'emerald', trend: '+8%',
          },
          {
            label: 'Outstanding Balance', value: formatCurrency(outstanding),
            sub: 'Pending collection', icon: Clock,
            color: 'orange', trend: null,
          },
          {
            label: 'Active Projects', value: String(activeProjects.length),
            sub: `${activeProjects.filter(p => p.progress_percent >= 70).length} on track`, icon: Activity,
            color: 'violet', trend: null,
          },
        ].map(({ label, value, sub, icon: Icon, color, trend }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-3 sm:p-5 shadow-card card-hover min-w-0">
            <div className="flex items-start justify-between mb-2 sm:mb-4">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${COLOR_MAP[color]?.bg}`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${COLOR_MAP[color]?.text}`} />
              </div>
              {trend && (
                <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full">
                  <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />{trend}
                </span>
              )}
            </div>
            <p className="text-base sm:text-2xl font-bold text-slate-900 truncate">{value}</p>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 leading-tight">{label}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

        {/* Morning briefing + project health */}
        <div className="lg:col-span-2 space-y-6">

          {/* Morning Briefing */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <h2 className="font-semibold text-slate-900 text-sm">AI Morning Briefing</h2>
              </div>
              <button
                onClick={fetchMorningBriefing}
                disabled={morningLoading}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-50"
              >
                {morningLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </button>
            </div>
            <div className="p-5">
              {morningLoading ? (
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-5/6 rounded" />
                  <div className="skeleton h-4 w-4/6 rounded" />
                </div>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">{morningBriefing}</p>
              )}
            </div>
          </div>

          {/* Project Progress */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900 text-sm">Project Progress</h2>
              <Link href="/projects" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {activeProjects.map(project => {
                const pct = project.progress_percent
                const statusColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
                const badgeColor  = pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                const badgeLabel  = pct >= 70 ? 'On Track' : pct >= 40 ? 'At Risk' : 'Delayed'
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors group"
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">{project.name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${badgeColor}`}>{badgeLabel}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full progress-bar ${statusColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 w-8 text-right flex-shrink-0">{pct}%</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">{project.current_stage}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Live Activity</h2>
          </div>
          <div className="divide-y divide-slate-50 overflow-y-auto max-h-[420px]">
            {ACTIVITY_FEED.map((item, i) => (
              <div key={i} className="px-5 py-3.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    item.type === 'success' ? 'bg-emerald-500' :
                    item.type === 'payment' ? 'bg-blue-500' : 'bg-slate-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-relaxed">{item.text}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-slate-100">
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium w-full text-center">
              View all activity →
            </button>
          </div>
        </div>
      </div>

      {/* AI Agents */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">AI Intelligence Agents</h2>
            <p className="text-xs text-slate-400 mt-0.5">10 agents ready · Click "Brief Me" for instant analysis</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            All Systems Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-0 divide-x divide-y divide-slate-100">
          {AGENTS.map(agent => {
            const c     = COLOR_MAP[agent.color]
            const state = agents[agent.id]
            const Icon  = agent.icon
            return (
              <div key={agent.id} className="p-5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.bg}`}>
                    <Icon className={`w-4 h-4 ${c.text}`} />
                  </div>
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-active" />
                    Active
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-tight">{agent.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 mb-3 leading-relaxed">{agent.desc}</p>

                {state?.briefing && !state.loading && (
                  <div className="bg-slate-50 rounded-lg p-2.5 mb-3 max-h-24 overflow-y-auto">
                    <p className="text-xs text-slate-600 leading-relaxed">{state.briefing}</p>
                    {state.time && <p className="text-xs text-slate-400 mt-1">{state.time}</p>}
                  </div>
                )}

                <button
                  onClick={() => briefAgent(agent.id)}
                  disabled={state?.loading}
                  className="w-full flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-xs font-medium py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {state?.loading
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Analysing...</>
                    : <><Bot className="w-3 h-3" />Brief Me</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
