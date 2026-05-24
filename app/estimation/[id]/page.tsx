'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Save, Download, Plus, Trash2, Home, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { BOQ, BOQItem } from '@/types'
import { groupBySection } from '@/lib/boq-store'

export default function EditBOQPage() {
  const params = useParams()
  const boqId = params?.id as string

  const [boq, setBoq] = useState<BOQ | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!boqId) return
    fetchBOQ()
  }, [boqId])

  async function fetchBOQ() {
    if (!boqId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/boqs?id=${boqId}`)
      if (!res.ok) throw new Error('Failed to fetch BOQ')
      const data = await res.json()
      setBoq(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BOQ')
    } finally {
      setLoading(false)
    }
  }

  async function updateItem(itemId: string, updates: Partial<BOQItem>) {
    if (!boq) return

    try {
      setSaving(true)
      const res = await fetch('/api/boqs/items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boqId,
          itemId,
          updates
        })
      })

      if (!res.ok) throw new Error('Failed to update item')

      const updated = await res.json()
      setBoq(updated)
      setEditingItemId(null)
      setSuccess('Item updated')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Delete this item?')) return
    if (!boq) return

    try {
      setSaving(true)
      const res = await fetch(`/api/boqs/items?boqId=${boqId}&itemId=${itemId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete item')

      const updated = await res.json()
      setBoq(updated)
      setSuccess('Item deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    } finally {
      setSaving(false)
    }
  }

  async function addNewItem() {
    if (!boq) return

    const newItem: Omit<BOQItem, 'id' | 'amount'> = {
      itemNo: Math.max(...boq.items.map(i => i.itemNo), 0) + 1,
      section: 'Other',
      description: 'New Item',
      quantity: 1,
      unit: 'L.S',
      unitRate: 0
    }

    try {
      setSaving(true)
      const res = await fetch('/api/boqs/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boqId,
          item: newItem
        })
      })

      if (!res.ok) throw new Error('Failed to add item')

      const updated = await res.json()
      setBoq(updated)
      setSuccess('New item added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  async function exportPDF() {
    try {
      const res = await fetch(`/api/boqs/export-pdf?id=${boqId}`)
      if (!res.ok) throw new Error('Failed to export PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BOQ_${boqId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    }
  }

  if (loading) {
    return (
      <div className="ml-64 min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading BOQ...</p>
        </div>
      </div>
    )
  }

  if (!boq) {
    return (
      <div className="ml-64 min-h-screen bg-slate-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">BOQ not found</p>
              <Link href="/estimation" className="text-red-700 hover:text-red-900 text-sm mt-2 inline-block">
                Back to estimations
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const grouped = groupBySection(boq.items)
  const sections = Object.keys(grouped).sort()

  return (
    <div className="ml-64 min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/estimation" className="text-blue-600 hover:text-blue-700">
                <Home className="w-5 h-5" />
              </Link>
              <h1 className="text-3xl font-bold text-slate-900">BOQ Editor</h1>
            </div>
            <p className="text-slate-600">{boq.drawing_filename}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={addNewItem}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* BOQ Items by Section */}
        {sections.map((section) => (
          <div key={section} className="mb-8 bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Section Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">{section}</h2>
              <p className="text-sm text-slate-600 mt-1">
                {grouped[section].length} items • Subtotal: AED{' '}
                {grouped[section].reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
              </p>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Item</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Description</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Qty</th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-900">Unit</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Rate (AED)</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Amount (AED)</th>
                    <th className="px-6 py-3 text-right font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {grouped[section].map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-all">
                      <td className="px-6 py-4 text-slate-600">{item.itemNo}</td>
                      <td className="px-6 py-4 text-slate-900">
                        {editingItemId === item.id ? (
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const updated = boq.items.map(i =>
                                i.id === item.id ? { ...i, description: e.target.value } : i
                              )
                              setBoq({ ...boq, items: updated })
                            }}
                            onBlur={() => updateItem(item.id, { description: item.description })}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') updateItem(item.id, { description: item.description })
                            }}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-300 rounded focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingItemId(item.id)}
                            className="text-left hover:text-blue-600 cursor-pointer"
                          >
                            {item.description}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value)
                            const updated = boq.items.map(i =>
                              i.id === item.id
                                ? { ...i, quantity: qty, amount: qty * i.unitRate }
                                : i
                            )
                            setBoq({ ...boq, items: updated })
                          }}
                          onBlur={() => updateItem(item.id, { quantity: item.quantity })}
                          className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-600">{item.unit}</td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          value={item.unitRate}
                          onChange={(e) => {
                            const rate = Number(e.target.value)
                            const updated = boq.items.map(i =>
                              i.id === item.id
                                ? { ...i, unitRate: rate, amount: i.quantity * rate }
                                : i
                            )
                            setBoq({ ...boq, items: updated })
                          }}
                          onBlur={() => updateItem(item.id, { unitRate: item.unitRate })}
                          className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        {item.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={saving}
                          className="text-red-600 hover:text-red-700 disabled:text-slate-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex justify-end items-end">
            <div className="w-64">
              <div className="flex justify-between text-sm text-slate-600 mb-2">
                <span>Subtotal:</span>
                <span>AED {boq.subtotal.toFixed(2)}</span>
              </div>
              {boq.vat && boq.vat > 0 && (
                <div className="flex justify-between text-sm text-slate-600 mb-3 pb-3 border-b">
                  <span>VAT (5%):</span>
                  <span>AED {boq.vat.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-slate-900">
                <span>Total:</span>
                <span>AED {boq.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
