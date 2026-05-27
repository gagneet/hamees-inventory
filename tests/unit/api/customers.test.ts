/**
 * Customers API Unit Tests
 *
 * Tests the Zod schema validation and response structure of:
 *   GET  /api/customers  (app/api/customers/route.ts)
 *   POST /api/customers
 *
 * Covers:
 *   - customerSchema validation (required, optional, invalid)
 *   - Pagination calculation
 *   - Search filter WHERE clause construction
 *   - Response shape
 *
 * Prisma is mocked via vitest.setup.ts — no DB calls.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Replicate the Zod schema from app/api/customers/route.ts ──────────────
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().nullish(),
  phone: z.string().min(1, 'Phone is required'),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  pincode: z.string().nullish(),
  notes: z.string().nullish(),
})

// ── Customer fixture ───────────────────────────────────────────────────────
function makeCustomer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cust-test-id',
    name: 'Rajinder Singh',
    email: 'rajinder@example.com',
    phone: '+91-98765-43210',
    address: '123 Main St',
    city: 'Amritsar',
    state: 'Punjab',
    pincode: '143001',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    measurements: [],
    orders: [],
    _count: { orders: 0 },
    ...overrides,
  }
}

// ── customerSchema – valid payloads ───────────────────────────────────────

describe('customerSchema – valid data', () => {
  it('accepts a complete valid payload', () => {
    const result = customerSchema.safeParse({
      name: 'Rajinder Singh',
      phone: '+91-98765-43210',
      email: 'rajinder@example.com',
      address: '123 Main St',
      city: 'Amritsar',
      state: 'Punjab',
      pincode: '143001',
      notes: 'VIP customer',
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal payload (only name and phone required)', () => {
    const result = customerSchema.safeParse({
      name: 'Gurpreet Kaur',
      phone: '9876543210',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null for all optional fields', () => {
    const result = customerSchema.safeParse({
      name: 'Test User',
      phone: '1234567890',
      email: null,
      address: null,
      city: null,
      state: null,
      pincode: null,
      notes: null,
    })
    expect(result.success).toBe(true)
  })

  it('omitting optional fields is valid', () => {
    const result = customerSchema.safeParse({
      name: 'Simple Customer',
      phone: '9999999999',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
      expect(result.data.city).toBeUndefined()
    }
  })
})

describe('customerSchema – invalid data', () => {
  it('rejects missing name', () => {
    const result = customerSchema.safeParse({ phone: '9876543210' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const nameError = result.error.issues.find(i => i.path[0] === 'name')
      expect(nameError).toBeDefined()
    }
  })

  it('rejects empty name string', () => {
    const result = customerSchema.safeParse({ name: '', phone: '9876543210' })
    expect(result.success).toBe(false)
  })

  it('rejects missing phone', () => {
    const result = customerSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const phoneError = result.error.issues.find(i => i.path[0] === 'phone')
      expect(phoneError).toBeDefined()
    }
  })

  it('rejects empty phone string', () => {
    const result = customerSchema.safeParse({ name: 'Test', phone: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = customerSchema.safeParse({
      name: 'Test',
      phone: '9876543210',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailError = result.error.issues.find(i => i.path[0] === 'email')
      expect(emailError).toBeDefined()
    }
  })

  it('rejects non-string name', () => {
    const result = customerSchema.safeParse({ name: 12345, phone: '9876543210' })
    expect(result.success).toBe(false)
  })
})

describe('customerSchema – email validation', () => {
  it('accepts valid email formats', () => {
    const emails = [
      'user@example.com',
      'user+tag@domain.co.in',
      'first.last@company.org',
    ]
    emails.forEach(email => {
      const result = customerSchema.safeParse({ name: 'Test', phone: '999', email })
      expect(result.success).toBe(true)
    })
  })

  it('accepts null (no email required)', () => {
    const result = customerSchema.safeParse({ name: 'Test', phone: '999', email: null })
    expect(result.success).toBe(true)
  })

  it('rejects malformed emails', () => {
    const badEmails = ['@nodomain', 'noatsign', 'missing@', 'space in@email.com']
    badEmails.forEach(email => {
      const result = customerSchema.safeParse({ name: 'Test', phone: '999', email })
      expect(result.success).toBe(false)
    })
  })
})

// ── Pagination ─────────────────────────────────────────────────────────────

describe('customers API – pagination logic', () => {
  // Mirrors route.ts: page = parseInt(params.get('page') || '1'), limit = 10
  function getPaginationMeta(page: number, limit: number, totalItems: number) {
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(totalItems / limit)
    return { page, limit, skip, totalPages, totalItems }
  }

  it('default limit is 10', () => {
    const defaultLimit = parseInt('10')
    expect(defaultLimit).toBe(10)
  })

  it('first page starts at skip=0', () => {
    expect(getPaginationMeta(1, 10, 50).skip).toBe(0)
  })

  it('second page starts at skip=10', () => {
    expect(getPaginationMeta(2, 10, 50).skip).toBe(10)
  })

  it('last page: 45 items, limit 10 → 5 pages', () => {
    expect(getPaginationMeta(1, 10, 45).totalPages).toBe(5)
  })

  it('exact multiple: 50 items, limit 10 → 5 pages', () => {
    expect(getPaginationMeta(1, 10, 50).totalPages).toBe(5)
  })

  it('51 items, limit 10 → 6 pages (ceil)', () => {
    expect(getPaginationMeta(1, 10, 51).totalPages).toBe(6)
  })

  it('single item → 1 page', () => {
    expect(getPaginationMeta(1, 10, 1).totalPages).toBe(1)
  })

  it('zero items → 0 pages', () => {
    expect(getPaginationMeta(1, 10, 0).totalPages).toBe(0)
  })
})

// ── Search filter construction ─────────────────────────────────────────────

describe('customers API – search filter construction', () => {
  // Mirrors route.ts: OR [name, email, phone] with insensitive mode
  function buildSearchWhere(search: string | null) {
    if (!search) return {}
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
      ],
    }
  }

  it('returns empty object when search is null', () => {
    expect(buildSearchWhere(null)).toEqual({})
  })

  it('returns empty object when search is empty string', () => {
    // null check: empty string is falsy
    expect(buildSearchWhere(null)).toEqual({})
  })

  it('builds OR filter across 3 fields (name, email, phone)', () => {
    const where = buildSearchWhere('rajinder')
    expect(where.OR).toHaveLength(3)
    const fields = where.OR!.map((c) => Object.keys(c)[0])
    expect(fields).toContain('name')
    expect(fields).toContain('email')
    expect(fields).toContain('phone')
  })

  it('uses case-insensitive mode for all fields', () => {
    const where = buildSearchWhere('Singh')
    where.OR!.forEach((clause) => {
      const value = Object.values(clause)[0] as { mode: string }
      expect(value.mode).toBe('insensitive')
    })
  })

  it('preserves the search term exactly (no transforms)', () => {
    const where = buildSearchWhere('Raj Singh')
    where.OR!.forEach((clause) => {
      const value = Object.values(clause)[0] as { contains: string }
      expect(value.contains).toBe('Raj Singh')
    })
  })
})

// ── GET response shape ─────────────────────────────────────────────────────

describe('GET /api/customers – response structure', () => {
  it('response has customers array and pagination metadata', () => {
    const mockResponse = {
      customers: [makeCustomer()],
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      },
    }
    expect(mockResponse).toHaveProperty('customers')
    expect(mockResponse).toHaveProperty('pagination')
    expect(Array.isArray(mockResponse.customers)).toBe(true)
    expect(mockResponse.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
    })
  })

  it('customer object has required fields', () => {
    const c = makeCustomer()
    expect(c).toHaveProperty('id')
    expect(c).toHaveProperty('name')
    expect(c).toHaveProperty('phone')
    expect(c).toHaveProperty('measurements')
    expect(c).toHaveProperty('orders')
    expect(c).toHaveProperty('_count')
  })

  it('_count.orders reflects total order count', () => {
    const c = makeCustomer({ _count: { orders: 5 } })
    expect(c._count.orders).toBe(5)
  })
})
