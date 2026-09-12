/**
 * FEATURETRACE: Route protection (Next.js 16 Proxy, formerly middleware)
 *
 * Optimistic check only: visitors without a session cookie are redirected to /login
 * before any protected page renders. Authoritative checks (valid JWT, active user, role
 * permissions, object-level scope) happen in app/(dashboard)/layout.tsx, section layouts,
 * and every API route handler.
 *
 * CHANGED in 0.32.x: "/" is now the public marketing site, so the login page moved to
 * "/login" and both are excluded from the matcher.
 */

import { NextResponse, type NextRequest } from 'next/server'

// Auth.js session cookie (prefixed with __Secure- on HTTPS; large tokens are chunked as .0, .1 …)
const SESSION_COOKIE_PREFIXES = ['authjs.session-token', '__Secure-authjs.session-token']

export function proxy(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some(({ name }) => SESSION_COOKIE_PREFIXES.some((prefix) => name === prefix || name.startsWith(`${prefix}.`)))
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  // Every app page except: the public marketing site ("/"), the login page ("/login"), the
  // public order-enquiry page ("/order", which takes an enquiry and never touches money or
  // stock — see app/order/page.tsx), the signed order-tracking links ("/track/<token>", where
  // the token is the credential — see lib/order-tracking.ts), API routes (which return 401
  // themselves), Next.js internals and root-level static files from public/ (logo.svg,
  // favicon.svg, robots.txt …). "marketing/" holds the public site's imagery.
  matcher: [
    '/((?!login(?:/|$)|order(?:/|$)|track/|marketing/|api(?:/|$)|_next/|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).+)',
  ],
}
