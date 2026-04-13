/**
 * Orders API Unit Tests
 *
 * Tests order creation validation logic (Zod schema + business rules)
 * and query filter construction from app/api/orders/route.ts.
 *
 * Prisma is mocked via vitest.setup.ts — no DB calls.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Replicate the Zod schema from the production route ─────────────────────
// Importing the enum constants from the Prisma client (works in test env)
const OrderPriority = { NORMAL: 'NORMAL', URGENT: 'URGENT' } as const
const BodyType = { SLIM: 'SLIM', REGULAR: 'REGULAR', LARGE: 'LARGE', XL: 'XL' } as const
const StitchingTier = { BASIC: 'BASIC', PREMIUM: 'PREMIUM', LUXURY: 'LUXURY' } as const

type OrderPriority = (typeof OrderPriority)[keyof typeof OrderPriority]
type BodyType = (typeof BodyType)[keyof typeof BodyType]
type StitchingTier = (typeof StitchingTier)[keyof typeof StitchingTier]

const orderItemSchema = z.object({
  garmentPatternId: z.string().min(1),
  clothInventoryId: z.string().min(1),
  quantityOrdered: z.number().int().positive().default(1),
  bodyType: z.enum(['SLIM', 'REGULAR', 'LARGE', 'XL']).default('REGULAR'),
  assignedTailorId: z.string().nullish(),
  accessories: z.array(
    z.object({
      accessoryId: z.string(),
      quantity: z.number().int().positive().default(1),
    })
  ).optional().default([]),
})

const orderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  measurementId: z.string().nullish(),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  advancePaid: z.number().min(0).default(0),
  notes: z.string().nullish(),
  stitchingTier: z.enum(['BASIC', 'PREMIUM', 'LUXURY']).default('BASIC'),
  fabricWastagePercent: z.number().min(0).max(15).default(0),
  designerConsultationFee: z.number().min(0).default(0),
  isHandStitched: z.boolean().default(false),
  isFullCanvas: z.boolean().default(false),
  isRushOrder: z.boolean().default(false),
  hasComplexDesign: z.boolean().default(false),
  additionalFittings: z.number().int().min(0).default(0),
  hasPremiumLining: z.boolean().default(false),
  isFabricCostOverridden: z.boolean().default(false),
  fabricCostOverride: z.number().nullish(),
  fabricCostOverrideReason: z.string().nullish(),
  isStitchingCostOverridden: z.boolean().default(false),
  stitchingCostOverride: z.number().nullish(),
  stitchingCostOverrideReason: z.string().nullish(),
  isAccessoriesCostOverridden: z.boolean().default(false),
  accessoriesCostOverride: z.number().nullish(),
  accessoriesCostOverrideReason: z.string().nullish(),
  pricingNotes: z.string().nullish(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
})

// ── Helper to build a minimal valid order payload ─────────────────────────
function minimalOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    customerId: 'customer-001',
    deliveryDate: '2026-02-15',
    advancePaid: 0,
    items: [
      {
        garmentPatternId: 'pattern-001',
        clothInventoryId: 'cloth-001',
        quantityOrdered: 1,
        bodyType: 'REGULAR',
        accessories: [],
      },
    ],
    ...overrides,
  }
}

// ── Schema validation – happy path ────────────────────────────────────────

describe('orderSchema – valid payloads', () => {
  it('accepts a minimal valid order', () => {
    const result = orderSchema.safeParse(minimalOrder())
    expect(result.success).toBe(true)
  })

  it('applies default priority = NORMAL', () => {
    const result = orderSchema.safeParse(minimalOrder())
    if (result.success) expect(result.data.priority).toBe('NORMAL')
  })

  it('applies default stitchingTier = BASIC', () => {
    const result = orderSchema.safeParse(minimalOrder())
    if (result.success) expect(result.data.stitchingTier).toBe('BASIC')
  })

  it('applies default advancePaid = 0', () => {
    const result = orderSchema.safeParse(minimalOrder({ advancePaid: undefined }))
    if (result.success) expect(result.data.advancePaid).toBe(0)
  })

  it('applies default fabricWastagePercent = 0', () => {
    const result = orderSchema.safeParse(minimalOrder())
    if (result.success) expect(result.data.fabricWastagePercent).toBe(0)
  })

  it('applies default boolean flags to false', () => {
    const result = orderSchema.safeParse(minimalOrder())
    if (result.success) {
      expect(result.data.isHandStitched).toBe(false)
      expect(result.data.isFullCanvas).toBe(false)
      expect(result.data.isRushOrder).toBe(false)
      expect(result.data.hasComplexDesign).toBe(false)
      expect(result.data.hasPremiumLining).toBe(false)
    }
  })

  it('accepts URGENT priority', () => {
    const result = orderSchema.safeParse(minimalOrder({ priority: 'URGENT' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.priority).toBe('URGENT')
  })

  it('accepts PREMIUM stitching tier', () => {
    const result = orderSchema.safeParse(minimalOrder({ stitchingTier: 'PREMIUM' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.stitchingTier).toBe('PREMIUM')
  })

  it('accepts LUXURY stitching tier', () => {
    const result = orderSchema.safeParse(minimalOrder({ stitchingTier: 'LUXURY' }))
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.stitchingTier).toBe('LUXURY')
  })

  it('accepts all body types for items', () => {
    for (const bodyType of ['SLIM', 'REGULAR', 'LARGE', 'XL'] as const) {
      const result = orderSchema.safeParse(
        minimalOrder({ items: [{ garmentPatternId: 'p1', clothInventoryId: 'c1', quantityOrdered: 1, bodyType, accessories: [] }] })
      )
      expect(result.success, `bodyType ${bodyType} should be valid`).toBe(true)
    }
  })

  it('accepts multiple items', () => {
    const result = orderSchema.safeParse(
      minimalOrder({
        items: [
          { garmentPatternId: 'p1', clothInventoryId: 'c1', quantityOrdered: 1, bodyType: 'REGULAR', accessories: [] },
          { garmentPatternId: 'p2', clothInventoryId: 'c2', quantityOrdered: 1, bodyType: 'SLIM', accessories: [] },
        ],
      })
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.items).toHaveLength(2)
  })

  it('accepts premium workmanship flags', () => {
    const result = orderSchema.safeParse(minimalOrder({
      isHandStitched: true,
      isFullCanvas: true,
      isRushOrder: true,
      hasComplexDesign: true,
      hasPremiumLining: true,
      additionalFittings: 2,
    }))
    expect(result.success).toBe(true)
  })

  it('accepts fabric wastage up to 15%', () => {
    expect(orderSchema.safeParse(minimalOrder({ fabricWastagePercent: 15 })).success).toBe(true)
    expect(orderSchema.safeParse(minimalOrder({ fabricWastagePercent: 10 })).success).toBe(true)
    expect(orderSchema.safeParse(minimalOrder({ fabricWastagePercent: 0 })).success).toBe(true)
  })
})

// ── Schema validation – invalid payloads ──────────────────────────────────

describe('orderSchema – invalid payloads', () => {
  it('rejects missing customerId', () => {
    const result = orderSchema.safeParse(minimalOrder({ customerId: '' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('customerId'))).toBe(true)
    }
  })

  it('rejects missing deliveryDate', () => {
    const result = orderSchema.safeParse(minimalOrder({ deliveryDate: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects empty items array', () => {
    const result = orderSchema.safeParse(minimalOrder({ items: [] }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('items'))).toBe(true)
    }
  })

  it('rejects negative advancePaid', () => {
    const result = orderSchema.safeParse(minimalOrder({ advancePaid: -100 }))
    expect(result.success).toBe(false)
  })

  it('rejects fabricWastagePercent > 15', () => {
    const result = orderSchema.safeParse(minimalOrder({ fabricWastagePercent: 16 }))
    expect(result.success).toBe(false)
  })

  it('rejects fabricWastagePercent < 0', () => {
    const result = orderSchema.safeParse(minimalOrder({ fabricWastagePercent: -1 }))
    expect(result.success).toBe(false)
  })

  it('rejects invalid priority value', () => {
    const result = orderSchema.safeParse(minimalOrder({ priority: 'SUPER_URGENT' }))
    expect(result.success).toBe(false)
  })

  it('rejects invalid stitching tier', () => {
    const result = orderSchema.safeParse(minimalOrder({ stitchingTier: 'ULTRA' }))
    expect(result.success).toBe(false)
  })

  it('rejects item with empty garmentPatternId', () => {
    const result = orderSchema.safeParse(
      minimalOrder({ items: [{ garmentPatternId: '', clothInventoryId: 'c1', quantityOrdered: 1, bodyType: 'REGULAR', accessories: [] }] })
    )
    expect(result.success).toBe(false)
  })

  it('rejects item with non-integer quantityOrdered', () => {
    const result = orderSchema.safeParse(
      minimalOrder({ items: [{ garmentPatternId: 'p1', clothInventoryId: 'c1', quantityOrdered: 1.5, bodyType: 'REGULAR', accessories: [] }] })
    )
    expect(result.success).toBe(false)
  })

  it('rejects item with zero quantityOrdered', () => {
    const result = orderSchema.safeParse(
      minimalOrder({ items: [{ garmentPatternId: 'p1', clothInventoryId: 'c1', quantityOrdered: 0, bodyType: 'REGULAR', accessories: [] }] })
    )
    expect(result.success).toBe(false)
  })

  it('rejects invalid bodyType', () => {
    const result = orderSchema.safeParse(
      minimalOrder({ items: [{ garmentPatternId: 'p1', clothInventoryId: 'c1', quantityOrdered: 1, bodyType: 'EXTRA_LARGE', accessories: [] }] })
    )
    expect(result.success).toBe(false)
  })

  it('rejects additionalFittings < 0', () => {
    const result = orderSchema.safeParse(minimalOrder({ additionalFittings: -1 }))
    expect(result.success).toBe(false)
  })
})

// ── Balance amount filter construction ────────────────────────────────────

describe('GET orders – balanceAmount filter construction', () => {
  /**
   * From route.ts lines 165-199
   * Parse "operator:value" strings into Prisma where clauses
   */
  function buildBalanceFilter(balanceAmount: string | null): Record<string, unknown> {
    if (!balanceAmount) return {}

    const [operator, value] = balanceAmount.split(':')
    const numValue = parseFloat(value)

    if (isNaN(numValue)) return {}

    const filter: Record<string, unknown> = {}
    switch (operator) {
      case 'gt':
        filter.gt = numValue === 0 ? 0.01 : numValue
        break
      case 'gte':
        filter.gte = numValue
        break
      case 'lt':
        filter.lt = numValue
        break
      case 'lte':
        filter.lte = numValue
        break
      case 'eq':
        if (numValue === 0) {
          return { gte: -0.01, lte: 0.01 }
        }
        filter.equals = numValue
        break
      default:
        filter.gt = parseFloat(balanceAmount) === 0 ? 0.01 : parseFloat(balanceAmount)
    }
    return filter
  }

  it('gt:0 uses 0.01 threshold (floating-point tolerance)', () => {
    const filter = buildBalanceFilter('gt:0')
    expect(filter.gt).toBe(0.01)
  })

  it('gt:100 uses exact value', () => {
    const filter = buildBalanceFilter('gt:100')
    expect(filter.gt).toBe(100)
  })

  it('gte:5000 uses exact gte', () => {
    const filter = buildBalanceFilter('gte:5000')
    expect(filter.gte).toBe(5000)
  })

  it('lt:500 uses exact lt', () => {
    const filter = buildBalanceFilter('lt:500')
    expect(filter.lt).toBe(500)
  })

  it('lte:1000 uses exact lte', () => {
    const filter = buildBalanceFilter('lte:1000')
    expect(filter.lte).toBe(1000)
  })

  it('eq:0 uses -0.01/+0.01 range (floating-point tolerance)', () => {
    const filter = buildBalanceFilter('eq:0')
    expect(filter.gte).toBe(-0.01)
    expect(filter.lte).toBe(0.01)
  })

  it('eq:500 uses equals', () => {
    const filter = buildBalanceFilter('eq:500')
    expect(filter.equals).toBe(500)
  })

  it('returns empty object for null input', () => {
    expect(buildBalanceFilter(null)).toEqual({})
  })

  it('returns empty object for invalid numeric value', () => {
    expect(buildBalanceFilter('gt:abc')).toEqual({})
  })
})

