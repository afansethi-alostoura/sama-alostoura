'use client'
export const dynamic = 'force-dynamic'

import React, { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, FileText, Loader2, CheckCircle2,
  AlertCircle, Building2, X, Zap, Wrench, Map, MessageSquare,
  Send, HardHat, RefreshCw, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type CategoryKey = 'architectural' | 'structural' | 'mep' | 'site'
type Phase = 'upload' | 'chat'

interface LocalFile {
  id:       string
  file:     File
  category: CategoryKey
  status:   'pending' | 'uploading' | 'done' | 'error'
  progress: number
  path?:    string   // Supabase storage path after upload
  errorMsg?: string
}

interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES  = 50  * 1024 * 1024  // 50 MB per file
const MAX_TOTAL_BYTES = 200 * 1024 * 1024  // 200 MB total

const CATEGORIES: {
  key: CategoryKey; label: string; sublabel: string
  Icon: React.ElementType; bg: string; border: string; accent: string
}[] = [
  { key:'architectural', label:'Architectural', sublabel:'Floor plans, elevations, sections',
    Icon:Building2, bg:'bg-blue-50',   border:'border-blue-200',   accent:'text-blue-600'  },
  { key:'structural',    label:'Structural',    sublabel:'Foundation, columns, slabs',
    Icon:Wrench,    bg:'bg-slate-50',  border:'border-slate-200',  accent:'text-slate-600' },
  { key:'mep',           label:'MEP / Drainage', sublabel:'Electrical, plumbing, AC',
    Icon:Zap,       bg:'bg-amber-50',  border:'border-amber-200',  accent:'text-amber-600' },
  { key:'site',          label:'Site Plan',     sublabel:'Plot boundary, compound wall',
    Icon:Map,       bg:'bg-green-50',  border:'border-green-200',  accent:'text-green-600' },
]

const SUGGESTIONS = [
  'How many M³ concrete for the ground floor slab?',
  'What is the total M² of external block walls?',
  'What is the total M² for plastering all internal walls?',
  'How many M² of tiles for all bathroom floors and walls?',
  'What is the excavation volume in M³?',
  'How many doors on each floor?',
  'What is the compound wall length in R.M?',
  'What is the total built floor area in M²?',
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) }

