import { vi } from 'vitest'

// Set required environment variables before any imports
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://hamees_user@/tailor_inventory?host=/var/run/postgresql'
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3009'
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-vitest-only-not-production'
process.env.NODE_ENV = 'test'

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
  const modelProxy = new Proxy(
    {},
    {
      get(_target, modelName: string) {
        return new Proxy(
          {},
          {
            get(_t, methodName: string) {
              if (methodName === 'fields') {
                return new Proxy({}, { get: () => undefined })
              }
              return vi.fn().mockResolvedValue(null)
            },
          }
        )
      },
    }
  )

  return {
    ...modelProxy,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(modelProxy)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  }
}
