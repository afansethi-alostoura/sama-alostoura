import { NextRequest, NextResponse } from 'next/server'
import { getAllCompanyDocs, createCompanyDoc } from '@/lib/company-docs-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ docs: getAllCompanyDocs() })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
    }
    const doc = createCompanyDoc({
      name:              body.name,
      category:          body.category,
      issuing_authority: body.issuing_authority ?? '',
      doc_number:        body.doc_number        ?? null,
      issue_date:        body.issue_date        ?? null,
      expiry_date:       body.expiry_date       ?? null,
      reminder_days:     Number(body.reminder_days) || 30,
      notes:             body.notes             ?? null,
    })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (err) {
    console.error('[CompanyDocs POST]', err)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
