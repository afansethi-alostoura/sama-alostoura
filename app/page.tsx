'use client'
import { useEffect, useState } from 'react'
import { Bot, TrendingUp, AlertCircle, CheckCircle, Clock, RefreshCw, Loader2 } from 'lucide-react'
import { DEMO_PROJECTS } from '@/lib/demo-data'
import type { QBSnapshot } from '@/lib/quickbooks/types'

interface ExecutiveStats {
  totalContractValue: number
  totalReceived: number
  outstandingBalance: number
  activeProjectsCount: number
  pipelineValue: number
  receivedPercentage: number
}

const AGENTS = [
  { id: 'ceo-dashboard', name: 'CEO Dashboard', description: 'Strategic insights & portfolio overview', icon: '📊', color: 'blue' },
  { id: 'project-manager', name: 'Project Manager', description: 'Project status & delivery risks', icon: '📋', color: 'amber' },
  { id: 'accountant', name: 'Accountant', description: 'Financial health & cash flow analysis', icon: '💰', color: 'emerald' },
  { id: 'estimation-engineer', name: 'Estimation Engineer', description: 'Cost estimates & BOQ analysis', icon: '📐', color: 'purple' },
  { id: 'financial-analyst', name: 'Financial Analyst', description: 'Revenue trends & profitability', icon: '📈', color: 'green' },
  { id: 'risk-manager', name: 'Risk Manager', description: 'Risk assessment & mitigation', icon: '⚠️', color: 'red' },
  { id: 'resource-planner', name: 'Resource Planner', description: 'Team utilization & scheduling', icon: '👥', color: 'cyan' },
  { id: 'quality-assurance', name: 'Quality Assurance', description: 'Quality standards & compliance', icon: '✓', color: 'indigo' },
  { id: 'safety-officer', name: 'Safety Officer', description: 'Safety protocols & incidents', icon: '🛡️', color: 'yellow' },
  { id: 'client-relations', name: 'Client Relations', description: 'Stakeholder communications', icon: '🤝', color: 'pink' },
]

interface AgentBriefing {
  agentId: string
  briefing: string
  timestamp: string
  loading: boolean
}

