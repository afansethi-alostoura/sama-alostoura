'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CreateEstimationPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [plotSize, setPlotSize] = useState('')
  const [floors, setFloors] = useState('')
  const [rooms, setRooms] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'dwg', 'dxf']
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
      if (!fileExt || !validExtensions.includes(fileExt)) {
        setError('Invalid file type. Allowed: PDF, JPG, PNG, DWG, DXF')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !projectId) {
      setError('Please select a file and enter a project ID')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/estimations/upload', {
        method: 'POST',
        body: formData,
      })

      let uploadData: any
      try {
        uploadData = await uploadRes.json()
      } catch (e) {
        const text = await uploadRes.text()
        throw new Error(`Invalid response from upload: ${text.substring(0, 100)}`)
      }

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed')
      }

      const extractRes = await fetch('/api/agents/estimation-engineer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filepath: uploadData.filepath,
          filename: uploadData.filename,
          filetype: uploadData.type,
          projectId,
          projectName: projectName || 'Untitled Project',
          plotSize: plotSize || 'Unknown',
          floors: floors || 'Unknown',
          rooms: rooms || 'Unknown',
          additionalContext: additionalContext || 'None',
        }),
      })

      if (!extractRes.ok) {
        const data = await extractRes.json()
        throw new Error(data.error || 'Extraction failed')
      }

      const extractData = await extractRes.json()

      const boqRes = await fetch('/api/boqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          drawing_filename: file.name,
          extracted_dimensions: extractData.extractedDimensions,
          items: extractData.boqItems,
        }),
      })

      if (!boqRes.ok) {
        throw new Error('Failed to save BOQ')
      }

      const boq = await boqRes.json()
      router.push(`/estimation/${boq.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/estimation"
          className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Estimations
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">New Estimation</h1>
          <p className="text-slate-600 mb-8">Upload an architectural drawing and we will extract dimensions to generate your BOQ</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Project ID (Required)
              </label>
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g., PROJ-2025-001"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Villa Development"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Plot Size (m2)
                </label>
                <input
                  type="text"
                  value={plotSize}
                  onChange={(e) => setPlotSize(e.target.value)}
                  placeholder="e.g., 500"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Floors
                </label>
                <input
                  type="text"
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  placeholder="e.g., 2"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rooms
                </label>
                <input
                  type="text"
                  value={rooms}
                  onChange={(e) => setRooms(e.target.value)}
                  placeholder="e.g., 6"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                className="hidden"
                disabled={loading}
              />
              {file ? (
                <div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="font-medium text-slate-900">{file.name}</p>
                  <p className="text-sm text-slate-600 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700 underline"
                    disabled={loading}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="font-medium text-slate-900 mb-1">Upload architectural drawing</p>
                  <p className="text-sm text-slate-600 mb-4">PDF, JPG, PNG, DWG, or DXF files</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors inline-block"
                    disabled={loading}
                  >
                    Select File
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Link
                href="/estimation"
                className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-lg transition-colors text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || !file || !projectId}
                className="flex-1 px-6 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Generate BOQ'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
