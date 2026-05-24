'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, ArrowRight, Loader2, AlertCircle, CheckCircle, Home } from 'lucide-react'
import { BOQItem } from '@/types'

type Step = 'upload' | 'extract' | 'review' | 'complete'

interface ExtractedBOQ {
  boqItems: BOQItem[]
  extractedDimensions: string
  itemCount: number
}

export default function CreateEstimationPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [extractedBOQ, setExtractedBOQ] = useState<ExtractedBOQ | null>(null)

  // Project context fields
  const [projectName, setProjectName] = useState('')
  const [plotSize, setPlotSize] = useState('')
  const [floors, setFloors] = useState('')
  const [rooms, setRooms] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [projectId, setProjectId] = useState('')

  const ALLOWED_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'dwg', 'dxf']
  const MAX_SIZE = 50 * 1024 * 1024 // 50MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError('')

    // Validate file size
    if (selectedFile.size > MAX_SIZE) {
      setError(`File size exceeds ${MAX_SIZE / 1024 / 1024}MB limit`)
      return
    }

    // Validate file type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_TYPES.includes(ext)) {
      setError(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`)
      return
    }

    setFile(selectedFile)
    setSuccess(`File selected: ${selectedFile.name}`)
  }

  async function handleUploadAndExtract() {
    if (!file) {
      setError('Please select a file')
      return
    }

    if (!projectName) {
      setError('Please enter project name')
      return
    }

    try {
      setLoading(true)
      setError('')
      setStep('extract')

      // Step 1: Upload file
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/estimations/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadRes.ok) {
        const data = await uploadRes.json()
        throw new Error(data.error || 'Upload failed')
      }

      const uploadData = await uploadRes.json()
      setSuccess(`File uploaded: ${uploadData.filename}`)

      // Step 2: Extract BOQ using AI
      const filetype = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const extractRes = await fetch('/api/agents/estimation-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: uploadData.filepath,
          filename: uploadData.filename,
          filetype,
          projectId,
          projectName,
          plotSize,
          floors,
          rooms,
          additionalContext
        })
      })

      if (!extractRes.ok) {
        const data = await extractRes.json()
        throw new Error(data.error || 'Extraction failed')
      }

      const boqData = await extractRes.json()
      setExtractedBOQ(boqData)
      setSuccess(`Extracted ${boqData.itemCount} BOQ items`)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process drawing')
      setStep('upload')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveBOQ() {
    if (!extractedBOQ) {
      setError('No BOQ data to save')
      return
    }

    try {
      setLoading(true)
      setError('')

      // Create BOQ
      const boqRes = await fetch('/api/boqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId || 'manual_entry',
          drawing_filename: file?.name || 'drawing',
          extracted_dimensions: extractedBOQ.extractedDimensions,
          items: extractedBOQ.boqItems,
          subtotal: extractedBOQ.boqItems.reduce((sum, item) => sum + item.amount, 0),
          vat: 0,
          total: extractedBOQ.boqItems.reduce((sum, item) => sum + item.amount, 0)
        })
      })

      if (!boqRes.ok) {
        const data = await boqRes.json()
        throw new Error(data.error || 'Save failed')
      }

      const createdBOQ = await boqRes.json()
      setSuccess('BOQ saved successfully!')
      setStep('complete')

      // Redirect to editor after 2 seconds
      setTimeout(() => {
        router.push(`/estimation/${createdBOQ.id}`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save BOQ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ml-64 min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link href="/estimation" className="text-blue-600 hover:text-blue-700">
            <Home className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Create BOQ from Drawing</h1>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-between">
          {(['upload', 'extract', 'review', 'complete'] as const).map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  s === step
                    ? 'bg-blue-600 text-white'
                    : ['upload', 'extract', 'review'].indexOf(s) < ['upload', 'extract', 'review'].indexOf(step)
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {['upload', 'extract', 'review'].indexOf(s) < ['upload', 'extract', 'review'].indexOf(step) ? (
                  '✓'
                ) : (
                  i + 1
                )}
              </div>
              <div className={`flex-1 h-1 mx-2 ${i < 3 ? 'bg-slate-200' : ''}`} />
            </div>
          ))}
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

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-lg border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Step 1: Upload & Project Details</h2>

            {/* File Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-3">Architectural Drawing *</label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-all cursor-pointer">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">
                    {file ? file.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG, DWG, or DXF (max 50MB)</p>
                </label>
              </div>
            </div>

            {/* Project Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Al Mirdif Villa"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Plot Size (sq.m)</label>
                <input
                  type="text"
                  value={plotSize}
                  onChange={(e) => setPlotSize(e.target.value)}
                  placeholder="e.g., 500"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Floors</label>
                <input
                  type="text"
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  placeholder="e.g., G+2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Number of Rooms</label>
                <input
                  type="text"
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  placeholder="e.g., 6"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Additional Context</label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Any special requirements or notes..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Action Button */}
            <div className="flex gap-3">
              <button
                onClick={handleUploadAndExtract}
                disabled={loading || !file || !projectName}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload & Extract
                  </>
                )}
              </button>
              <Link
                href="/estimation"
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-all"
              >
                Cancel
              </Link>
            </div>
          </div>
        )}

        {/* Step 2 & 3: Extract & Review */}
        {(step === 'extract' || step === 'review') && (
          <div className="bg-white rounded-lg border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {step === 'extract' ? 'Step 2: Extracting BOQ...' : 'Step 3: Review BOQ Items'}
            </h2>

            {step === 'extract' && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-slate-600">Analyzing drawing and extracting BOQ items...</p>
              </div>
            )}

            {step === 'review' && extractedBOQ && (
              <div>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>{extractedBOQ.itemCount}</strong> BOQ items extracted. Review the summary below, then proceed to edit in detail.
                  </p>
                </div>

                {/* Items Summary Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-900">Section</th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-900">Description</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-900">Qty</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-900">Rate</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-900">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {extractedBOQ.boqItems.slice(0, 10).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600">{item.section}</td>
                          <td className="px-4 py-2 text-slate-900">{item.description}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{item.quantity}</td>
                          <td className="px-4 py-2 text-right text-slate-600">AED {item.unitRate}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900">AED {item.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {extractedBOQ.boqItems.length > 10 && (
                    <p className="text-sm text-slate-600 mt-3">
                      ... and {extractedBOQ.boqItems.length - 10} more items
                    </p>
                  )}
                </div>

                {/* Totals */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-semibold text-slate-900">
                      AED {extractedBOQ.boqItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveBOQ}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-medium transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Save & Continue
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setStep('upload')
                      setExtractedBOQ(null)
                    }}
                    className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg font-medium transition-all"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="bg-white rounded-lg border border-slate-200 p-8">
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">BOQ Created Successfully!</h2>
              <p className="text-slate-600 mb-6">Redirecting to editor...</p>
              <Link
                href="/estimation"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                View BOQs
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
