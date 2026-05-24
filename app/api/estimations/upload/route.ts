import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { writeFile } from 'fs/promises'

const UPLOAD_DIR = path.join(process.cwd(), '.uploads')
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'dwg', 'dxf', 'txt']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }
  } catch (error) {
    console.error('Error creating upload directory:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    const filename = `${timestamp}_${random}_${file.name}`
    const filepath = path.join(UPLOAD_DIR, filename)

    try {
      // Save file
      const bytes = await file.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))

      // Verify file was written
      if (!fs.existsSync(filepath)) {
        throw new Error('File was not written successfully')
      }

      // Return file info for AI processing
      return NextResponse.json({
        success: true,
        filename: file.name,
        savedAs: filename,
        filepath,
        size: file.size,
        type: ext,
        message: 'File uploaded successfully. Ready for AI extraction.'
      }, { status: 201 })
    } catch (writeError) {
      console.error('Error writing file to disk:', writeError)
      // Clean up if file partially written
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath)
        }
      } catch (e) {
        console.error('Error cleaning up file:', e)
      }
      throw writeError
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// GET: List uploaded files (for debugging)
export async function GET() {
  try {
    await ensureUploadDir()
    const files = fs.readdirSync(UPLOAD_DIR)
    return NextResponse.json({ files, count: files.length })
  } catch (error) {
    console.error('Error listing files:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}
