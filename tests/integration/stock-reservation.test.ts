/**
 * Integration Tests – Stock Reservation
 *
 * Tests that:
 * 1. available stock = currentStock - reserved
 * 2. Critical/Low stock thresholds are correctly calculated with real data
 * 3. Test data is fully cleaned up (even on failure) — IDEMPOTENT
 *
 * Uses prefix "TEST_VITEST_" to identify test data for safe cleanup.
 * Creates and deletes its own stock movement records and cloth inventory items.
 *
 * Run with: pnpm test tests/integration/stock-reservation.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const TEST_PREFIX = 'TEST_VITEST_'
const TEST_SKU_PREFIX = 'CLT-TEST-VITEST-'

let pool: Pool
let prisma: PrismaClient

// ── DB connection ──────────────────────────────────────────────────────────
beforeAll(() => {
  const connectionString = process.env.DATABASE_URL!
  pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })
})

// ── Global cleanup — runs even if tests fail ───────────────────────────────
afterAll(async () => {
  try {
    await cleanupTestData()
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
})

// ── Per-test cleanup — reset test data between tests ──────────────────────
beforeEach(async () => {
  await cleanupTestData()
})

async function cleanupTestData() {
  // Delete in dependency order (stock movements first, then inventory items)
  const testItems = await prisma.clothInventory.findMany({
    where: { sku: { startsWith: TEST_SKU_PREFIX } },
    select: { id: true },
  })

  if (testItems.length > 0) {
    const ids = testItems.map((i) => i.id)

    // Delete associated stock movements
    await prisma.stockMovement.deleteMany({
      where: { clothInventoryId: { in: ids } },
    })

    // Delete the cloth inventory items themselves
    await prisma.clothInventory.deleteMany({
      where: { id: { in: ids } },
    })
  }
}

// ── Helper to create a test cloth item ────────────────────────────────────
async function createTestClothItem(overrides: {
  currentStock?: number
  reserved?: number
  minimumStockMeters?: number
  name?: string
} = {}) {
  const sku = `${TEST_SKU_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return prisma.clothInventory.create({
    data: {
      sku,
      name: overrides.name ?? `${TEST_PREFIX}Fabric`,
      type: 'Cotton',
      brand: 'TestBrand',
      color: 'Blue',
      colorHex: '#000000',
      pattern: 'Plain',
      quality: 'Standard',
      pricePerMeter: 100,
      currentStock: overrides.currentStock ?? 100,
      reserved: overrides.reserved ?? 0,
      totalPurchased: overrides.currentStock ?? 100,
      minimumStockMeters: overrides.minimumStockMeters ?? 20,
      supplier: 'TestSupplier',
    },
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('stock reservation – real database', () => {
  it('creates a cloth item and reads back correct stock fields', async () => {
    const item = await createTestClothItem({ currentStock: 100, reserved: 0 })

    const found = await prisma.clothInventory.findUnique({ where: { id: item.id } })
    expect(found).not.toBeNull()
    expect(found?.currentStock).toBe(100)
    expect(found?.reserved).toBe(0)
  })

  it('available stock = currentStock - reserved', async () => {
    const item = await createTestClothItem({ currentStock: 100, reserved: 30 })

    const found = await prisma.clothInventory.findUnique({ where: { id: item.id } })
    const available = (found?.currentStock ?? 0) - (found?.reserved ?? 0)
    expect(available).toBe(70)
  })

  it('incrementing reserved reduces effective available stock', async () => {
    const item = await createTestClothItem({ currentStock: 100, reserved: 0 })

    // Simulate order reservation: reserve 15m
    const updated = await prisma.clothInventory.update({
      where: { id: item.id },
      data: { reserved: { increment: 15 } },
    })

    expect(updated.reserved).toBe(15)
    expect(updated.currentStock - updated.reserved).toBe(85)
  })

  it('decrementing reserved (on cancellation) restores available stock', async () => {
    const item = await createTestClothItem({ currentStock: 100, reserved: 15 })

    const updated = await prisma.clothInventory.update({
      where: { id: item.id },
      data: { reserved: { decrement: 15 } },
    })

    expect(updated.reserved).toBe(0)
    expect(updated.currentStock - updated.reserved).toBe(100)
  })

  it('stock status is "critical" when available < 50% of minimum', async () => {
    // 100 total, 95 reserved → 5 available, minimum 20 → critical (5 < 10)
    const item = await createTestClothItem({ currentStock: 100, reserved: 95, minimumStockMeters: 20 })

    const found = await prisma.clothInventory.findUnique({ where: { id: item.id } })
    const available = (found?.currentStock ?? 0) - (found?.reserved ?? 0)
    const min = found?.minimumStockMeters ?? 20

    expect(available).toBe(5)
    expect(available < min * 0.5).toBe(true) // critical threshold
  })

  it('stock status is "low" when available is between 50% and 100% of minimum', async () => {
    // 100 total, 85 reserved → 15 available, minimum 20 → low (15 >= 10 && 15 < 20)
    const item = await createTestClothItem({ currentStock: 100, reserved: 85, minimumStockMeters: 20 })

    const found = await prisma.clothInventory.findUnique({ where: { id: item.id } })
    const available = (found?.currentStock ?? 0) - (found?.reserved ?? 0)
    const min = found?.minimumStockMeters ?? 20

    expect(available).toBe(15)
    expect(available >= min * 0.5).toBe(true)
    expect(available < min).toBe(true)
  })

  it('stock status is "healthy" when available >= minimum', async () => {
    // 100 total, 70 reserved → 30 available, minimum 20 → healthy (30 >= 20)
    const item = await createTestClothItem({ currentStock: 100, reserved: 70, minimumStockMeters: 20 })

    const found = await prisma.clothInventory.findUnique({ where: { id: item.id } })
    const available = (found?.currentStock ?? 0) - (found?.reserved ?? 0)
    const min = found?.minimumStockMeters ?? 20

    expect(available >= min).toBe(true)
  })

  it('creates a PURCHASE stock movement when initial stock > 0', async () => {
    // Manually create a stock movement as the API would
    const item = await createTestClothItem({ currentStock: 50 })

    const movement = await prisma.stockMovement.create({
      data: {
        clothInventoryId: item.id,
        type: 'PURCHASE',
        quantityMeters: 50,
        balanceAfterMeters: 50,
        // Use the first user in DB (doesn't matter for this test)
        userId: (await prisma.user.findFirst({ select: { id: true } }))!.id,
        notes: `${TEST_PREFIX}Initial stock movement`,
      },
    })

    expect(movement.type).toBe('PURCHASE')
    expect(movement.quantityMeters).toBe(50)
    expect(movement.balanceAfterMeters).toBe(50)
    expect(movement.clothInventoryId).toBe(item.id)
  })

  it('creates an ORDER_RESERVED movement when fabric is reserved', async () => {
    const item = await createTestClothItem({ currentStock: 100, reserved: 0 })
    const userId = (await prisma.user.findFirst({ select: { id: true } }))!.id

    // Reserve 3.5m for an order
    await prisma.clothInventory.update({
      where: { id: item.id },
      data: { reserved: { increment: 3.5 } },
    })

    const movement = await prisma.stockMovement.create({
      data: {
        clothInventoryId: item.id,
        type: 'ORDER_RESERVED',
        quantityMeters: -3.5, // negative = reserved/removed from available
        balanceAfterMeters: 96.5, // 100 - 3.5
        userId,
        notes: `${TEST_PREFIX}Reserved for test order`,
      },
    })

    expect(movement.type).toBe('ORDER_RESERVED')
    expect(movement.quantityMeters).toBe(-3.5)
    expect(movement.balanceAfterMeters).toBe(96.5)
  })

  it('releasing reservation creates ORDER_CANCELLED movement', async () => {
    const item = await createTestClothItem({ currentStock: 100, reserved: 10 })
    const userId = (await prisma.user.findFirst({ select: { id: true } }))!.id

    // Release reservation
    await prisma.clothInventory.update({
      where: { id: item.id },
      data: { reserved: { decrement: 10 } },
    })

    const movement = await prisma.stockMovement.create({
      data: {
        clothInventoryId: item.id,
        type: 'ORDER_CANCELLED',
        quantityMeters: 10, // positive = returned to available
        balanceAfterMeters: 100, // back to full
        userId,
        notes: `${TEST_PREFIX}Reservation released`,
      },
    })

    expect(movement.type).toBe('ORDER_CANCELLED')
    expect(movement.quantityMeters).toBe(10)
  })

  it('test data is isolated from production data via SKU prefix', async () => {
    // All test items we created should be identifiable by prefix
    const testItems = await prisma.clothInventory.findMany({
      where: { sku: { startsWith: TEST_SKU_PREFIX } },
    })

    // All returned items should be our test items
    for (const item of testItems) {
      expect(item.sku.startsWith(TEST_SKU_PREFIX)).toBe(true)
    }
  })
})

describe('real inventory stock levels', () => {
  /**
   * These tests read from existing seed data (no create/delete).
   * They verify that the seeded inventory has the expected structure.
   */

  it('at least some cloth inventory items exist', async () => {
    const count = await prisma.clothInventory.count({
      where: { sku: { not: { startsWith: TEST_SKU_PREFIX } } },
    })
    expect(count).toBeGreaterThan(0)
  })

  it('all cloth items have currentStock >= 0', async () => {
    const items = await prisma.clothInventory.findMany({
      where: { sku: { not: { startsWith: TEST_SKU_PREFIX } } },
      select: { currentStock: true, sku: true },
    })
    for (const item of items) {
      expect(item.currentStock, `${item.sku} has negative stock`).toBeGreaterThanOrEqual(0)
    }
  })

  it('all cloth items have reserved >= 0', async () => {
    const items = await prisma.clothInventory.findMany({
      where: { sku: { not: { startsWith: TEST_SKU_PREFIX } } },
      select: { reserved: true, sku: true },
    })
    for (const item of items) {
      expect(item.reserved, `${item.sku} has negative reserved`).toBeGreaterThanOrEqual(0)
    }
  })

  it('reserved never exceeds currentStock for any cloth item', async () => {
    const items = await prisma.clothInventory.findMany({
      where: { sku: { not: { startsWith: TEST_SKU_PREFIX } } },
      select: { currentStock: true, reserved: true, sku: true },
    })
    for (const item of items) {
      expect(
        item.reserved <= item.currentStock,
        `${item.sku}: reserved (${item.reserved}) > currentStock (${item.currentStock})`
      ).toBe(true)
    }
  })

  it('garment patterns have positive baseMeters', async () => {
    const patterns = await prisma.garmentPattern.findMany({
      select: { name: true, baseMeters: true },
    })
    expect(patterns.length).toBeGreaterThan(0)
    for (const pattern of patterns) {
      expect(pattern.baseMeters, `${pattern.name} has non-positive baseMeters`).toBeGreaterThan(0)
    }
  })
})
