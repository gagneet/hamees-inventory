/**
 * Data-scope regressions: payment-reminder alerts, stock-movement order links, WhatsApp history,
 * the customer report for non-financial roles, and audited accessory stock corrections.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { UserRole } from '@/lib/permissions'
import type { Actor } from '@/lib/authz'
import { POST as dismissAlert } from '@/app/api/alerts/[id]/dismiss/route'
import { PATCH as readAlert } from '@/app/api/alerts/[id]/read/route'
import { PATCH as patchAlert } from '@/app/api/alerts/route'
import { POST as markAllRead } from '@/app/api/alerts/mark-all-read/route'
import { buildAlerts } from '@/app/api/dashboard/enhanced-stats/sections'
import { GET as clothHistory } from '@/app/api/inventory/cloth/[id]/history/route'
import { GET as whatsappHistory } from '@/app/api/whatsapp/history/route'
import { GET as customersReport } from '@/app/api/reports/customers/route'
import { PATCH as patchAccessory } from '@/app/api/inventory/accessories/[id]/route'

const db = prisma as unknown as Record<string, any>

function actAs(role: UserRole, id = 'user-1') {
  vi.mocked(auth).mockResolvedValue({ user: { id, role, name: 'Test', email: 't@example.com' } } as never)
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('payment-reminder alerts are invisible to non-financial roles', () => {
  const singleAlertActions = [
    ['dismiss', () => dismissAlert(new Request('http://localhost/api/alerts/a1/dismiss', { method: 'POST' }), params('a1'))],
    ['read', () => readAlert(new Request('http://localhost/api/alerts/a1/read', { method: 'PATCH' }), params('a1'))],
    [
      'PATCH /api/alerts',
      () =>
        patchAlert(
          new Request('http://localhost/api/alerts', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: 'a1', isDismissed: true }),
          })
        ),
    ],
  ] as const

  for (const [name, call] of singleAlertActions) {
    it(`${name}: an inventory manager gets 404 for a payment reminder`, async () => {
      actAs('INVENTORY_MANAGER')
      db.alert.findFirst.mockResolvedValue(null)

      const res = await call()

      expect(res.status).toBe(404)
      expect(JSON.stringify(db.alert.findFirst.mock.calls[0][0].where)).toContain('REORDER_REMINDER')
      expect(db.alert.update).not.toHaveBeenCalled()
    })
  }

  it('owners act on any alert (no visibility filter)', async () => {
    actAs('OWNER')
    db.alert.findFirst.mockResolvedValue({ id: 'a1' })
    db.alert.update.mockResolvedValue({ id: 'a1' })

    const res = await dismissAlert(new Request('http://localhost/api/alerts/a1/dismiss', { method: 'POST' }), params('a1'))

    expect(res.status).toBe(200)
    expect(JSON.stringify(db.alert.findFirst.mock.calls[0][0].where)).not.toContain('REORDER_REMINDER')
  })

  it('mark-all-read only touches alerts the role can see', async () => {
    actAs('INVENTORY_MANAGER')
    db.alert.updateMany.mockResolvedValue({ count: 3 })
    expect((await markAllRead()).status).toBe(200)
    expect(JSON.stringify(db.alert.updateMany.mock.calls[0][0].where)).toContain('REORDER_REMINDER')

    actAs('OWNER')
    await markAllRead()
    expect(JSON.stringify(db.alert.updateMany.mock.calls[1][0].where)).not.toContain('REORDER_REMINDER')
  })

  it('dashboard alerts are scoped and the unread count is a real count', async () => {
    db.alert.count.mockResolvedValue(12)
    db.alert.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }])

    const result = await buildAlerts({ id: 'v1', role: 'VIEWER' } as Actor)

    expect(result.unread).toBe(12)
    expect(result.recent).toHaveLength(5)
    expect(JSON.stringify(db.alert.count.mock.calls[0][0].where)).toContain('REORDER_REMINDER')
    expect(JSON.stringify(db.alert.findMany.mock.calls[0][0].where)).toContain('REORDER_REMINDER')
  })
})

describe('cloth stock history', () => {
  const movements = [
    { id: 'm1', orderId: 'o1', order: { id: 'o1', orderNumber: 'ORD-1' } },
    { id: 'm2', orderId: 'o2', order: { id: 'o2', orderNumber: 'ORD-2' } },
    { id: 'm3', orderId: null, order: null },
  ]

  beforeEach(() => {
    db.clothInventory.findUnique.mockResolvedValue({ id: 'c1', name: 'Linen' })
    db.stockMovement.findMany.mockResolvedValue(movements)
  })

  it("hides links to orders outside a tailor's scope", async () => {
    actAs('TAILOR', 'tailor-1')
    db.order.findMany.mockResolvedValue([{ id: 'o1' }])

    const res = await clothHistory(new Request('http://localhost/api/inventory/cloth/c1/history') as never, params('c1'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.movements.map((m: any) => m.order?.orderNumber ?? null)).toEqual(['ORD-1', null, null])
    expect(JSON.stringify(body)).not.toContain('ORD-2')
    expect(JSON.stringify(db.order.findMany.mock.calls[0][0].where)).toContain('tailor-1')
  })

  it('keeps every order link for roles that see all orders', async () => {
    actAs('OWNER')

    const body = await (await clothHistory(new Request('http://localhost/x') as never, params('c1'))).json()

    expect(body.movements.map((m: any) => m.order?.orderNumber ?? null)).toEqual(['ORD-1', 'ORD-2', null])
    expect(db.order.findMany).not.toHaveBeenCalled()
  })
})

describe('WhatsApp history', () => {
  it("limits a tailor to messages about their own orders (no customer-wide arm)", async () => {
    actAs('TAILOR', 'tailor-1')
    db.whatsAppMessage.findMany.mockResolvedValue([])
    db.whatsAppMessage.groupBy.mockResolvedValue([])

    const res = await whatsappHistory(new Request('http://localhost/api/whatsapp/history'))

    expect(res.status).toBe(200)
    const where = JSON.stringify(db.whatsAppMessage.findMany.mock.calls[0][0].where)
    expect(where).toContain('tailor-1')
    expect(where).not.toContain('"customer"')
  })
})

describe('customer report', () => {
  const customers = [
    {
      id: 'c1',
      name: 'Asha',
      phone: '9000000001',
      email: null,
      city: 'Amritsar',
      orders: [
        { totalAmount: 60000, createdAt: new Date('2026-01-01') },
        { totalAmount: 1000, createdAt: new Date('2026-02-01') },
      ],
      measurements: [{ id: 'm1' }],
    },
    { id: 'c2', name: 'Ravi', phone: '9000000002', email: null, city: null, orders: [], measurements: [] },
  ]

  beforeEach(() => {
    db.customer.findMany.mockResolvedValue(customers)
  })

  it('gives a sales manager counts but no amounts (and does not crash the page shape)', async () => {
    actAs('SALES_MANAGER')

    const res = await customersReport(new Request('http://localhost/api/reports/customers'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.financialsHidden).toBe(true)
    expect(body.summary).toMatchObject({
      totalCustomers: 2,
      activeCustomers: 1,
      repeatCustomers: 1,
      avgLifetimeValue: null,
      avgOrderValue: null,
    })
    expect(body.topCustomers[0]).toMatchObject({ name: 'Asha', orderCount: 2, totalRevenue: null, avgOrderValue: null })
    expect(body.customerSegments).toBeNull()
    expect(JSON.stringify(body)).not.toMatch(/61000|60000/)
  })

  it('gives owners revenue figures and segments', async () => {
    actAs('OWNER')

    const body = await (await customersReport(new Request('http://localhost/api/reports/customers'))).json()

    expect(body.financialsHidden).toBe(false)
    expect(body.topCustomers[0].totalRevenue).toBe(61000)
    expect(body.customerSegments).toEqual({ highValue: 1, mediumValue: 0, lowValue: 0 })
  })
})

describe('accessory stock corrections', () => {
  function patch(body: unknown) {
    return patchAccessory(
      new Request('http://localhost/api/inventory/accessories/a1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }) as never,
      params('a1')
    )
  }

  beforeEach(() => {
    actAs('INVENTORY_MANAGER', 'inv-1')
    // mockReset drops "once" values a previous test left unconsumed
    db.accessoryInventory.findUnique.mockReset()
    vi.mocked(prisma.$queryRaw).mockReset()
    db.accessoryInventory.findUnique
      .mockResolvedValueOnce({ id: 'a1', name: 'Button', currentStock: 10, reserved: 4 })
      .mockResolvedValueOnce({ id: 'a1', name: 'Button', currentStock: 6, reserved: 4 })
  })

  it('refuses to set stock below the reserved quantity', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as never)

    const res = await patch({ currentStock: 2 })

    expect(res.status).toBe(400)
    expect(db.accessoryStockMovement.create).not.toHaveBeenCalled()
  })

  it('records an ADJUSTMENT movement for the change', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ previousStock: 10, currentStock: 6, reserved: 4 }] as never)

    const res = await patch({ currentStock: 6, _auditNote: 'Stock take' })

    expect(res.status).toBe(200)
    expect(db.accessoryStockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accessoryInventoryId: 'a1',
        userId: 'inv-1',
        type: 'ADJUSTMENT',
        quantityUnits: -4,
        balanceAfterUnits: 6,
        notes: 'Stock take',
      }),
    })
    // Stock is never written through the generic update
    expect(db.accessoryInventory.update).not.toHaveBeenCalled()
    expect(db.accessoryInventory.updateMany).not.toHaveBeenCalled()
  })
})
