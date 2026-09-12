/**
 * FEATURETRACE: Route protection (Next.js 16 Proxy, formerly middleware)
 *
 * Optimistic check only: visitors without a session cookie are redirected to the login page
 * before any protected page renders. Authoritative checks (valid JWT, active user, role
 * permissions, object-level scope) happen in app/(dashboard)/layout.tsx, section layouts,
 * and every API route handler.
 */

import { NextResponse, type NextRequest } from 'next/server'

// Auth.js session cookie (prefixed with __Secure- on HTTPS; large tokens are chunked as .0, .1 …)
const SESSION_COOKIE_PREFIXES = ['authjs.session-token', '__Secure-authjs.session-token']

export function proxy(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some(({ name }) => SESSION_COOKIE_PREFIXES.some((prefix) => name === prefix || name.startsWith(`${prefix}.`)))
  if (!hasSession) {
    const loginUrl = new URL('/', request.url)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  // Every app page except the public login page ("/"), API routes (which return 401 themselves),
  // Next.js internals and root-level static files from public/ (logo.svg, favicon.svg, robots.txt …).
  matcher: ['/((?!api(?:/|$)|_next/|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).+)'],
}
