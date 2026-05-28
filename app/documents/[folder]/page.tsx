'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, Loader2, ExternalLink, Trash2,
  FileText, BarChart2, FlaskConical, ShieldCheck, ChevronDown,
} from 'lucide-react'

interface DocRecord {
  id: string
  project_id: string
  project_name: string
  folder: string
  original_name: string
  file_size: number
  mime_type: string
  public_url: string
  created_at: string
}

interface Project {
  id: string
  name: string
  status: string
}

const FOLDER_META: Record<string, {
  label: string
  Icon: React.ElementType
  text: string
  bg: string
}> = {
  'drawings':            { label: 'Drawings',              Icon: FileText,    text: 'text-blue-700',   bg: 'bg-blue-50'   },
  'survey-reports':      { label: 'Survey Reports',        Icon: BarChart2,   text: 'text-green-700',  bg: 'bg-green-50'  },
  'lab-reports':         { label: 'Laboratory Reports',    Icon: FlaskConical,text: 'text-purple-700', bg: 'bg-purple-50' },
  'contracts-approvals': { label: 'Contracts & Approvals', Icon: ShieldCheck, text: 'text-amber-700',  bg: 'bg-amber-50'  },
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function fileEmoji(mime: string) {
  if (mime.includes('pdf'))   return '📄'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('word'))  return '📝'
  return '📎'
}

export default function GlobalFolderPage() {
  const { folder } = useParams() as { folder: string }
  const meta = FOLDER_META[folder] ?? { label: folder, Icon: FileText, text: 'text-slate-700', bg: 'bg-slate-50' }
  const { Icon } = meta

  const [docs,     setDocs]     = useState<DocRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [projects, setProjects] = useState<Project[]>([])

  // Upload modal
  const [showModal,          setShowModal]          = useState(false)
  const [selectedProjectId,  setSelectedProjectId]  = useState('')
  const [uploading,          setUploading]          = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/documents?folder=${folder}`)
      .then(r => r.json())
      .then(data => setDocs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) =>
        setProjects(Array.isArray(data) ? data.filter(p => p.status !== 'completed') : [])
      )
      .catch(() => {})
  }, [folder])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedProjectId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const res = await fetch(`/api/projects/${selectedProjectId}/documents`, {
        method: 'POST',
        body: fd,
      })
      if (res.ok) {
        const doc = await res.json()
        const proj = projects.find(p => p.id === selectedProjectId)
        setDocs(prev => [{ ...doc, project_name: proj?.name ?? 'Unknown Project' }, ...prev])
      }
    } catch {}
    finally {
      setUploading(false)
      setShowModal(false)
      setSelectedProjectId('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(docId: string, projectId: string) {
    await fetch(`/api/projects/${projectId}/documents?docId=${docId}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.bg}`}>
            <Icon className={`w-5 h-5 ${meta.text}`} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">{meta.label}</h1>
            <p className="text-xs text-slate-400">
              {docs.length} file{docs.length !== 1 ? 's' : ''} across all projects
            </p>
          </div>
        </div>

        <div>
          {/* Hidden file input — opened after project is selected */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx,.dwg,.dxf"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => setShowModal(true)}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><Upload className="w-4 h-4" /> Upload</>
            }
          </button>
        </div>
      </div>

      {/* ── Upload modal ────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setSelectedProjectId('') } }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Upload Document</h2>
            <p className="text-sm text-slate-500 mb-5">
              Which project is this document for?
            </p>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Project
            </label>
            <div className="relative mb-6">
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select a project —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowModal(false); setSelectedProjectId('') }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (selectedProjectId) fileInputRef.current?.click() }}
                disabled={!selectedProjectId}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-xl transition-colors"
              >
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── File list ───────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Icon className="w-20 h-20 mb-6 opacity-15" />
            <p className="text-lg font-semibold text-slate-500">No files yet</p>
            <p className="text-sm mt-1">Click <strong>Upload</strong> to add the first file</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map(doc => (
              <div
                key={doc.id}
                className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all group"
              >
                <span className="text-3xl flex-shrink-0">{fileEmoji(doc.mime_type)}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{doc.original_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Project badge */}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {doc.project_name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <a
                    href={doc.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id, doc.project_id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-8">
          Supported: PDF, images, Excel, Word, DWG — max 50 MB per file
        </p>
      </div>
    </div>
  )
}
