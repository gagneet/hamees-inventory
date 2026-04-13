/**
 * Stock Management Business Logic Tests
 *
 * Tests calculateStockStatus and stock reservation / availability logic.
 * The available stock formula is always:
 *   available = currentStock - reserved
 */
import { describe, it, expect } from 'vitest'
import { calculateStockStatus } from '@/lib/utils'

// ── calculateStockStatus ───────────────────────────────────────────────────
// Source definition (lib/utils.ts):
//   healthy  → available >= minimum
//   low      → available >= minimum * 0.5
//   critical → otherwise (available < minimum * 0.5)

describe('calculateStockStatus thresholds', () => {
  it('"healthy" when available is exactly at minimum', () => {
    expect(calculateStockStatus(20, 20)).toBe('healthy')
  })

  it('"healthy" when available exceeds minimum', () => {
    expect(calculateStockStatus(50, 20)).toBe('healthy')
  })

  it('"low" when available is exactly 50% of minimum', () => {
    // 10 >= 20 * 0.5 (10)  →  low
    expect(calculateStockStatus(10, 20)).toBe('low')
  })

  it('"low" when available is between 50% and 100% of minimum', () => {
    expect(calculateStockStatus(12, 20)).toBe('low')
    expect(calculateStockStatus(11, 20)).toBe('low')
    expect(calculateStockStatus(19.99, 20)).toBe('low')
  })

  it('"critical" when available is just below 50% of minimum', () => {
    expect(calculateStockStatus(9.99, 20)).toBe('critical')
    expect(calculateStockStatus(9, 20)).toBe('critical')
  })

  it('"critical" when available is zero', () => {
    expect(calculateStockStatus(0, 20)).toBe('critical')
  })

  it('"critical" for the real Wool Blend scenario (5.65m available, 20m minimum)', () => {
    // Verified production scenario from v0.19.2 fix
    expect(calculateStockStatus(5.65, 20)).toBe('critical')
  })

  it('"critical" for the real Wool Premium scenario (6.20m available, 20m minimum)', () => {
    expect(calculateStockStatus(6.20, 20)).toBe('critical')
  })

  it('handles large minimums correctly', () => {
    // 100m minimum → threshold = 50m
    // 40m available < 50 (minimum * 0.5) → critical
    expect(calculateStockStatus(40, 100)).toBe('critical')
    // 49m available < 50 → critical
    expect(calculateStockStatus(49, 100)).toBe('critical')
    // 50m available >= 50 (exactly at 50%) → low
    expect(calculateStockStatus(50, 100)).toBe('low')
    // 75m available: 75 < 100 (not healthy), 75 >= 50 → low
    expect(calculateStockStatus(75, 100)).toBe('low')
    // 100m available: >= minimum → healthy
    expect(calculateStockStatus(100, 100)).toBe('healthy')
  })
})

// ── Available stock calculation ────────────────────────────────────────────

describe('available stock = currentStock - reserved', () => {
  function availableStock(currentStock: number, reserved: number): number {
    return currentStock - reserved
  }

  it('no reservations: all stock is available', () => {
    expect(availableStock(100, 0)).toBe(100)
  })

  it('some reservations reduce available stock', () => {
    expect(availableStock(100, 30)).toBe(70)
  })

  it('full reservation means zero available', () => {
    expect(availableStock(50, 50)).toBe(0)
  })

  it('real scenario: cotton with partial reservation', () => {
    // 200m total, 50m reserved → 150m available
    expect(availableStock(200, 50)).toBe(150)
    expect(calculateStockStatus(150, 20)).toBe('healthy')
  })

  it('real scenario: Wool Blend (75m total, 69.35m reserved)', () => {
    const available = availableStock(75, 69.35)
    expect(available).toBeCloseTo(5.65, 2)
    expect(calculateStockStatus(available, 20)).toBe('critical')
  })
})

// ── Stock reservation on order creation ───────────────────────────────────

describe('stock reservation logic (order creation)', () => {
  /**
   * When an order is created, the cloth inventory's "reserved" field is incremented
   * by estimatedMeters.
   *
   *   newReserved = currentReserved + estimatedMeters
   *   newAvailable = currentStock - newReserved
   */

  function reserveStock(currentStock: number, currentReserved: number, estimatedMeters: number) {
    if (currentStock - currentReserved < estimatedMeters) {
      throw new Error('Insufficient stock')
    }
    const newReserved = currentReserved + estimatedMeters
    const newAvailable = currentStock - newReserved
    return { newReserved, newAvailable }
  }

  it('reserves estimated meters and reduces available stock', () => {
    const { newReserved, newAvailable } = reserveStock(100, 10, 3.5)
    expect(newReserved).toBe(13.5)
    expect(newAvailable).toBe(86.5)
  })

  it('throws when insufficient stock available', () => {
    // Only 5m available (100 - 95), need 10m
    expect(() => reserveStock(100, 95, 10)).toThrow('Insufficient stock')
  })

  it('reserving exactly what is available leaves zero stock', () => {
    const { newAvailable } = reserveStock(100, 90, 10)
    expect(newAvailable).toBe(0)
  })

  it('multiple order reservations accumulate correctly', () => {
    // Order 1 reserves 3m
    let { newReserved: r1, newAvailable: a1 } = reserveStock(100, 0, 3)
    expect(r1).toBe(3)
    expect(a1).toBe(97)

    // Order 2 reserves 5m (on top of existing 3m)
    const { newReserved: r2, newAvailable: a2 } = reserveStock(100, r1, 5)
    expect(r2).toBe(8)
    expect(a2).toBe(92)
  })
})

