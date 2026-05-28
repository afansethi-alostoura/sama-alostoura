/**
 * POST /api/estimations/signed-upload-url
 *
 * Server creates a signed upload URL for a single drawing file.
 * The browser then uploads the file DIRECTLY to Supabase Storage using
 * that URL — completely bypassing Vercel's 4.5 MB request body limit.
 *
 * Body: { filename: string }
 * Returns: { signedUrl: string, token: string, path: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET          = 'estimation-drawings'
const FILE_SIZE_LIMIT = 52_428_800  // 50 MB

async function ensureBucket() {
  if (!supabaseAdmin) return
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!data) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public:        false,
      fileSizeLimit: FILE_SIZE_LIMIT,
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Storage not configured — add Supabase env vars.' },
        { status: 500 },
      )
    }

    const { filename } = await req.json()
    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 })
    }

    await ensureBucket()

    // Unique storage path for this file
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${filename}`

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path)

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to generate upload URL' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token:     data.token,
      path:      data.path,
    })
  } catch (err) {
    console.error('signed-upload-url error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
