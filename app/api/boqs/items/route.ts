import { NextRequest, NextResponse } from 'next/server'
import {
  addBOQItem,
  updateBOQItem,
  deleteBOQItem
} from '@/lib/boq-store'

// POST: Add new item to BOQ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { boqId, item } = body

    if (!boqId || !item) {
      return NextResponse.json(
        { error: 'Missing required fields: boqId, item' },
        { status: 400 }
      )
    }

    const updated = await addBOQItem(boqId, item)

    if (!updated) {
      return NextResponse.json(
        { error: 'BOQ not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated, { status: 201 })
  } catch (error) {
    console.error('Error adding BOQ item:', error)
    return NextResponse.json(
      { error: 'Failed to add BOQ item' },
      { status: 500 }
    )
  }
}

// PUT: Update BOQ item
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { boqId, itemId, updates } = body

    if (!boqId || !itemId || !updates) {
      return NextResponse.json(
        { error: 'Missing required fields: boqId, itemId, updates' },
        { status: 400 }
      )
    }

    const updated = await updateBOQItem(boqId, itemId, updates)

    if (!updated) {
      return NextResponse.json(
        { error: 'BOQ or item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating BOQ item:', error)
    return NextResponse.json(
      { error: 'Failed to update BOQ item' },
      { status: 500 }
    )
  }
}

// DELETE: Remove BOQ item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const boqId = searchParams.get('boqId')
    const itemId = searchParams.get('itemId')

    if (!boqId || !itemId) {
      return NextResponse.json(
        { error: 'BOQ ID and Item ID are required' },
        { status: 400 }
      )
    }

    const updated = await deleteBOQItem(boqId, itemId)

    if (!updated) {
      return NextResponse.json(
        { error: 'BOQ or item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error deleting BOQ item:', error)
    return NextResponse.json(
      { error: 'Failed to delete BOQ item' },
      { status: 500 }
    )
  }
}
