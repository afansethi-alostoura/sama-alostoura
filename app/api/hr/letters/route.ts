import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs'

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

function readPublicFile(name: string): Buffer | null {
  try {
    const p = path.join(process.cwd(), 'public', name)
    return fs.readFileSync(p)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    await ensureTable()
    const rows = await query(
      `SELECT id, ref_no, title, issued_to, issued_by, letter_date, created_at
       FROM hr_letters ORDER BY created_at DESC`
    )
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const form        = await req.formData()
    const file        = form.get('file')        as File | null
    const title       = (form.get('title')       as string) || ''
    const issued_to   = (form.get('issued_to')   as string) || ''
    const issued_by   = (form.get('issued_by')   as string) || ''
    const ref_no      = (form.get('ref_no')      as string) || ''
    const letter_date = (form.get('letter_date') as string) || new Date().toISOString().slice(0, 10)

    if (!file) return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Max 20 MB' }, { status: 400 })

    const id = genId()
    const siteUrl  = req.headers.get('origin') || 'https://sama-alostoura.vercel.app'
    const verifyUrl = `${siteUrl}/verify/${id}`

    // Load original PDF
    const bytes   = await file.arrayBuffer()
    const pdfDoc  = await PDFDocument.load(bytes)
    const pages   = pdfDoc.getPages()
    const lastPage = pages[pages.length - 1]
    const { width, height } = lastPage.getSize()

    // ── QR code (PNG) ────────────────────────────────────────────────────────
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 })
    const qrBytes   = Buffer.from(qrDataUrl.replace('data:image/png;base64,', ''), 'base64')
    const qrImage   = await pdfDoc.embedPng(qrBytes)

    // ── Company round stamp (JPG) ─────────────────────────────────────────────
    const stampBytes = readPublicFile('stamp.jpg')
    const stampImage = stampBytes ? await pdfDoc.embedJpg(stampBytes) : null

    // ── Signature (JPG) ───────────────────────────────────────────────────────
    const sigBytes = readPublicFile('signature.jpg')
    const sigImage = sigBytes ? await pdfDoc.embedJpg(sigBytes) : null

    // ── Layout constants (points) ─────────────────────────────────────────────
    // Bottom band: signature left, round stamp centre-right, QR top-right corner
    const margin  = 36        // 12.7mm from edge
    const sigW    = 110
    const sigH    = 55
    const sigX    = margin
    const sigY    = margin

    const stW     = 90
    const stH     = 90
    const stX     = width / 2 - stW / 2   // centred
    const stY     = margin - 5

    const qrSize  = 72
    const qrX     = width - margin - qrSize
    const qrY     = margin + 4

    // ── Draw signature ────────────────────────────────────────────────────────
    if (sigImage) {
      lastPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigW, height: sigH })
    }

    // ── Draw round stamp ─────────────────────────────────────────────────────
    if (stampImage) {
      lastPage.drawImage(stampImage, { x: stX, y: stY, width: stW, height: stH, opacity: 0.88 })
    }

    // ── Draw QR code ──────────────────────────────────────────────────────────
    lastPage.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

    // Small "Scan to verify" label under QR
    lastPage.drawText('Scan to verify', {
      x: qrX + 8, y: qrY - 9, size: 6, color: rgb(0.45, 0.45, 0.45),
    })
    lastPage.drawText(id, {
      x: qrX - 2, y: qrY - 17, size: 5, color: rgb(0.35, 0.35, 0.35),
    })

    // ── Subtle diagonal watermark ─────────────────────────────────────────────
    lastPage.drawText('OFFICIALLY ISSUED', {
      x: width / 2 - 100, y: height / 2 - 20,
      size: 42, color: rgb(0.88, 0.88, 0.93),
      opacity: 0.07, rotate: degrees(45),
    })

    // ── Save & store ──────────────────────────────────────────────────────────
    const stampedBytes = await pdfDoc.save()
    const fileData     = Buffer.from(stampedBytes).toString('base64')

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
