import { NextRequest, NextResponse } from 'next/server'
import {
  getAllRates,
  getRatesByCategory,
  addRate,
  updateRate,
  deleteRate,
  getCategoriesList,
  seedRates
} from '@/lib/rates-store'
import { RateLibraryItem } from '@/types'

// GET: Fetch all rates or filter by category
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const getCategoriesFlag = searchParams.get('categories') === 'true'

    if (getCategoriesFlag) {
      const categories = await getCategoriesList()
      return NextResponse.json({ categories })
    }

    if (category) {
      const rates = await getRatesByCategory(category)
      return NextResponse.json({ rates, count: rates.length })
    }

    const rates = await getAllRates()
    return NextResponse.json({ rates, count: rates.length })
  } catch (error) {
    console.error('Error fetching rates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rates' },
      { status: 500 }
    )
  }
}

// POST: Add new rate or seed rates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Handle seeding rates
    if (body.seed && Array.isArray(body.rates)) {
      await seedRates(body.rates)
      return NextResponse.json({ message: 'Rates seeded successfully' })
    }

    // Add single rate
    const { description, unit, unitRate, category, notes } = body

    if (!description || !unit || unitRate === undefined || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: description, unit, unitRate, category' },
        { status: 400 }
      )
    }

    const newRate = await addRate({
      description,
      unit,
      unitRate,
      category,
      notes
    })

    return NextResponse.json(newRate, { status: 201 })
  } catch (error) {
    console.error('Error adding rate:', error)
    return NextResponse.json(
      { error: 'Failed to add rate' },
      { status: 500 }
    )
  }
}

// PUT: Update existing rate
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Rate ID is required' },
        { status: 400 }
      )
    }

    const updated = await updateRate(id, updates)

    if (!updated) {
      return NextResponse.json(
        { error: 'Rate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating rate:', error)
    return NextResponse.json(
      { error: 'Failed to update rate' },
      { status: 500 }
    )
  }
}

// DELETE: Remove rate
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Rate ID is required' },
        { status: 400 }
      )
    }

    const deleted = await deleteRate(id)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Rate not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Rate deleted successfully' })
  } catch (error) {
    console.error('Error deleting rate:', error)
    return NextResponse.json(
      { error: 'Failed to delete rate' },
      { status: 500 }
    )
  }
}
