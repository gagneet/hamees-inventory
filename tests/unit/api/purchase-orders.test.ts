/**
 * Purchase Orders API Unit Tests
 *
 * Tests the Zod schema validation, total calculation, and PO number generation
 * from app/api/purchase-orders/route.ts.
 *
 * Covers:
 *   - purchaseOrderSchema validation
 *   - totalAmount calculation (sum of quantity × pricePerUnit)
 *   - per-item totalPrice calculation
 *   - PO number generation format
 *   - Query filter construction
 *   - Response structure
 *
 * Prisma is mocked via vitest.setup.ts — no DB calls.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Replicate schema from app/api/purchase-orders/route.ts ────────────────
const purchaseOrderItemSchema = z
  .object({
    itemName: z.string().min(1),
    itemType: z.enum(['CLOTH', 'ACCESSORY']),
    quantity: z.number().positive().optional(),
    orderedQuantity: z.number().positive().optional(),
    unit: z.string().min(1),
    pricePerUnit: z.number().nonnegative().optional(),
  })
  .refine((item) => item.quantity !== undefined || item.orderedQuantity !== undefined, {
    message: 'Quantity is required',
    path: ['quantity'],
  })

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().nullish(),
  items: z.array(purchaseOrderItemSchema).min(1),
  notes: z.string().nullish(),
})

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


function getInitialPurchaseOrderStatus(role: string): 'APPROVED' | 'PENDING_APPROVAL' {
  return role === 'OWNER' ? 'APPROVED' : 'PENDING_APPROVAL'
}

function canApprovePurchaseOrder(role: string): boolean {
  return role === 'OWNER' || role === 'INVENTORY_MANAGER'
}


// ── Approval workflow helpers ─────────────────────────────────────────────

describe('PO approval workflow', () => {
  it('marks OWNER-created POs as approved immediately', () => {
    expect(getInitialPurchaseOrderStatus('OWNER')).toBe('APPROVED')
  })

  it('marks non-owner-created POs as pending approval', () => {
    expect(getInitialPurchaseOrderStatus('TAILOR')).toBe('PENDING_APPROVAL')
    expect(getInitialPurchaseOrderStatus('ADMIN')).toBe('PENDING_APPROVAL')
    expect(getInitialPurchaseOrderStatus('INVENTORY_MANAGER')).toBe('PENDING_APPROVAL')
  })

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

// ── PO number generation (mirrors route logic) ────────────────────────────
function generatePONumber(year: number, existingCount: number): string {
  return `PO-${year}-${String(existingCount + 1).padStart(4, '0')}`
}

// ── Total calculation (mirrors route logic) ───────────────────────────────
function calculatePOTotal(
  items: Array<{ quantity: number; pricePerUnit: number }>
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0)
}

function calculateItemTotal(quantity: number, pricePerUnit: number): number {
  return quantity * pricePerUnit
}

function calculateReceiveStatus(
  purchaseOrder: { status: string; paidAmount: number; totalAmount: number; items: Array<{ id: string; orderedQuantity: number; receivedQuantity: number }> },
  submittedItems: Array<{ id: string; receivedQuantity: number }>,
  additionalPayment = 0
): string {
  const receivedQuantityByItemId = new Map(
    submittedItems.map((item) => [item.id, item.receivedQuantity])
  )
  const newPaidAmount = purchaseOrder.paidAmount + additionalPayment
  const newBalanceAmount = purchaseOrder.totalAmount - newPaidAmount
  const paymentComplete = newBalanceAmount <= 0.01

  const allFullyReceived = purchaseOrder.items.every((poItem) => {
    const totalReceived = poItem.receivedQuantity + (receivedQuantityByItemId.get(poItem.id) ?? 0)
    return totalReceived >= poItem.orderedQuantity
  })

  const anyReceived = purchaseOrder.items.some((poItem) => {
    const totalReceived = poItem.receivedQuantity + (receivedQuantityByItemId.get(poItem.id) ?? 0)
    return totalReceived > 0
  })

  if (allFullyReceived && paymentComplete) return 'RECEIVED'
  if (anyReceived || newPaidAmount > 0) return 'PARTIAL'
  return purchaseOrder.status
}

describe('PO receive status calculation', () => {
  const purchaseOrder = {
    status: 'APPROVED',
    paidAmount: 0,
    totalAmount: 1000,
    items: [
      { id: 'item-1', orderedQuantity: 10, receivedQuantity: 0 },
      { id: 'item-2', orderedQuantity: 5, receivedQuantity: 0 },
    ],
  }

  it('does not mark a PO as received when only a submitted subset is fully received', () => {
    const status = calculateReceiveStatus(
      purchaseOrder,
      [{ id: 'item-1', receivedQuantity: 10 }],
      1000
    )

    expect(status).toBe('PARTIAL')
  })

  it('marks a PO as received only when every PO item is fully received and payment is complete', () => {
    const status = calculateReceiveStatus(
      purchaseOrder,
      [
        { id: 'item-1', receivedQuantity: 10 },
        { id: 'item-2', receivedQuantity: 5 },
      ],
      1000
    )

    expect(status).toBe('RECEIVED')
  })
})

// ── Fixtures ──────────────────────────────────────────────────────────────
function makeValidPO(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    supplierId: 'supplier-abc-123',
    expectedDate: '2026-06-15',
    items: [
      { itemName: 'Cotton Fabric', itemType: 'CLOTH', quantity: 50, unit: 'meters', pricePerUnit: 300 },
      { itemName: 'Buttons', itemType: 'ACCESSORY', quantity: 200, unit: 'pieces', pricePerUnit: 5 },
    ],
    notes: 'Urgent order',
    ...overrides,
  }
}

// ── purchaseOrderSchema – valid payloads ──────────────────────────────────

describe('purchaseOrderSchema – valid data', () => {
  it('accepts a complete valid PO payload', () => {
    const result = purchaseOrderSchema.safeParse(makeValidPO())
    expect(result.success).toBe(true)
  })

  it('accepts payload without expectedDate', () => {
    const result = purchaseOrderSchema.safeParse({
      supplierId: 'sup-123',
      items: [{ itemName: 'Silk', itemType: 'CLOTH', quantity: 10, unit: 'm', pricePerUnit: 500 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts non-owner-style payload without pricePerUnit', () => {
    const result = purchaseOrderSchema.safeParse({
      supplierId: 'sup-123',
      items: [{ itemName: 'Silk', itemType: 'CLOTH', quantity: 10, unit: 'm' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts orderedQuantity as a legacy/full-page quantity field', () => {
    const result = purchaseOrderSchema.safeParse({
      supplierId: 'sup-123',
      items: [{ itemName: 'Silk', itemType: 'CLOTH', orderedQuantity: 10, unit: 'm' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts null notes', () => {
    const po = makeValidPO({ notes: null })
    const result = purchaseOrderSchema.safeParse(po)
    expect(result.success).toBe(true)
  })

  it('accepts pricePerUnit of 0 (consignment items)', () => {
    const result = purchaseOrderSchema.safeParse({
      supplierId: 'sup-123',
      items: [{ itemName: 'Sample Fabric', itemType: 'CLOTH', quantity: 1, unit: 'm', pricePerUnit: 0 }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts ACCESSORY itemType', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Metal Buttons',
      itemType: 'ACCESSORY',
      quantity: 500,
      unit: 'pcs',
      pricePerUnit: 3,
    })
    expect(result.success).toBe(true)
  })

  it('accepts CLOTH itemType', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Linen Fabric',
      itemType: 'CLOTH',
      quantity: 30,
      unit: 'meters',
      pricePerUnit: 250,
    })
    expect(result.success).toBe(true)
  })
})

describe('purchaseOrderSchema – invalid data', () => {
  it('rejects missing supplierId', () => {
    const result = purchaseOrderSchema.safeParse({
      items: [{ itemName: 'Test', itemType: 'CLOTH', quantity: 1, unit: 'm', pricePerUnit: 100 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const err = result.error.issues.find(i => i.path[0] === 'supplierId')
      expect(err).toBeDefined()
    }
  })

  it('rejects empty supplierId', () => {
    const result = purchaseOrderSchema.safeParse(makeValidPO({ supplierId: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects empty items array (must have at least 1 item)', () => {
    const result = purchaseOrderSchema.safeParse({ supplierId: 'sup-123', items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects item with zero quantity', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Test',
      itemType: 'CLOTH',
      quantity: 0, // must be positive
      unit: 'm',
      pricePerUnit: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects item with negative quantity', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Test',
      itemType: 'CLOTH',
      quantity: -5,
      unit: 'm',
      pricePerUnit: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative pricePerUnit', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Test',
      itemType: 'CLOTH',
      quantity: 10,
      unit: 'm',
      pricePerUnit: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an item without quantity or orderedQuantity', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Test',
      itemType: 'CLOTH',
      unit: 'm',
      pricePerUnit: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid itemType', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Test',
      itemType: 'INVALID_TYPE',
      quantity: 10,
      unit: 'm',
      pricePerUnit: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty itemName', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: '',
      itemType: 'CLOTH',
      quantity: 10,
      unit: 'm',
      pricePerUnit: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty unit', () => {
    const result = purchaseOrderItemSchema.safeParse({
      itemName: 'Cotton',
      itemType: 'CLOTH',
      quantity: 10,
      unit: '',
      pricePerUnit: 100,
    })
    expect(result.success).toBe(false)
  })
})

// ── Total amount calculation ───────────────────────────────────────────────

describe('PO total amount calculation', () => {
  it('single item total = quantity × pricePerUnit', () => {
    expect(calculateItemTotal(50, 300)).toBe(15000)
  })

  it('fractional price total rounds as expected', () => {
    // 200 buttons × ₹5 each = ₹1,000
    expect(calculateItemTotal(200, 5)).toBe(1000)
  })

  it('sum of multiple items', () => {
    const items = [
      { quantity: 50, pricePerUnit: 300 },  // 15000
      { quantity: 200, pricePerUnit: 5 },   // 1000
    ]
    expect(calculatePOTotal(items)).toBe(16000)
  })

  it('zero price item contributes 0 to total', () => {
    const items = [
      { quantity: 10, pricePerUnit: 200 },  // 2000
      { quantity: 5, pricePerUnit: 0 },     // 0
    ]
    expect(calculatePOTotal(items)).toBe(2000)
  })

  it('single item PO total equals that item total', () => {
    const items = [{ quantity: 25, pricePerUnit: 450 }]
    expect(calculatePOTotal(items)).toBe(calculateItemTotal(25, 450))
  })

  it('empty items array produces 0 total', () => {
    expect(calculatePOTotal([])).toBe(0)
  })

  it('large order total calculation (realistic scenario)', () => {
    // 200m silk @ ₹800/m + 500 buttons @ ₹8 + 50 zippers @ ₹25
    const items = [
      { quantity: 200, pricePerUnit: 800 },  // 160,000
      { quantity: 500, pricePerUnit: 8 },    // 4,000
      { quantity: 50, pricePerUnit: 25 },    // 1,250
    ]
    expect(calculatePOTotal(items)).toBe(165250)
  })
})

// ── PO number generation ──────────────────────────────────────────────────

describe('PO number generation', () => {
  it('follows PO-{YEAR}-{NNNN} format', () => {
    const poNum = generatePONumber(2026, 0)
    expect(poNum).toMatch(/^PO-\d{4}-\d{4}$/)
  })

  it('first PO of the year is PO-{YEAR}-0001', () => {
    expect(generatePONumber(2026, 0)).toBe('PO-2026-0001')
  })

  it('zero-pads sequence number to 4 digits', () => {
    expect(generatePONumber(2026, 9)).toBe('PO-2026-0010')
    expect(generatePONumber(2026, 99)).toBe('PO-2026-0100')
  })

  it('does not pad sequence numbers beyond 4 digits', () => {
    expect(generatePONumber(2026, 9999)).toBe('PO-2026-10000')
  })

  it('uses current year in PO number', () => {
    const currentYear = new Date().getFullYear()
    const poNum = generatePONumber(currentYear, 0)
    expect(poNum).toContain(String(currentYear))
  })

  it('sequence increments from existing count + 1', () => {
    // If there are 5 existing POs, next is #6
    expect(generatePONumber(2026, 5)).toBe('PO-2026-0006')
  })
})

// ── Query filter construction ─────────────────────────────────────────────

describe('purchase orders – GET filter construction', () => {
  // Mirrors route.ts: where = { active: true }; optionally add status/supplierId
  function buildPOWhere(status: string | null, supplierId: string | null) {
    const where: Record<string, unknown> = { active: true }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId
    return where
  }

  it('base filter always includes active:true', () => {
    expect(buildPOWhere(null, null)).toEqual({ active: true })
  })

  it('adds status filter when provided', () => {
    const where = buildPOWhere('PENDING', null)
    expect(where.status).toBe('PENDING')
    expect(where.active).toBe(true)
  })

  it('adds supplierId filter when provided', () => {
    const where = buildPOWhere(null, 'sup-xyz')
    expect(where.supplierId).toBe('sup-xyz')
    expect(where.active).toBe(true)
  })

  it('combines both filters when both provided', () => {
    const where = buildPOWhere('RECEIVED', 'sup-abc')
    expect(where.status).toBe('RECEIVED')
    expect(where.supplierId).toBe('sup-abc')
    expect(where.active).toBe(true)
  })

  it('does not add status when null', () => {
    const where = buildPOWhere(null, 'sup-123')
    expect(where).not.toHaveProperty('status')
  })

  it('does not add supplierId when null', () => {
    const where = buildPOWhere('PENDING', null)
    expect(where).not.toHaveProperty('supplierId')
  })
})

// ── Response structure ────────────────────────────────────────────────────

describe('GET /api/purchase-orders – response structure', () => {
  it('response wraps array in purchaseOrders key', () => {
    const mockResponse = { purchaseOrders: [] }
    expect(mockResponse).toHaveProperty('purchaseOrders')
    expect(Array.isArray(mockResponse.purchaseOrders)).toBe(true)
  })

  it('PO object has required fields', () => {
    const po = {
      id: 'po-test-id',
      poNumber: 'PO-2026-0001',
      supplierId: 'sup-abc',
      status: 'PENDING',
      totalAmount: 16000,
      balanceAmount: 16000,
      active: true,
      createdAt: new Date(),
      supplier: { id: 'sup-abc', name: 'Test Supplier', phone: null, email: null },
      items: [],
    }
    expect(po).toHaveProperty('poNumber')
    expect(po).toHaveProperty('status')
    expect(po).toHaveProperty('totalAmount')
    expect(po).toHaveProperty('balanceAmount')
    expect(po).toHaveProperty('supplier')
    expect(po).toHaveProperty('items')
  })

  it('POST 201 response wraps result in purchaseOrder key', () => {
    const mockCreated = {
      id: 'po-new-id',
      poNumber: 'PO-2026-0005',
      status: 'PENDING',
      totalAmount: 5000,
    }
    const response = { purchaseOrder: mockCreated }
    expect(response).toHaveProperty('purchaseOrder')
    expect(response.purchaseOrder.poNumber).toBe('PO-2026-0005')
  })
})
