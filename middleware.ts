import { NextResponse, type NextRequest } from 'next/server'

// Routes that never require auth (login, webhooks, QB OAuth callback)
const PUBLIC_PATHS = new Set([
  '/login',
  '/setup-totp',
  '/terms',
  '/privacy',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/setup-totp',
  '/api/auth/test-wa',
  '/api/webhooks/whatsapp',
  '/api/meta/whatsapp/webhook',
  '/api/quickbooks/callback',
  '/api/quickbooks/notify',
  '/api/debug',
  '/api/trigger-sync',
  '/api/quickbooks/sync',
  '/api/projects/sync-all',
  '/api/whatsapp/webhook',
  '/api/test-ai',
])

// Pages/APIs engineers cannot access (financial & admin-only)
const ENGINEER_BLOCKED_PREFIXES = [
  '/reconciliation',
  '/api/reconcil',
  '/api/quickbooks',
  '/api/agents/accountant',
  '/api/agents/ceo-dashboard',
  '/settings',
]

// HMAC session verification (Edge-compatible Web Crypto)
// Token format (new): {role}:{randomHex}.{expiry}.{base64url_hmac}
// Token format (legacy): {randomHex}.{expiry}.{base64url_hmac}
async function verifySession(cookie: string): Promise<{ valid: boolean; role: string }> {
  try {
    const secret = process.env.SESSION_SECRET ?? 'dev-secret-change-in-production'

    const lastDot = cookie.lastIndexOf('.')
    if (lastDot === -1) return { valid: false, role: '' }
    const payload   = cookie.slice(0, lastDot)
    const sigB64url = cookie.slice(lastDot + 1)

    // Extract expiry from payload (last numeric segment before the sig dot)
    const dotIdx = payload.lastIndexOf('.')
    if (dotIdx === -1) return { valid: false, role: '' }
    const expiry = parseInt(payload.slice(dotIdx + 1), 10)
    if (!expiry || Date.now() > expiry) return { valid: false, role: '' }

    // Import HMAC key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )

    // base64url → bytes
    const b64      = sigB64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded   = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const sigBytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0))
    const valid    = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))

    // Parse role — new tokens start with "{role}:" before the hex
    const colonIdx = payload.indexOf(':')
    const role = (valid && colonIdx !== -1) ? payload.slice(0, colonIdx) : 'admin'

    return { valid, role }
  } catch {
    return { valid: false, role: '' }
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
    const { valid, role } = await verifySession(cookie)
    if (!valid) {
      const res = pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url))
      res.cookies.delete('sama-session')
      return res
    }

    // Engineers cannot access financial/admin routes
    if (role === 'engineer') {
      const blocked = ENGINEER_BLOCKED_PREFIXES.some(p => pathname.startsWith(p))
      if (blocked) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/projects', request.url))
      }
    }

    // Pass role to downstream via header (pages can read via headers())
    const res = NextResponse.next()
    res.headers.set('x-user-role', role)
    return res
  } catch (err) {
    console.error('Middleware error:', err)
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)',],
}
