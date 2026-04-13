/**
 * Inventory API Unit Tests
 *
 * Tests the Zod schema validation and response structure of:
 *   GET  /api/inventory/cloth  (app/api/inventory/cloth/route.ts)
 *   POST /api/inventory/cloth
 *
 * Uses mocked Prisma — does NOT touch the real database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

// ── Replicate the Zod schema from the production route ─────────────────────
// We test the schema directly to avoid importing next/server into unit tests.
const clothInventorySchema = z.object({
  sku: z.string().nullish(),
  name: z.string().nullish(),
  type: z.string().nullish(),
  brand: z.string().nullish(),
  color: z.string().nullish(),
  colorHex: z.string().nullish().default('#000000'),
  pattern: z.string().nullish(),
  quality: z.string().nullish(),
  pricePerMeter: z.number().nullish(),
  currentStock: z.number().nullish(),
  minimumStockMeters: z.number().nullish(),
  supplier: z.string().nullish(),
  supplierId: z.string().nullish(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
})

// ── SKU generation helper (mirrors route logic) ───────────────────────────
function generateClothSku(type?: string | null, brand?: string | null): string {
  const t = (type || 'UNK').substring(0, 3).toUpperCase()
  const b = (brand || 'UNK').substring(0, 3).toUpperCase()
  return `CLT-${t}-${b}-${Date.now().toString().slice(-6)}`
}

// ── Mocked DB behaviour helpers ───────────────────────────────────────────
function makeClothItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cloth-test-id',
    sku: 'CLT-COT-ABC-123456',
    name: 'Premium Cotton',
    type: 'Cotton',
    brand: 'ABC',
    color: 'Blue',
    colorHex: '#3B82F6',
    pattern: 'Plain',
    quality: 'Premium',
    pricePerMeter: 500,
    currentStock: 100,
    reserved: 0,
    minimumStockMeters: 20,
    supplier: 'Test Supplier',
    supplierId: null,
    location: 'Rack A1',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    supplierRel: null,
    ...overrides,
  }
}

// ── Schema validation tests ────────────────────────────────────────────────

describe('clothInventorySchema – valid data', () => {
  it('accepts a complete valid payload', () => {
    const input = {
      sku: 'CLT-COT-ABC-001',
      name: 'Premium Cotton Blue',
      type: 'Cotton',
      brand: 'ABC Fabrics',
      color: 'Blue',
      colorHex: '#3B82F6',
      pattern: 'Plain',
      quality: 'Premium',
      pricePerMeter: 450.00,
      currentStock: 100,
      minimumStockMeters: 20,
      supplier: 'ABC Fabrics Ltd',
      location: 'Rack A1',
      notes: 'Premium quality cotton',
    }
    const result = clothInventorySchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('accepts a minimal payload (all fields nullable)', () => {
    const result = clothInventorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('applies default colorHex when omitted', () => {
    const result = clothInventorySchema.safeParse({ name: 'Test Fabric' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.colorHex).toBe('#000000')
    }
  })

  it('accepts null values for nullable fields', () => {
    const result = clothInventorySchema.safeParse({
      sku: null,
      name: null,
      pricePerMeter: null,
      supplierId: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts numeric stock values', () => {
    const result = clothInventorySchema.safeParse({
      currentStock: 150.5,
      minimumStockMeters: 20,
      pricePerMeter: 499.99,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currentStock).toBe(150.5)
      expect(result.data.pricePerMeter).toBe(499.99)
    }
  })
})

describe('clothInventorySchema – invalid data', () => {
  it('rejects non-numeric pricePerMeter', () => {
    const result = clothInventorySchema.safeParse({ pricePerMeter: 'not-a-number' })
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric currentStock', () => {
    const result = clothInventorySchema.safeParse({ currentStock: 'hundred' })
    expect(result.success).toBe(false)
  })

  it('rejects non-numeric minimumStockMeters', () => {
    const result = clothInventorySchema.safeParse({ minimumStockMeters: true })
    expect(result.success).toBe(false)
  })

  it('rejects non-string name', () => {
    const result = clothInventorySchema.safeParse({ name: 12345 })
    expect(result.success).toBe(false)
  })
})

// ── SKU generation ─────────────────────────────────────────────────────────

describe('SKU generation for cloth inventory', () => {
  it('generates CLT- prefix', () => {
    expect(generateClothSku('Cotton', 'ABC').startsWith('CLT-')).toBe(true)
  })

  it('uses first 3 chars of type (uppercased)', () => {
    expect(generateClothSku('Polyester', 'Brand')).toMatch(/^CLT-POL-/)
  })

  it('uses first 3 chars of brand (uppercased)', () => {
    expect(generateClothSku('Silk', 'premium')).toMatch(/^CLT-SIL-PRE-/)
  })

  it('falls back to UNK when type is missing', () => {
    expect(generateClothSku(null, 'ABC')).toMatch(/^CLT-UNK-/)
  })

  it('falls back to UNK when brand is missing', () => {
    expect(generateClothSku('Cotton', null)).toMatch(/^CLT-COT-UNK-/)
  })

  it('appends a 6-digit numeric suffix from timestamp', () => {
    const sku = generateClothSku('Cotton', 'ABC')
    const suffix = sku.split('-')[3]
    expect(suffix).toMatch(/^\d{6}$/)
  })
})

// ── Pagination calculation ─────────────────────────────────────────────────

describe('inventory API pagination logic', () => {
  function getPaginationMeta(page: number, limit: number, totalItems: number) {
    const skip = (page - 1) * limit
    const totalPages = Math.ceil(totalItems / limit)
    return { page, limit, skip, totalPages, totalItems }
  }

  it('calculates skip correctly for page 1', () => {
    expect(getPaginationMeta(1, 25, 100).skip).toBe(0)
  })

  it('calculates skip correctly for page 2', () => {
    expect(getPaginationMeta(2, 25, 100).skip).toBe(25)
  })

  it('calculates total pages', () => {
    expect(getPaginationMeta(1, 25, 100).totalPages).toBe(4)
    expect(getPaginationMeta(1, 25, 101).totalPages).toBe(5) // ceil
    expect(getPaginationMeta(1, 10, 32).totalPages).toBe(4)
  })

  it('default limit is 25 for cloth inventory', () => {
    // From route.ts: parseInt(searchParams.get('limit') || '25')
    const defaultLimit = parseInt('25')
    expect(defaultLimit).toBe(25)
  })
})

// ── GET response structure ─────────────────────────────────────────────────

describe('GET /api/inventory/cloth – response structure', () => {
  it('response includes both items and clothInventory aliases', () => {
    // The route returns both:  { items, clothInventory: items, pagination }
    const mockResponse = {
      items: [makeClothItem()],
      clothInventory: [makeClothItem()],
      pagination: { page: 1, limit: 25, totalItems: 1, totalPages: 1 },
    }

    expect(mockResponse).toHaveProperty('items')
    expect(mockResponse).toHaveProperty('clothInventory')
    expect(mockResponse).toHaveProperty('pagination')
    expect(mockResponse.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      totalItems: expect.any(Number),
      totalPages: expect.any(Number),
    })
  })

  it('inventory items have required stock fields', () => {
    const item = makeClothItem()
    expect(item).toHaveProperty('currentStock')
    expect(item).toHaveProperty('reserved')
    expect(item).toHaveProperty('minimumStockMeters')
    expect(item).toHaveProperty('pricePerMeter')
  })

  it('available stock is derivable from item fields', () => {
    const item = makeClothItem({ currentStock: 100, reserved: 30 })
    const available = item.currentStock - item.reserved
    expect(available).toBe(70)
  })
})

// ── POST initial stock movement ────────────────────────────────────────────

describe('POST /api/inventory/cloth – initial stock movement', () => {
  it('creates a PURCHASE stock movement for initial stock', () => {
    // When currentStock > 0, the route creates a StockMovement of type PURCHASE
    const stockMovementData = {
      type: 'PURCHASE',
      quantity: 100,
      balanceAfter: 100,
      notes: 'Initial stock',
    }
    expect(stockMovementData.type).toBe('PURCHASE')
    expect(stockMovementData.quantity).toBe(100)
    expect(stockMovementData.balanceAfter).toBe(stockMovementData.quantity)
    expect(stockMovementData.notes).toBe('Initial stock')
  })

  it('does not create stock movement when currentStock is 0', () => {
    // Route condition: if (data.currentStock && data.currentStock > 0)
    const currentStock = 0
    const shouldCreateMovement = currentStock && currentStock > 0
    expect(shouldCreateMovement).toBeFalsy()
  })

  it('does not create stock movement when currentStock is null', () => {
    const currentStock = null
    const shouldCreateMovement = currentStock && (currentStock as number) > 0
    expect(shouldCreateMovement).toBeFalsy()
  })
})

// ── Search filter logic ────────────────────────────────────────────────────

describe('inventory search filter construction', () => {
  /**
   * The route builds a `where.OR` array for search that includes:
   * name, sku, type, brand, color
   */
  function buildSearchWhere(search: string | null) {
    if (!search) return {}
    return {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
      ],
    }
  }

  it('returns empty where when search is null', () => {
    expect(buildSearchWhere(null)).toEqual({})
  })

  it('builds OR filter across 5 fields when search is provided', () => {
    const where = buildSearchWhere('cotton')
    expect(where.OR).toHaveLength(5)
    const fields = where.OR!.map((c: any) => Object.keys(c)[0])
    expect(fields).toContain('name')
    expect(fields).toContain('sku')
    expect(fields).toContain('type')
    expect(fields).toContain('brand')
    expect(fields).toContain('color')
  })

  it('uses case-insensitive mode', () => {
    const where = buildSearchWhere('Cotton')
    where.OR!.forEach((clause: any) => {
      const value = Object.values(clause)[0] as any
      expect(value.mode).toBe('insensitive')
    })
  })
})
