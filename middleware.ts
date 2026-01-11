import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname === '/'
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/inventory') ||
    req.nextUrl.pathname.startsWith('/orders') ||
    req.nextUrl.pathname.startsWith('/customers') ||
    req.nextUrl.pathname.startsWith('/suppliers') ||
    req.nextUrl.pathname.startsWith('/alerts') ||
    req.nextUrl.pathname.startsWith('/settings')

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
