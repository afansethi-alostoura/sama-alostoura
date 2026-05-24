import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Hardcoded admin credentials
const ADMIN_USERNAME = 'Samaalostoura'
const ADMIN_PASSWORD = 'Iqbalsethi8585@'

// Generate a simple session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, password } = body

    // Validate request body
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Validate credentials (timing-safe comparison to prevent timing attacks)
    const usernameMatch = crypto.timingSafeEqual(
      Buffer.from(username),
      Buffer.from(ADMIN_USERNAME)
    )
    const passwordMatch = crypto.timingSafeEqual(
      Buffer.from(password),
      Buffer.from(ADMIN_PASSWORD)
    )

    if (!usernameMatch || !passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
    }

    // Generate session token
    const sessionToken = generateSessionToken()

    // Set secure httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set('sama-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      sessionToken: sessionToken,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `Login error: ${message}` },
      { status: 500 }
    )
  }
}