function fmtBytes(b: number) {
  return b < 1024 * 1024
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`
}

async function compressImage(file: File): Promise<File> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['jpg','jpeg','png','webp'].includes(ext)) return file
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 2000
      let { width, height } = img
      if (width <= MAX && height <= MAX && file.size < 3 * 1024 * 1024) { resolve(file); return }
      if (width > height) { height = Math.round(height * MAX / width); width = MAX }
      else                { width  = Math.round(width * MAX / height); height = MAX }
      const c = document.createElement('canvas')
      c.width = width; c.height = height
      c.getContext('2d')!.drawImage(img, 0, 0, width, height)
      c.toBlob(blob => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.88)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DrawingChatPage() {
  const [phase,    setPhase]    = useState<Phase>('upload')
  const [files,    setFiles]    = useState<LocalFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [globalError, setGlobalError] = useState('')

  // Chat state
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [input,       setInput]       = useState('')
  const [thinking,    setThinking]    = useState(false)
  const [chatError,   setChatError]   = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement>>>({})

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // ── File selection ──────────────────────────────────────────────────────────
  function addFiles(newFiles: File[], category: CategoryKey) {
    setGlobalError('')
    const totalCurrent = files.reduce((s, f) => s + f.file.size, 0)
    let runningTotal = totalCurrent

    const toAdd: LocalFile[] = []
    for (const f of newFiles) {
      if (f.size > MAX_FILE_BYTES) {
        setGlobalError(`"${f.name}" exceeds 50 MB limit — skipped.`)
        continue
      }
      if (runningTotal + f.size > MAX_TOTAL_BYTES) {
        setGlobalError('Total upload limit of 200 MB reached.')
        break
      }
      const existing = files.find(x => x.file.name === f.name && x.category === category)
      if (existing) continue
      runningTotal += f.size
      toAdd.push({ id: uid(), file: f, category, status: 'pending', progress: 0 })
    }
    setFiles(prev => [...prev, ...toAdd])
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // ── Upload all pending files to Supabase ────────────────────────────────────
  async function uploadAllFiles() {
    const pending = files.filter(f => f.status === 'pending')
    if (!pending.length) {
      // All already uploaded — go to chat
      setPhase('chat')
      return
    }

    setUploading(true)
    setGlobalError('')

    for (const lf of pending) {
      // Mark as uploading
      setFiles(prev => prev.map(f => f.id === lf.id ? { ...f, status: 'uploading', progress: 0 } : f))

      try {
        // Compress images before upload
        const fileToUpload = await compressImage(lf.file)

        // Get signed upload URL from server
        const urlRes = await fetch('/api/estimations/signed-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: fileToUpload.name,
            contentType: fileToUpload.type || 'application/octet-stream',
          }),
        })

        if (!urlRes.ok) {
          const err = await urlRes.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || `Server error ${urlRes.status}`)
        }

        const { signedUrl, token, path } = await urlRes.json()

        // Upload directly to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('estimation-drawings')
          .uploadToSignedUrl(path, token, fileToUpload, {
            contentType: fileToUpload.type || 'application/octet-stream',
            upsert: true,
          })

        if (uploadError) throw new Error(uploadError.message)

        setFiles(prev => prev.map(f =>
          f.id === lf.id ? { ...f, status: 'done', progress: 100, path } : f
        ))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        setFiles(prev => prev.map(f =>
          f.id === lf.id ? { ...f, status: 'error', errorMsg: msg } : f
        ))
      }
    }

    setUploading(false)

    // Check if we have at least one successful upload
    setFiles(prev => {
      const hasDone = prev.some(f => f.status === 'done')
      if (hasDone) setPhase('chat')
      return prev
    })
  }

  // ── Send chat message ───────────────────────────────────────────────────────
  async function sendMessage(text?: string) {
    const question = (text ?? input).trim()
    if (!question || thinking) return

    setInput('')
    setChatError('')

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages(newMessages)
    setThinking(true)

    try {
      const uploadedFiles = files
        .filter(f => f.status === 'done' && f.path)
        .map(f => ({ path: f.path!, name: f.file.name, category: f.category }))

      const res = await fetch('/api/agents/drawing-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: uploadedFiles, messages: newMessages }),
      })

      let data: { answer?: string; error?: string }
      try { data = await res.json() } catch { throw new Error(`Server error (${res.status})`) }
      if (!res.ok || !data.answer) throw new Error(data.error || 'No answer received')

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer! }])
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setThinking(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Upload Phase UI ─────────────────────────────────────────────────────────
  if (phase === 'upload') {
    const totalFiles = files.length
    const doneCnt    = files.filter(f => f.status === 'done').length
    const errorCnt   = files.filter(f => f.status === 'error').length

    return (
      <div className="min-h-screen bg-slate-50">

        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center gap-4">
          <Link href="/estimation"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <MessageSquare className="w-5 h-5 text-emerald-500" />
          <h1 className="text-lg font-bold text-slate-900">Drawing Analysis Chat</h1>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">

          {/* Hero */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Upload Drawings → Ask Quantity Questions</h2>
                <p className="text-emerald-100 text-sm mt-1 leading-relaxed">
                  Upload your architectural, structural, MEP and site drawings. Then chat with the
                  Civil Engineer AI — ask &ldquo;How many M³ concrete for the ground floor slab?&rdquo;
                  and get answers with exact quantities and drawing references.
                </p>
                <p className="text-emerald-200 text-xs mt-2">
                  You fill in the BOQ manually based on the answers · Supports PDF, JPG, PNG
                </p>
              </div>
            </div>
          </div>

          {/* Global error */}
          {globalError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{globalError}</p>
            </div>
          )}

          {/* Category upload zones */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
              Upload Drawings
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {CATEGORIES.map(cat => {
                const catFiles = files.filter(f => f.category === cat.key)
                return (
                  <div key={cat.key} className={`${cat.bg} border-2 ${cat.border} rounded-2xl p-4`}>
                    <div className="flex items-center gap-3 mb-3">
                      <cat.Icon className={`w-5 h-5 ${cat.accent}`} />
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{cat.label}</p>
                        <p className="text-xs text-slate-500">{cat.sublabel}</p>
                      </div>
                    </div>

                    {/* File list */}
                    {catFiles.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {catFiles.map(lf => (
                          <div key={lf.id} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2">
                            {lf.status === 'done'      && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                            {lf.status === 'uploading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                            {lf.status === 'error'     && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                            {lf.status === 'pending'   && <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{lf.file.name}</p>
                              {lf.status === 'error' && (
                                <p className="text-xs text-red-500 truncate">{lf.errorMsg}</p>
                              )}
                              {lf.status !== 'error' && (
                                <p className="text-xs text-slate-400">{fmtBytes(lf.file.size)}</p>
                              )}
                            </div>
                            {lf.status !== 'uploading' && (
                              <button onClick={() => removeFile(lf.id)}
                                className="p-0.5 text-slate-300 hover:text-slate-600 transition-colors flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add files button */}
                    <input
                      ref={el => { if (el) inputRefs.current[cat.key] = el }}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={e => {
                        const picked = Array.from(e.target.files || [])
                        addFiles(picked, cat.key)
                        e.target.value = ''
                      }}
                    />
                    <button
                      onClick={() => inputRefs.current[cat.key]?.click()}
                      disabled={uploading}
                      className="w-full py-2 border-2 border-dashed border-current rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors hover:opacity-80 disabled:opacity-40"
                      style={{ color: 'inherit' }}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {catFiles.length === 0 ? `Add ${cat.label} Drawings` : 'Add More'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status summary */}
          {totalFiles > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {totalFiles} file{totalFiles !== 1 ? 's' : ''} selected
                  {doneCnt > 0 && <span className="text-emerald-600"> · {doneCnt} uploaded</span>}
                  {errorCnt > 0 && <span className="text-red-600"> · {errorCnt} failed</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {files.reduce((s, f) => s + f.file.size, 0) > 0
                    ? `Total: ${fmtBytes(files.reduce((s, f) => s + f.file.size, 0))}`
                    : ''}
                </p>
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
                </div>
              )}
            </div>
          )}

          {/* Start Chat button */}
          <button
            onClick={uploadAllFiles}
            disabled={uploading || totalFiles === 0}
            className="w-full py-4 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm text-base"
          >
            {uploading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Uploading drawings…</>
              : doneCnt > 0
                ? <><MessageSquare className="w-5 h-5" /> Open Chat ({doneCnt} uploaded)<ChevronRight className="w-5 h-5" /></>
                : <><Upload className="w-5 h-5" /> Upload &amp; Start Chat</>
            }
          </button>

          <p className="text-center text-xs text-slate-400">
            Supports PDF, JPG, PNG up to 50 MB per file · 200 MB total · Drawings are read by Claude Vision
          </p>
        </div>
      </div>
    )
  }

  // ── Chat Phase UI ───────────────────────────────────────────────────────────
  const uploadedFiles = files.filter(f => f.status === 'done' && f.path)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => setPhase('upload')}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
          <HardHat className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm leading-tight">Civil Engineer AI</p>
          <p className="text-xs text-slate-400 truncate">
            {uploadedFiles.length} drawing{uploadedFiles.length !== 1 ? 's' : ''} loaded ·
            Ask quantity questions below
          </p>
        </div>
        <button
          onClick={() => { setPhase('upload'); setMessages([]) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> New Session
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: file list ─────────────────────────────────────── */}
        <aside className="hidden sm:flex flex-col w-56 bg-white border-r border-slate-200 flex-shrink-0">
          <div className="p-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Uploaded Drawings</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {CATEGORIES.map(cat => {
              const catFiles = uploadedFiles.filter(f => f.category === cat.key)
              if (!catFiles.length) return null
              return (
                <div key={cat.key} className="mb-3">
                  <p className={`text-xs font-bold mb-1 flex items-center gap-1 ${cat.accent}`}>
                    <cat.Icon className="w-3 h-3" /> {cat.label}
                  </p>
                  {catFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-50">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <p className="text-xs text-slate-600 truncate">{f.file.name}</p>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="p-3 border-t border-slate-100">
            <button
              onClick={() => setPhase('upload')}
              className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" /> Add More Drawings
            </button>
          </div>
        </aside>

        {/* ── Main chat area ──────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Message history */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">

            {/* Welcome / empty state */}
            {messages.length === 0 && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <HardHat className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Civil Engineer AI ready</p>
                      <p className="text-xs text-slate-500">
                        {uploadedFiles.length} drawing{uploadedFiles.length !== 1 ? 's' : ''} loaded
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    I have reviewed your uploaded drawings. Ask me any quantity or dimension question
                    and I&apos;ll give you specific answers with references to the drawings.
                    Use the answers to fill in your BOQ.
                  </p>
                </div>

                {/* Suggestion chips */}
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Common Questions
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left p-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl text-xs text-slate-700 transition-all leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                    <HardHat className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {thinking && (
              <div className="flex justify-start">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 mr-2">
                  <HardHat className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-xs text-slate-400 ml-1">Reading drawings…</span>
                  </div>
                </div>
              </div>
            )}

            {/* Chat error */}
            {chatError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 max-w-2xl mx-auto">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 text-sm">{chatError}</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 flex-shrink-0">
            <div className="max-w-3xl mx-auto flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={thinking}
                rows={1}
                placeholder="Ask a quantity question, e.g. How many M³ concrete for the raft foundation?"
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none
                  focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60
                  max-h-36 overflow-y-auto"
                style={{ minHeight: '42px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 144)}px`
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={thinking || !input.trim()}
                className="w-10 h-10 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed
                  text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                {thinking
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              Press Enter to send · Shift+Enter for new line · Answers include drawing references and calculations
            </p>
          </div>

        </main>
      </div>
    </div>
  )
}
