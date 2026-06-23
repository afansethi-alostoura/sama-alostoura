'use client'
import { useEffect, useRef, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot, Send, Loader2, ArrowLeft, HardHat, Building2, Wallet, Calculator,
  TrendingUp, Shield, Users, CheckCircle, AlertCircle, Handshake, BarChart3,
  Copy, CheckCheck, RefreshCw,
} from 'lucide-react'
import { useAllProjects } from '@/hooks/useAllProjects'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Agent config ──────────────────────────────────────────────────────────────
const AGENT_CONFIG: Record<string, { name: string; desc: string; icon: any; color: string; bg: string; border: string }> = {
  'construction-ops':   { name: 'Construction Ops Engineer', desc: 'Senior 25yr ops engineer — sequence · risks · next actions', icon: HardHat,      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  'project-manager':    { name: 'Project Manager',           desc: 'Project delivery, risks & MBHRE payments',                   icon: Building2,    color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200'},
  'ceo-dashboard':      { name: 'CEO Agent',                 desc: 'Strategic portfolio insights',                               icon: BarChart3,    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200'  },
  'accountant':         { name: 'Finance AI',                desc: 'Cash flow & financial health',                               icon: Wallet,       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200'},
  'financial-analyst':  { name: 'Financial Analyst',         desc: 'Revenue trends & profitability',                             icon: TrendingUp,   color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200'  },
  'risk-manager':       { name: 'Risk Manager',              desc: 'Risk assessment & mitigation',                               icon: Shield,       color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200'},
  'resource-planner':   { name: 'Resource Planner',          desc: 'Team & schedule optimization',                               icon: Users,        color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200'  },
  'estimation-engineer':{ name: 'Estimation AI',             desc: 'Cost estimates & BOQ analysis',                              icon: Calculator,   color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200'},
  'quality-assurance':  { name: 'QA Inspector',              desc: 'Quality & compliance checks',                                icon: CheckCircle,  color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200' },
  'safety-officer':     { name: 'Safety Officer',            desc: 'Site safety & incidents',                                    icon: AlertCircle,  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200'   },
  'client-relations':   { name: 'Client Relations',          desc: 'Stakeholder communications',                                 icon: Handshake,    color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200'  },
}

interface Message { role: 'user' | 'assistant'; content: string; time?: string }

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm text-slate-800 space-y-2 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 mt-3 mb-1 border-b border-slate-200 pb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 mt-2 mb-0.5">{children}</h3>,
          p:  ({ children }) => <p className="text-sm text-slate-700 leading-relaxed mb-1">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 pl-1 mb-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 pl-1 mb-1">{children}</ol>,
          li: ({ children }) => <li className="text-sm text-slate-700 leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
          code: ({ children }) => <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-300 pl-3 py-0.5 bg-blue-50 rounded-r text-slate-600 italic text-xs my-1">{children}</blockquote>,
          hr: () => <hr className="border-slate-200 my-2" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-slate-200">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-50">{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-slate-600">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default function AgentChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const config  = AGENT_CONFIG[id] ?? { name: id, desc: '', icon: Bot, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' }
  const Icon    = config.icon

  const { projects } = useAllProjects()
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [briefing,  setBriefing]  = useState(false)
  const [copied,    setCopied]    = useState<number | null>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Load initial briefing when projects are ready
  useEffect(() => {
    if (projects.length > 0 && messages.length === 0 && !briefing) {
      loadBriefing()
    }
  }, [projects])

  async function loadBriefing() {
    setBriefing(true)
    setLoading(true)
    try {
      const res  = await fetch(`/api/agents/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects }),
      })
      const data = await res.json()
      const text = data.briefing ?? 'Ready to assist. Ask me anything about your projects.'
      setMessages([{ role: 'assistant', content: text, time: now() }])
    } catch {
      setMessages([{ role: 'assistant', content: 'Ready to assist. Ask me anything about your projects.', time: now() }])
    } finally {
      setLoading(false)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: text, time: now() }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      const res  = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: id,
          projects,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'No response.', time: now() }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.', time: now() }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function copyMsg(idx: number, content: string) {
    navigator.clipboard.writeText(content)
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
  }

  function now() {
    return new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">{config.name}</p>
          <p className="text-xs text-slate-400 truncate">{config.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            {projects.filter(p => p.status === 'active').length} projects
          </span>
          <button
            onClick={() => { setMessages([]); setBriefing(false); setTimeout(loadBriefing, 100) }}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            title="New conversation"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${config.bg}`}>
              <Icon className={`w-8 h-8 ${config.color}`} />
            </div>
            <div>
              <p className="font-bold text-slate-800">{config.name}</p>
              <p className="text-sm text-slate-400 mt-1">{config.desc}</p>
            </div>
            <p className="text-xs text-slate-400">Loading project data…</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

            {/* Avatar */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? config.bg : 'bg-blue-600'}`}>
              {msg.role === 'assistant'
                ? <Icon className={`w-4 h-4 ${config.color}`} />
                : <span className="text-xs font-bold text-white">ME</span>}
            </div>

            {/* Bubble */}
            <div className={`group relative max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              <div className={`px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : `bg-white border ${config.border} text-slate-800 rounded-tl-sm shadow-sm`
              }`}>
                {msg.role === 'assistant'
                  ? <MarkdownMessage content={msg.content} />
                  : <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {msg.time && <span className="text-[10px] text-slate-400">{msg.time}</span>}
                {msg.role === 'assistant' && (
                  <button onClick={() => copyMsg(i, msg.content)} className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                    {copied === i ? <CheckCheck className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copied === i ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${config.bg}`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className={`px-4 py-3 rounded-2xl rounded-tl-sm bg-white border ${config.border} shadow-sm`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Suggested questions (shown before first user message) ─────────── */}
      {messages.length === 1 && !loading && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0">
          {getSuggestions(id).map((q, i) => (
            <button
              key={i}
              onClick={() => { setInput(q); inputRef.current?.focus() }}
              className="text-xs whitespace-nowrap bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-full transition-colors flex-shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white border-t border-slate-200 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Ask ${config.name}…`}
            disabled={loading}
            className="flex-1 resize-none px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as any}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

function getSuggestions(id: string): string[] {
  const map: Record<string, string[]> = {
    'construction-ops':    ['What should we do on site today?', 'Which project is most at risk of delay?', 'What inspections are needed this week?', 'Which works unlock the next payment?'],
    'project-manager':     ['What is blocking progress on each project?', 'Which project needs attention most urgently?', 'When can we submit the next MBHRE claim?'],
    'ceo-dashboard':       ['What is the overall portfolio health?', 'Which project has the best cash flow?', 'What should I focus on this week?'],
    'accountant':          ['What is our total outstanding amount?', 'Which invoices are overdue?', 'What is our cash flow this month?'],
    'financial-analyst':   ['What is our collection rate across projects?', 'Which project is most profitable?', 'Show me revenue trends'],
    'risk-manager':        ['What are the highest risks right now?', 'Which project is most likely to be delayed?', 'What are the top cost overrun risks?'],
    'resource-planner':    ['How should we allocate our team this week?', 'Are there any schedule conflicts?', 'Which project needs more manpower?'],
    'estimation-engineer': ['What is the estimated cost for MEP works?', 'How do I price finishing works in Dubai?', 'What is a typical rate for blockwork per m²?'],
    'quality-assurance':   ['What quality checks are needed before concrete pour?', 'What are the Dubai Municipality requirements for finishes?', 'What tests are required for MEP?'],
    'safety-officer':      ['What safety measures are needed for excavation?', 'What PPE is required on site?', 'What are the UAE labour law requirements?'],
    'client-relations':    ['Draft a project update for my client', 'How do I handle a client complaint?', 'Write a payment reminder message'],
  }
  return map[id] ?? ['Tell me about the current project status', 'What should we prioritize?', 'What are the main risks?']
}