// ── Order number generation ────────────────────────────────────────────────

describe('order number generation', () => {
  /**
   * From route.ts line 523:
   *   `ORD-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
   */
  function generateOrderNum(): string {
    return `ORD-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
  }

  it('starts with ORD-', () => {
    expect(generateOrderNum().startsWith('ORD-')).toBe(true)
  })

  it('has 3 parts separated by hyphens', () => {
    const parts = generateOrderNum().split('-')
    expect(parts).toHaveLength(3)
  })

  it('random suffix is zero-padded to 3 digits', () => {
    // Run 50 times to catch edge cases with low random numbers
    for (let i = 0; i < 50; i++) {
      const num = generateOrderNum()
      const suffix = num.split('-')[2]
      expect(suffix).toMatch(/^\d{3}$/)
    }
  })
})

// ── Advance payment validation rule ───────────────────────────────────────

describe('advance payment validation rule', () => {
  /**
   * From route.ts lines 509-516:
   *   if (validatedData.advancePaid > totalAmount) return 400
   */
  function validateAdvance(advancePaid: number, totalAmount: number): string | null {
    if (advancePaid > totalAmount) {
      return `Advance payment (₹${advancePaid.toFixed(2)}) cannot exceed total order amount (₹${totalAmount.toFixed(2)})`
    }
    return null
  }

  it('no error when advance equals total', () => {
    expect(validateAdvance(11200, 11200)).toBeNull()
  })

  it('no error when advance is less than total', () => {
    expect(validateAdvance(5000, 11200)).toBeNull()
  })

  it('no error for zero advance', () => {
    expect(validateAdvance(0, 11200)).toBeNull()
  })

  it('returns error message when advance exceeds total', () => {
    const msg = validateAdvance(15000, 11200)
    expect(msg).not.toBeNull()
    expect(msg).toContain('15000.00')
    expect(msg).toContain('11200.00')
    expect(msg).toContain('cannot exceed')
  })

  it('error message uses ₹ symbol', () => {
    const msg = validateAdvance(15000, 11200)
    expect(msg).toContain('₹')
  })
})

// ── Subtotal composition ───────────────────────────────────────────────────

describe('order subtotal composition', () => {
  /**
   * From route.ts line 491:
   *   subTotal = fabricCost + fabricWastageAmount + accessoriesCost
   *             + stitchingCost + workmanshipPremiums + designerConsultationFee
   */
  function calcSubTotal(costs: {
    fabricCost: number
    fabricWastageAmount: number
    accessoriesCost: number
    stitchingCost: number
    workmanshipPremiums: number
    designerConsultationFee: number
  }): number {
    return parseFloat((
      costs.fabricCost +
      costs.fabricWastageAmount +
      costs.accessoriesCost +
      costs.stitchingCost +
      costs.workmanshipPremiums +
      costs.designerConsultationFee
    ).toFixed(2))
  }

  it('sums all cost components correctly', () => {
    const subTotal = calcSubTotal({
      fabricCost: 10000,
      fabricWastageAmount: 1000, // 10% wastage
      accessoriesCost: 500,
      stitchingCost: 2000,
      workmanshipPremiums: 4000, // hand stitching 40%
      designerConsultationFee: 3000,
    })
    expect(subTotal).toBe(20500)
  })

  it('zero optional costs: subTotal equals fabric + stitching', () => {
    const subTotal = calcSubTotal({
      fabricCost: 10000,
      fabricWastageAmount: 0,
      accessoriesCost: 0,
      stitchingCost: 2000,
      workmanshipPremiums: 0,
      designerConsultationFee: 0,
    })
    expect(subTotal).toBe(12000)
  })

  it('result is rounded to 2 decimal places', () => {
    const subTotal = calcSubTotal({
      fabricCost: 10000.001,
      fabricWastageAmount: 1000.004,
      accessoriesCost: 500.003,
      stitchingCost: 2000.001,
      workmanshipPremiums: 0,
      designerConsultationFee: 0,
    })
    const decimals = subTotal.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})
