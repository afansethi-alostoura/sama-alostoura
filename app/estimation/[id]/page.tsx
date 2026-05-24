'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Edit2, Save, Trash2, Plus, Download, ArrowLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface BOQItem {
  id: string
  itemNo: number
  section: string
  description: string
  quantity: number
  unit: string
  unitRate: number
  amount: number
  notes?: string
}

interface BOQ {
  id: string
  projectId: string
  drawing_filename: string
  items: BOQItem[]
  subtotal: number
  vat: number
  total: number
}

export default function BOQEditorPage() {
  const router = useRouter()
  const params = useParams()
  const boqId = params.id as string
  
  const [boq, setBOQ] = useState<BOQ | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    fetchBOQ()
  }, [boqId])

  async function fetchBOQ() {
    try {
      const res = await fetch(`/api/boqs?id=${boqId}`)
      const data = await res.json()
      setBOQ(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load BOQ')
    } finally {
      setLoading(false)
    }
  }

  async function saveBOQ() {
    if (!boq) return
    setSaving(true)
    try {
      const res = await fetch('/api/boqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boq),
      })
      if (!res.ok) throw new Error('Failed to save')
      alert('BOQ saved successfully')
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(itemId: string, section: 'quantity' | 'unitRate' | 'description', value: string | number) {
    setEditingCell(`${itemId}-${section}`)
    setEditValue(String(value))
  }

  function finishEdit(itemId: string, section: string) {
    if (!boq) return
    const item = boq.items.find(i => i.id === itemId)
    if (!item) return

    let newValue: any = editValue
    if (section === 'quantity' || section === 'unitRate') {
      newValue = parseFloat(editValue) || 0
      if (section === 'quantity') item.quantity = newValue
      if (section === 'unitRate') item.unitRate = newValue
      item.amount = item.quantity * item.unitRate
    } else if (section === 'description') {
      item.description = editValue
    }

    const subtotal = boq.items.reduce((sum, i) => sum + i.amount, 0)
    const vat = subtotal * 0.05
    const total = subtotal + vat

    setBOQ({
      ...boq,
      subtotal,
      vat,
      total,
    })
    setEditingCell(null)
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Delete this item?')) return
    if (!boq) return

    const updatedItems = boq.items.filter(i => i.id !== itemId)
    const subtotal = updatedItems.reduce((sum, i) => sum + i.amount, 0)
    const vat = subtotal * 0.05
    const total = subtotal + vat

    setBOQ({
      ...boq,
      items: updatedItems,
      subtotal,
      vat,
      total,
    })
  }

  async function handleExport() {
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
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading BOQ...</p>
        </div>
      </div>
    )
  }

  if (!boq) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/estimation" className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">BOQ not found</p>
          </div>
        </div>
      </div>
    )
  }

  const sections = [...new Set(boq.items.map(i => i.section))]

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/estimation" className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{boq.drawing_filename}</h1>
              <p className="text-slate-600">{boq.items.length} items</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleExport} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg">
                Export PDF
              </button>
              <button onClick={saveBOQ} disabled={saving} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg">
                {saving ? 'Saving' : 'Save'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="px-4 py-3 text-left font-semibold">No.</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-left font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">Delete</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(section => (
                  <>
                    <tr key={`section-${section}`} className="bg-slate-50 border-b border-slate-200">
                      <td colSpan={7} className="px-4 py-3 font-semibold">{section}</td>
                    </tr>
                    {boq.items.filter(i => i.section === section).map(item => (
                      <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="px-4 py-3">{item.itemNo}</td>
                        <td className="px-4 py-3">
                          {editingCell === `${item.id}-description` ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => finishEdit(item.id, 'description')}
                              className="w-full px-2 py-1 border border-slate-300 rounded"
                            />
                          ) : (
                            <span onClick={() => startEdit(item.id, 'description', item.description)} className="cursor-pointer hover:text-brand-600">
                              {item.description}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingCell === `${item.id}-quantity` ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => finishEdit(item.id, 'quantity')}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-right"
                            />
                          ) : (
                            <span onClick={() => startEdit(item.id, 'quantity', item.quantity)} className="cursor-pointer hover:text-brand-600">
                              {item.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{item.unit}</td>
                        <td className="px-4 py-3 text-right">
                          {editingCell === `${item.id}-unitRate` ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => finishEdit(item.id, 'unitRate')}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                            />
                          ) : (
                            <span onClick={() => startEdit(item.id, 'unitRate', item.unitRate)} className="cursor-pointer hover:text-brand-600">
                              {item.unitRate.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => deleteItem(item.id)} className="text-red-600 hover:bg-red-100 p-1 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end gap-8 border-t pt-6">
            <div className="text-right">
              <p className="text-slate-600 text-sm">Subtotal</p>
              <p className="text-xl font-bold">AED {boq.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-600 text-sm">VAT (5%)</p>
              <p className="text-xl font-bold">AED {boq.vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right min-w-48">
              <p className="text-slate-600 text-sm">Total</p>
              <p className="text-3xl font-bold text-brand-600">AED {boq.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}