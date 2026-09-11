/**
 * Integration Tests – per-item production status (PATCH /api/orders/[id]/items/[itemId]/status)
 *
 * Against a real (disposable, seeded) database:
 * 1. Moving one garment leaves the order at the least advanced item's stage
 * 2. The order becomes READY — and the customer is notified — only when every garment is READY
 * 3. A tailor may move only their own item (another tailor's item is a 404) and back one stage at most
 * 4. Every item move writes a history row linked to the item
 *
 * Creates one order (number prefix "TEST-VITEST-ITEMSTATUS-") from seeded customer, pattern and
 * fabric rows and deletes it afterwards, even on failure.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.unmock('@/lib/db')

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { PATCH } from '@/app/api/orders/[id]/items/[itemId]/status/route'

const ORDER_PREFIX = 'TEST-VITEST-ITEMSTATUS-'

type SessionUser = { id: string; name: string; email: string; role: string }
let owner: SessionUser
let tailor: SessionUser
let orderId: string
let tailorItemId: string
let otherItemId: string

function actAs(user: SessionUser) {
  vi.mocked(auth).mockImplementation((() => Promise.resolve({ user })) as unknown as typeof auth)
}

async function move(itemId: string, status: string) {
  const response = await PATCH(
    new Request('http://localhost/api', { method: 'PATCH', body: JSON.stringify({ status }) }),
    { params: Promise.resolve({ id: orderId, itemId }) }
  )
  return { status: response.status, body: await response.json() }
}

async function orderStatus() {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })
  return order.status
}

async function cleanup() {
  const orders = await prisma.order.findMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } }, select: { id: true } })
  const ids = orders.map((o) => o.id)
  if (ids.length === 0) return
  await prisma.orderHistory.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } })
  await prisma.order.deleteMany({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  await cleanup()
  const [ownerRow, tailorRow, customer, pattern, cloth] = await Promise.all([
    prisma.user.findFirst({ where: { role: 'OWNER', active: true } }),
    prisma.user.findFirst({ where: { role: 'TAILOR', active: true } }),
    prisma.customer.findFirst({ select: { id: true } }),
    prisma.garmentPattern.findFirst({ select: { id: true } }),
    prisma.clothInventory.findFirst({ select: { id: true } }),
  ])
  if (!ownerRow || !tailorRow || !customer || !pattern || !cloth) {
    throw new Error('The test database must be seeded (pnpm db:seed) before running this test')
  }
  owner = { id: ownerRow.id, name: ownerRow.name, email: ownerRow.email, role: 'OWNER' }
  tailor = { id: tailorRow.id, name: tailorRow.name, email: tailorRow.email, role: 'TAILOR' }

  const order = await prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${Date.now()}`,
      customerId: customer.id,
      userId: owner.id,
      deliveryDate: new Date(Date.now() + 7 * 86_400_000),
      totalAmount: 0,
      balanceAmount: 0,
      status: 'NEW',
      items: {
        create: [
          { garmentPatternId: pattern.id, clothInventoryId: cloth.id, estimatedMeters: 1, pricePerUnit: 0, totalPrice: 0, assignedTailorId: tailor.id },
          { garmentPatternId: pattern.id, clothInventoryId: cloth.id, estimatedMeters: 1, pricePerUnit: 0, totalPrice: 0 },
        ],
      },
    },
    include: { items: { orderBy: { id: 'asc' } } },
  })
  orderId = order.id
  tailorItemId = order.items.find((i) => i.assignedTailorId === tailor.id)!.id
  otherItemId = order.items.find((i) => i.assignedTailorId === null)!.id
})

afterAll(async () => {
  try {
    await cleanup()
  } finally {
    await prisma.$disconnect()
  }
})

describe('per-item production status', () => {
  it('keeps the order at the least advanced garment', async () => {
    actAs(owner)
    const first = await move(tailorItemId, 'CUTTING')
    expect(first.status).toBe(200)
    expect(first.body.orderStatus).toBe('NEW')
    expect(await orderStatus()).toBe('NEW')

    const second = await move(otherItemId, 'STITCHING')
    expect(second.status).toBe(200)
    expect(second.body.orderStatus).toBe('CUTTING')
    expect(await orderStatus()).toBe('CUTTING')

    const itemRows = await prisma.orderHistory.findMany({ where: { orderId, changeType: 'ITEM_STATUS_UPDATE' } })
    expect(itemRows.map((r) => r.orderItemId).sort()).toEqual([otherItemId, tailorItemId].sort())
    const orderRows = await prisma.orderHistory.findMany({ where: { orderId, changeType: 'STATUS_UPDATE' } })
    expect(orderRows.map((r) => `${r.oldValue}->${r.newValue}`)).toEqual(['NEW->CUTTING'])
  })

  it("lets a tailor move only their own garment, and back one stage at most", async () => {
    actAs(tailor)
    expect((await move(otherItemId, 'FINISHING')).status).toBe(404)

    const forward = await move(tailorItemId, 'FINISHING')
    expect(forward.status).toBe(200)
    expect(forward.body.orderStatus).toBe('STITCHING')

    expect((await move(tailorItemId, 'CUTTING')).status).toBe(403)
    expect((await move(tailorItemId, 'STITCHING')).status).toBe(200)
    expect(await orderStatus()).toBe('STITCHING')
  })

  it('makes the order READY and notifies the customer only when every garment is ready', async () => {
    actAs(owner)
    const one = await move(tailorItemId, 'READY')
    expect(one.body.orderStatus).toBe('STITCHING')
    expect(vi.mocked(whatsappService.sendOrderReady)).not.toHaveBeenCalled()

    const both = await move(otherItemId, 'READY')
    expect(both.status).toBe(200)
    expect(both.body.orderStatus).toBe('READY')
    expect(await orderStatus()).toBe('READY')
    expect(vi.mocked(whatsappService.sendOrderReady)).toHaveBeenCalledWith(orderId)
  })

  it('refuses statuses outside production and moves to the same stage', async () => {
    actAs(owner)
    expect((await move(otherItemId, 'DELIVERED')).status).toBe(400)
    expect((await move(otherItemId, 'READY')).status).toBe(400)
  })
})
