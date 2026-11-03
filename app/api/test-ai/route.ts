import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ status: 'MISSING — OPENAI_API_KEY not set' })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
      }),
    })
    const data = await res.json()
    if (res.ok) return NextResponse.json({ status: 'OK', model: 'gpt-4o-mini', key_prefix: key.slice(0, 8) + '...' })
    return NextResponse.json({ status: 'API_ERROR', code: res.status, error: data?.error?.message })
  } catch (e) {
    return NextResponse.json({ status: 'FETCH_ERROR', error: String(e) })
  }
}
