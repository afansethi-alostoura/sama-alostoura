'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Camera, Download, ImagePlus, Loader2, Star,
  Trash2, GripVertical, ChevronUp, ChevronDown, X,
} from 'lucide-react'

interface Project {
  id: string
  name: string
  client_name: string
  location: string
  status: string
  progress_percent: number
  current_stage: string
  start_date: string
  expected_completion: string
  contract_value: number
}

interface Photo {
  id:        string
  file:      File
  preview:   string   // object URL
  caption:   string
  isCover:   boolean
}

// ─── PDF generator (lazy-import jsPDF to keep SSR safe) ──────────────────────

async function generateAlbumPDF(project: Project, photos: Photo[]) {
  const { jsPDF } = await import('jspdf')

  const PAGE_W  = 210   // A4 mm
  const PAGE_H  = 297
  const MARGIN  = 12
  const CONTENT_W = PAGE_W - MARGIN * 2

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Helper: load image as base64 ─────────────────────────────────────────
  function toBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload  = () => res(reader.result as string)
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
  }

  // ── Helper: fit image into a box (contain, centred) ──────────────────────
  function fitBox(imgW: number, imgH: number, boxW: number, boxH: number) {
    const scale = Math.min(boxW / imgW, boxH / imgH)
    const w = imgW * scale
    const h = imgH * scale
    return { w, h, x: (boxW - w) / 2, y: (boxH - h) / 2 }
  }

  // ── Helper: add header band ───────────────────────────────────────────────
  function addHeader(pageNum: number, total: number) {
    // Thin accent bar
    doc.setFillColor(30, 64, 175)   // blue-800
    doc.rect(0, 0, PAGE_W, 4, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(30, 64, 175)
    doc.text('SAMA ALOSTOURA', MARGIN, 11)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)  // slate-500
    doc.text(`${project.name} — Progress Photo Album`, MARGIN + 44, 11)
    doc.text(`Page ${pageNum} / ${total}`, PAGE_W - MARGIN, 11, { align: 'right' })

    // Divider
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, 14, PAGE_W - MARGIN, 14)
  }

  // ── Helper: add footer band ───────────────────────────────────────────────
  function addFooter() {
    const y = PAGE_H - 8
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, y, PAGE_W - MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)  // slate-400
    const now = new Date().toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.text(`Generated on ${now}`, MARGIN, PAGE_H - 4)
    doc.text('CONFIDENTIAL', PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' })
  }

  // Pre-load all images as base64
  const base64List: string[] = []
  for (const p of photos) {
    base64List.push(await toBase64(p.file))
  }

  // Separate cover from rest
  const coverIdx  = photos.findIndex(p => p.isCover)
  const coverB64  = coverIdx >= 0 ? base64List[coverIdx] : null
  const restPhotos = photos.filter((_, i) => i !== coverIdx)
  const restB64    = base64List.filter((_, i) => i !== coverIdx)

  // Total pages: 1 cover + ceil(rest / 4)
  const photoPagesCount = Math.ceil(restPhotos.length / 4)
  const totalPages      = 1 + photoPagesCount

  // ────────────────────────────────────────────────────────────────────────────
  // PAGE 1 — COVER
  // ────────────────────────────────────────────────────────────────────────────

  // Top accent block
  doc.setFillColor(15, 23, 42)   // slate-900
  doc.rect(0, 0, PAGE_W, 55, 'F')
  doc.setFillColor(30, 64, 175)  // blue-800
  doc.rect(0, 52, PAGE_W, 3, 'F')

  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(148, 163, 184)
  doc.text('SAMA ALOSTOURA', MARGIN, 14)
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('AI Construction OS', MARGIN, 20)

  // Report label
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('PROGRESS PHOTO ALBUM', MARGIN, 35)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('Site Documentation Report', MARGIN, 43)

  // Project details block (below dark header)
  const detailsY = 60
  const fmt = (label: string, val: string | number, x: number, y: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.text(label.toUpperCase(), x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(String(val), x, y + 5)
  }

  fmt('Project', project.name,          MARGIN,           detailsY)
  fmt('Client',  project.client_name,   MARGIN,           detailsY + 14)
  fmt('Location', project.location,     MARGIN + 95,      detailsY)
  fmt('Status',  project.status.replace('_',' ').toUpperCase(), MARGIN + 95, detailsY + 14)
  fmt('Progress', `${project.progress_percent}%`, MARGIN,  detailsY + 28)
  fmt('Stage',   project.current_stage, MARGIN + 95,      detailsY + 28)

  const sd = project.start_date        ? new Date(project.start_date).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) : '—'
  const ed = project.expected_completion ? new Date(project.expected_completion).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }) : '—'
  fmt('Start Date', sd, MARGIN,          detailsY + 42)
  fmt('Expected Completion', ed, MARGIN + 95, detailsY + 42)

  // Divider
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, detailsY + 58, PAGE_W - MARGIN, detailsY + 58)

  // Cover photo
  if (coverB64) {
    const img = new Image()
    img.src = coverB64
    await new Promise(r => { img.onload = r; img.onerror = r })
    const boxX = MARGIN
    const boxY = detailsY + 63
    const boxW = CONTENT_W
    const boxH = 145
    const { w, h, x: ox, y: oy } = fitBox(img.naturalWidth, img.naturalHeight, boxW, boxH)
    doc.addImage(coverB64, 'JPEG', boxX + ox, boxY + oy, w, h)

    // Photo border
    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.3)
    doc.rect(boxX, boxY, boxW, boxH)

    // "COVER PHOTO" label
    doc.setFillColor(30, 64, 175)
    doc.roundedRect(boxX + 3, boxY + 3, 28, 7, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text('COVER PHOTO', boxX + 5, boxY + 7.5)
  } else {
    // Placeholder
    const boxY = detailsY + 63
    doc.setFillColor(241, 245, 249)
    doc.rect(MARGIN, boxY, CONTENT_W, 145, 'F')
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('No cover photo selected', PAGE_W / 2, boxY + 72.5, { align: 'center' })
  }

  addFooter()

  // ────────────────────────────────────────────────────────────────────────────
  // PHOTO PAGES — 4 per page (2 × 2 grid)
  // ────────────────────────────────────────────────────────────────────────────

  const HEADER_H   = 18   // header band height
  const FOOTER_H   = 12   // footer band height
  const GRID_TOP   = HEADER_H + 4
  const GRID_BOTTOM = PAGE_H - FOOTER_H - 2
  const GRID_H      = GRID_BOTTOM - GRID_TOP
  const GAP         = 5   // mm between photos
  const CAPTION_H   = 8   // mm reserved below each photo for caption
  const CELL_W      = (CONTENT_W - GAP) / 2
  const CELL_H      = (GRID_H    - GAP) / 2
  const PHOTO_H     = CELL_H - CAPTION_H

  for (let pageIdx = 0; pageIdx < photoPagesCount; pageIdx++) {
    doc.addPage()
    addHeader(pageIdx + 2, totalPages)
    addFooter()

    const slice = restPhotos.slice(pageIdx * 4, pageIdx * 4 + 4)

    for (let i = 0; i < slice.length; i++) {
      const col  = i % 2
      const row  = Math.floor(i / 2)
      const cellX = MARGIN + col * (CELL_W + GAP)
      const cellY = GRID_TOP + row * (CELL_H + GAP)

      // Cell background
      doc.setFillColor(248, 250, 252)
      doc.rect(cellX, cellY, CELL_W, CELL_H, 'F')
      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.25)
      doc.rect(cellX, cellY, CELL_W, CELL_H)

      // Photo
      const b64 = restB64[pageIdx * 4 + i]
      if (b64) {
        const img = new Image()
        img.src = b64
        await new Promise(r => { img.onload = r; img.onerror = r })
        const { w, h, x: ox, y: oy } = fitBox(img.naturalWidth, img.naturalHeight, CELL_W, PHOTO_H)
        doc.addImage(b64, 'JPEG', cellX + ox, cellY + oy, w, h)
      }

      // Caption area
      const capY = cellY + PHOTO_H + 1
      if (slice[i].caption) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(51, 65, 85)   // slate-700
        // Truncate if too long
        const cap = doc.splitTextToSize(slice[i].caption, CELL_W - 4)
        doc.text(cap[0], cellX + 2, capY + 4)
      }

      // Photo number badge
      const num  = pageIdx * 4 + i + 1
      doc.setFillColor(30, 64, 175)
      doc.roundedRect(cellX + CELL_W - 10, cellY + 1, 9, 6, 1, 1, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.5)
      doc.setTextColor(255, 255, 255)
      doc.text(String(num), cellX + CELL_W - 5.5, cellY + 4.7, { align: 'center' })
    }
  }

  const filename = `${project.name.replace(/\s+/g, '_')}_Progress_Photos.pdf`
  doc.save(filename)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhotoAlbumPage() {
  const [projects,       setProjects]       = useState<Project[]>([])
  const [selectedId,     setSelectedId]     = useState('')
  const [photos,         setPhotos]         = useState<Photo[]>([])
  const [generating,     setGenerating]     = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [dragOver,       setDragOver]       = useState(false)
  const fileRef   = useRef<HTMLInputElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)
  const dragItem  = useRef<number | null>(null)
  const dragOver_ = useRef<number | null>(null)

  const project = projects.find(p => p.id === selectedId) ?? null

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => {
        const active = data.sort((a, b) => a.name.localeCompare(b.name))
        setProjects(active)
        if (active.length > 0) setSelectedId(active[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingProjects(false))
  }, [])

  // Clean up object URLs on unmount
  useEffect(() => () => { photos.forEach(p => URL.revokeObjectURL(p.preview)) }, [photos])

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    setPhotos(prev => {
      const isFirst = prev.length === 0
      return [
        ...prev,
        ...arr.map((f, i) => ({
          id:      `${Date.now()}_${i}`,
          file:    f,
          preview: URL.createObjectURL(f),
          caption: '',
          isCover: isFirst && i === 0,
        })),
      ]
    })
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const next = prev.filter(p => p.id !== id)
      // If removed photo was cover and there's still photos, assign first as cover
      if (prev.find(p => p.id === id)?.isCover && next.length > 0 && !next.some(p => p.isCover)) {
        next[0] = { ...next[0], isCover: true }
      }
      return next
    })
  }

  const setCover = (id: string) => {
    setPhotos(prev => prev.map(p => ({ ...p, isCover: p.id === id })))
  }

  const updateCaption = (id: string, caption: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p))
  }

  const movePhoto = (id: string, dir: -1 | 1) => {
    setPhotos(prev => {
      const idx  = prev.findIndex(p => p.id === id)
      const next = [...prev]
      const to   = idx + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
  }

  const onDragStart = (i: number) => { dragItem.current = i }
  const onDragEnter = (i: number) => { dragOver_.current = i }
  const onDragEnd   = () => {
    if (dragItem.current === null || dragOver_.current === null) return
    setPhotos(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragItem.current!, 1)
      next.splice(dragOver_.current!, 0, moved)
      dragItem.current  = null
      dragOver_.current = null
      return next
    })
  }

  const handleGenerate = async () => {
    if (!project || photos.length === 0) return
    setGenerating(true)
    try {
      await generateAlbumPDF(project, photos)
    } catch (e) {
      alert('PDF generation failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGenerating(false)
    }
  }

  const coverPhoto  = photos.find(p => p.isCover)
  const nonCover    = photos.filter(p => !p.isCover)

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/documents" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Progress Photo Album</h1>
          <p className="text-sm text-slate-500">Generate a professional A4 PDF with 4 photos per page</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px,1fr] gap-6">

        {/* ── LEFT PANEL ── */}
        <div className="space-y-5">

          {/* Project selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Project</h2>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
              </div>
            ) : (
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {project && (
              <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                {[
                  ['Client',   project.client_name],
                  ['Location', project.location],
                  ['Progress', `${project.progress_percent}%`],
                  ['Stage',    project.current_stage],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-slate-400 font-medium">{k}</span>
                    <span className="text-slate-700 text-right max-w-[180px] truncate">{v || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload area */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Upload Photos</h2>
            <div
              ref={dropRef}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
            >
              <ImagePlus className={`w-8 h-8 ${dragOver ? 'text-blue-500' : 'text-slate-300'}`} />
              <p className="text-sm text-slate-500 text-center">
                Drag & drop photos here<br />
                <span className="text-xs text-slate-400">or click to browse</span>
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileInput}
            />
            {photos.length > 0 && (
              <p className="text-xs text-slate-400 mt-2 text-center">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
                {photos.length > 1 && ` · ${Math.ceil((photos.length - 1) / 4) + 1} page${Math.ceil((photos.length - 1) / 4) + 1 > 1 ? 's' : ''} (cover + ${Math.ceil((photos.length - 1) / 4)} photo page${Math.ceil((photos.length - 1) / 4) > 1 ? 's' : ''})`}
              </p>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!project || photos.length === 0 || generating}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
              : <><Download className="w-4 h-4" /> Generate PDF Album</>}
          </button>

          {photos.length === 0 && (
            <p className="text-xs text-center text-slate-400">Upload at least one photo to generate the album.</p>
          )}
        </div>

        {/* ── RIGHT PANEL — Photo grid ── */}
        <div className="space-y-5">

          {photos.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center py-24 text-slate-300">
              <Camera className="w-16 h-16 mb-4" />
              <p className="text-sm font-medium">No photos yet</p>
              <p className="text-xs mt-1">Upload photos on the left to get started</p>
            </div>
          ) : (
            <>
              {/* Cover photo */}
              {coverPhoto && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <h2 className="text-sm font-semibold text-slate-700">Cover Photo</h2>
                    <span className="text-xs text-slate-400">(first page, full width)</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden bg-slate-100" style={{ aspectRatio: '16/9' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPhoto.preview} alt="Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <input
                        type="text"
                        placeholder="Cover caption (optional)…"
                        value={coverPhoto.caption}
                        onChange={e => updateCaption(coverPhoto.id, e.target.value)}
                        className="w-full bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <button
                      onClick={() => removePhoto(coverPhoto.id)}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Progress photos grid */}
              {nonCover.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-700">
                      Progress Photos
                      <span className="ml-2 text-xs font-normal text-slate-400">4 per page · drag to reorder</span>
                    </h2>
                    <span className="text-xs text-blue-600 font-medium">
                      {nonCover.length} photo{nonCover.length !== 1 ? 's' : ''} → {Math.ceil(nonCover.length / 4)} page{Math.ceil(nonCover.length / 4) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Page previews */}
                  {Array.from({ length: Math.ceil(nonCover.length / 4) }).map((_, pageIdx) => {
                    const slice = nonCover.slice(pageIdx * 4, pageIdx * 4 + 4)
                    // Find their original indices in `photos` for drag
                    const originalIndices = slice.map(s => photos.findIndex(p => p.id === s.id))

                    return (
                      <div key={pageIdx} className="mb-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-px flex-1 bg-slate-100" />
                          <span className="text-xs text-slate-400 font-medium">Page {pageIdx + 2}</span>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {slice.map((photo, i) => {
                            const originalIdx = originalIndices[i]
                            return (
                              <div
                                key={photo.id}
                                draggable
                                onDragStart={() => onDragStart(originalIdx)}
                                onDragEnter={() => onDragEnter(originalIdx)}
                                onDragEnd={onDragEnd}
                                className="group relative bg-slate-50 rounded-xl overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing"
                              >
                                <div className="relative" style={{ aspectRatio: '4/3' }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={photo.preview} alt="" className="w-full h-full object-cover" />

                                  {/* Overlay controls */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                                  {/* Photo number */}
                                  <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold rounded-md px-1.5 py-0.5">
                                    {pageIdx * 4 + i + 1}
                                  </div>

                                  {/* Drag handle */}
                                  <div className="absolute top-2 right-8 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <GripVertical className="w-4 h-4" />
                                  </div>

                                  {/* Action buttons */}
                                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setCover(photo.id)}
                                      title="Set as cover"
                                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                                    >
                                      <Star className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => removePhoto(photo.id)}
                                      className="bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Move up/down */}
                                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => movePhoto(photo.id, -1)}
                                      className="bg-white/80 hover:bg-white text-slate-700 rounded w-5 h-5 flex items-center justify-center shadow text-xs"
                                    >
                                      <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => movePhoto(photo.id, 1)}
                                      className="bg-white/80 hover:bg-white text-slate-700 rounded w-5 h-5 flex items-center justify-center shadow text-xs"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Caption input */}
                                <div className="p-2">
                                  <input
                                    type="text"
                                    placeholder="Caption…"
                                    value={photo.caption}
                                    onChange={e => updateCaption(photo.id, e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}

                  {/* Tip */}
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    ⭐ = set as cover · hover photo for controls · drag to reorder
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
