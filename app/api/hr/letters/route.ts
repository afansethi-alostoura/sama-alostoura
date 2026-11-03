import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS hr_letters (
      id          TEXT PRIMARY KEY,
      ref_no      TEXT,
      title       TEXT,
      issued_to   TEXT,
      issued_by   TEXT,
      letter_date DATE,
      file_data   TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

function genId() {
  const yr = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `SA-${yr}-${rand}`
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await query(
      `SELECT id, ref_no, title, issued_to, issued_by, letter_date, created_at
       FROM hr_letters ORDER BY created_at DESC`
    )
    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const form      = await req.formData()
    const file      = form.get('file') as File | null
    const title     = (form.get('title')      as string) || ''
    const issued_to = (form.get('issued_to')  as string) || ''
    const issued_by = (form.get('issued_by')  as string) || ''
    const ref_no    = (form.get('ref_no')     as string) || ''
    const letter_date = (form.get('letter_date') as string) || new Date().toISOString().slice(0,10)

    if (!file) return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Max 20 MB' }, { status: 400 })

    const id = genId()
    const siteUrl = req.headers.get('origin') || 'https://sama-alostoura.vercel.app'
    const verifyUrl = `${siteUrl}/verify/${id}`

    // Load original PDF
    const bytes  = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(bytes)
    const pages  = pdfDoc.getPages()
    const lastPage = pages[pages.length - 1]
    const { width, height } = lastPage.getSize()

    // Generate QR code as PNG bytes
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 1 })
    const qrBase64  = qrDataUrl.replace('data:image/png;base64,', '')
    const qrBytes   = Buffer.from(qrBase64, 'base64')
    const qrImage   = await pdfDoc.embedPng(qrBytes)

    // Draw stamp circle (SVG-style via lines/ellipse not available in pdf-lib, use box)
    const stampX = width  - 160
    const stampY = 20
    const stampW = 140
    const stampH = 100

    // Outer border box for stamp area
    lastPage.drawRectangle({
      x: stampX - 2, y: stampY - 2,
      width: stampW + 4, height: stampH + 4,
      borderColor: rgb(0.05, 0.3, 0.6),
      borderWidth: 1.5,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    })

    // QR code (left side of stamp box)
    lastPage.drawImage(qrImage, { x: stampX + 2, y: stampY + 2, width: 68, height: 68 })

    // Company text (right side)
    const fontSize = 5.5
    lastPage.drawText('SAMA ALOSTOURA', {
      x: stampX + 74, y: stampY + 72, size: fontSize + 1,
      color: rgb(0.05, 0.3, 0.6),
    })
    lastPage.drawText('BUILDING CONTRACTING', {
      x: stampX + 74, y: stampY + 63, size: fontSize,
      color: rgb(0.05, 0.3, 0.6),
    })
    lastPage.drawText('L.L.C  — DUBAI, UAE', {
      x: stampX + 74, y: stampY + 54, size: fontSize,
      color: rgb(0.05, 0.3, 0.6),
    })
    lastPage.drawText('─────────────────', {
      x: stampX + 74, y: stampY + 47, size: fontSize,
      color: rgb(0.6, 0.6, 0.6),
    })
    lastPage.drawText('VERIFIED DOCUMENT', {
      x: stampX + 74, y: stampY + 38, size: fontSize,
      color: rgb(0.1, 0.55, 0.1),
    })
    lastPage.drawText(`ID: ${id}`, {
      x: stampX + 74, y: stampY + 29, size: 4.5,
      color: rgb(0.3, 0.3, 0.3),
    })
    lastPage.drawText(letter_date, {
      x: stampX + 74, y: stampY + 21, size: 4.5,
      color: rgb(0.3, 0.3, 0.3),
    })
    lastPage.drawText('Scan QR to verify', {
      x: stampX + 74, y: stampY + 12, size: 4.5,
      color: rgb(0.5, 0.5, 0.5),
    })

    // "OFFICIAL DOCUMENT" watermark text across last page (subtle)
    lastPage.drawText('OFFICIALLY ISSUED', {
      x: width / 2 - 80, y: height / 2,
      size: 36, color: rgb(0.9, 0.9, 0.95),
      opacity: 0.08, rotate: degrees(45),
    })

    const stampedBytes = await pdfDoc.save()
    const fileData = Buffer.from(stampedBytes).toString('base64')

    await query(
      `INSERT INTO hr_letters (id, ref_no, title, issued_to, issued_by, letter_date, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, ref_no || null, title || null, issued_to || null, issued_by || null, letter_date, fileData]
    )

    return NextResponse.json({ id, ref_no, title, issued_to, issued_by, letter_date, verify_url: verifyUrl }, { status: 201 })
  } catch (err) {
    console.error('[hr/letters POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
