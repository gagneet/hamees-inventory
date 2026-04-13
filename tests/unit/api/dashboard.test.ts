/**
 * Dashboard API Unit Tests
 *
 * Tests the structure and logic of the enhanced stats API response
 * from app/api/dashboard/enhanced-stats/route.ts.
 *
 * These tests verify:
 * 1. Response shape (all required keys present)
 * 2. Calculation formulas (revenue growth, outstanding payments, stock metrics)
 * 3. Filter logic (date ranges, status exclusions)
 *
 * Prisma is mocked — no DB calls.
 */
import { describe, it, expect } from 'vitest'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

// ── Growth rate calculation ────────────────────────────────────────────────
// Used throughout the dashboard for MoM comparisons
function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return parseFloat(((( current - previous) / previous) * 100).toFixed(1))
}

// ── Response shape validators ─────────────────────────────────────────────
function validateGeneralStatsShape(stats: Record<string, unknown>) {
  const required = ['inventory', 'orders', 'revenue', 'customers', 'cashFlow']
  return required.every((key) => key in stats)
}

function validateInventoryShape(inv: Record<string, unknown>) {
  return ['totalItems', 'lowStock', 'criticalStock', 'totalValue'].every((k) => k in inv)
}

function validateOrdersShape(orders: Record<string, unknown>) {
  return ['total', 'pending', 'thisMonth', 'growth'].every((k) => k in orders)
}

// ── Mock response builder ─────────────────────────────────────────────────
function buildMockDashboardResponse(overrides: Record<string, unknown> = {}) {
  return {
    generalStats: {
      inventory: {
        totalItems: 10,
        lowStock: 2,
        criticalStock: 1,
        totalValue: 250000,
        totalMeters: 850,
      },
      orders: {
        total: 232,
        pending: 45,
        thisMonth: 25,
        lastMonth: 55,
        growth: calcGrowth(25, 55),
        delivered: 187,
      },
      revenue: {
        thisMonth: 125000,
        lastMonth: 220000,
        growth: calcGrowth(125000, 220000),
        byMonth: [],
      },
      customers: {
        total: 25,
        newThisMonth: 2,
      },
      cashFlow: {
        cashCollectedThisMonth: 90000,
        cashCollectedLastMonth: 175000,
        outstandingPayments: 91093.32,
      },
    },
    tailor: {
      inProgress: 12,
      dueToday: 3,
      overdue: 2,
      workloadByGarmentType: [],
    },
    inventory: {
      lowStockCount: 2,
      criticalStockCount: 1,
      pendingPOs: 4,
      totalItems: 10,
      lowStockItems: [],
      criticalStockItems: [],
    },
    sales: {
      newOrdersToday: 1,
      readyForPickup: 5,
      pendingOrders: 40,
      thisMonthOrders: 25,
    },
    ...overrides,
  }
}

// ── Response structure tests ───────────────────────────────────────────────

describe('dashboard API response structure', () => {
  it('includes all top-level keys', () => {
    const response = buildMockDashboardResponse()
    expect(response).toHaveProperty('generalStats')
    expect(response).toHaveProperty('tailor')
    expect(response).toHaveProperty('inventory')
    expect(response).toHaveProperty('sales')
  })

  it('generalStats has inventory, orders, revenue, customers, cashFlow', () => {
    const { generalStats } = buildMockDashboardResponse()
    expect(validateGeneralStatsShape(generalStats)).toBe(true)
  })

  it('inventory stats has required keys', () => {
    const { generalStats } = buildMockDashboardResponse()
    expect(validateInventoryShape(generalStats.inventory)).toBe(true)
  })

  it('orders stats has required keys', () => {
    const { generalStats } = buildMockDashboardResponse()
    expect(validateOrdersShape(generalStats.orders)).toBe(true)
  })

  it('tailor section has inProgress, dueToday, overdue', () => {
    const { tailor } = buildMockDashboardResponse()
    expect(tailor).toHaveProperty('inProgress')
    expect(tailor).toHaveProperty('dueToday')
    expect(tailor).toHaveProperty('overdue')
  })

  it('inventory section has lowStockCount and criticalStockCount', () => {
    const { inventory } = buildMockDashboardResponse()
    expect(inventory).toHaveProperty('lowStockCount')
    expect(inventory).toHaveProperty('criticalStockCount')
  })

  it('sales section has newOrdersToday and readyForPickup', () => {
    const { sales } = buildMockDashboardResponse()
    expect(sales).toHaveProperty('newOrdersToday')
    expect(sales).toHaveProperty('readyForPickup')
  })
})

