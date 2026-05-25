import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = new Set(['/login', '/terms', '/privacy', '/api/auth/login'])

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    // Allow public routes
    if (publicRoutes.has(pathname)) {
      return NextResponse.next()
    }

    // Check for session token
    const sessionToken = request.cookies.get('sama-session')?.value

    // Redirect to login if no session token
    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, redirect to login to be safe
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
