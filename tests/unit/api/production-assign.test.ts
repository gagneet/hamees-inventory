/**
 * Bulk tailor assignment — POST /api/production/assign
 * Validation rules (pure) and the route's permission / validation gates (Prisma mocked → null).
 */
import { describe, it, expect, vi } from 'vitest'

// Explicit model mocks: the global Proxy-based mock doesn't expose models outside $transaction
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    orderItem: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    orderHistory: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { auth } from '@/lib/auth'
import {
  assignRequestSchema,
  checkAssignItems,
  checkAssignTarget,
  MAX_ASSIGN_ITEMS,
  type AssignCandidateItem,
} from '@/app/api/production/_lib/assign'
import { POST } from '@/app/api/production/assign/route'

const mockedAuth = vi.mocked(auth as unknown as () => Promise<unknown>)
const asRole = (role: string) =>
  mockedAuth.mockResolvedValueOnce({ user: { id: 'user-1', name: 'U', email: 'u@example.com', role } })

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/production/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  )

const item = (id: string, status = 'CUTTING', assignedTailorId: string | null = null): AssignCandidateItem => ({
  id,
  orderId: `order-${id}`,
  assignedTailorId,
  order: { orderNumber: `ORD-${id}`, status },
})

describe('assignRequestSchema', () => {
  it('accepts a tailor id or null (unassign)', () => {
    expect(assignRequestSchema.safeParse({ orderItemIds: ['a'], tailorId: 't1' }).success).toBe(true)
    expect(assignRequestSchema.safeParse({ orderItemIds: ['a'], tailorId: null }).success).toBe(true)
  })

  it('requires between 1 and MAX_ASSIGN_ITEMS items', () => {
    expect(assignRequestSchema.safeParse({ orderItemIds: [], tailorId: 't1' }).success).toBe(false)
    const tooMany = Array.from({ length: MAX_ASSIGN_ITEMS + 1 }, (_, i) => `i${i}`)
    expect(assignRequestSchema.safeParse({ orderItemIds: tooMany, tailorId: 't1' }).success).toBe(false)
  })

  it('rejects a missing tailorId (must be explicit null to unassign)', () => {
    expect(assignRequestSchema.safeParse({ orderItemIds: ['a'] }).success).toBe(false)
  })

  it('de-duplicates item ids', () => {
    const parsed = assignRequestSchema.parse({ orderItemIds: ['a', 'b', 'a'], tailorId: null })
    expect(parsed.orderItemIds).toEqual(['a', 'b'])
  })
})

describe('checkAssignTarget', () => {
  it('allows unassigning', () => {
    expect(checkAssignTarget(null, null)).toEqual({ ok: true })
  })
  it('allows active tailors and master tailors', () => {
    expect(checkAssignTarget('t1', { role: 'TAILOR', active: true }).ok).toBe(true)
    expect(checkAssignTarget('m1', { role: 'MASTER_TAILOR', active: true }).ok).toBe(true)
  })
  it('rejects unknown, inactive and non-tailor users', () => {
    expect(checkAssignTarget('x', null)).toMatchObject({ ok: false, status: 400 })
    expect(checkAssignTarget('t1', { role: 'TAILOR', active: false })).toMatchObject({ ok: false, status: 400 })
    expect(checkAssignTarget('s1', { role: 'SALES_MANAGER', active: true })).toMatchObject({ ok: false, status: 400 })
    expect(checkAssignTarget('o1', { role: 'OWNER', active: true })).toMatchObject({ ok: false, status: 400 })
  })
})

describe('checkAssignItems', () => {
  it('passes when every requested item exists on an open order', () => {
    expect(checkAssignItems(['a', 'b'], [item('a'), item('b', 'READY')])).toEqual({ ok: true })
  })
  it('returns 404 when any item is missing', () => {
    expect(checkAssignItems(['a', 'b'], [item('a')])).toMatchObject({ ok: false, status: 404 })
  })
  it('refuses items on delivered or cancelled orders', () => {
    expect(checkAssignItems(['a'], [item('a', 'DELIVERED')])).toMatchObject({ ok: false, status: 400 })
    expect(checkAssignItems(['a'], [item('a', 'CANCELLED')])).toMatchObject({ ok: false, status: 400 })
  })
})

describe('POST /api/production/assign', () => {
  it('forbids roles without assign_tailors', async () => {
    for (const role of ['TAILOR', 'VIEWER', 'INVENTORY_MANAGER']) {
      asRole(role)
      const res = await post({ orderItemIds: ['a'], tailorId: 't1' })
      expect(res.status, role).toBe(403)
    }
  })

  it('rejects malformed JSON', async () => {
    const res = await post('{not json')
    expect(res.status).toBe(400)
  })

  it('rejects an empty item list', async () => {
    const res = await post({ orderItemIds: [], tailorId: 't1' })
    expect(res.status).toBe(400)
  })

  it('rejects assignment to a user who is not an active tailor', async () => {
    asRole('MASTER_TAILOR')
    const res = await post({ orderItemIds: ['a'], tailorId: 'ghost' }) // prisma mock → user not found
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/not an active tailor/i)
  })

  it('returns 404 when the items do not exist', async () => {
    asRole('SALES_MANAGER')
    const res = await post({ orderItemIds: ['missing'], tailorId: null })
    expect(res.status).toBe(404)
  })
})
