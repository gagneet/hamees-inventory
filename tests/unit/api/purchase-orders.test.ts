/**
 * Purchase Orders API Unit Tests
 *
 * Route-level tests for app/api/purchase-orders/route.ts (create) and
 * app/api/purchase-orders/[id]/receive/route.ts, plus the approval / receive-status rules.
 *
 * Covers:
 *   - every line links exactly one active inventory item of its type; name and unit are derived
 *   - whole accessory units, fabric rounding, duplicates, supplier checks and mismatch warnings
 *   - price privacy (only the owner prices at creation) and lib/money totals
 *   - receiving credits the line's link; only legacy unlinked lines may be linked by the request
 *   - PO number generation
 *
 * Prisma is mocked via vitest.setup.ts — no DB calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { UserRole } from '@/lib/permissions'
import { addAccessoryStock, changeClothStock } from '@/lib/stock'
import { runReorderCheckQuietly } from '@/lib/reorder'
import { nextPoNumber } from '@/lib/purchase-order-items'
import { GET as listPurchaseOrders, POST as createPurchaseOrder } from '@/app/api/purchase-orders/route'
import { POST as receivePurchaseOrder } from '@/app/api/purchase-orders/[id]/receive/route'

vi.mock('@/lib/reorder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/reorder')>()),
  // Returns a promise like the real one (the after() stub chains .catch on it)
  runReorderCheckQuietly: vi.fn(async () => {}),
}))

vi.mock('@/lib/stock', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stock')>()),
  changeClothStock: vi.fn(),
  addAccessoryStock: vi.fn(),
}))

const db = prisma as unknown as Record<string, any>

function actAs(role: UserRole, id = 'user-1') {
  vi.mocked(auth).mockResolvedValue({ user: { id, role, name: 'Test', email: 't@example.com' } } as never)
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// ── Approval workflow rules ───────────────────────────────────────────────

const approvePurchaseOrderSchema = z.object({
  status: z.literal('APPROVED'),
  items: z.array(
    z.object({
      id: z.string().min(1),
      pricePerUnit: z.number().positive(),
    })
  ).min(1),
  notes: z.string().nullish(),
})

function canApprovePurchaseOrder(role: string): boolean {
  return role === 'OWNER' || role === 'INVENTORY_MANAGER'
}

describe('PO approval workflow', () => {
  it('allows only OWNER and INVENTORY_MANAGER to approve POs', () => {
    expect(canApprovePurchaseOrder('OWNER')).toBe(true)
    expect(canApprovePurchaseOrder('INVENTORY_MANAGER')).toBe(true)
    expect(canApprovePurchaseOrder('ADMIN')).toBe(false)
    expect(canApprovePurchaseOrder('TAILOR')).toBe(false)
  })

  it('requires positive item prices during approval', () => {
    const result = approvePurchaseOrderSchema.safeParse({
      status: 'APPROVED',
      items: [{ id: 'item-1', pricePerUnit: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts approval payload with prices for every item', () => {
    const result = approvePurchaseOrderSchema.safeParse({
      status: 'APPROVED',
      items: [
        { id: 'item-1', pricePerUnit: 300 },
        { id: 'item-2', pricePerUnit: 5 },
      ],
      notes: 'Approved by inventory manager',
    })
    expect(result.success).toBe(true)
  })
})

// ── POST /api/purchase-orders ─────────────────────────────────────────────

const supplierRel = { id: 'sup-1', name: 'Sup One' }
const clothRecord = (o: Record<string, unknown> = {}) => ({
  id: 'c1',
  sku: 'CLT-1',
  name: 'Cotton',
  brand: 'Raymond',
  color: 'Navy',
  active: true,
  supplierId: 'sup-1',
  supplierRel,
  ...o,
})
const accessoryRecord = (o: Record<string, unknown> = {}) => ({
  id: 'a1',
  sku: 'ACC-1',
  name: 'Buttons',
  color: 'Ivory',
  active: true,
  supplierId: 'sup-1',
  supplierRel,
  ...o,
})

const clothLine = (o: Record<string, unknown> = {}) => ({
  itemType: 'CLOTH',
  clothInventoryId: 'c1',
  quantity: 12.5,
  pricePerUnit: 300,
  ...o,
})
const accessoryLine = (o: Record<string, unknown> = {}) => ({
  itemType: 'ACCESSORY',
  accessoryInventoryId: 'a1',
  quantity: 3,
  pricePerUnit: 4.2,
  ...o,
})

const createPO = (body: Record<string, unknown>) =>
  createPurchaseOrder(new Request('http://localhost/api/purchase-orders', json({ supplierId: 'sup-1', ...body })))

const createdData = () => db.purchaseOrder.create.mock.calls[0][0].data

describe('POST /api/purchase-orders – inventory-linked lines', () => {
  beforeEach(() => {
    actAs('OWNER')
    db.supplier.findUnique.mockResolvedValue({ id: 'sup-1', active: true })
    db.clothInventory.findMany.mockResolvedValue([clothRecord()])
    db.accessoryInventory.findMany.mockResolvedValue([accessoryRecord()])
    db.purchaseOrder.count.mockResolvedValue(0)
    db.purchaseOrder.findMany.mockResolvedValue([])
    db.purchaseOrder.create.mockImplementation(async ({ data }: { data: any }) => ({
      id: 'po-new',
      ...data,
      items: data.items.create,
    }))
  })

  it('rejects a line without its inventory link', async () => {
    const res = await createPO({ items: [{ itemType: 'CLOTH', itemName: 'Free text fabric', quantity: 5, pricePerUnit: 10 }] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Choose the fabric this line restocks')
    expect(db.purchaseOrder.create).not.toHaveBeenCalled()
  })

  it('rejects a link of the wrong type', async () => {
    const res = await createPO({ items: [{ itemType: 'ACCESSORY', clothInventoryId: 'c1', quantity: 5, pricePerUnit: 10 }] })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details.map((d: { message: string }) => d.message)).toEqual(
      expect.arrayContaining(['Choose the accessory this line restocks', 'An accessory line cannot link a fabric'])
    )
    expect(db.purchaseOrder.create).not.toHaveBeenCalled()
  })

  it('rejects a line linking both a fabric and an accessory', async () => {
    const res = await createPO({ items: [clothLine({ accessoryInventoryId: 'a1' })] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('A fabric line cannot link an accessory')
  })

  it('rejects inactive or unknown items', async () => {
    db.clothInventory.findMany.mockResolvedValue([clothRecord({ active: false })])
    const inactive = await createPO({ items: [clothLine()] })
    expect(inactive.status).toBe(400)
    expect((await inactive.json()).error).toBe('Line 1: fabric not found or no longer active')

    db.accessoryInventory.findMany.mockResolvedValue([])
    const unknown = await createPO({ items: [accessoryLine({ accessoryInventoryId: 'missing' })] })
    expect(unknown.status).toBe(400)
    expect((await unknown.json()).error).toBe('Line 1: accessory not found or no longer active')

    expect(db.purchaseOrder.create).not.toHaveBeenCalled()
  })

  it('derives name and unit from the item, ignoring client values, and totals with lib/money', async () => {
    const res = await createPO({
      items: [clothLine({ itemName: 'Whatever', unit: 'kg' }), accessoryLine({ itemName: 'Other', unit: 'boxes' })],
    })

    expect(res.status).toBe(201)
    const data = createdData()
    expect(data.items.create).toEqual([
      {
        itemName: 'Cotton — Raymond, Navy (CLT-1)',
        itemType: 'CLOTH',
        orderedQuantity: 12.5,
        unit: 'meters',
        pricePerUnit: 300,
        totalPrice: 3750,
        clothInventoryId: 'c1',
        accessoryInventoryId: null,
      },
      {
        itemName: 'Buttons — Ivory (ACC-1)',
        itemType: 'ACCESSORY',
        orderedQuantity: 3,
        unit: 'pieces',
        pricePerUnit: 4.2,
        totalPrice: 12.6,
        clothInventoryId: null,
        accessoryInventoryId: 'a1',
      },
    ])
    expect(data).toMatchObject({ totalAmount: 3762.6, subTotal: 3762.6, balanceAmount: 3762.6, status: 'APPROVED' })
    expect(data.poNumber).toMatch(/^PO-\d{4}-0001$/)
    expect((await res.json()).warnings).toEqual([])
    expect(runReorderCheckQuietly).toHaveBeenCalledWith({ trigger: 'purchase_order_changed', userId: 'user-1' })
  })

  it('accepts orderedQuantity as the quantity field', async () => {
    const res = await createPO({ items: [clothLine({ quantity: undefined, orderedQuantity: 8 })] })
    expect(res.status).toBe(201)
    expect(createdData().items.create[0].orderedQuantity).toBe(8)
  })

  it('requires whole units for accessories and rounds fabric to 3 decimals', async () => {
    const fractional = await createPO({ items: [accessoryLine({ quantity: 2.5 })] })
    expect(fractional.status).toBe(400)
    expect((await fractional.json()).error).toBe('Line 1: accessory quantities must be whole units')

    const res = await createPO({ items: [clothLine({ quantity: 10.12345 })] })
    expect(res.status).toBe(201)
    expect(createdData().items.create[0].orderedQuantity).toBe(10.123)
  })

  it('rejects the same item twice on one PO', async () => {
    const res = await createPO({ items: [clothLine(), clothLine({ quantity: 3 })] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('already on this purchase order')
  })

  it('warns, without blocking, when an item is usually bought from another supplier', async () => {
    db.supplier.findUnique.mockResolvedValue({ id: 'sup-2', active: true })

    const res = await createPO({ supplierId: 'sup-2', items: [clothLine()] })

    expect(res.status).toBe(201)
    expect((await res.json()).warnings).toEqual(['Cotton — Raymond, Navy (CLT-1) is usually supplied by Sup One'])
  })

  it('rejects an unknown or inactive supplier', async () => {
    db.supplier.findUnique.mockResolvedValue({ id: 'sup-1', active: false })
    const res = await createPO({ items: [clothLine()] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Supplier not found or inactive')
    expect(db.purchaseOrder.create).not.toHaveBeenCalled()
  })

  it('stores no prices from non-owners and leaves their POs pending approval', async () => {
    actAs('INVENTORY_MANAGER')

    const res = await createPO({ items: [clothLine({ pricePerUnit: 500 })] })

    expect(res.status).toBe(201)
    const data = createdData()
    expect(data.status).toBe('PENDING_APPROVAL')
    expect(data.items.create[0]).toMatchObject({ pricePerUnit: 0, totalPrice: 0 })
    expect(data.totalAmount).toBe(0)
  })

  it('requires the owner to price every line', async () => {
    const res = await createPO({ items: [clothLine({ pricePerUnit: undefined })] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Price per unit is required')
  })

  it('forbids roles without PO permissions', async () => {
    actAs('VIEWER')
    const res = await createPO({ items: [clothLine()] })
    expect(res.status).toBe(403)
  })

  it('rejects an empty PO', async () => {
    const res = await createPO({ items: [] })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/purchase-orders', () => {
  beforeEach(() => {
    actAs('OWNER')
    db.purchaseOrder.findMany.mockResolvedValue([])
  })

  it('filters active POs by status and supplier and includes the linked items', async () => {
    const res = await listPurchaseOrders(new Request('http://localhost/api/purchase-orders?status=APPROVED&supplierId=sup-1'))

    expect(res.status).toBe(200)
    const args = db.purchaseOrder.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ active: true, status: 'APPROVED', supplierId: 'sup-1' })
    expect(args.include.items.include).toHaveProperty('clothInventory')
    expect(args.include.items.include).toHaveProperty('accessoryInventory')
  })

  it('rejects an unknown status filter', async () => {
    const res = await listPurchaseOrders(new Request('http://localhost/api/purchase-orders?status=BOGUS'))
    expect(res.status).toBe(400)
  })
})

describe('PO number generation', () => {
  const MAY_2026 = new Date(2026, 4, 1)

  it('first PO of the year is PO-{YEAR}-0001', async () => {
    db.purchaseOrder.count.mockResolvedValue(0)
    db.purchaseOrder.findMany.mockResolvedValue([])
    expect(await nextPoNumber(db as never, MAY_2026)).toBe('PO-2026-0001')
    expect(db.purchaseOrder.findMany.mock.calls[0][0].where).toEqual({ poNumber: { startsWith: 'PO-2026-' } })
  })

  it('continues after the highest number used this year, even with gaps', async () => {
    db.purchaseOrder.count.mockResolvedValue(7)
    db.purchaseOrder.findMany.mockResolvedValue([{ poNumber: 'PO-2026-0003' }, { poNumber: 'PO-2026-0012' }])
    expect(await nextPoNumber(db as never, MAY_2026)).toBe('PO-2026-0013')
  })

  it('never reuses a number when the overall count is higher', async () => {
    db.purchaseOrder.count.mockResolvedValue(20)
    db.purchaseOrder.findMany.mockResolvedValue([{ poNumber: 'PO-2026-0012' }])
    expect(await nextPoNumber(db as never, MAY_2026)).toBe('PO-2026-0021')
  })

  it('does not pad beyond 4 digits', async () => {
    db.purchaseOrder.count.mockResolvedValue(9999)
    db.purchaseOrder.findMany.mockResolvedValue([])
    expect(await nextPoNumber(db as never, MAY_2026)).toBe('PO-2026-10000')
  })
})

// ── POST /api/purchase-orders/[id]/receive ───────────────────────────────

const poLine = (o: Record<string, unknown> = {}) => ({
  id: 'l1',
  purchaseOrderId: 'po1',
  itemName: 'Cotton — Raymond, Navy (CLT-1)',
  itemType: 'CLOTH',
  orderedQuantity: 10,
  receivedQuantity: 0,
  unit: 'meters',
  clothInventoryId: 'c1',
  accessoryInventoryId: null,
  ...o,
})

const purchaseOrderWith = (items: unknown[], o: Record<string, unknown> = {}) => ({
  id: 'po1',
  poNumber: 'PO-2026-0001',
  status: 'APPROVED',
  paidAmount: 0,
  totalAmount: 1000,
  balanceAmount: 1000,
  notes: null,
  receivedDate: null,
  items,
  ...o,
})

const receive = (body: Record<string, unknown>) =>
  receivePurchaseOrder(new Request('http://localhost/api/purchase-orders/po1/receive', json(body)), {
    params: Promise.resolve({ id: 'po1' }),
  })

describe('POST /api/purchase-orders/[id]/receive – inventory links', () => {
  beforeEach(() => {
    actAs('OWNER')
    db.pOItem.updateMany.mockResolvedValue({ count: 1 })
    db.clothInventory.findUnique.mockResolvedValue({ active: true })
    db.accessoryInventory.findUnique.mockResolvedValue({ active: true })
    vi.mocked(changeClothStock).mockResolvedValue({ currentStock: 14, reserved: 0 })
    vi.mocked(addAccessoryStock).mockResolvedValue({ currentStock: 30, reserved: 0 })
  })

  it('credits the line’s linked fabric without the request naming it', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine()]))

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 4 }] })

    expect(res.status).toBe(200)
    expect(changeClothStock).toHaveBeenCalledWith(expect.anything(), 'c1', 4, expect.objectContaining({ countAsPurchase: true }))
    const update = db.pOItem.updateMany.mock.calls[0][0]
    expect(update.data).toEqual({ receivedQuantity: 4 })
    expect(db.stockMovement.create.mock.calls[0][0].data).toMatchObject({
      clothInventoryId: 'c1',
      type: 'PURCHASE',
      quantityMeters: 4,
      balanceAfterMeters: 14,
    })
    expect(db.stockMovement.create.mock.calls[0][0].data.notes).toContain('PO-2026-0001')
    expect(db.purchaseOrder.update.mock.calls[0][0].data.status).toBe('PARTIAL')
  })

  it('accepts the same id as the line’s link', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine()]))
    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 4, clothInventoryId: 'c1' }] })
    expect(res.status).toBe(200)
    expect(changeClothStock).toHaveBeenCalledWith(expect.anything(), 'c1', 4, expect.anything())
  })

  it('rejects a different item for an already-linked line (400)', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine()]))

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 4, clothInventoryId: 'c9' }] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Cotton — Raymond, Navy (CLT-1) is already linked to a different inventory item')
    expect(changeClothStock).not.toHaveBeenCalled()
    expect(db.pOItem.updateMany).not.toHaveBeenCalled()
  })

  it('links a legacy unlinked line to the chosen item and credits it', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine({ clothInventoryId: null, itemName: 'Old fabric' })]))

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 10, clothInventoryId: 'c2' }] })

    expect(res.status).toBe(200)
    expect(db.clothInventory.findUnique).toHaveBeenCalledWith({ where: { id: 'c2' }, select: { active: true } })
    expect(db.pOItem.updateMany.mock.calls[0][0].data).toEqual({ receivedQuantity: 10, clothInventoryId: 'c2' })
    expect(changeClothStock).toHaveBeenCalledWith(expect.anything(), 'c2', 10, expect.anything())
  })

  it('rejects an item of the wrong type for a legacy line', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine({ clothInventoryId: null, itemName: 'Old fabric' })]))

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 1, accessoryInventoryId: 'a1' }] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Old fabric is not an accessory line')
    expect(db.pOItem.updateMany).not.toHaveBeenCalled()
  })

  it('requires an item before crediting a legacy line', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine({ clothInventoryId: null, itemName: 'Old fabric' })]))

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 1 }] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Old fabric is not linked to inventory: choose the fabric to credit')
  })

  it('rejects linking a legacy line to an inactive item', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine({ clothInventoryId: null, itemName: 'Old fabric' })]))
    db.clothInventory.findUnique.mockResolvedValue({ active: false })

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 1, clothInventoryId: 'c2' }] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('not found or is inactive')
  })

  it('credits linked accessories in whole units', async () => {
    const accessoryPoLine = poLine({
      itemType: 'ACCESSORY',
      itemName: 'Buttons — Ivory (ACC-1)',
      unit: 'pieces',
      orderedQuantity: 50,
      clothInventoryId: null,
      accessoryInventoryId: 'a1',
    })
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([accessoryPoLine]))

    const fractional = await receive({ items: [{ id: 'l1', receivedQuantity: 2.5 }] })
    expect(fractional.status).toBe(400)
    expect((await fractional.json()).error).toBe('Buttons — Ivory (ACC-1): accessory quantities must be whole units')

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 20 }] })
    expect(res.status).toBe(200)
    expect(addAccessoryStock).toHaveBeenCalledWith(expect.anything(), 'a1', 20)
    expect(db.accessoryStockMovement.create.mock.calls[0][0].data).toMatchObject({
      accessoryInventoryId: 'a1',
      quantityUnits: 20,
      balanceAfterUnits: 30,
    })
  })

  it('caps receipts at the outstanding quantity', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine({ receivedQuantity: 6 })]))

    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 5 }] })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('only 4 outstanding')
    expect(changeClothStock).not.toHaveBeenCalled()
  })

  it('marks the PO received only when every line is in and it is paid', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(
      purchaseOrderWith([poLine(), poLine({ id: 'l2', clothInventoryId: 'c2' })], { paidAmount: 1000, balanceAmount: 0 })
    )

    await receive({ items: [{ id: 'l1', receivedQuantity: 10 }] })
    expect(db.purchaseOrder.update.mock.calls[0][0].data.status).toBe('PARTIAL')

    await receive({ items: [{ id: 'l1', receivedQuantity: 10 }, { id: 'l2', receivedQuantity: 10 }] })
    expect(db.purchaseOrder.update.mock.calls[1][0].data.status).toBe('RECEIVED')
  })

  it('refuses to receive a PO that is not approved', async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(purchaseOrderWith([poLine()], { status: 'PENDING_APPROVAL' }))
    const res = await receive({ items: [{ id: 'l1', receivedQuantity: 1 }] })
    expect(res.status).toBe(400)
    expect(changeClothStock).not.toHaveBeenCalled()
  })
})