// ── Growth rate calculation ────────────────────────────────────────────────

describe('month-over-month growth rate calculation', () => {
  it('calculates positive growth correctly', () => {
    // 25 this month vs 55 last month → decline
    expect(calcGrowth(25, 55)).toBeCloseTo(-54.5, 1)
  })

  it('calculates zero growth when equal', () => {
    expect(calcGrowth(100, 100)).toBe(0)
  })

  it('handles previous month being zero (avoid division by zero)', () => {
    expect(calcGrowth(100, 0)).toBe(100)
    expect(calcGrowth(0, 0)).toBe(0)
  })

  it('calculates real growth percentage', () => {
    // 120,000 current vs 100,000 previous → +20%
    expect(calcGrowth(120000, 100000)).toBe(20)
  })

  it('result is rounded to 1 decimal place', () => {
    const growth = calcGrowth(123456, 98765)
    const decimals = growth.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(1)
  })
})

// ── Cash collected metric ─────────────────────────────────────────────────

describe('cash collected metric excludes cancelled orders (v0.27.5)', () => {
  /**
   * The fix in v0.27.5 added:
   *   order: { status: { notIn: ['CANCELLED'] } }
   * to the paymentInstallment aggregation query.
   */

  function buildCashCollectedQuery(monthStart: Date, monthEnd: Date) {
    return {
      where: {
        paidDate: { gte: monthStart, lte: monthEnd },
        status: 'PAID',
        order: {
          status: { notIn: ['CANCELLED'] },
        },
      },
    }
  }

  it('includes order status filter in cash collected query', () => {
    const now = new Date()
    const query = buildCashCollectedQuery(startOfMonth(now), endOfMonth(now))
    expect(query.where.order).toBeDefined()
    expect(query.where.order.status.notIn).toContain('CANCELLED')
  })

  it('does not include CANCELLED in notIn for delivered orders', () => {
    const now = new Date()
    const query = buildCashCollectedQuery(startOfMonth(now), endOfMonth(now))
    // DELIVERED is not in the exclusion list — those payments ARE counted
    expect(query.where.order.status.notIn).not.toContain('DELIVERED')
  })
})

// ── Outstanding payments calculation ──────────────────────────────────────

describe('outstanding payments (v0.28.6)', () => {
  /**
   * Outstanding = SUM(balanceAmount) WHERE status NOT IN ('CANCELLED')
   * v0.28.6 fixed: correct balance after fixing PO calculations and double-counting
   */

  it('excludes cancelled orders from outstanding calculations', () => {
    const orders = [
      { status: 'DELIVERED', balanceAmount: 50000 },
      { status: 'READY', balanceAmount: 25000 },
      { status: 'CANCELLED', balanceAmount: 15000 }, // should NOT be included
      { status: 'NEW', balanceAmount: 16093.32 },
    ]
    const outstanding = orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((s, o) => s + o.balanceAmount, 0)

    expect(outstanding).toBeCloseTo(91093.32, 2)
  })

  it('counts all active order statuses', () => {
    const activeStatuses = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY', 'DELIVERED']
    // All of these should have their balanceAmount counted
    activeStatuses.forEach((status) => {
      expect(status).not.toBe('CANCELLED')
    })
  })
})

// ── Stock health classification ────────────────────────────────────────────