export default function CEODashboard() {
  const [stats, setStats] = useState<ExecutiveStats | null>(null)
  const [snapshot, setSnapshot] = useState<QBSnapshot | null>(null)
  const [briefings, setBriefings] = useState<Record<string, AgentBriefing>>({})
  const [ceoMorningBriefing, setCEOMorningBriefing] = useState<string>('')
  const [loadingMorning, setLoadingMorning] = useState(true)

  // Load financial data on mount
  useEffect(() => {
    const activeProjects = DEMO_PROJECTS.filter(p => p.status === 'active')
    const totalContractValue = activeProjects.reduce((sum, p) => sum + p.contract_value, 0)
    const totalReceived = activeProjects.reduce((sum, p) => sum + p.received_amount, 0)
    const outstandingBalance = totalContractValue - totalReceived
    const receivedPercentage = totalContractValue > 0 ? (totalReceived / totalContractValue) * 100 : 0

    setStats({
      totalContractValue,
      totalReceived,
      outstandingBalance,
      activeProjectsCount: activeProjects.length,
      pipelineValue: DEMO_PROJECTS.filter(p => p.status === 'pipeline').reduce((sum, p) => sum + p.contract_value, 0),
      receivedPercentage,
    })

    // Load CEO morning briefing
    loadMorningBriefing()
  }, [])

  const loadMorningBriefing = async () => {
    setLoadingMorning(true)
    try {
      const res = await fetch('/api/agents/ceo-dashboard', { method: 'POST' })
      const data = await res.json()
      setCEOMorningBriefing(data.briefing || 'Good morning, CEO. All systems operational.')
    } catch (error) {
      console.error('Failed to load CEO briefing:', error)
      setCEOMorningBriefing('Unable to load briefing. Please refresh.')
    } finally {
      setLoadingMorning(false)
    }
  }

  const loadAgentBriefing = async (agentId: string) => {
    setBriefings(prev => ({
      ...prev,
      [agentId]: { agentId, briefing: '', timestamp: '', loading: true }
    }))

    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: 'POST' })
      const data = await res.json()

      setBriefings(prev => ({
        ...prev,
        [agentId]: {
          agentId,
          briefing: data.briefing || 'No briefing available.',
          timestamp: new Date().toLocaleTimeString('en-AE'),
          loading: false
        }
      }))
    } catch (error) {
      console.error(`Failed to load ${agentId} briefing:`, error)
      setBriefings(prev => ({
        ...prev,
        [agentId]: {
          agentId,
          briefing: 'Unable to load briefing. Please try again.',
          timestamp: '',
          loading: false
        }
      }))
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      maximumFractionDigits: 0,
    }).format(value)
  }

  const onTrackProjects = DEMO_PROJECTS.filter(p => p.status === 'active' && p.progress_percent >= 80).length
  const atRiskProjects = DEMO_PROJECTS.filter(p => p.status === 'active' && p.progress_percent < 50).length
  const behindSchedule = DEMO_PROJECTS.filter(p => p.status === 'active' && p.current_stage === 'Mobilization').length

  const urgentItems = [
    ...DEMO_PROJECTS.filter(p => p.progress_percent < 30).map(p => ({
      type: 'behind-schedule',
      title: `${p.name} - Behind Schedule`,
      description: `Project is ${p.progress_percent}% complete`,
      severity: 'critical'
    }))
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-amber-500/30 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white">Sama Alostoura AI OS</h1>
            <p className="text-slate-400 mt-2">Executive Intelligence Dashboard</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">{new Date().toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <p className="text-xs text-amber-500 mt-1">Production Environment</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Morning Briefing */}
        <div className="border-2 border-amber-500 bg-slate-800/50 rounded-lg p-8 backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-amber-400">Executive Morning Briefing</h2>
            <button
              onClick={loadMorningBriefing}
              disabled={loadingMorning}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loadingMorning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loadingMorning ? 'Analysing...' : 'Refresh'}
            </button>
          </div>
          <div className="prose prose-invert max-w-none">
            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{ceoMorningBriefing}</p>
          </div>
        </div>

        {/* Executive Summary KPIs */}
        {stats && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Financial Summary</h2>
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-slate-800 border-l-4 border-amber-500 rounded-lg p-6 hover:bg-slate-750 transition">
                <p className="text-slate-400 text-sm font-medium">Total Contract Value</p>
                <p className="text-3xl font-bold text-white mt-2">{formatCurrency(stats.totalContractValue)}</p>
                <p className="text-xs text-slate-500 mt-2">{stats.activeProjectsCount} active projects</p>
              </div>

              <div className="bg-slate-800 border-l-4 border-emerald-500 rounded-lg p-6 hover:bg-slate-750 transition">
                <p className="text-slate-400 text-sm font-medium">Total Received</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{formatCurrency(stats.totalReceived)}</p>
                <p className="text-xs text-slate-500 mt-2">{Math.round(stats.receivedPercentage)}% collected</p>
              </div>

              <div className="bg-slate-800 border-l-4 border-amber-600 rounded-lg p-6 hover:bg-slate-750 transition">
                <p className="text-slate-400 text-sm font-medium">Outstanding Balance</p>
                <p className="text-3xl font-bold text-amber-400 mt-2">{formatCurrency(stats.outstandingBalance)}</p>
                <p className="text-xs text-slate-500 mt-2">Pending collection</p>
              </div>

              <div className="bg-slate-800 border-l-4 border-blue-500 rounded-lg p-6 hover:bg-slate-750 transition">
                <p className="text-slate-400 text-sm font-medium">Active Projects</p>
                <p className="text-3xl font-bold text-blue-400 mt-2">{stats.activeProjectsCount}</p>
                <p className="text-xs text-slate-500 mt-2">In progress</p>
              </div>

              <div className="bg-slate-800 border-l-4 border-purple-500 rounded-lg p-6 hover:bg-slate-750 transition">
                <p className="text-slate-400 text-sm font-medium">Pipeline Value</p>
                <p className="text-3xl font-bold text-purple-400 mt-2">{formatCurrency(stats.pipelineValue)}</p>
                <p className="text-xs text-slate-500 mt-2">Future contracts</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Agents Grid */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">AI Intelligence Agents</h2>
          <div className="grid grid-cols-2 gap-6">
            {AGENTS.map(agent => (
              <div key={agent.id} className="bg-slate-800 border border-slate-700 hover:border-amber-500 rounded-lg p-6 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-3xl mb-2">{agent.icon}</div>
                    <h3 className="text-lg font-bold text-white">{agent.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{agent.description}</p>
                  </div>
                </div>

                {briefings[agent.id]?.briefing && (
                  <div className="bg-slate-900 rounded p-4 mb-4 max-h-48 overflow-y-auto">
                    <p className="text-sm text-slate-200">{briefings[agent.id].briefing}</p>
                    <p className="text-xs text-slate-500 mt-2">Last updated: {briefings[agent.id].timestamp}</p>
                  </div>
                )}

                <button
                  onClick={() => loadAgentBriefing(agent.id)}
                  disabled={briefings[agent.id]?.loading}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {briefings[agent.id]?.loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analysing...
                    </>
                  ) : (
                    <>
                      <Bot className="w-4 h-4" />
                      Brief Me
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Project Health Overview */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Project Health Overview</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <h3 className="text-lg font-bold text-emerald-400">On Track</h3>
              </div>
              <p className="text-3xl font-bold text-emerald-400">{onTrackProjects}</p>
              <p className="text-sm text-slate-400 mt-2">Projects meeting deadlines</p>
            </div>

            <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-6 h-6 text-amber-500" />
                <h3 className="text-lg font-bold text-amber-400">At Risk</h3>
              </div>
              <p className="text-3xl font-bold text-amber-400">{atRiskProjects}</p>
              <p className="text-sm text-slate-400 mt-2">Projects needing attention</p>
            </div>

            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
                <h3 className="text-lg font-bold text-red-400">Behind Schedule</h3>
              </div>
              <p className="text-3xl font-bold text-red-400">{behindSchedule}</p>
              <p className="text-sm text-slate-400 mt-2">Immediate action required</p>
            </div>
          </div>
        </div>

        {/* Urgent Action Items */}
        {urgentItems.length > 0 && (
          <div className="bg-red-900/20 border-l-4 border-red-600 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h2 className="text-xl font-bold text-red-400">Urgent Action Items</h2>
            </div>
            <div className="space-y-3">
              {urgentItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-800/50 p-4 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-grow">
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-slate-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-4">
          <a href="/projects" className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 rounded-lg text-center transition-all">
            → View Projects
          </a>
          <a href="/accounting" className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-medium py-3 rounded-lg text-center transition-all">
            → View Accounting
          </a>
          <a href="/estimation" className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-medium py-3 rounded-lg text-center transition-all">
            → Create Estimation
          </a>
        </div>
      </div>
    </div>
  )
}
