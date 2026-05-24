import { NextRequest, NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import { getBOQ } from '@/lib/boq-store'
import { groupBySection } from '@/lib/boq-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const boqId = searchParams.get('id')

    if (!boqId) {
      return NextResponse.json(
        { error: 'BOQ ID is required' },
        { status: 400 }
      )
    }

    const boq = await getBOQ(boqId)
    if (!boq) {
      return NextResponse.json(
        { error: 'BOQ not found' },
        { status: 404 }
      )
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true
    })

    // Collect PDF data
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('SAMA ALOSTOURA', { align: 'center' })
    doc.fontSize(10).font('Helvetica').text('Building Contracting LLC', { align: 'center' })
    doc.fontSize(9).fillColor('#666666').text('Dubai, UAE | Est. 2020', { align: 'center' })

    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()

    // Title
    doc.moveDown()
    doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold').text('BILL OF QUANTITIES', { align: 'center' })

    // Project Info
    doc.moveDown()
    doc.fontSize(10).font('Helvetica')
    doc.text(`Drawing: ${boq.drawing_filename}`, 70)
    doc.text(`Date: ${new Date(boq.createdAt).toLocaleDateString()}`)
    doc.text(`BOQ ID: ${boq.id}`)

    doc.moveDown()

    // Group items by section
    const grouped = groupBySection(boq.items)
    const sections = Object.keys(grouped).sort()

    // Table headers
    const startY = doc.y
    const colX = { itemNo: 70, description: 150, qty: 430, unit: 460, rate: 490, amount: 520 }
    const rowHeight = 20

    // Header row
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
    doc.rect(50, startY, 500, 20).fill('#1e40af')

    doc.text('Item', colX.itemNo, startY + 5)
    doc.text('Description', colX.description, startY + 5)
    doc.text('Qty', colX.qty, startY + 5)
    doc.text('Unit', colX.unit, startY + 5)
    doc.text('Rate', colX.rate, startY + 5)
    doc.text('Amount', colX.amount, startY + 5)

    let y = startY + 25
    let itemCounter = 0
    let sectionSubtotal = 0

    // Render sections
    sections.forEach((section) => {
      // Section header
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e40af')
      doc.text(section.toUpperCase(), 70, y)
      y += rowHeight + 5

      // Section items
      const sectionItems = grouped[section]
      sectionSubtotal = 0

      sectionItems.forEach((item) => {
        itemCounter++

        // Alternate row background
        if (itemCounter % 2 === 0) {
          doc.rect(50, y - 5, 500, rowHeight).fill('#f3f4f6').stroke()
        } else {
          doc.rect(50, y - 5, 500, rowHeight).stroke()
        }

        doc.fontSize(8).font('Helvetica').fillColor('#000000')
        doc.text(String(item.itemNo), colX.itemNo, y)
        doc.text(item.description, colX.description, y, { width: 270 })
        doc.text(String(item.quantity), colX.qty, y)
        doc.text(item.unit, colX.unit, y)
        doc.text(`AED ${item.unitRate.toFixed(2)}`, colX.rate, y, { align: 'right' })
        doc.text(`AED ${item.amount.toFixed(2)}`, colX.amount, y, { align: 'right' })

        sectionSubtotal += item.amount
        y += rowHeight

        // Check for page break
        if (y > 700) {
          doc.addPage()
          y = 50
        }
      })

      // Section subtotal
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e40af')
      doc.rect(50, y - 5, 500, 20).fill('#e0e7ff')
      doc.text(`Subtotal for ${section}:`, colX.description, y)
      doc.text(`AED ${sectionSubtotal.toFixed(2)}`, colX.amount, y, { align: 'right' })

      y += 25
    })

    // Summary
    y += 10
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
    doc.text(`SUBTOTAL:`, colX.description, y)
    doc.text(`AED ${boq.subtotal.toFixed(2)}`, colX.amount, y, { align: 'right' })

    y += 25
    if (boq.vat && boq.vat > 0) {
      doc.fontSize(10).font('Helvetica')
      doc.text(`VAT (5%):`, colX.description, y)
      doc.text(`AED ${boq.vat.toFixed(2)}`, colX.amount, y, { align: 'right' })

      y += 25
    }

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e40af')
    doc.rect(50, y - 5, 500, 25).fill('#1e40af')
    doc.fillColor('#FFFFFF')
    doc.text(`TOTAL:`, colX.description, y + 3)
    doc.text(`AED ${boq.total.toFixed(2)}`, colX.amount, y + 3, { align: 'right' })

    // Footer
    y += 40
    doc.fontSize(9).fillColor('#666666').font('Helvetica')
    doc.text('', 70, y)
    doc.text('_________________________________', colX.description)
    doc.text('Authorized Signature')

    doc.moveDown(2)
    doc.fontSize(8).fillColor('#999999')
    doc.text('This BOQ is valid for 30 days from date of issue. Prices subject to market conditions.', { align: 'center' })
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' })

    // Finish PDF and return response
    doc.end()

    // Return PDF response
    return new Promise<NextResponse>((resolve, reject) => {
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(chunks)
          resolve(
            new NextResponse(pdfBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="BOQ_${boqId}.pdf"`,
                'Content-Length': pdfBuffer.length.toString()
              }
            })
          )
        } catch (err) {
          reject(err)
        }
      })

      doc.on('error', (err) => {
        reject(err)
      })
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
