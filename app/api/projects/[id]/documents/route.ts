/**
 * Project Documents API
 * GET    /api/projects/[id]/documents         — list all docs for project
 * POST   /api/projects/[id]/documents         — upload file (multipart)
 * DELETE /api/projects/[id]/documents?docId=  — delete doc + storage file
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const BUCKET = 'project-documents'

function notConfigured() {
  return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
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

  // Return empty array on any error (e.g. table not yet created)
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

  const ext        = file.name.split('.').pop() ?? 'bin'
  const unique     = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `${id}/${folder}/${unique}`

  const buffer = await file.arrayBuffer()

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath)

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
    console.error('POST project_documents insert error:', dbErr.message)
    // Return a minimal doc record so the UI still shows the file
    return NextResponse.json({
      id: unique, project_id: id, folder, filename: unique,
      original_name: file.name, file_size: file.size, mime_type: file.type,
      storage_path: storagePath, public_url: urlData.publicUrl,
      created_at: new Date().toISOString(),
    })
  }
  return NextResponse.json(doc)
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const docId  = req.nextUrl.searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })
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