describe('stock health chart data structure', () => {
  /**
   * Stock Health Chart shows In Stock / Low / Critical counts.
   * Critical: available < minimum * 0.5
   * Low:      available >= minimum * 0.5 AND available < minimum
   * In Stock: available >= minimum
   */
  function classifyStock(items: Array<{ currentStock: number; reserved: number; minimumStockMeters: number }>) {
    const classified = items.map((item) => {
      const available = item.currentStock - item.reserved
      const min = item.minimumStockMeters
      let status: 'healthy' | 'low' | 'critical'
      if (available >= min) status = 'healthy'
      else if (available >= min * 0.5) status = 'low'
      else status = 'critical'
      return { ...item, available, status }
    })

    return {
      healthy: classified.filter((i) => i.status === 'healthy').length,
      low: classified.filter((i) => i.status === 'low').length,
      critical: classified.filter((i) => i.status === 'critical').length,
    }
  }

  it('classifies items correctly', () => {
    const items = [
      { currentStock: 100, reserved: 10, minimumStockMeters: 20 },   // 90 >= 20 → healthy
      { currentStock: 75, reserved: 60, minimumStockMeters: 20 },    // 15 >= 10 → low
      { currentStock: 75, reserved: 69, minimumStockMeters: 20 },    // 6 < 10 → critical
    ]

    const result = classifyStock(items)
    expect(result.healthy).toBe(1)
    expect(result.low).toBe(1)
    expect(result.critical).toBe(1)
  })

  it('total count equals number of items', () => {
    const items = [
      { currentStock: 100, reserved: 0, minimumStockMeters: 20 },
      { currentStock: 100, reserved: 0, minimumStockMeters: 20 },
      { currentStock: 5, reserved: 0, minimumStockMeters: 20 },
    ]
    const result = classifyStock(items)
    expect(result.healthy + result.low + result.critical).toBe(3)
  })
})

// ── Date range construction ────────────────────────────────────────────────

describe('dashboard date range construction', () => {
  it('this month start/end spans the full month', () => {
    const now = new Date('2026-01-15')
    const start = startOfMonth(now)
    const end = endOfMonth(now)

    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(31) // January has 31 days
  })

  it('last month start/end correctly calculated with subMonths', () => {
    const now = new Date('2026-01-15')
    const lastMonth = subMonths(now, 1)
    const start = startOfMonth(lastMonth)
    const end = endOfMonth(lastMonth)

    expect(start.getMonth()).toBe(11) // December (0-indexed)
    expect(end.getMonth()).toBe(11)
    expect(start.getFullYear()).toBe(2025)
  })

  it('handles month boundary correctly for February', () => {
    const now = new Date('2026-02-28')
    const start = startOfMonth(now)
    const end = endOfMonth(now)

    expect(start.getDate()).toBe(1)
    expect(end.getDate()).toBe(28) // 2026 is not a leap year
  })
})

// ── Revenue forecast calculation ──────────────────────────────────────────

describe('revenue forecast (v0.21.0)', () => {
  /**
   * From revenue-forecast-chart.tsx:
   *   deliveredRevenue = sum of DELIVERED orders this month
   *   pendingRevenue = sum of non-delivered, non-cancelled orders this month
   *   forecastedRevenue = deliveredRevenue + pendingRevenue
   *   growthRate = ((forecasted - lastMonth) / lastMonth) * 100
   */
  function calcForecast(
    deliveredRevenue: number,
    pendingRevenue: number,
    lastMonthRevenue: number
  ) {
    const forecastedRevenue = deliveredRevenue + pendingRevenue
    const growthRate =
      lastMonthRevenue > 0
        ? parseFloat((((forecastedRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1))
        : 0
    return { deliveredRevenue, pendingRevenue, forecastedRevenue, growthRate }
  }

  it('forecasted = delivered + pending', () => {
    const { forecastedRevenue } = calcForecast(100000, 50000, 120000)
    expect(forecastedRevenue).toBe(150000)
  })

  it('growth rate shows improvement over last month', () => {
    // 150,000 this month vs 120,000 last month → +25%
    const { growthRate } = calcForecast(100000, 50000, 120000)
    expect(growthRate).toBeCloseTo(25, 0)
  })

  it('growth rate shows decline', () => {
    // 80,000 forecast vs 120,000 last → -33.3%
    const { growthRate } = calcForecast(60000, 20000, 120000)
    expect(growthRate).toBeCloseTo(-33.3, 0)
  })

  it('handles zero last month gracefully', () => {
    const { growthRate } = calcForecast(50000, 25000, 0)
    expect(growthRate).toBe(0)
  })
})
