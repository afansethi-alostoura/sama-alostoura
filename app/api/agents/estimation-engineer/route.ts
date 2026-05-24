import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { getAllRates } from '@/lib/rates-store'
import { BOQItem } from '@/types'
import { anthropic } from '@/lib/anthropic'

export async function POST(request: NextRequest) {
  let filepath = ''
  let body: any = null

  try {
    body = await request.json()
    const {
      filepath: fp,
      filename,
      filetype,
      projectId,
      projectName,
      plotSize,
      floors,
      rooms,
      additionalContext
    } = body
    filepath = fp

    if (!filepath || !filename || !filetype) {
      return NextResponse.json(
        { error: 'Missing required fields: filepath, filename, filetype' },
        { status: 400 }
      )
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Get rate library for context
    const rates = await getAllRates()
    const ratesByCategory = rates.reduce((acc, rate) => {
      if (!acc[rate.category]) {
        acc[rate.category] = []
      }
      acc[rate.category].push(rate)
      return acc
    }, {} as Record<string, typeof rates>)

    // Format rates for Claude context
    const ratesContext = Object.entries(ratesByCategory)
      .map(([category, items]) => {
        const itemList = items
          .map(i => `${i.description} (${i.unit}): AED ${i.unitRate}`)
          .join('\n  ')
        return `${category}:\n  ${itemList}`
      })
      .join('\n\n')

    // Read file and encode as base64
    const fileBuffer = fs.readFileSync(filepath)
    const base64File = fileBuffer.toString('base64')

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
    if (filetype === 'png') {
      mediaType = 'image/png'
    }

    // Build system prompt for estimation engineer
    const systemPrompt = `You are an expert quantity surveyor for Sama Alostoura Building Contracting LLC, Dubai, UAE.

Your role is to analyze architectural drawings and extract dimensions to generate accurate Bill of Quantities (BOQ) for construction projects.

From the provided drawing, you must:
1. Extract all relevant dimensions: plot size, number of floors, number of rooms, wall lengths, slab areas, height measurements
2. Identify all construction work items visible in the drawing
3. Match items to the provided rate library when possible
4. Calculate quantities based on extracted dimensions
5. Generate a complete BOQ with proper sections and line items

SAMA ALOSTOURA BOQ SECTIONS (in order):
1. Mobilization
2. Excavation and Backfilling
3. Substructure
4. Super Structure
5. Block Works
6. Internal Plaster Works
7. External Plaster Works
8. Water Proofing Works
9. Electrical & Etisalat works
10. Plumbing & Drainage works
11. Air Condition
12. Fire Alarm System
13. Fixing & Supplying Flooring and Wall Tiling
14. Doors and Windows
15. Painting Works
16. False Ceiling Works
17. Carpentry Works
18. Kitchen Equipment
19. Provisional Items
20. Temporary Works
21. Maintenance Period
22. Final Cleaning
23. Site Supervision
24. Handover

AVAILABLE RATE LIBRARY:
${ratesContext}

For items NOT in the rate library, provide reasonable market rates for Dubai construction in AED.

Return your response as a valid JSON array of BOQ items with this exact structure:
[
  {
    "itemNo": 1,
    "section": "Mobilization",
    "description": "Item description",
    "quantity": 1,
    "unit": "L.S",
    "unitRate": 5000
  }
]

Include a "notes" field for any assumptions or items not found in rate library.
Return ONLY the JSON array, no other text.`

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64File
              }
            },
            {
              type: 'text',
              text: `Analyze this architectural drawing and generate a complete BOQ for a construction project with these parameters:
Project: ${projectName || 'Residential Villa'}
Plot Size: ${plotSize || 'Unknown'} sq.m
Number of Floors: ${floors || 'Unknown'}
Number of Rooms: ${rooms || 'Unknown'}
Additional Context: ${additionalContext || 'None'}

Extract all dimensions and generate complete BOQ with accurate quantities and rates.`
            }
          ]
        }
      ]
    })

    // Extract BOQ items from response
    let boqItems: BOQItem[] = []
    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        // Convert to proper BOQItem format with IDs
        boqItems = parsed.map((item: any, index: number) => ({
          id: `item_${Date.now()}_${index}`,
          itemNo: item.itemNo || index + 1,
          section: item.section || 'Other',
          description: item.description || '',
          quantity: Number(item.quantity) || 0,
          unit: item.unit || 'L.S',
          unitRate: Number(item.unitRate) || 0,
          amount: (Number(item.quantity) || 0) * (Number(item.unitRate) || 0),
          notes: item.notes
        }))
      }
    } catch (parseError) {
      console.error('Error parsing BOQ JSON:', parseError)
    }

    // Clean up uploaded file
    fs.unlinkSync(filepath)

    return NextResponse.json({
      success: true,
      filename,
      extractedDimensions: responseText,
      boqItems,
      itemCount: boqItems.length,
      message: 'Drawing analyzed successfully. BOQ items extracted.'
    })
  } catch (error) {
    console.error('Error in estimation agent:', error)

    // Clean up file if it exists
    if (filepath && fs.existsSync(filepath)) {
      try {
        fs.unlinkSync(filepath)
      } catch (e) {
        console.error('Error cleaning up file:', e)
      }
    }

    return NextResponse.json(
      { error: 'Failed to process drawing: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
