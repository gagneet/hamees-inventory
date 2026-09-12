/**
 * The application's public surface.
 *
 * Every API route must enforce a permission, a session, or an API key. The handful that do not
 * are listed here deliberately, so adding a new unauthenticated endpoint has to be a conscious
 * edit to this list rather than an oversight in a large pull request.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const API_ROOT = join(process.cwd(), 'app', 'api')

/** Routes that are reachable without a session, and why each one is safe. */
const ALLOWED_WITHOUT_SESSION: Record<string, string> = {
  'health/route.ts': 'Liveness probe for the deploy script and the tunnel. Reads nothing but a SELECT 1.',
  'auth/[...nextauth]/route.ts': 'The sign-in endpoint itself.',
  'excel/submit-order/route.ts': 'Guarded by the X-Excel-Api-Key header (lib/excel-api-auth.ts).',
  'public/enquiries/route.ts':
    'The public order-enquiry form. Writes only CustomerEnquiry — no customer, order, pricing or ' +
    'stock — and is rate limited per IP and per phone number with a honeypot field.',
  'public/track-request/route.ts':
    'Asks for an order-tracking link. Answers the caller with nothing at all: the signed link is ' +
    'sent over WhatsApp to the number already on the customer record. Rate limited per IP and ' +
    'per phone number with a honeypot field.',
}

const GUARDS = [
  'requirePermission',
  'requireAnyPermission',
  'requireAllPermissions',
  'requireAuth',
  'requirePagePermission',
  'auth()',
  'verifyExcelApiKey',
]

function routeFiles(dir: string, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      found.push(...routeFiles(full, prefix ? `${prefix}/${entry}` : entry))
    } else if (entry === 'route.ts' || entry === 'route.tsx') {
      found.push(prefix ? `${prefix}/${entry}` : entry)
    }
  }
  return found
}

describe('every API route is guarded, or explicitly listed as public', () => {
  const routes = routeFiles(API_ROOT)

  it('finds the API routes at all (guards against a silently empty sweep)', () => {
    expect(routes.length).toBeGreaterThan(20)
  })

  it.each(routes)('%s', (route) => {
    const source = readFileSync(join(API_ROOT, route), 'utf8')
    const guarded = GUARDS.some((guard) => source.includes(guard))
    if (guarded) return
    expect(
      Object.keys(ALLOWED_WITHOUT_SESSION),
      `${route} has no auth guard and is not on the public allowlist in this test`
    ).toContain(route)
  })

  it('the public allowlist has not grown unnoticed', () => {
    expect(Object.keys(ALLOWED_WITHOUT_SESSION).sort()).toEqual(
      [
        'auth/[...nextauth]/route.ts',
        'excel/submit-order/route.ts',
        'health/route.ts',
        'public/enquiries/route.ts',
        'public/track-request/route.ts',
      ].sort()
    )
  })

  it('the only public route that writes is the enquiry form, and it writes only CustomerEnquiry', () => {
    const source = readFileSync(join(API_ROOT, 'public', 'enquiries', 'route.ts'), 'utf8')
    const writes = [...source.matchAll(/prisma\.(\w+)\.(create|update|updateMany|upsert|delete|deleteMany)/g)]
    expect(writes.map((match) => match[1])).toEqual(['customerEnquiry'])
  })

  it('the tracking-link request writes nothing of its own', () => {
    const source = readFileSync(join(API_ROOT, 'public', 'track-request', 'route.ts'), 'utf8')
    const writes = [...source.matchAll(/prisma\.(\w+)\.(create|update|updateMany|upsert|delete|deleteMany)/g)]
    expect(writes).toEqual([])
  })

  it('the tracking-link request looks the order up only after the response is decided', () => {
    // Whether the response leaks anything is asserted behaviourally in
    // tests/unit/api/public-track-request.test.ts; this only pins the shape that makes it true.
    // Comments are stripped first: the route's own docblock says "in `after()`", and matching
    // that instead of the call would make this pass no matter what the code did.
    const source = readFileSync(join(API_ROOT, 'public', 'track-request', 'route.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')

    const scheduled = source.indexOf('after(')
    const lookup = source.indexOf('prisma.order.findFirst')
    expect(scheduled).toBeGreaterThan(-1)
    expect(lookup).toBeGreaterThan(-1)
    expect(scheduled).toBeLessThan(lookup)
  })

  it.each(['enquiries', 'track-request'])('the public %s route is rate limited and has a honeypot', (route) => {
    const source = readFileSync(join(API_ROOT, 'public', route, 'route.ts'), 'utf8')
    expect(source).toContain('rateLimit(')
    expect(source).toMatch(/honeypot/i)
  })
})
