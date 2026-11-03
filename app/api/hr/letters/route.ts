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
  const yr   = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `SA-${yr}-${rand}`
}

// 9-point grid: position id → (xPct, yPct) from bottom-left of page
const POS_MAP: Record<string, [number, number]> = {
  TL: [0.04, 0.82], TC: [0.37, 0.82], TR: [0.70, 0.82],
  ML: [0.04, 0.46], MC: [0.37, 0.46], MR: [0.70, 0.46],
  BL: [0.04, 0.04], BC: [0.37, 0.04], BR: [0.70, 0.04],
}

async function loadAsset(type: string): Promise<Buffer | null> {
  try {
    const rows = await query(`SELECT file_data FROM hr_letter_assets WHERE type=$1`, [type])
    if (!rows.length) return null
    return Buffer.from((rows[0] as { file_data: string }).file_data, 'base64')
  } catch { return null }
}

async function embedAsset(pdfDoc: PDFDocument, buf: Buffer, mime: string) {
  if (mime.includes('png') || buf[0] === 0x89) return pdfDoc.embedPng(buf)
  return pdfDoc.embedJpg(buf)
}

async function getMime(type: string): Promise<string> {
  try {
    const rows = await query(`SELECT mime_type FROM hr_letter_assets WHERE type=$1`, [type])
    return rows.length ? (rows[0] as { mime_type: string }).mime_type : 'image/png'
  } catch { return 'image/png' }
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
    const form = await req.formData()

    const file        = form.get('file')        as File | null
    const title       = (form.get('title')       as string) || ''
    const issued_to   = (form.get('issued_to')   as string) || ''
    const issued_by   = (form.get('issued_by')   as string) || ''
    const ref_no      = (form.get('ref_no')      as string) || ''
    const letter_date = (form.get('letter_date') as string) || new Date().toISOString().slice(0, 10)

    const addSig   = form.get('add_signature') === 'true'
    const addStamp = form.get('add_stamp')     === 'true'
    const addQr    = form.get('add_qr')        !== 'false'   // default true
    const sigPos   = (form.get('sig_pos')   as string) || 'BL'
    const stPos    = (form.get('stamp_pos') as string) || 'BR'
    const qrPos    = (form.get('qr_pos')    as string) || 'BR'

    if (!file) return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Max 20 MB' }, { status: 400 })

    const id        = genId()
    const siteUrl   = req.headers.get('origin') || 'https://sama-alostoura.vercel.app'
    const verifyUrl = `${siteUrl}/verify/${id}`

    const bytes    = await file.arrayBuffer()
    const pdfDoc   = await PDFDocument.load(bytes)
    const pages    = pdfDoc.getPages()
    const lastPage = pages[pages.length - 1]
    const { width, height } = lastPage.getSize()

    const resolve = (posId: string, w: number, h: number) => {
      const [xp, yp] = POS_MAP[posId] ?? POS_MAP['BL']
      return { x: xp * width, y: yp * height + (yp < 0.3 ? 0 : -h) }
    }

    // ── Signature ────────────────────────────────────────────────────────────
    if (addSig) {
      const sigBuf  = await loadAsset('signature')
      const sigMime = await getMime('signature')
      if (sigBuf) {
        const sigImg = await embedAsset(pdfDoc, sigBuf, sigMime)
        const sigW = 110, sigH = 55
        const { x, y } = resolve(sigPos, sigW, sigH)
        lastPage.drawImage(sigImg, { x, y, width: sigW, height: sigH })
      }
    }

    // ── Round stamp ───────────────────────────────────────────────────────────
    if (addStamp) {
      const stBuf  = await loadAsset('stamp')
      const stMime = await getMime('stamp')
      if (stBuf) {
        const stImg = await embedAsset(pdfDoc, stBuf, stMime)
        const stW = 90, stH = 90
        const { x, y } = resolve(stPos, stW, stH)
        lastPage.drawImage(stImg, { x, y, width: stW, height: stH, opacity: 0.9 })
      }
    }

    // ── QR code ───────────────────────────────────────────────────────────────
    if (addQr) {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1 })
      const qrBytes   = Buffer.from(qrDataUrl.replace('data:image/png;base64,', ''), 'base64')
      const qrImg     = await pdfDoc.embedPng(qrBytes)
      const qrSize    = 72
      const { x, y } = resolve(qrPos, qrSize, qrSize)
      lastPage.drawImage(qrImg, { x, y, width: qrSize, height: qrSize })
      lastPage.drawText('Scan to verify', {
        x: x + 6, y: y - 10, size: 6, color: rgb(0.4, 0.4, 0.4),
      })
      lastPage.drawText(id, {
        x: x - 2, y: y - 18, size: 5, color: rgb(0.35, 0.35, 0.35),
      })
    }

    // ── Subtle watermark ─────────────────────────────────────────────────────
    lastPage.drawText('OFFICIALLY ISSUED', {
      x: width / 2 - 100, y: height / 2 - 20,
      size: 42, color: rgb(0.88, 0.88, 0.93),
      opacity: 0.07, rotate: degrees(45),
    })

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
