/**
 * Per-item production status routes:
 *   PATCH /api/orders/[id]/items/[itemId]/status — one garment
 *   PATCH /api/orders/[id]/status               — order-level (bulk stage move, deliver, cancel)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { after } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { UserRole } from '@/lib/permissions'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { PATCH as patchItemStatus } from '@/app/api/orders/[id]/items/[itemId]/status/route'
import { PATCH as patchOrderStatus } from '@/app/api/orders/[id]/status/route'

type MockPrisma = Record<string, any>
const mockPrisma = prisma as unknown as MockPrisma

const TAILOR_ID = 'tailor-1'
const OTHER_TAILOR = 'tailor-2'

function actAs(role: UserRole, id = TAILOR_ID) {
  vi.mocked(auth).mockResolvedValue({ user: { id, role, name: 'Test', email: 't@example.com' } } as never)
}

function patch(url: string, body: unknown) {
  return new Request(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

const itemParams = (itemId: string) => ({ params: Promise.resolve({ id: 'o1', itemId }) })
const orderParams = { params: Promise.resolve({ id: 'o1' }) }

type ItemRow = { id: string; status: string; assignedTailorId: string | null; estimatedMeters?: number }

/**
 * A two-garment order. `afterItems` is what the items look like once the move is written
 * (what syncOrderStatus reads back inside the transaction).
 */
function setupOrder(opts: { status: string; items: ItemRow[]; afterItems?: { status: string }[] }) {
  const items = opts.items.map((i) => ({
    estimatedMeters: 3,
    garmentPattern: { name: `Garment ${i.id}` },
    clothInventory: { currentStock: 50 },
    clothInventoryId: `cloth-${i.id}`,
    ...i,
  }))
  mockPrisma.order = {
    findFirst: vi.fn().mockResolvedValue({
      id: 'o1',
      orderNumber: 'ORD-1',
      status: opts.status,
      notes: null,
      items,
      accessoryStockMovements: [],
    }),
    // lock re-check (select status) → sync (select status + items) → final response (include)
    findUnique: vi.fn().mockImplementation((args: { select?: { items?: unknown } }) => {
      if (args.select?.items) return Promise.resolve({ status: opts.status, items: opts.afterItems ?? items })
      if (args.select) return Promise.resolve({ status: opts.status })
      return Promise.resolve({ id: 'o1', status: opts.status, customer: { name: 'C' }, items })
    }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  }
  mockPrisma.orderItem = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue({}),
  }
  mockPrisma.orderHistory = { create: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({ count: 0 }) }
}

beforeEach(() => {
  mockPrisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma))
})

