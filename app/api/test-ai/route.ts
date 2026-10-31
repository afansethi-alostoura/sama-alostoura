import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.GOOGLE_API_KEY
  if (!key) return NextResponse.json({ status: 'MISSING — GOOGLE_API_KEY not set' })

  // Try a minimal Gemini call
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] }),
      }
    )
    const data = await res.json()
    if (res.ok) return NextResponse.json({ status: 'OK', key_prefix: key.slice(0, 8) + '...' })
    return NextResponse.json({ status: 'API_ERROR', code: res.status, error: data?.error?.message, key_prefix: key.slice(0, 8) + '...' })
  } catch (e) {
    return NextResponse.json({ status: 'FETCH_ERROR', error: String(e) })
  }
}
