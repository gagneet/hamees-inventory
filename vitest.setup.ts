import { vi } from 'vitest'

// Set required environment variables before any imports.
// Database-backed integration tests only run when TEST_DATABASE_URL points at a disposable
// database (see vitest.config.ts) — they must never run against the production database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test@localhost/unused_by_unit_tests'
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3009'
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-vitest-only-not-production'
// NODE_ENV is read-only in TypeScript strict types; Vitest sets it to 'test' automatically

// Mock next/server primitives that are not available in Node test environment
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server')
  return {
    ...actual,
    // after() is a Next.js 15+ background task utility — no-op in tests
    after: vi.fn((fn: () => Promise<void>) => {
      // fire and forget so tests don't hang
      fn().catch(() => {})
    }),
  }
})

// Mock next-auth so API routes can be tested without a real session
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: {
        id: 'test-user-id',
        name: 'Test Owner',
        email: 'owner@hameesattire.com',
        role: 'OWNER',
      },
    })
  ),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}))

// Mock @/lib/db so unit tests never touch the real database.
// Integration tests override this mock per-test using vi.unmock().
vi.mock('@/lib/db', () => {
  const mockPrisma = buildPrismaMock()
  return { prisma: mockPrisma }
})

// Mock WhatsApp service to avoid network calls in tests
vi.mock('@/lib/whatsapp/whatsapp-service', () => ({
  whatsappService: {
    sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
    sendOrderReady: vi.fn().mockResolvedValue(undefined),
    sendPaymentReminder: vi.fn().mockResolvedValue(undefined),
    sendLowStockAlert: vi.fn().mockResolvedValue(undefined),
  },
}))

/**
 * Build a recursive auto-mocked Prisma client.
 * Every model method returns vi.fn() that resolves to sensible defaults.
 */
function buildPrismaMock() {
  // Models and their methods are created lazily and cached, so `prisma.user.findMany`
  // is the same vi.fn() on every access (tests can call .mockResolvedValue on it).
  // Assigning a model (`prisma.order = { findMany: vi.fn() }`) replaces that model's methods;
  // methods the assignment doesn't list are still auto-mocked.
  const createModel = (initial: Record<string, unknown> = {}) => {
    const methods = new Map<string, unknown>(Object.entries(initial))
    return new Proxy({} as Record<string, unknown>, {
      get(_t, methodName) {
        if (typeof methodName !== 'string') return undefined
        if (methodName === 'fields') return new Proxy({}, { get: () => undefined })
        if (!methods.has(methodName)) methods.set(methodName, vi.fn().mockResolvedValue(null))
        return methods.get(methodName)
      },
      set(_t, methodName, value) {
        if (typeof methodName === 'string') methods.set(methodName, value)
        return true
      },
    })
  }
  const models = new Map<string, Record<string, unknown>>()
  const model = (name: string) => {
    if (!models.has(name)) models.set(name, createModel())
    return models.get(name)!
  }

  const special: Record<string, unknown> = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  }

  const client: Record<string | symbol, unknown> = new Proxy({} as Record<string | symbol, unknown>, {
    get(_t, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (prop === '$transaction') return transaction
      if (prop in special) return special[prop]
      return model(prop)
    },
    // Tests may assign `prisma.$transaction = vi.fn()` or a whole model; without this trap
    // the assignment would be silently dropped
    set(_t, prop, value) {
      if (typeof prop !== 'string') return true
      if (prop === '$transaction') transaction = value
      else if (prop.startsWith('$')) special[prop] = value
      else models.set(prop, createModel(value && typeof value === 'object' ? (value as Record<string, unknown>) : {}))
      return true
    },
  })

  // Supports both interactive (callback) and batch (array of promises) transactions
  let transaction: unknown = vi.fn(async (arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => Promise<unknown>)(client) : Promise.all(arg as Promise<unknown>[])
  )

  return client
}
