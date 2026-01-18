import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if route is protected
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/suppliers') ||
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/settings')

  // Check if route is the login page
  const isAuthPage = pathname === '/'

  // Check for session token (NextAuth.js uses this cookie name)
  const sessionToken = request.cookies.get('authjs.session-token') ||
                       request.cookies.get('__Secure-authjs.session-token')

  const isLoggedIn = !!sessionToken

  // Redirect to login if accessing protected route without session
  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect to dashboard if accessing login page while logged in
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
