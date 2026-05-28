/**
 * Project Documents API
 * GET    /api/projects/[id]/documents        — list docs for this project
 * POST   /api/projects/[id]/documents        — upload file (multipart)
 * DELETE /api/projects/[id]/documents?docId= — delete doc + storage file
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const BUCKET = 'project-documents'

function notConfigured() {
  return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
}

/** Ensure the storage bucket exists — creates it with public access if missing */
async function ensureBucket() {
  if (!supabaseAdmin) return
  const { data: existing } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!existing) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52428800, // 50 MB
    })
    if (error && !error.message.toLowerCase().includes('already exists')) {
      console.error('ensureBucket error:', error.message)
    }
  }
}

// ── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isSupabaseConfigured() || !supabaseAdmin) return notConfigured()

  const { data, error } = await supabaseAdmin
    .from('project_documents')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET project_documents error:', error.message)
    return NextResponse.json([])
  }
  return NextResponse.json(data ?? [])
}

// ── POST (upload) ─────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isSupabaseConfigured() || !supabaseAdmin) return notConfigured()

  const form   = await req.formData()
  const file   = form.get('file')   as File | null
  const folder = form.get('folder') as string | null

  if (!file || !folder) {
    return NextResponse.json({ error: 'file and folder required' }, { status: 400 })
  }

  // ── 1. Make sure bucket exists ────────────────────────────────────────────
  await ensureBucket()

  // ── 2. Upload file to storage ─────────────────────────────────────────────
  const ext         = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const unique      = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `${id}/${folder}/${unique}`
  const buffer      = await file.arrayBuffer()

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (upErr) {
    console.error('Storage upload error:', upErr.message)
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 })
  }

  // ── 3. Get public URL ─────────────────────────────────────────────────────
  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath)

  // ── 4. Save record to database ────────────────────────────────────────────
  const { data: doc, error: dbErr } = await supabaseAdmin
    .from('project_documents')
    .insert({
      project_id:    id,
      folder,
      filename:      unique,
      original_name: file.name,
      file_size:     file.size,
      mime_type:     file.type,
      storage_path:  storagePath,
      public_url:    urlData.publicUrl,
    })
    .select()
    .single()

  if (dbErr) {
    console.error('DB insert error:', dbErr.message)
    // File is in storage — clean it up to avoid orphans
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json(
      { error: `Database error: ${dbErr.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json(doc)
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }  = await params
  const docId   = req.nextUrl.searchParams.get('docId')
  if (!docId)   return NextResponse.json({ error: 'docId required' }, { status: 400 })
  if (!isSupabaseConfigured() || !supabaseAdmin) return notConfigured()

  const { data: doc } = await supabaseAdmin
    .from('project_documents')
    .select('storage_path')
    .eq('id', docId)
    .eq('project_id', id)
    .single()

  if (doc?.storage_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path])
  }

  await supabaseAdmin.from('project_documents').delete().eq('id', docId)
  return NextResponse.json({ deleted: true })
}
