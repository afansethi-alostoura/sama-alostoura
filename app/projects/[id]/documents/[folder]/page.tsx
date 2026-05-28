'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Upload, Loader2, ExternalLink, Trash2,
  FileText, BarChart2, FlaskConical, ShieldCheck,
} from 'lucide-react'

interface DocRecord {
  id: string
  project_id: string
  folder: string
  original_name: string
  file_size: number
  mime_type: string
  public_url: string
  created_at: string
}

const FOLDER_META: Record<string, { label: string; Icon: React.ElementType; color: string; text: string; bg: string }> = {
  'drawings':             { label: 'Drawings',              Icon: FileText,    color: 'blue',   text: 'text-blue-700',   bg: 'bg-blue-50'   },
  'survey-reports':       { label: 'Survey Reports',        Icon: BarChart2,   color: 'green',  text: 'text-green-700',  bg: 'bg-green-50'  },
  'lab-reports':          { label: 'Laboratory Reports',    Icon: FlaskConical,color: 'purple', text: 'text-purple-700', bg: 'bg-purple-50' },
  'contracts-approvals':  { label: 'Contracts & Approvals', Icon: ShieldCheck, color: 'amber',  text: 'text-amber-700',  bg: 'bg-amber-50'  },
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

export default function FolderPage() {
  const { id, folder } = useParams() as { id: string; folder: string }
  const meta = FOLDER_META[folder] ?? { label: folder, Icon: FileText, text: 'text-slate-700', bg: 'bg-slate-50' }
  const { Icon } = meta

  const [docs,      setDocs]      = useState<DocRecord[]>([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/projects/${id}/documents`)
      .then(r => r.json())
      .then((data: DocRecord[]) => setDocs(data.filter(d => d.folder === folder)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, folder])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const res = await fetch(`/api/projects/${id}/documents`, { method: 'POST', body: fd })
      if (res.ok) {
        const doc = await res.json()
        setDocs(prev => [doc, ...prev])
      }
    } catch {}
    finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(docId: string) {
    await fetch(`/api/projects/${id}/documents?docId=${docId}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== docId))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between">
        {/* Left: breadcrumb */}
        <div className="flex items-center gap-3">
          <Link
            href={`/projects/${id}/documents`}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.bg}`}>
            <Icon className={`w-5 h-5 ${meta.text}`} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">{meta.label}</h1>
            <p className="text-xs text-slate-400">{docs.length} file{docs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Right: Upload button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx,.dwg,.dxf"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
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

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Icon className="w-20 h-20 mb-6 opacity-15" />
            <p className="text-lg font-semibold text-slate-500">No files yet</p>
            <p className="text-sm mt-1">Click <strong>Upload</strong> in the top-right corner to add files</p>
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
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
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
                    onClick={() => handleDelete(doc.id)}
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
