import { NextRequest, NextResponse } from 'next/server'
import {
  getAllBOQs,
  getBOQsByProjectId,
  getBOQ,
  createBOQ,
  updateBOQ,
  deleteBOQ,
  addBOQItem,
  updateBOQItem,
  deleteBOQItem,
  calculateTotals
} from '@/lib/boq-store'
import { BOQItem } from '@/types'

// GET: Fetch all BOQs or filter by project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const boqId = searchParams.get('id')

    if (boqId) {
      const boq = await getBOQ(boqId)
      if (!boq) {
        return NextResponse.json(
          { error: 'BOQ not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(boq)
    }

    if (projectId) {
      const boqs = await getBOQsByProjectId(projectId)
      return NextResponse.json({ boqs, count: boqs.length })
    }

    const boqs = await getAllBOQs()
    return NextResponse.json({ boqs, count: boqs.length })
  } catch (error) {
    console.error('Error fetching BOQs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch BOQs' },
      { status: 500 }
    )
  }
}

// POST: Create new BOQ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      projectId,
      drawing_filename,
      extracted_dimensions,
      items,
      vat = 0.05
    } = body

    if (!projectId || !drawing_filename || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, drawing_filename, items' },
        { status: 400 }
      )
    }

    const totals = calculateTotals(items, vat)

    const newBOQ = await createBOQ({
      projectId,
      drawing_filename,
      extracted_dimensions,
      items,
      subtotal: totals.subtotal,
      vat: totals.vat,
      total: totals.total
    })

    return NextResponse.json(newBOQ, { status: 201 })
  } catch (error) {
    console.error('Error creating BOQ:', error)
    return NextResponse.json(
      { error: 'Failed to create BOQ' },
      { status: 500 }
    )
  }
}

// PUT: Update BOQ
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'BOQ ID is required' },
        { status: 400 }
      )
    }

    // If items are being updated, recalculate totals
    if (updates.items) {
      const totals = calculateTotals(updates.items, updates.vat)
      updates.subtotal = totals.subtotal
      updates.vat = totals.vat
      updates.total = totals.total
    }

    const updated = await updateBOQ(id, updates)

    if (!updated) {
      return NextResponse.json(
        { error: 'BOQ not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating BOQ:', error)
    return NextResponse.json(
      { error: 'Failed to update BOQ' },
      { status: 500 }
    )
  }
}

// DELETE: Remove BOQ
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'BOQ ID is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteBOQ(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'BOQ not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'BOQ deleted successfully' })
  } catch (error) {
    console.error('Error deleting BOQ:', error)
    return NextResponse.json(
      { error: 'Failed to delete BOQ' },
      { status: 500 }
    )
  }
}
