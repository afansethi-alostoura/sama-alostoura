/**
 * POST /api/hr/analyze-document
 *
 * Accepts a multipart form with a single `file` field (PDF, JPG, PNG).
 * Passes the document to Claude Vision with a UAE construction company context
 * and returns structured extracted fields.
 *
 * Supported document types:
 *   Employee  — UAE Residency Visa, Emirates ID, Passport, Labour Card / Work Permit
 *   Vehicle   — Mulkiya (Vehicle Registration), Vehicle Insurance, RTA Periodic Test
 *   Company   — Trade License, Chamber Certificate, Contractor Classification,
 *               Civil Defence, ISO, Insurance Policies, VAT Certificate, etc.
 */
import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

const EXTRACTION_PROMPT = `You are an expert document analyst for Sama Alostoura Building Contracting LLC in Dubai, UAE.

Analyze the document image/scan provided and extract all relevant information.

Return ONLY a valid JSON object — no markdown, no explanation — with this exact structure:

{
  "documentType": "...",           // e.g. "Emirates ID", "Mulkiya", "Trade License", "Passport", "Visa", "Labour Card", "Vehicle Insurance", "RTA Test", "Chamber Certificate", "Contractor Classification", "Civil Defence Certificate", "ISO Certificate", "Workmen Insurance", "General Liability Insurance", "VAT Registration", "Other"
  "category": "...",               // MUST be exactly one of: "employee", "vehicle", "company"
  "confidence": "...",             // "high", "medium", or "low"

  // For EMPLOYEE documents (Visa, Emirates ID, Passport, Labour Card):
  "holderName": "...",             // Full name as on document (null if not applicable)
  "nationality": "...",            // Country of nationality (null if not applicable)
  "dateOfBirth": "...",            // YYYY-MM-DD (null if not found)
  "gender": "...",                 // "Male" or "Female" (null if not found)

  // For VEHICLE documents (Mulkiya, Insurance, RTA Test):
  "plateNumber": "...",            // e.g. "12345 DXB" (null if not applicable)
  "vehicleMake": "...",            // e.g. "Toyota" (null if not applicable)
  "vehicleModel": "...",           // e.g. "Hilux" (null if not applicable)
  "vehicleYear": "...",            // e.g. "2020" (null if not applicable)
  "vehicleColor": "...",           // (null if not applicable)
  "chassisNumber": "...",          // VIN / chassis (null if not applicable)

  // For COMPANY documents:
  "companyName": "...",            // Company name on document (null if not applicable)
  "licenseNumber": "...",          // License / cert number (null if not applicable)

  // Common fields:
  "docNumber": "...",              // Document/ID number, policy number, ref number
  "issuingAuthority": "...",       // e.g. "ICA", "RTA", "DED", "Dubai Municipality", "Civil Defence", "Insurance Company name"
  "issueDate": "...",              // YYYY-MM-DD (null if not found)
  "expiryDate": "...",             // YYYY-MM-DD (null if not found or no expiry)
  "notes": "..."                   // Any other useful info — e.g. visa type, profession, policy type
}

Rules:
- All dates MUST be in YYYY-MM-DD format. Convert Arabic/Hijri to Gregorian if needed.
- If a field cannot be extracted, use null (not empty string).
- For UAE visas: expiryDate is the date stamped in the passport, not the entry date.
- For Emirates ID: docNumber is the 15-digit ID number (784-XXXX-XXXXXXX-X).
- For Mulkiya: plateNumber includes the emirate code (e.g. "12345 DXB" for Dubai).
- Return ONLY the JSON object. No markdown fences, no extra text.`

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const MAX = 20 * 1024 * 1024  // 20 MB
    if (file.size > MAX) {
      return NextResponse.json({ error: 'File too large. Max 20 MB.' }, { status: 400 })
    }

    const ext  = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp']
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: `Unsupported file type: ${ext}. Use PDF, JPG, or PNG.` }, { status: 400 })
    }

    // Convert file to base64
    const bytes  = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // Build Claude message — PDFs use the beta document block, images use standard image block
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userContent: any[]

    if (ext === 'pdf') {
      // PDF support requires the pdfs-2024-09-25 beta header (handled via betas param)
      userContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: EXTRACTION_PROMPT },
      ]
    } else {
      const mediaType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: EXTRACTION_PROMPT },
      ]
    }

    const createParams = {
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      messages:   [{ role: 'user' as const, content: userContent }],
      ...(ext === 'pdf' ? { betas: ['pdfs-2024-09-25'] } : {}),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (anthropic.messages as any).create(createParams)

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''

    // Strip markdown fences if model added them despite instructions
    const jsonStr = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(jsonStr)
    } catch {
      console.error('[analyze-document] Bad JSON from Claude:', raw)
      return NextResponse.json({ error: 'Could not parse AI response. Try a clearer image.' }, { status: 422 })
    }

    return NextResponse.json({
      ok:         true,
      filename:   file.name,
      fileSize:   file.size,
      extracted,
    })
  } catch (err) {
    console.error('[analyze-document]', err)
    return NextResponse.json({ error: 'Analysis failed. Check server logs.' }, { status: 500 })
  }
}
