'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileUp, Plus, Download, Trash2, AlertCircle } from 'lucide-react'
import { BOQ } from '@/types'

export default function EstimationPage() {
  const [boqs, setBoqs] = useState<BOQ[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBOQs()
  }, [])

  async function fetchBOQs() {
    try {
      setLoading(true)
      const res = await fetch('/api/boqs')
      if (!res.ok) throw new Error('Failed to fetch BOQs')
      const data = await res.json()
      setBoqs(data.boqs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BOQs')
    } finally {
      setLoading(false)
    }
  }

  async function deleteBOQ(id: string) {
    if (!confirm('Are you sure you want to delete this BOQ?')) return

    try {
      const res = await fetch(`/api/boqs?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete BOQ')
      setBoqs(boqs.filter(b => b.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete BOQ')
    }
  }

  async function exportPDF(id: string) {
    try {
      const res = await fetch(`/api/boqs/export-pdf?id=${id}`)
      if (!res.ok) throw new Error('Failed to export PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BOQ_${id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    }
  }

  return (
    <div className="ml-64 min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Estimation Engineer</h1>
          <p className="text-slate-600 mt-2">Generate accurate BOQs from architectural drawings using AI</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-8 flex gap-3">
          <Link
            href="/estimation/create"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
          >
            <FileUp className="w-4 h-4" />
            Upload Drawing
          </Link>
          <button
            onClick={fetchBOQs}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-all"
          >
            Refresh
          </button>
        </div>

        {/* BOQs List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="text-slate-600 mt-4">Loading BOQs...</p>
          </div>
        ) : boqs.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <FileUp className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No BOQs yet</h3>
            <p className="text-slate-600 mb-6">Upload an architectural drawing to generate your first BOQ</p>
            <Link
              href="/estimation/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Create BOQ
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Drawing</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Items</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Total (AED)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">Created</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {boqs.map((boq) => (
                  <tr key={boq.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 text-sm text-slate-900">{boq.drawing_filename}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{boq.items.length} items</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      AED {boq.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(boq.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/estimation/${boq.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit BOQ"
                        >
                          <Plus className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => exportPDF(boq.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Export PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteBOQ(boq.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete BOQ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
