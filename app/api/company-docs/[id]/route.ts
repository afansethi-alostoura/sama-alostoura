import { NextRequest, NextResponse } from 'next/server'
import { updateCompanyDoc, deleteCompanyDoc } from '@/lib/company-docs-store'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }  = await params
    const body    = await req.json()
    const updated = updateCompanyDoc(id, body)
    if (!updated) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json({ doc: updated })
  } catch (err) {
    console.error('[CompanyDocs PATCH]', err)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok     = deleteCompanyDoc(id)
  if (!ok) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