describe('PATCH /api/orders/[id]/items/[itemId]/status', () => {
  it("returns 404 when a tailor moves a colleague's item on a shared order", async () => {
    actAs('TAILOR')
    setupOrder({
      status: 'CUTTING',
      items: [
        { id: 'mine', status: 'CUTTING', assignedTailorId: TAILOR_ID },
        { id: 'theirs', status: 'CUTTING', assignedTailorId: OTHER_TAILOR },
      ],
    })

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/theirs/status', { status: 'STITCHING' }), itemParams('theirs'))

    expect(res.status).toBe(404)
    expect(JSON.stringify(mockPrisma.order.findFirst.mock.calls[0][0].where)).toContain(TAILOR_ID)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 404 when the order is out of scope', async () => {
    actAs('TAILOR')
    setupOrder({ status: 'CUTTING', items: [] })
    mockPrisma.order.findFirst.mockResolvedValue(null)

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/x/status', { status: 'STITCHING' }), itemParams('x'))
    expect(res.status).toBe(404)
  })

  it('moves only the tailor’s own item, records it, and re-derives the order status', async () => {
    actAs('TAILOR')
    setupOrder({
      status: 'CUTTING',
      items: [
        { id: 'mine', status: 'CUTTING', assignedTailorId: TAILOR_ID },
        { id: 'theirs', status: 'STITCHING', assignedTailorId: OTHER_TAILOR },
      ],
      afterItems: [{ status: 'STITCHING' }, { status: 'STITCHING' }],
    })

    const res = await patchItemStatus(
      patch('http://localhost/api/orders/o1/items/mine/status', { status: 'STITCHING', notes: 'collar done' }),
      itemParams('mine')
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orderStatus).toBe('STITCHING')

    // Guarded write on this item only
    const claim = mockPrisma.orderItem.updateMany.mock.calls[0][0]
    expect(claim.where).toEqual({ id: 'mine', orderId: 'o1', status: 'CUTTING' })
    expect(claim.data.status).toBe('STITCHING')
    expect(claim.data.notes).toBeUndefined() // tailors can't replace item notes…

    const [itemEvent, orderEvent] = mockPrisma.orderHistory.create.mock.calls.map((c: any[]) => c[0].data)
    expect(itemEvent).toMatchObject({ changeType: 'ITEM_STATUS_UPDATE', orderItemId: 'mine', oldValue: 'CUTTING', newValue: 'STITCHING' })
    expect(itemEvent.description).toContain('collar done') // …their note goes to the history
    expect(orderEvent).toMatchObject({ changeType: 'STATUS_UPDATE', oldValue: 'CUTTING', newValue: 'STITCHING' })
    expect(mockPrisma.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'STITCHING' } })
    expect(after).not.toHaveBeenCalled()
  })

  it('notifies the customer when the last garment makes the order READY', async () => {
    actAs('TAILOR')
    setupOrder({
      status: 'FINISHING',
      items: [
        { id: 'mine', status: 'FINISHING', assignedTailorId: TAILOR_ID },
        { id: 'theirs', status: 'READY', assignedTailorId: OTHER_TAILOR },
      ],
      afterItems: [{ status: 'READY' }, { status: 'READY' }],
    })

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/mine/status', { status: 'READY' }), itemParams('mine'))

    expect(res.status).toBe(200)
    expect(after).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(whatsappService.sendOrderReady).toHaveBeenCalledWith('o1'))
  })

  it('does not notify while other garments are still in production', async () => {
    actAs('OWNER', 'owner-1')
    setupOrder({
      status: 'CUTTING',
      items: [
        { id: 'a', status: 'FINISHING', assignedTailorId: TAILOR_ID },
        { id: 'b', status: 'CUTTING', assignedTailorId: OTHER_TAILOR },
      ],
      afterItems: [{ status: 'READY' }, { status: 'CUTTING' }],
    })

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/a/status', { status: 'READY' }), itemParams('a'))

    expect(res.status).toBe(200)
    expect(mockPrisma.order.update).not.toHaveBeenCalled() // still CUTTING
    expect(after).not.toHaveBeenCalled()
  })

  it('returns 409 when the item was moved by someone else in the meantime', async () => {
    actAs('TAILOR')
    setupOrder({ status: 'CUTTING', items: [{ id: 'mine', status: 'CUTTING', assignedTailorId: TAILOR_ID }] })
    mockPrisma.orderItem.updateMany.mockResolvedValue({ count: 0 })

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/mine/status', { status: 'STITCHING' }), itemParams('mine'))

    expect(res.status).toBe(409)
    expect(mockPrisma.orderHistory.create).not.toHaveBeenCalled()
  })

  it('refuses to move a tailor’s item back more than one stage', async () => {
    actAs('TAILOR')
    setupOrder({ status: 'STITCHING', items: [{ id: 'mine', status: 'STITCHING', assignedTailorId: TAILOR_ID }] })

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/mine/status', { status: 'NEW' }), itemParams('mine'))

    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('records measured meters and wastage against this item', async () => {
    actAs('MASTER_TAILOR', 'master-1')
    setupOrder({ status: 'NEW', items: [{ id: 'a', status: 'NEW', assignedTailorId: TAILOR_ID, estimatedMeters: 2 }] })

    const res = await patchItemStatus(
      patch('http://localhost/api/orders/o1/items/a/status', { status: 'CUTTING', actualMetersUsed: 2.5 }),
      itemParams('a')
    )

    expect(res.status).toBe(200)
    const data = mockPrisma.orderItem.updateMany.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'CUTTING', actualMetersUsed: 2.5, wastageMeters: 0.5 })
  })

  it('rejects DELIVERED on an item (order-level only)', async () => {
    actAs('OWNER', 'owner-1')
    setupOrder({ status: 'READY', items: [{ id: 'a', status: 'READY', assignedTailorId: TAILOR_ID }] })

    const res = await patchItemStatus(patch('http://localhost/api/orders/o1/items/a/status', { status: 'DELIVERED' }), itemParams('a'))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/orders/[id]/status (order level)', () => {
  it('moves every item with a bulk stage change and records per-item history', async () => {
    actAs('OWNER', 'owner-1')
    setupOrder({
      status: 'NEW',
      items: [
        { id: 'a', status: 'NEW', assignedTailorId: TAILOR_ID },
        { id: 'b', status: 'CUTTING', assignedTailorId: OTHER_TAILOR },
      ],
    })

    const res = await patchOrderStatus(patch('http://localhost/api/orders/o1/status', { status: 'CUTTING' }), orderParams)

    expect(res.status).toBe(200)
    expect(mockPrisma.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: expect.objectContaining({ status: 'CUTTING' }),
    })
    const itemEvents = mockPrisma.orderHistory.createMany.mock.calls[0][0].data
    expect(itemEvents).toHaveLength(1) // item b was already cutting
    expect(itemEvents[0]).toMatchObject({ orderItemId: 'a', changeType: 'ITEM_STATUS_UPDATE', newValue: 'CUTTING' })
  })

  it('forbids a tailor from moving an order that has items of other tailors', async () => {
    actAs('TAILOR')
    setupOrder({
      status: 'NEW',
      items: [
        { id: 'a', status: 'NEW', assignedTailorId: TAILOR_ID },
        { id: 'b', status: 'NEW', assignedTailorId: OTHER_TAILOR },
      ],
    })

    const res = await patchOrderStatus(patch('http://localhost/api/orders/o1/status', { status: 'CUTTING' }), orderParams)

    expect(res.status).toBe(403)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('lets a tailor move an order whose items are all theirs', async () => {
    actAs('TAILOR')
    setupOrder({
      status: 'NEW',
      items: [
        { id: 'a', status: 'NEW', assignedTailorId: TAILOR_ID },
        { id: 'b', status: 'NEW', assignedTailorId: TAILOR_ID },
      ],
    })

    const res = await patchOrderStatus(patch('http://localhost/api/orders/o1/status', { status: 'CUTTING' }), orderParams)

    expect(res.status).toBe(200)
    expect(mockPrisma.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orderId: 'o1' }, data: expect.objectContaining({ status: 'CUTTING' }) })
    )
  })

  it('closes every item when the order is delivered, even if not all are READY', async () => {
    actAs('OWNER', 'owner-1')
    setupOrder({ status: 'FINISHING', items: [] })

    const res = await patchOrderStatus(patch('http://localhost/api/orders/o1/status', { status: 'DELIVERED' }), orderParams)

    expect(res.status).toBe(200)
    expect(mockPrisma.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: expect.objectContaining({ status: 'DELIVERED' }),
    })
    expect(mockPrisma.orderHistory.createMany).not.toHaveBeenCalled()
  })
})
