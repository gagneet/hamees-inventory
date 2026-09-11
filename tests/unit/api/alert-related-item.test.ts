/**
 * GET /api/alerts/[id] — the stock item an alert is about, in one shape for fabric and accessories
 * (the page used to read a `minimum` the API never sent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { UserRole } from '@/lib/permissions'
import { GET } from '@/app/api/alerts/[id]/route'

const db = prisma as unknown as Record<string, any>

function actAs(role: UserRole) {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'u1', role, name: 'T', email: 't@example.com' } } as never)
}

const supplier = { id: 's1', name: 'Sup One', phone: '+919876500000', email: null }

const clothRow = {
  id: 'c1',
  sku: 'CLT-1',
  name: 'Cotton',
  type: 'Cotton',
  currentStock: 4.5,
  reserved: 1.5,
  minimumStockMeters: 10,
  pricePerMeter: 450,
  supplierRel: supplier,
}

const accessoryRow = {
  id: 'a1',
  sku: 'ACC-1',
  name: 'Shell Buttons',
  type: 'Button',
  currentStock: 20,
  reserved: 5,
  minimumStockUnits: 50,
  pricePerUnit: 4.5,
  supplierRel: supplier,
}

const alertRow = (o: Record<string, unknown> = {}) => ({
  id: 'al1',
  type: 'REORDER_REMINDER',
  severity: 'HIGH',
  title: 'Reorder: Cotton',
  message: 'Reorder 16 meters',
  isRead: true,
  relatedType: 'cloth',
  relatedId: 'c1',
  ...o,
})

const get = () => GET(new Request('http://localhost/api/alerts/al1'), { params: Promise.resolve({ id: 'al1' }) })

beforeEach(() => {
  actAs('OWNER')
  db.clothInventory.findUnique.mockResolvedValue(clothRow)
  db.accessoryInventory.findUnique.mockResolvedValue(accessoryRow)
})

describe('GET /api/alerts/[id] related item', () => {
  it('returns a fabric with the fields the page renders', async () => {
    db.alert.findFirst.mockResolvedValue(alertRow())

    const body = await (await get()).json()

    expect(body.relatedItem).toEqual({
      kind: 'cloth',
      unit: 'm',
      id: 'c1',
      sku: 'CLT-1',
      name: 'Cotton',
      type: 'Cotton',
      currentStock: 4.5,
      reserved: 1.5,
      minimum: 10,
      unitPrice: 450,
      supplierRel: supplier,
    })
  })

  it('returns an accessory, in units', async () => {
    db.alert.findFirst.mockResolvedValue(alertRow({ relatedType: 'accessory', relatedId: 'a1' }))

    const body = await (await get()).json()

    expect(body.relatedItem).toMatchObject({ kind: 'accessory', unit: 'pcs', id: 'a1', minimum: 50, unitPrice: 4.5 })
    expect(db.clothInventory.findUnique).not.toHaveBeenCalled()
  })

  it('still reads legacy INVENTORY alerts as fabric', async () => {
    db.alert.findFirst.mockResolvedValue(alertRow({ relatedType: 'INVENTORY' }))

    expect((await (await get()).json()).relatedItem).toMatchObject({ kind: 'cloth', minimum: 10 })
  })

  it('still reads the model names older alerts stored', async () => {
    db.alert.findFirst.mockResolvedValue(alertRow({ relatedType: 'ClothInventory' }))
    expect((await (await get()).json()).relatedItem).toMatchObject({ kind: 'cloth', minimum: 10 })

    db.alert.findFirst.mockResolvedValue(alertRow({ relatedType: 'AccessoryInventory', relatedId: 'a1' }))
    expect((await (await get()).json()).relatedItem).toMatchObject({ kind: 'accessory', minimum: 50 })
  })

  it('hides the price from roles without inventory cost access', async () => {
    actAs('TAILOR')
    db.alert.findFirst.mockResolvedValue(alertRow())

    const { relatedItem } = await (await get()).json()

    expect(relatedItem).toMatchObject({ kind: 'cloth', minimum: 10 })
    expect(relatedItem.unitPrice).toBeUndefined()
  })

  it('returns no item for alerts that are not about stock', async () => {
    db.alert.findFirst.mockResolvedValue(alertRow({ type: 'PAYMENT_REMINDER', relatedType: 'order', relatedId: 'o1' }))

    expect((await (await get()).json()).relatedItem).toBeNull()
  })
})
