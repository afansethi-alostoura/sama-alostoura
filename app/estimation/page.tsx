'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Download, Trash2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface BOQListItem {
  id: string
  projectId: string
  drawing_filename: string
  items: any[]
  subtotal: number
  total: number
  createdAt: string
}

export default function EstimationPage() {
  const router = useRouter()
  const [boqs, setBoqs] = useState<BOQListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchBOQs()
  }, [])

  async function fetchBOQs() {
    try {
      const res = await fetch('/api/boqs')
      const data = await res.json()
      setBoqs(data.boqs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BOQs')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(boqId: string) {
    if (!confirm('Delete this BOQ? This cannot be undone.')) return

    setDeleting(boqId)
    try {
      const res = await fetch(`/api/boqs?id=${boqId}`, { method: 'DELETE' })
      if (res.ok) {
        setBoqs(boqs.filter(b => b.id !== boqId))
      } else {
        alert('Failed to delete BOQ')
      }
    } catch (err) {
      alert('Error deleting BOQ: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDeleting(null)
    }
  }

  async function handleExport(boqId: string) {
    try {
      const res = await fetch(`/api/boqs/export-pdf?id=${boqId}`)
      if (res.ok) {
        const html = await res.text()
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(html)
          printWindow.document.close()
          printWindow.print()
        }
      } else {
        alert('Failed to export BOQ')
      }
    } catch (err) {
      alert('Error exporting: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading estimations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Estimation Engineer</h1>
          <p className="text-slate-600">Create and manage Bills of Quantities from architectural drawings</p>
        </div>

        <div className="mb-6">
          <Link
            href="/estimation/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Estimation
          </Link>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-900 font-medium">Error</p>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {boqs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No estimations yet</h3>
            <p className="text-slate-600 mb-6">Create your first BOQ by uploading an architectural drawing</p>
            <Link
              href="/estimation/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Estimation
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {boqs.map((boq) => (
              <div key={boq.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{boq.drawing_filename}</h3>
                      <p className="text-sm text-slate-600">
                        {boq.items.length} items • Project: {boq.projectId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">AED {boq.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-xs text-slate-600">Subtotal: AED {boq.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mb-4">
                    Created {new Date(boq.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/estimation/${boq.id}`)}
                      className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleExport(boq.id)}
                      className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={() => handleDelete(boq.id)}
                      disabled={deleting === boq.id}
                      className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting === boq.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
