import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { PATCH as patchStatus } from '@/app/api/orders/[id]/status/route'
import { PATCH as patchItem } from '@/app/api/orders/[id]/items/[itemId]/route'
import { GET as listOrders } from '@/app/api/orders/route'
import { GET as getCustomer } from '@/app/api/customers/[id]/route'
import { POST as recordPayment } from '@/app/api/orders/[id]/payments/route'
import { POST as dismissAlert } from '@/app/api/alerts/[id]/dismiss/route'
import { GET as customersReport } from '@/app/api/reports/customers/route'

type MockPrisma = Record<string, any>
const mockPrisma = prisma as unknown as MockPrisma

const TAILOR_ID = 'tailor-1'

/**
 * Sign in as `role`. The real requirePermission/requireAnyPermission helpers run against this
 * session, so the RBAC matrix in lib/permissions.ts is exercised, not bypassed.
 */
function actAs(role: UserRole, id = TAILOR_ID) {
  const session = { user: { id, role, name: 'Test', email: 't@example.com' } }
  vi.mocked(auth).mockResolvedValue(session as never)
}

function jsonRequest(url: string, body: unknown, method = 'PATCH') {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('BOLA / object-level authorization', () => {
  beforeEach(() => {
    mockPrisma.order = {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    }
    mockPrisma.orderItem = { findFirst: vi.fn(), update: vi.fn() }
    mockPrisma.customer = { count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() }
    mockPrisma.user = { findUnique: vi.fn() }
    mockPrisma.$transaction = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 404 when a tailor updates the status of an order not assigned to them', async () => {
    actAs('TAILOR')
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await patchStatus(jsonRequest('http://localhost/api/orders/o1/status', { status: 'CUTTING' }), {
      params: Promise.resolve({ id: 'o1' }),
    })

    expect(res.status).toBe(404)
    const where = mockPrisma.order.findFirst.mock.calls[0][0].where
    expect(JSON.stringify(where)).toContain(TAILOR_ID)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('forbids a tailor from marking an order DELIVERED', async () => {
    actAs('TAILOR')
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'o1',
      orderNumber: 'ORD-1',
      status: 'READY',
      notes: null,
      items: [],
      accessoryStockMovements: [],
    })

    const res = await patchStatus(jsonRequest('http://localhost/api/orders/o1/status', { status: 'DELIVERED' }), {
      params: Promise.resolve({ id: 'o1' }),
    })

    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('forbids changing assignedTailorId without assign_tailors', async () => {
    const role = (['TAILOR', 'VIEWER', 'SALES_MANAGER', 'INVENTORY_MANAGER'] as UserRole[]).find(
      (r) => !hasPermission(r, 'assign_tailors')
    )!
    actAs(role)
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      id: 'i1',
      orderId: 'o1',
      garmentPatternId: 'g1',
      clothInventoryId: 'c1',
      quantityOrdered: 1,
      assignedTailorId: TAILOR_ID,
      notes: null,
      estimatedMeters: 3,
      totalPrice: 1000,
      order: { id: 'o1', status: 'NEW', orderNumber: 'ORD-1' },
      garmentPattern: { name: 'Shirt' },
      clothInventory: { name: 'Linen', color: 'Blue', pricePerMeter: 100, currentStock: 50 },
      assignedTailor: { id: TAILOR_ID, name: 'Tailor' },
    })

    const res = await patchItem(
      jsonRequest('http://localhost/api/orders/o1/items/i1', { assignedTailorId: 'someone-else' }) as never,
      { params: Promise.resolve({ id: 'o1', itemId: 'i1' }) }
    )

    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('scopes the order item lookup to the parent order and the actor', async () => {
    actAs('TAILOR')
    mockPrisma.orderItem.findFirst.mockResolvedValue(null)

    const res = await patchItem(
      jsonRequest('http://localhost/api/orders/o1/items/i1', { notes: 'hi' }) as never,
      { params: Promise.resolve({ id: 'o1', itemId: 'i1' }) }
    )

    expect(res.status).toBe(404)
    const where = mockPrisma.orderItem.findFirst.mock.calls[0][0].where
    expect(where.id).toBe('i1')
    expect(where.orderId).toBe('o1')
    expect(JSON.stringify(where.order)).toContain(TAILOR_ID)
  })

  it("adds the tailor's assignment scope to the orders list query", async () => {
    actAs('TAILOR')
    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.order.groupBy.mockResolvedValue([])
    mockPrisma.order.findMany.mockResolvedValue([])

    const res = await listOrders(new Request('http://localhost/api/orders?status=NEW'))

    expect(res.status).toBe(200)
    const where = mockPrisma.order.findMany.mock.calls[0][0].where
    const serialized = JSON.stringify(where)
    expect(serialized).toContain(TAILOR_ID)
    expect(serialized).toContain('assignedTailorId')
    expect(serialized).toContain('NEW')
  })

  it('does not scope the orders list for roles that can view all orders', async () => {
    actAs('OWNER', 'owner-1')
    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.order.groupBy.mockResolvedValue([])
    mockPrisma.order.findMany.mockResolvedValue([])

    const res = await listOrders(new Request('http://localhost/api/orders'))

    expect(res.status).toBe(200)

    const where = mockPrisma.order.findMany.mock.calls[0][0].where
    expect(JSON.stringify(where ?? {})).not.toContain('assignedTailorId')
  })

  it('returns 404 when a tailor reads a customer outside their orders', async () => {
    actAs('TAILOR')
    mockPrisma.customer.count.mockResolvedValue(0)

    const res = await getCustomer(new Request('http://localhost/api/customers/c1') as never, {
      params: Promise.resolve({ id: 'c1' }),
    })

    expect(res.status).toBe(404)
    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled()
  })

  it('rejects an invalid order status filter', async () => {
    actAs('OWNER', 'owner-1')

    const res = await listOrders(new Request('http://localhost/api/orders?status=HACKED'))

    expect(res.status).toBe(400)
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })
})

describe('RBAC denials run through the real permission helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forbids a tailor from recording a payment', async () => {
    actAs('TAILOR')

    const res = await recordPayment(
      jsonRequest('http://localhost/api/orders/o1/payments', { amount: 100, paymentMode: 'CASH' }, 'POST'),
      { params: Promise.resolve({ id: 'o1' }) }
    )

    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('forbids a viewer from dismissing alerts', async () => {
    actAs('VIEWER', 'viewer-1')

    const res = await dismissAlert(new Request('http://localhost/api/alerts/a1/dismiss', { method: 'POST' }), {
      params: Promise.resolve({ id: 'a1' }),
    })

    expect(res.status).toBe(403)
    expect(mockPrisma.alert.update).not.toHaveBeenCalled()
  })

  it('forbids a tailor from the customer report', async () => {
    actAs('TAILOR')

    const res = await customersReport(new Request('http://localhost/api/reports/customers'))

    expect(res.status).toBe(403)
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled()
  })

  it('forbids an inventory manager from listing orders', async () => {
    actAs('INVENTORY_MANAGER', 'inv-1')

    const res = await listOrders(new Request('http://localhost/api/orders'))

    expect(res.status).toBe(403)
    expect(mockPrisma.order.findMany).not.toHaveBeenCalled()
  })

  it('returns 401 without a session', async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const res = await listOrders(new Request('http://localhost/api/orders'))

    expect(res.status).toBe(401)
  })
})
