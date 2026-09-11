/**
 * GET /api/inventory/reorder (view_inventory; prices only for inventory-cost roles) and
 * POST /api/inventory/reorder/run (manage_inventory; 409 while another run holds the lock).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { UserRole } from '@/lib/permissions'
import { GET as getReorder } from '@/app/api/inventory/reorder/route'
import { POST as runReorder } from '@/app/api/inventory/reorder/run/route'

const db = prisma as unknown as Record<string, any>

function actAs(role: UserRole, id = 'user-1') {
  vi.mocked(auth).mockResolvedValue({ user: { id, role, name: 'Test', email: 't@example.com' } } as never)
}

const clothRow = (o: Record<string, unknown> = {}) => ({
  id: 'c1',
  sku: 'CLT-1',
  name: 'Cotton',
  brand: 'Raymond',
  color: 'Navy',
  currentStock: 4,
  reserved: 0,
  minimumStockMeters: 10,
  reorderQuantity: null,
  pricePerMeter: 100,
  supplierId: 'sup-1',
  supplierRel: { id: 'sup-1', name: 'Sup One', active: true },
  ...o,
})

const get = (query = '') => getReorder(new Request(`http://localhost/api/inventory/reorder${query}`))

beforeEach(() => {
  actAs('OWNER')
  db.clothInventory.findMany.mockResolvedValue([clothRow(), clothRow({ id: 'c2', sku: 'CLT-2', currentStock: 40 })])
  db.accessoryInventory.findMany.mockResolvedValue([])
  db.pOItem.findMany.mockResolvedValue([])
  db.supplierPrice.findMany.mockResolvedValue([])
})

describe('GET /api/inventory/reorder', () => {
  it('lists items that need a reorder, with suggested quantity and estimated cost', async () => {
    const res = await get()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({ id: 'c1', suggestedQuantity: 16, unitPrice: 100, estimatedCost: 1600 })
    expect(body.canRunReorderCheck).toBe(true)
  })

  it('returns every item for the PO picker with scope=all, filtered by type', async () => {
    expect((await (await get('?scope=all')).json()).items).toHaveLength(2)
    expect((await (await get('?scope=all&type=ACCESSORY')).json()).items).toHaveLength(0)
  })

  it('strips prices and costs for roles without inventory cost access', async () => {
    actAs('TAILOR')

    const body = await (await get()).json()

    expect(body.items[0]).toMatchObject({ id: 'c1', suggestedQuantity: 16, available: 4 })
    expect(body.items[0]).not.toHaveProperty('unitPrice')
    expect(body.items[0]).not.toHaveProperty('estimatedCost')
    expect(body.canRunReorderCheck).toBe(false)
  })

  it('requires view_inventory', async () => {
    actAs('SALES_MANAGER')
    const res = await get()
    expect(res.status).toBe(403)
    expect(db.clothInventory.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/inventory/reorder/run', () => {
  it('requires manage_inventory', async () => {
    actAs('TAILOR')
    const res = await runReorder()
    expect(res.status).toBe(403)
  })

  it('returns 409 while another run holds the lock', async () => {
    db.$queryRaw.mockResolvedValue([{ locked: false }])

    const res = await runReorder()

    expect(res.status).toBe(409)
    expect((await res.json()).result.status).toBe('skipped')
  })
})
