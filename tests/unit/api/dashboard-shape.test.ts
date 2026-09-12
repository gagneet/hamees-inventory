/**
 * Role shaping for GET /api/dashboard/enhanced-stats — which sections each role receives and
 * that financial values never reach roles without financial visibility.
 */
import { describe, it, expect } from 'vitest'
import {
  dashboardSectionsFor,
  shapeGeneralStats,
  shapeOrderList,
  shapeSalesSection,
  shapeTopCustomers,
} from '@/app/api/dashboard/enhanced-stats/shape'

const order = {
  id: 'o1',
  orderNumber: 'ORD-1',
  status: 'READY',
  deliveryDate: '2026-09-12',
  totalAmount: 12000,
  balanceAmount: 4000,
  customer: { id: 'c1', name: 'Asha', phone: '98765', email: null },
  items: [{ id: 'i1', quantityOrdered: 2, garmentPattern: { name: 'Shirt' } }],
}

const customers = [
  { id: 'c1', name: 'Big spender', totalOrders: 1, totalItems: 1, totalSpent: 90000, valueScore: 91600 },
  { id: 'c2', name: 'Regular', totalOrders: 5, totalItems: 7, totalSpent: 10000, valueScore: 18200 },
]

const generalStats = {
  revenue: { thisMonth: 50000, lastMonth: 40000, growth: 25 },
  orders: { total: 10, pending: 4, delivered: 6, thisMonth: 3, lastMonth: 2, growth: 50 },
  inventory: {
    totalItems: 5,
    lowStock: 1,
    criticalStock: 0,
    totalValue: 250000,
    totalMeters: 400,
    accessories: { totalItems: 3, totalUnits: 100, totalReserved: 5, totalValue: 8000, lowStock: 0, criticalStock: 1 },
  },
}

describe('dashboardSectionsFor', () => {
  it('gives OWNER and ADMIN every business section including financials', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      const s = dashboardSectionsFor(role)
      expect(s.financial, role).toBe(true)
      expect(s.sales && s.inventory && s.production, role).toBe(true)
      expect(s.tailor, role).toBe(false)
    }
  })

  it('never gives financials to VIEWER, SALES_MANAGER, INVENTORY_MANAGER or production staff', () => {
    for (const role of ['VIEWER', 'SALES_MANAGER', 'INVENTORY_MANAGER', 'MASTER_TAILOR', 'TAILOR'] as const) {
      expect(dashboardSectionsFor(role).financial, role).toBe(false)
    }
  })

  it('gives TAILOR only the personal workbench', () => {
    expect(dashboardSectionsFor('TAILOR')).toMatchObject({
      tailor: true,
      production: false,
      sales: false,
      inventory: false,
      financial: false,
    })
  })

  it('gives MASTER_TAILOR the shop-wide production section', () => {
    expect(dashboardSectionsFor('MASTER_TAILOR')).toMatchObject({ tailor: true, production: true, sales: false, financial: false })
  })

  it('gives VIEWER amount-free sales and inventory counts', () => {
    expect(dashboardSectionsFor('VIEWER')).toMatchObject({ sales: true, inventory: true, financial: false, production: false })
  })
})

describe('shapeOrderList', () => {
  it('keeps amounts for OWNER', () => {
    expect(shapeOrderList([order], 'OWNER')[0].totalAmount).toBe(12000)
  })

  it('strips amounts (and nothing operational) for SALES_MANAGER, VIEWER and TAILOR', () => {
    for (const role of ['SALES_MANAGER', 'VIEWER', 'TAILOR'] as const) {
      const [shaped] = shapeOrderList([order], role)
      expect(shaped.totalAmount, role).toBeUndefined()
      expect(shaped.balanceAmount, role).toBeUndefined()
      expect(shaped.orderNumber).toBe('ORD-1')
      expect(shaped.customer).toEqual(order.customer)
      expect(shaped.items?.[0]).toEqual(order.items[0])
    }
  })
})

describe('shapeTopCustomers', () => {
  it('keeps spend for OWNER', () => {
    expect(shapeTopCustomers(customers, 'OWNER')[0]).toHaveProperty('totalSpent', 90000)
  })

  it('removes spend and the spend-based score, and ranks by activity for SALES_MANAGER', () => {
    const shaped = shapeTopCustomers(customers, 'SALES_MANAGER')
    expect(shaped.map((c) => c.id)).toEqual(['c2', 'c1'])
    for (const c of shaped) {
      expect(c).not.toHaveProperty('totalSpent')
      expect(c).not.toHaveProperty('valueScore')
    }
  })
})

describe('shapeGeneralStats', () => {
  it('keeps revenue and stock value for OWNER', () => {
    expect(shapeGeneralStats(generalStats, 'OWNER')).toEqual(generalStats)
  })

  it('keeps stock value but not revenue for INVENTORY_MANAGER', () => {
    const shaped = shapeGeneralStats(generalStats, 'INVENTORY_MANAGER')
    expect(shaped.revenue).toBeUndefined()
    expect(shaped.inventory?.totalValue).toBe(250000)
  })

  it('removes revenue and stock value for VIEWER but keeps counts', () => {
    const shaped = shapeGeneralStats(generalStats, 'VIEWER')
    expect(shaped.revenue).toBeUndefined()
    expect(shaped.inventory?.totalValue).toBeUndefined()
    expect(shaped.inventory?.accessories.totalValue).toBeUndefined()
    expect(shaped.inventory?.lowStock).toBe(1)
    expect(shaped.inventory?.accessories.criticalStock).toBe(1)
    expect(shaped.orders.pending).toBe(4)
  })

  it('gives production staff order counts only', () => {
    const shaped = shapeGeneralStats(generalStats, 'TAILOR')
    expect(shaped).toEqual({ orders: generalStats.orders })
  })
})

describe('shapeSalesSection', () => {
  const sales = {
    newOrdersToday: 1,
    newOrdersTodayList: [order],
    readyForPickup: 1,
    readyForPickupList: [order],
    pendingOrders: 1,
    pendingOrdersList: [order],
    thisMonthOrders: 1,
    thisMonthOrdersList: [order],
    orderPipeline: [{ status: 'READY', count: 1 }],
    topCustomers: customers,
    revenueForecast: { forecastedRevenue: 12000 },
  }

  it('drops the revenue forecast and all amounts for SALES_MANAGER', () => {
    const shaped = shapeSalesSection(sales, 'SALES_MANAGER')
    expect(shaped).not.toHaveProperty('revenueForecast')
    expect(JSON.stringify(shaped)).not.toMatch(/totalAmount|balanceAmount|totalSpent|valueScore/)
    expect(shaped.orderPipeline).toEqual(sales.orderPipeline)
  })

  it('keeps everything for ADMIN', () => {
    const shaped = shapeSalesSection(sales, 'ADMIN')
    expect(shaped.revenueForecast).toEqual({ forecastedRevenue: 12000 })
    expect(shaped.readyForPickupList[0].totalAmount).toBe(12000)
  })
})
