'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, BarChart2, FlaskConical, ShieldCheck, FolderOpen } from 'lucide-react'

interface DocRecord {
  id: string
  folder: string
}

const FOLDERS = [
  {
    key:   'drawings',
    label: 'Drawings',
    Icon:  FileText,
    bg:    'bg-blue-50',
    border:'border-blue-200',
    hover: 'hover:bg-blue-100',
    text:  'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    key:   'survey-reports',
    label: 'Survey Reports',
    Icon:  BarChart2,
    bg:    'bg-green-50',
    border:'border-green-200',
    hover: 'hover:bg-green-100',
    text:  'text-green-700',
    badge: 'bg-green-100 text-green-700',
  },
  {
    key:   'lab-reports',
    label: 'Laboratory Reports',
    Icon:  FlaskConical,
    bg:    'bg-purple-50',
    border:'border-purple-200',
    hover: 'hover:bg-purple-100',
    text:  'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
  },
  {
    key:   'contracts-approvals',
    label: 'Contracts & Approvals',
    Icon:  ShieldCheck,
    bg:    'bg-amber-50',
    border:'border-amber-200',
    hover: 'hover:bg-amber-100',
    text:  'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
  },
]

export default function ProjectDocumentsPage() {
  const { id } = useParams() as { id: string }
  const [docs, setDocs] = useState<DocRecord[]>([])

  useEffect(() => {
    fetch(`/api/projects/${id}/documents`)
      .then(r => r.json())
      .then(data => setDocs(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [id])

  const countFor = (folder: string) => docs.filter(d => d.folder === folder).length

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Project
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">{docs.length} file{docs.length !== 1 ? 's' : ''} across all folders</p>
        </div>
      </div>

      {/* Folder grid */}
      <div className="grid grid-cols-2 gap-5">
        {FOLDERS.map(({ key, label, Icon, bg, border, hover, text, badge }) => {
          const count = countFor(key)
          return (
            <Link
              key={key}
              href={`/projects/${id}/documents/${key}`}
              className={`flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all ${bg} ${border} ${hover} group`}
            >
              <Icon className={`w-14 h-14 ${text} group-hover:scale-110 transition-transform`} />
              <div className="text-center">
                <p className={`font-bold text-base ${text}`}>{label}</p>
                <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${badge}`}>
                  {count} file{count !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
