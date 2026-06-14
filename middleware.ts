import { NextResponse, type NextRequest } from 'next/server'

// Routes that never require auth (login, webhooks, QB OAuth callback)
const PUBLIC_PATHS = new Set([
  '/login',
  '/terms',
  '/privacy',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/test-wa',
  '/api/webhooks/whatsapp',
  '/api/meta/whatsapp/webhook',
  '/api/quickbooks/callback',
  '/api/quickbooks/notify',
])

// ── HMAC session verification (Edge-compatible Web Crypto) ────────────────────
// Token format: {randomHex}.{expiryMs}.{base64url_hmac}
// Signature covers "{randomHex}.{expiryMs}" so expiry cannot be tampered.
async function verifySession(cookie: string): Promise<boolean> {
  try {
    const secret = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'

    const lastDot = cookie.lastIndexOf('.')
    if (lastDot === -1) return false
    const payload   = cookie.slice(0, lastDot)
    const sigB64url = cookie.slice(lastDot + 1)

    // Extract and check expiry from payload ({hex}.{expiry})
    const dotIdx = payload.lastIndexOf('.')
    if (dotIdx === -1) return false
    const expiry = parseInt(payload.slice(dotIdx + 1), 10)
    if (!expiry || Date.now() > expiry) return false

    // Import HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    // base64url → base64 → bytes
    const b64     = sigB64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded  = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))

    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    // Always allow public paths
    if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

    // Always allow Next.js internals
    if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
      return NextResponse.next()
    }

    const cookie = request.cookies.get('sama-session')?.value

    // No cookie → 401 for API, redirect to /login for pages
    if (!cookie) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Verify signature + expiry
    const valid = await verifySession(cookie)
    if (!valid) {
      const res = pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url))
      res.cookies.delete('sama-session')
      return res
    }

    return NextResponse.next()
  } catch (err) {
    console.error('Middleware error:', err)
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  // Cover ALL paths except Next.js static bundles and image optimiser
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
}