// ── Stock release on cancellation ─────────────────────────────────────────

describe('stock release on order cancellation', () => {
  /**
   * When an order is CANCELLED, the cloth reservation is released:
   *   newReserved = currentReserved - estimatedMeters
   *   currentStock remains unchanged
   */
  function releaseStock(currentStock: number, currentReserved: number, estimatedMeters: number) {
    const newReserved = Math.max(0, currentReserved - estimatedMeters)
    return { newReserved, available: currentStock - newReserved }
  }

  it('releasing reservation restores available stock', () => {
    const { newReserved, available } = releaseStock(100, 10, 3.5)
    expect(newReserved).toBe(6.5)
    expect(available).toBe(93.5)
  })

  it('releasing all reserved stock makes it fully available again', () => {
    const { newReserved, available } = releaseStock(100, 10, 10)
    expect(newReserved).toBe(0)
    expect(available).toBe(100)
  })

  it('cannot release more than reserved (floor at zero)', () => {
    const { newReserved } = releaseStock(100, 5, 10) // edge case
    expect(newReserved).toBe(0)
  })
})

// ── Stock consumption on delivery ─────────────────────────────────────────

describe('stock consumption on delivery', () => {
  /**
   * When an order is DELIVERED, fabric is consumed:
   *   newCurrentStock = currentStock - actualMetersUsed
   *   newReserved     = reserved - estimatedMeters (reservation cleared)
   */
  function consumeStock(
    currentStock: number,
    reserved: number,
    estimatedMeters: number,
    actualMetersUsed: number
  ) {
    const newCurrentStock = currentStock - actualMetersUsed
    const newReserved = Math.max(0, reserved - estimatedMeters)
    const newAvailable = newCurrentStock - newReserved
    const wastage = actualMetersUsed - estimatedMeters
    return { newCurrentStock, newReserved, newAvailable, wastage }
  }

  it('consuming estimated meters reduces stock and clears reservation', () => {
    const { newCurrentStock, newReserved } = consumeStock(100, 10, 3.5, 3.5)
    expect(newCurrentStock).toBe(96.5)
    expect(newReserved).toBe(6.5)
  })

  it('positive wastage when actual > estimated', () => {
    const { wastage } = consumeStock(100, 10, 3.5, 3.87)
    expect(wastage).toBeCloseTo(0.37, 2)
  })

  it('negative wastage (savings) when actual < estimated', () => {
    const { wastage } = consumeStock(100, 10, 3.5, 3.25)
    expect(wastage).toBeCloseTo(-0.25, 2)
  })

  it('delivery reduces available stock permanently', () => {
    // Before delivery: 100 total, 10 reserved → 90 available
    // After delivery with 3.5m consumed: 96.5 total, 6.5 reserved → 90 available
    const { newAvailable } = consumeStock(100, 10, 3.5, 3.5)
    expect(newAvailable).toBe(90)
  })
})

// ── Body type meter adjustments ────────────────────────────────────────────

describe('fabric meters calculation by body type', () => {
  /**
   * From route.ts:
   *   adjustment = 0 for SLIM (pattern.slimAdjustment, assumed 0 if not SLIM special case)
   *   Actually from the route:
   *     if (item.bodyType === BodyType.SLIM) adjustment = pattern.slimAdjustment
   *     if (item.bodyType === BodyType.LARGE) adjustment = pattern.largeAdjustment
   *     if (item.bodyType === BodyType.XL) adjustment = pattern.xlAdjustment
   *   estimatedMeters = (pattern.baseMeters + adjustment) * quantityOrdered
   *
   * NOTE: REGULAR body type has no adjustment (stays 0).
   */
  function calcEstimatedMeters(
    baseMeters: number,
    bodyType: 'SLIM' | 'REGULAR' | 'LARGE' | 'XL',
    adjustments: { slim: number; large: number; xl: number },
    quantity = 1
  ): number {
    let adj = 0
    if (bodyType === 'SLIM') adj = adjustments.slim
    if (bodyType === 'LARGE') adj = adjustments.large
    if (bodyType === 'XL') adj = adjustments.xl
    return (baseMeters + adj) * quantity
  }

  const shirtPattern = { baseMeters: 2.5, slim: -0.2, large: 0.3, xl: 0.5 }

  it('REGULAR uses base meters with no adjustment', () => {
    expect(calcEstimatedMeters(2.5, 'REGULAR', shirtPattern)).toBe(2.5)
  })

  it('SLIM uses slim adjustment (typically negative)', () => {
    expect(calcEstimatedMeters(2.5, 'SLIM', shirtPattern)).toBe(2.3)
  })

  it('LARGE uses large adjustment (positive)', () => {
    expect(calcEstimatedMeters(2.5, 'LARGE', shirtPattern)).toBe(2.8)
  })

  it('XL uses xl adjustment (largest positive)', () => {
    expect(calcEstimatedMeters(2.5, 'XL', shirtPattern)).toBe(3.0)
  })

  it('quantity multiplies the estimated meters', () => {
    // 2 shirts of LARGE body type
    expect(calcEstimatedMeters(2.5, 'LARGE', shirtPattern, 2)).toBe(5.6)
  })
})
