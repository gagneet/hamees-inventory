/**
 * Reorder engine (lib/reorder.ts): the pure stock-position / suggestion rules, and runReorderCheck
 * against a mocked transaction (advisory lock, auto-drafted POs, alerts, audit).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/audit'
import { getAppSettings } from '@/lib/settings'
import {
  REORDER_LOCK_KEY,
  computeOnOrder,
  computeReorderNeeds,
  computeReorderPositions,
  pickSupplierPrice,
  reorderSeverity,
  reorderSuggestion,
  runReorderCheck,
  type OpenPOLine,
  type ReorderItem,
  type SupplierPriceRow,
} from '@/lib/reorder'

vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/settings', () => ({ getAppSettings: vi.fn() }))

const cloth = (o: Partial<ReorderItem> = {}): ReorderItem => ({
  kind: 'cloth',
  id: 'c1',
  sku: 'CLT-1',
  name: 'Cotton',
  lineName: 'Cotton — Raymond, Navy (CLT-1)',
  currentStock: 4,
  reserved: 0,
  minimum: 10,
  reorderQuantity: null,
  supplierId: 'sup-1',
  supplierName: 'Sup One',
  itemPrice: 100,
  ...o,
})

const accessory = (o: Partial<ReorderItem> = {}): ReorderItem => ({
  ...cloth(),
  kind: 'accessory',
  id: 'a1',
  sku: 'ACC-1',
  name: 'Buttons',
  lineName: 'Buttons — Ivory (ACC-1)',
  itemPrice: 4.5,
  ...o,
})

const line = (o: Partial<OpenPOLine> = {}): OpenPOLine => ({
  status: 'APPROVED',
  clothInventoryId: 'c1',
  accessoryInventoryId: null,
  orderedQuantity: 0,
  receivedQuantity: 0,
  ...o,
})

const NOW = new Date('2026-09-11T10:00:00Z')
const price = (o: Partial<SupplierPriceRow> = {}): SupplierPriceRow => ({
  supplierId: 'sup-1',
  clothInventoryId: 'c1',
  pricePerMeter: 90,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  effectiveTo: null,
  active: true,
  ...o,
})

describe('computeReorderNeeds – on-order netting', () => {
  it('counts outstanding quantity on open POs, so covered items need nothing', () => {
    // available 4 + on order (10 − 2) = 12 > minimum 10
    const input = { items: [cloth()], openLines: [line({ orderedQuantity: 10, receivedQuantity: 2 })] }
    expect(computeReorderNeeds(input)).toEqual([])
    expect(computeReorderPositions(input)[0].onOrder).toBe(8)
  })

  it('nets partial on-order stock out of the default quantity', () => {
    // available 4 + on order 3 = 7 ≤ 10 → order 2 × 10 − 4 − 3 = 13
    const [need] = computeReorderNeeds({ items: [cloth()], openLines: [line({ orderedQuantity: 3 })] })
    expect(need).toMatchObject({ id: 'c1', available: 4, onOrder: 3, suggestedQuantity: 13 })
  })

  it('ignores received, cancelled and unlinked lines', () => {
    const openLines = [
      line({ status: 'RECEIVED', orderedQuantity: 100 }),
      line({ status: 'CANCELLED', orderedQuantity: 100 }),
      line({ clothInventoryId: null, orderedQuantity: 100 }),
    ]
    expect(computeOnOrder(openLines).size).toBe(0)
    expect(computeReorderNeeds({ items: [cloth()], openLines })[0].suggestedQuantity).toBe(16)
  })

  it('counts every open status, including drafts awaiting approval', () => {
    const openLines = ['PENDING_APPROVAL', 'PENDING', 'APPROVED', 'PARTIAL'].map((status) =>
      line({ status, orderedQuantity: 1 })
    )
    expect(computeOnOrder(openLines).get('cloth:c1')).toBe(4)
  })

  it('keeps fabric and accessory on-order separate', () => {
    const onOrder = computeOnOrder([
      line({ orderedQuantity: 5 }),
      line({ clothInventoryId: null, accessoryInventoryId: 'c1', orderedQuantity: 7 }),
    ])
    expect(onOrder.get('cloth:c1')).toBe(5)
    expect(onOrder.get('accessory:c1')).toBe(7)
  })

  it('uses available stock (current − reserved), not current stock', () => {
    const [need] = computeReorderNeeds({ items: [cloth({ currentStock: 12, reserved: 5 })], openLines: [] })
    expect(need).toMatchObject({ available: 7, suggestedQuantity: 13 })
  })

  it('reorders at exactly the minimum, not above it', () => {
    expect(computeReorderNeeds({ items: [cloth({ currentStock: 10 })], openLines: [] })[0].suggestedQuantity).toBe(10)
    expect(computeReorderNeeds({ items: [cloth({ currentStock: 10.01 })], openLines: [] })).toEqual([])
  })
})

describe('computeReorderNeeds – quantity', () => {
  it('uses the item reorderQuantity when set', () => {
    const [need] = computeReorderNeeds({ items: [cloth({ reorderQuantity: 50 })], openLines: [] })
    expect(need.suggestedQuantity).toBe(50)
  })

  it('falls back to topping up to twice the minimum when reorderQuantity is empty or 0', () => {
    for (const reorderQuantity of [null, 0]) {
      expect(computeReorderNeeds({ items: [cloth({ reorderQuantity })], openLines: [] })[0].suggestedQuantity).toBe(16)
    }
  })

  it('applies to accessories too', () => {
    const needs = computeReorderNeeds({
      items: [accessory({ currentStock: 3, reorderQuantity: 25 }), accessory({ id: 'a2', currentStock: 3 })],
      openLines: [],
    })
    expect(needs.map((n) => [n.id, n.suggestedQuantity, n.unit, n.itemType])).toEqual([
      ['a1', 25, 'pieces', 'ACCESSORY'],
      ['a2', 17, 'pieces', 'ACCESSORY'],
    ])
  })

  it('rounds fabric up to whole meters', () => {
    // 20 − 2.35 = 17.65 → 18; a reorder quantity of 12.2 → 13
    expect(computeReorderNeeds({ items: [cloth({ currentStock: 2.35 })], openLines: [] })[0].suggestedQuantity).toBe(18)
    expect(
      computeReorderNeeds({ items: [cloth({ reorderQuantity: 12.2 })], openLines: [] })[0].suggestedQuantity
    ).toBe(13)
  })

  it('does not round up floating-point noise', () => {
    // 2 × 1.1 − (0.3 − 0.1) = 2.0000000000000004 in floating point → 2, not 3
    const [need] = computeReorderNeeds({
      items: [cloth({ minimum: 1.1, currentStock: 0.3, reserved: 0.1 })],
      openLines: [],
    })
    expect(need.suggestedQuantity).toBe(2)
  })

  it('keeps whole results exact', () => {
    expect(computeReorderNeeds({ items: [cloth({ currentStock: 5 })], openLines: [] })[0].suggestedQuantity).toBe(15)
  })

  it('reorderSuggestion reports no quantity when stock is sufficient', () => {
    expect(reorderSuggestion({ available: 30, onOrder: 0, minimum: 10, reorderQuantity: 50 })).toEqual({
      needsReorder: false,
      quantity: 0,
    })
  })
})

describe('computeReorderNeeds – supplier and price', () => {
  it('still reports items without a supplier (alert only, no PO)', () => {
    const [need] = computeReorderNeeds({ items: [cloth({ supplierId: null, supplierName: null })], openLines: [] })
    expect(need).toMatchObject({ supplierId: null, supplierName: null, suggestedQuantity: 16 })
  })

  it('prices fabric from the current supplier price, else the item price', () => {
    const [withPrice] = computeReorderPositions({ items: [cloth()], openLines: [], supplierPrices: [price()], now: NOW })
    expect(withPrice).toMatchObject({ unitPrice: 90, priceSource: 'supplier' })

    const [without] = computeReorderPositions({ items: [cloth()], openLines: [], supplierPrices: [], now: NOW })
    expect(without).toMatchObject({ unitPrice: 100, priceSource: 'item' })
  })

  it('ignores inactive, expired and future supplier prices; the latest effective one wins', () => {
    const prices = [
      price({ pricePerMeter: 70, active: false }),
      price({ pricePerMeter: 60, effectiveTo: new Date('2026-06-01T00:00:00Z') }),
      price({ pricePerMeter: 50, effectiveFrom: new Date('2026-12-01T00:00:00Z') }),
      price({ pricePerMeter: 80, effectiveFrom: new Date('2026-03-01T00:00:00Z') }),
      price({ pricePerMeter: 85, effectiveFrom: new Date('2026-08-01T00:00:00Z') }),
    ]
    expect(pickSupplierPrice(prices, 'c1', 'sup-1', NOW)).toBe(85)
    expect(pickSupplierPrice(prices, 'c1', null, NOW)).toBeNull()
  })

  it('prices from the PO supplier when the picker asks for it', () => {
    const [position] = computeReorderPositions(
      { items: [cloth()], openLines: [], supplierPrices: [price(), price({ supplierId: 'sup-2', pricePerMeter: 75 })], now: NOW },
      { priceSupplierId: 'sup-2' }
    )
    expect(position.unitPrice).toBe(75)
  })

  it('prices accessories from the item', () => {
    const [position] = computeReorderPositions({ items: [accessory()], openLines: [], supplierPrices: [price()], now: NOW })
    expect(position).toMatchObject({ unitPrice: 4.5, priceSource: 'item' })
  })

  it('grades severity by physical shortfall', () => {
    expect(reorderSeverity(0, 10)).toBe('CRITICAL')
    expect(reorderSeverity(5, 10)).toBe('HIGH')
    expect(reorderSeverity(7, 10)).toBe('MEDIUM')
  })
})

// ── runReorderCheck ────────────────────────────────────────────────────────────

const db = prisma as unknown as Record<string, any>

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

function mockTransaction(opts: { locked?: boolean; cloth?: unknown[]; alerts?: unknown[]; draft?: unknown } = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ locked: opts.locked ?? true }]),
    clothInventory: { findMany: vi.fn().mockResolvedValue(opts.cloth ?? []) },
    accessoryInventory: { findMany: vi.fn().mockResolvedValue([]) },
    pOItem: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
    supplierPrice: { findMany: vi.fn().mockResolvedValue([]) },
    purchaseOrder: {
      findFirst: vi.fn().mockResolvedValue(opts.draft ?? null),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'po-auto', poNumber: 'PO-2026-0001' }),
      update: vi.fn().mockResolvedValue({}),
    },
    alert: {
      findMany: vi.fn().mockResolvedValue(opts.alerts ?? []),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  }
  db.$transaction = vi.fn(async (fn: (t: unknown) => unknown) => fn(tx))
  return tx
}

function autoReorder(enabled: boolean) {
  vi.mocked(getAppSettings).mockResolvedValue({ autoReorderEnabled: enabled } as Awaited<ReturnType<typeof getAppSettings>>)
}

describe('runReorderCheck', () => {
  beforeEach(() => autoReorder(true))

  it('skips without reading or writing when another run holds the advisory lock', async () => {
    const tx = mockTransaction({ locked: false, cloth: [clothRow()] })

    const result = await runReorderCheck({ trigger: 'manual', userId: 'u1' })

    expect(result).toMatchObject({ status: 'skipped', needs: 0, purchaseOrders: [] })
    const [sql, key] = tx.$queryRaw.mock.calls[0]
    expect((sql as string[]).join('?')).toContain('pg_try_advisory_xact_lock')
    expect(key).toBe(REORDER_LOCK_KEY)
    expect(tx.clothInventory.findMany).not.toHaveBeenCalled()
    expect(tx.purchaseOrder.create).not.toHaveBeenCalled()
    expect(tx.alert.create).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })

  it('drafts a PENDING_APPROVAL PO per supplier with linked lines, raises an alert and audits', async () => {
    const tx = mockTransaction({ cloth: [clothRow()] })

    const result = await runReorderCheck({ trigger: 'order_created', userId: 'u1', now: NOW })

    expect(result).toMatchObject({ status: 'completed', needs: 1, alertsCreated: 1 })
    expect(result.purchaseOrders).toEqual([
      { id: 'po-auto', poNumber: 'PO-2026-0001', supplierId: 'sup-1', created: true, linesAdded: 1 },
    ])
    const data = tx.purchaseOrder.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      supplierId: 'sup-1',
      status: 'PENDING_APPROVAL',
      autoGenerated: true,
      totalAmount: 1600,
      balanceAmount: 1600,
    })
    expect(data.items.create).toEqual([
      expect.objectContaining({
        itemType: 'CLOTH',
        itemName: 'Cotton — Raymond, Navy (CLT-1)',
        clothInventoryId: 'c1',
        accessoryInventoryId: null,
        orderedQuantity: 16,
        unit: 'meters',
        pricePerUnit: 100,
        totalPrice: 1600,
      }),
    ])
    const alert = tx.alert.create.mock.calls[0][0].data
    expect(alert).toMatchObject({ type: 'REORDER_REMINDER', relatedType: 'cloth', relatedId: 'c1', severity: 'HIGH' })
    expect(alert.message).toContain('Reorder 16 meters from Sup One.')
    expect(alert.message).toContain('PO-2026-0001')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PURCHASE_ORDER_AUTO_CREATED', entityId: 'po-auto', userId: 'u1' })
    )
  })

  it('raises alerts only when auto-reorder is off', async () => {
    const tx = mockTransaction({ cloth: [clothRow()] })
    autoReorder(false)

    const result = await runReorderCheck({ trigger: 'alerts' })

    expect(result).toMatchObject({ status: 'completed', autoReorderEnabled: false, alertsCreated: 1, purchaseOrders: [] })
    expect(tx.purchaseOrder.create).not.toHaveBeenCalled()
    expect(tx.alert.create.mock.calls[0][0].data.message).not.toContain('draft purchase order')
    expect(audit).not.toHaveBeenCalled()
  })

  it('never adds an item that is already on the supplier draft', async () => {
    const draft = {
      id: 'po-draft',
      poNumber: 'PO-2026-0007',
      paidAmount: 0,
      items: [{ clothInventoryId: 'c1', accessoryInventoryId: null, totalPrice: 1600 }],
    }
    const tx = mockTransaction({ cloth: [clothRow()], draft })

    const result = await runReorderCheck({ trigger: 'manual' })

    expect(result.purchaseOrders).toEqual([])
    expect(tx.pOItem.create).not.toHaveBeenCalled()
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled()
    expect(tx.alert.create.mock.calls[0][0].data.message).toContain('PO-2026-0007')
  })

  it('appends new items to the existing draft and recomputes its totals', async () => {
    const draft = {
      id: 'po-draft',
      poNumber: 'PO-2026-0007',
      paidAmount: 0,
      items: [{ clothInventoryId: 'c-other', accessoryInventoryId: null, totalPrice: 500.25 }],
    }
    const tx = mockTransaction({ cloth: [clothRow()], draft })

    const result = await runReorderCheck({ trigger: 'manual', userId: 'u1' })

    expect(tx.pOItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ purchaseOrderId: 'po-draft', clothInventoryId: 'c1', orderedQuantity: 16 }),
    })
    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: 'po-draft' },
      data: { totalAmount: 2100.25, subTotal: 2100.25, balanceAmount: 2100.25 },
    })
    expect(result.purchaseOrders).toEqual([
      { id: 'po-draft', poNumber: 'PO-2026-0007', supplierId: 'sup-1', created: false, linesAdded: 1 },
    ])
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'PURCHASE_ORDER_AUTO_APPENDED' }))
  })

  it('does not draft for items without an active supplier', async () => {
    const tx = mockTransaction({
      cloth: [clothRow({ supplierId: 'sup-1', supplierRel: { id: 'sup-1', name: 'Sup One', active: false } })],
    })

    const result = await runReorderCheck({ trigger: 'manual' })

    expect(result.purchaseOrders).toEqual([])
    expect(tx.purchaseOrder.create).not.toHaveBeenCalled()
    expect(tx.alert.create.mock.calls[0][0].data.message).toContain('no supplier linked')
  })

  it('resolves alerts for covered items, respects a snoozed dismissal and re-raises an expired one', async () => {
    const tx = mockTransaction({
      cloth: [clothRow(), clothRow({ id: 'c2', sku: 'CLT-2' }), clothRow({ id: 'c3', sku: 'CLT-3', currentStock: 50 })],
      alerts: [
        { id: 'al-2', relatedId: 'c2', relatedType: 'cloth', isDismissed: true, dismissedUntil: new Date('2026-09-12T00:00:00Z') },
        { id: 'al-1', relatedId: 'c1', relatedType: 'cloth', isDismissed: true, dismissedUntil: new Date('2026-09-10T00:00:00Z') },
        { id: 'al-3', relatedId: 'c3', relatedType: 'cloth', isDismissed: false, dismissedUntil: null },
      ],
    })
    tx.alert.deleteMany.mockResolvedValue({ count: 1 })
    autoReorder(false)

    const result = await runReorderCheck({ trigger: 'manual', now: NOW })

    // c1: dismissal expired → re-raised in place
    expect(tx.alert.update).toHaveBeenCalledTimes(1)
    expect(tx.alert.update).toHaveBeenCalledWith({
      where: { id: 'al-1' },
      data: expect.objectContaining({ isDismissed: false, dismissedUntil: null, isRead: false }),
    })
    // c2: still snoozed → untouched, no duplicate row
    expect(tx.alert.create).not.toHaveBeenCalled()
    // c3: above minimum → resolved
    expect(tx.alert.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['al-3'] } } })
    expect(result).toMatchObject({ needs: 2, alertsCreated: 1, alertsResolved: 1 })
  })
})
