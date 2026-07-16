'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { FolderOpen, FileText, BarChart2, FlaskConical, ShieldCheck, Camera } from 'lucide-react'

const FOLDERS = [
  {
    key:    'drawings',
    label:  'Drawings',
    Icon:   FileText,
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    hover:  'hover:bg-blue-100',
    text:   'text-blue-700',
    badge:  'bg-blue-100 text-blue-700',
  },
  {
    key:    'survey-reports',
    label:  'Survey Reports',
    Icon:   BarChart2,
    bg:     'bg-green-50',
    border: 'border-green-200',
    hover:  'hover:bg-green-100',
    text:   'text-green-700',
    badge:  'bg-green-100 text-green-700',
  },
  {
    key:    'lab-reports',
    label:  'Laboratory Reports',
    Icon:   FlaskConical,
    bg:     'bg-purple-50',
    border: 'border-purple-200',
    hover:  'hover:bg-purple-100',
    text:   'text-purple-700',
    badge:  'bg-purple-100 text-purple-700',
  },
  {
    key:    'contracts-approvals',
    label:  'Contracts & Approvals',
    Icon:   ShieldCheck,
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    hover:  'hover:bg-amber-100',
    text:   'text-amber-700',
    badge:  'bg-amber-100 text-amber-700',
  },
]

export default function DocumentsPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total,  setTotal]  = useState(0)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then((data: { folder: string }[]) => {
        if (!Array.isArray(data)) return
        setTotal(data.length)
        const c: Record<string, number> = {}
        data.forEach(d => { c[d.folder] = (c[d.folder] ?? 0) + 1 })
        setCounts(c)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} file{total !== 1 ? 's' : ''} across all projects
          </p>
        </div>
      </div>

      {/* Folder grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {FOLDERS.map(({ key, label, Icon, bg, border, hover, text, badge }) => {
          const count = counts[key] ?? 0
          return (
            <Link
              key={key}
              href={`/documents/${key}`}
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

        {/* Progress Photo Album — special card */}
        <Link
          href="/documents/photo-album"
          className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 transition-all bg-blue-50 border-blue-200 hover:bg-blue-100 group col-span-1 sm:col-span-2"
        >
          <Camera className="w-14 h-14 text-blue-600 group-hover:scale-110 transition-transform" />
          <div className="text-center">
            <p className="font-bold text-base text-blue-700">Progress Photo Album</p>
            <p className="text-xs text-blue-500 mt-1">Upload site photos → generate professional A4 PDF (4 photos/page)</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
