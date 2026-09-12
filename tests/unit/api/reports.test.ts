/**
 * Reports API Data-Shape Compatibility Tests
 *
 * Ensures API responses remain compatible with:
 * - app/(dashboard)/reports/financial/page.tsx
 * - app/(dashboard)/reports/customers/page.tsx
 * - app/(dashboard)/reports/expenses/page.tsx
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getFinancialReport } from '@/app/api/reports/financial/route'
import { GET as getCustomerReport } from '@/app/api/reports/customers/route'
import { GET as getExpenseReport } from '@/app/api/reports/expenses/route'
import { prisma } from '@/lib/db'
import * as apiPermissions from '@/lib/api-permissions'

type MockPrisma = {
  order: {
    aggregate: ReturnType<typeof vi.fn>
  }
  expense: {
    aggregate: ReturnType<typeof vi.fn>
    groupBy: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  paymentInstallment: {
    aggregate: ReturnType<typeof vi.fn>
  }
  customer: {
    findMany: ReturnType<typeof vi.fn>
  }
  $queryRaw: ReturnType<typeof vi.fn>
}

describe('reports API response shapes', () => {
  const mockPrisma = prisma as unknown as MockPrisma

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(apiPermissions, 'requireAnyPermission').mockResolvedValue({
      session: { user: { id: 'owner-1', role: 'OWNER' } },
      error: null,
    } as never)

    mockPrisma.order = {
      aggregate: vi.fn(),
    }
    mockPrisma.expense = {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    }
    mockPrisma.paymentInstallment = {
      aggregate: vi.fn(),
    }
    mockPrisma.customer = {
      findMany: vi.fn(),
    }
    mockPrisma.$queryRaw = vi.fn()
  })

  it('financial report returns shape consumed by Financial Report page', async () => {
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 120000 } }) // monthly revenue
      .mockResolvedValueOnce({ _sum: { balanceAmount: 45000 }, _count: 3 }) // outstanding
    mockPrisma.expense.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 30000 } })
    mockPrisma.paymentInstallment.aggregate.mockResolvedValueOnce({ _sum: { installmentAmount: 50000 } })
    mockPrisma.$queryRaw.mockResolvedValue([{ totalValue: 275000 }])

    const response = await getFinancialReport(new Request('http://localhost/api/reports/financial?months=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('financialData')
    expect(body).toHaveProperty('yearToDate')

    expect(body.summary).toEqual(
      expect.objectContaining({
        thisMonthRevenue: expect.any(Number),
        thisMonthExpenses: expect.any(Number),
        thisMonthProfit: expect.any(Number),
        thisMonthMargin: expect.any(Number),
        outstandingPayments: expect.any(Number),
        outstandingCount: expect.any(Number),
        inventoryValue: expect.any(Number),
        cashReceived: expect.any(Number),
      })
    )
    expect(Array.isArray(body.financialData)).toBe(true)
    expect(body.financialData[0]).toEqual(
      expect.objectContaining({
        month: expect.any(String),
        revenue: expect.any(Number),
        expenses: expect.any(Number),
        profit: expect.any(Number),
        margin: expect.any(Number),
      })
    )
    expect(body.yearToDate).toEqual(
      expect.objectContaining({
        revenue: expect.any(Number),
        expenses: expect.any(Number),
        profit: expect.any(Number),
      })
    )
  })

  it('financial revenue is net of discounts and excludes tax, and receipts are split by mode', async () => {
    // One delivered order: 100,000 gross − 10,000 discount = 90,000 taxable, 10,800 GST,
    // 100,800 invoiced. Revenue must be the 90,000 — tax belongs to the tax authority and a
    // discount is not income.
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({
        _sum: {
          subTotal: 10000000n,
          discount: 1000000n,
          taxableAmount: 9000000n,
          gstAmount: 1080000n,
          totalAmount: 10080000n,
        },
      })
      .mockResolvedValueOnce({ _sum: { balanceAmount: 0n }, _count: 0 }) // outstanding
      .mockResolvedValueOnce({ _sum: { advancePaid: 2500000n } }) // advances this month
    mockPrisma.expense.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 3000000n } })
    mockPrisma.paymentInstallment = {
      aggregate: vi.fn(),
      findMany: vi.fn().mockResolvedValue([
        { installmentNumber: 2, paidAmount: 12000, paymentMode: 'CASH', notes: null, order: { advancePaid: 25000 } },
        { installmentNumber: 3, paidAmount: 8000, paymentMode: 'UPI', notes: null, order: { advancePaid: 25000 } },
      ]),
    }
    mockPrisma.$queryRaw.mockResolvedValue([{ totalValue: 0 }])

    const response = await getFinancialReport(new Request('http://localhost/api/reports/financial?months=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.summary.thisMonthGrossValue).toBe(100000)
    expect(body.summary.thisMonthDiscounts).toBe(10000)
    expect(body.summary.thisMonthRevenue).toBe(90000) // NOT 100,800
    expect(body.summary.thisMonthTaxCollected).toBe(10800)
    expect(body.summary.thisMonthInvoicedTotal).toBe(100800)
    // Profit is measured against net sales, so it never contains a tax liability
    expect(body.summary.thisMonthProfit).toBe(60000)

    // Cash flow is a separate measure: 25,000 advance (no mode recorded) + 12,000 cash + 8,000 UPI
    expect(body.summary.receiptsTotal).toBe(45000)
    expect(body.summary.cashReceived).toBe(12000)
    expect(body.summary.receiptsByMode).toEqual({ UNRECORDED: 25000, CASH: 12000, UPI: 8000 })
  })

  it('financial revenue falls back to gross − discount for legacy rows with no taxable amount', async () => {
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({
        _sum: { subTotal: 10000000n, discount: 1000000n, taxableAmount: 0n, gstAmount: 0n, totalAmount: 9000000n },
      })
      .mockResolvedValueOnce({ _sum: { balanceAmount: 0n }, _count: 0 })
      .mockResolvedValueOnce({ _sum: { advancePaid: 0n } })
    mockPrisma.expense.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 0n } })
    mockPrisma.$queryRaw.mockResolvedValue([{ totalValue: 0 }])

    const body = await (
      await getFinancialReport(new Request('http://localhost/api/reports/financial?months=1'))
    ).json()
    expect(body.summary.thisMonthRevenue).toBe(90000)
  })

  it('customer report returns shape consumed by Customer Report page', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: 'cust-1',
        name: 'Rajinder Singh',
        phone: '9999999999',
        email: 'rajinder@example.com',
        city: 'Amritsar',
        orders: [
          { totalAmount: 60000, createdAt: new Date('2026-05-01') },
          { totalAmount: 25000, createdAt: new Date('2026-05-10') },
        ],
        measurements: [{ id: 'm-1' }],
      },
      {
        id: 'cust-2',
        name: 'Harpreet Singh',
        phone: '8888888888',
        email: null,
        city: 'Ludhiana',
        orders: [{ totalAmount: 15000, createdAt: new Date('2026-04-20') }],
        measurements: [],
      },
    ])

    const response = await getCustomerReport(new Request('http://localhost/api/reports/customers?months=12'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('topCustomers')
    expect(body).toHaveProperty('customerSegments')

    expect(body.summary).toEqual(
      expect.objectContaining({
        totalCustomers: expect.any(Number),
        activeCustomers: expect.any(Number),
        repeatCustomers: expect.any(Number),
        repeatRate: expect.any(String),
        avgLifetimeValue: expect.any(String),
        avgOrderValue: expect.any(String),
      })
    )
    expect(Array.isArray(body.topCustomers)).toBe(true)
    expect(body.topCustomers[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        orderCount: expect.any(Number),
        totalRevenue: expect.any(Number),
        avgOrderValue: expect.any(Number),
        hasMeasurements: expect.any(Boolean),
      })
    )
    expect(body.customerSegments).toEqual(
      expect.objectContaining({
        highValue: expect.any(Number),
        mediumValue: expect.any(Number),
        lowValue: expect.any(Number),
      })
    )
  })

  it('expenses report returns shape consumed by Expenses Report page', async () => {
    mockPrisma.expense.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 12500 }, _count: 4 }) // monthly series entry
      .mockResolvedValueOnce({ _sum: { totalAmount: 12500 } }) // this month
      .mockResolvedValueOnce({ _sum: { totalAmount: 10000 } }) // last month
    mockPrisma.expense.groupBy.mockResolvedValue([
      { category: 'RENT', _sum: { totalAmount: 8000 }, _count: 1 },
      { category: 'UTILITIES', _sum: { totalAmount: 4500 }, _count: 3 },
    ])
    mockPrisma.expense.findMany.mockResolvedValue([
      {
        id: 'exp-1',
        description: 'Showroom Rent',
        category: 'RENT',
        totalAmount: 8000,
        expenseDate: new Date('2026-05-05'),
        paidByUser: { name: 'Owner' },
      },
    ])

    const response = await getExpenseReport(new Request('http://localhost/api/reports/expenses?months=1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveProperty('summary')
    expect(body).toHaveProperty('expensesByMonth')
    expect(body).toHaveProperty('expensesByCategory')
    expect(body).toHaveProperty('topExpenses')

    expect(body.summary).toEqual(
      expect.objectContaining({
        totalExpenses: expect.any(Number),
        thisMonth: expect.any(Number),
        lastMonth: expect.any(Number),
        growth: expect.any(String),
        transactionCount: expect.any(Number),
      })
    )
    expect(Array.isArray(body.expensesByMonth)).toBe(true)
    expect(body.expensesByMonth[0]).toEqual(
      expect.objectContaining({
        month: expect.any(String),
        amount: expect.any(Number),
        count: expect.any(Number),
      })
    )
    expect(Array.isArray(body.expensesByCategory)).toBe(true)
    expect(body.expensesByCategory[0]).toEqual(
      expect.objectContaining({
        category: expect.any(String),
        amount: expect.any(Number),
        count: expect.any(Number),
      })
    )
    expect(Array.isArray(body.topExpenses)).toBe(true)
    expect(body.topExpenses[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        category: expect.any(String),
        amount: expect.any(Number),
      })
    )
  })
})
