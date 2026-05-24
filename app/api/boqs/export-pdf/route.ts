import { NextRequest, NextResponse } from 'next/server'
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

    // Generate HTML that can be printed as PDF
    const grouped = groupBySection(boq.items)
    const sections = Object.keys(grouped).sort()

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>BOQ - ${boq.drawing_filename}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; }
      .page-break { page-break-before: always; }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #1e40af;
    }
    .header p {
      margin: 5px 0;
      font-size: 12px;
      color: #666;
    }
    .metadata {
      font-size: 11px;
      margin: 10px 0;
      color: #666;
    }
    .section {
      margin-top: 20px;
    }
    .section-title {
      background-color: #1e40af;
      color: white;
      padding: 8px 12px;
      font-weight: bold;
      margin-bottom: 5px;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 11px;
    }
    th {
      background-color: #1e40af;
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #ddd;
    }
    td {
      padding: 8px;
      border: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f3f4f6;
    }
    .text-right {
      text-align: right;
    }
    .subtotal-row {
      background-color: #e0e7ff;
      font-weight: bold;
    }
    .total-section {
      margin-top: 20px;
      padding: 15px;
      background-color: #f3f4f6;
      border: 1px solid #ddd;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
      font-size: 12px;
    }
    .total-final {
      background-color: #1e40af;
      color: white;
      padding: 10px;
      font-size: 14px;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
    }
    .signature {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      width: 200px;
      margin: 40px 0 5px 0;
    }
    .signature-text {
      font-size: 11px;
      color: #666;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SAMA ALOSTOURA</h1>
    <p>Building Contracting LLC</p>
    <p>Dubai, UAE | Est. 2020</p>
  </div>

  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="margin: 10px 0; color: #1e40af;">BILL OF QUANTITIES</h2>
  </div>

  <div class="metadata">
    <div>Drawing: ${boq.drawing_filename}</div>
    <div>Date: ${new Date(boq.createdAt).toLocaleDateString()}</div>
    <div>BOQ ID: ${boq.id}</div>
  </div>
`

    // Add sections with tables
    sections.forEach((section) => {
      const sectionItems = grouped[section]
      const sectionSubtotal = sectionItems.reduce((sum, item) => sum + item.amount, 0)

      html += `
  <div class="section">
    <div class="section-title">${section.toUpperCase()}</div>
    <table>
      <thead>
        <tr>
          <th style="width: 5%">Item</th>
          <th style="width: 40%">Description</th>
          <th style="width: 10%" class="text-right">Qty</th>
          <th style="width: 10%" class="text-right">Unit</th>
          <th style="width: 15%" class="text-right">Rate (AED)</th>
          <th style="width: 20%" class="text-right">Amount (AED)</th>
        </tr>
      </thead>
      <tbody>
`

      sectionItems.forEach((item) => {
        html += `
        <tr>
          <td>${item.itemNo}</td>
          <td>${item.description}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${item.unit}</td>
          <td class="text-right">${item.unitRate.toFixed(2)}</td>
          <td class="text-right">${item.amount.toFixed(2)}</td>
        </tr>
`
      })

      html += `
        <tr class="subtotal-row">
          <td colspan="5" style="text-align: right;">Subtotal for ${section}:</td>
          <td class="text-right">${sectionSubtotal.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>
`
    })

    // Summary
    html += `
  <div class="total-section">
    <div class="total-row">
      <span>SUBTOTAL:</span>
      <span>AED ${boq.subtotal.toFixed(2)}</span>
    </div>
`

    if (boq.vat && boq.vat > 0) {
      html += `
    <div class="total-row">
      <span>VAT (5%):</span>
      <span>AED ${boq.vat.toFixed(2)}</span>
    </div>
`
    }

    html += `
    <div class="total-final">
      <span>TOTAL:</span>
      <span>AED ${boq.total.toFixed(2)}</span>
    </div>
  </div>

  <div class="signature">
    <div class="signature-line"></div>
    <div class="signature-text">Authorized Signature</div>
    <div class="signature-text">Date: _________________</div>
  </div>

  <div class="footer">
    <p>This BOQ is valid for 30 days from date of issue. Prices subject to market conditions.</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="BOQ_${boqId}.html"`
      }
    })
  } catch (error) {
    console.error('Error generating BOQ:', error)
    return NextResponse.json(
      { error: 'Failed to generate BOQ: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
