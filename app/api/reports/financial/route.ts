import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { isLegacyAdvanceInstallment, roundMoney } from '@/lib/order-finance'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { sumFromMinor } from '@/lib/money'

const MAX_MONTHS = 36

export async function GET(request: Request) {
  const { session, error } = await requireAnyPermission(['view_financial_reports'])
  if (error) return error

  const userRole = session.user.role

  try {
    const { searchParams } = new URL(request.url)
    const requested = parseInt(searchParams.get('months') || '12', 10)
    const months = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_MONTHS) : 12

    // Revenue and expenses by month (parallelized to avoid async waterfall)
    const financialData = await Promise.all(
      Array.from({ length: months }, async (_, index) => {
        const i = months - 1 - index
        const monthStart = startOfMonth(subMonths(new Date(), i))
        const monthEnd = endOfMonth(subMonths(new Date(), i))

        const [revenue, expenses] = await Promise.all([
          prisma.order.aggregate({
            where: {
              createdAt: { gte: monthStart, lte: monthEnd },
              status: 'DELIVERED',
            },
            _sum: { totalAmount: true },
          }),
          prisma.expense.aggregate({
            where: {
              expenseDate: { gte: monthStart, lte: monthEnd },
            },
            _sum: { totalAmount: true },
          }),
        ])

        const revenueAmount = sumFromMinor(revenue._sum.totalAmount)
        const expenseAmount = sumFromMinor(expenses._sum.totalAmount)
        const profit = revenueAmount - expenseAmount

        return {
          month: format(monthStart, 'MMM yyyy'),
          revenue: revenueAmount,
          expenses: expenseAmount,
          profit,
          margin: revenueAmount > 0 ? (profit / revenueAmount) * 100 : 0,
        }
      })
    )

    // Current month P&L
    const thisMonth = financialData[financialData.length - 1]
    const monthStart = startOfMonth(new Date())

    // Parallelize independent database queries to avoid sequential waiting
    const [outstandingPayments, inventoryValueResult, installmentsThisMonth, advancesThisMonth] = await Promise.all([
      // Outstanding payments
      prisma.order.aggregate({
        where: {
          balanceAmount: { gt: 0 },
          status: { notIn: ['CANCELLED'] },
        },
        _sum: { balanceAmount: true },
        _count: true,
      }),

      // Inventory value - compute at database level for better performance
      prisma.$queryRaw<{ totalValue: number }[]>`
        SELECT COALESCE(SUM("currentStock" * "pricePerMeter"), 0) as "totalValue"
        FROM "ClothInventory"
      `,

      // Cash received this month: every installment with money on it (PAID and PARTIAL) …
      prisma.paymentInstallment.findMany({
        where: { paidDate: { gte: monthStart }, paidAmount: { gt: 0 } },
        select: { installmentNumber: true, paidAmount: true, notes: true, order: { select: { advancePaid: true } } },
      }),

      // … plus advances taken on orders created this month (advances are never installments)
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, advancePaid: { gt: 0 } },
        _sum: { advancePaid: true },
      }),
    ])

    // currentStock (meters) × pricePerMeter (minor units) → minor units
    const totalInventoryValue = roundMoney(sumFromMinor(Number(inventoryValueResult[0]?.totalValue || 0)))
    // Legacy rows duplicating an advance are excluded; that advance is counted via Order.advancePaid
    const installmentCash = (installmentsThisMonth ?? []).reduce(
      (sum, installment) =>
        isLegacyAdvanceInstallment(installment, installment.order?.advancePaid ?? 0) ? sum : sum + (installment.paidAmount || 0),
      0
    )
    const cashReceived = roundMoney(installmentCash + (sumFromMinor(advancesThisMonth?._sum.advancePaid)))

    const response = {
      summary: {
        thisMonthRevenue: thisMonth?.revenue || 0,
        thisMonthExpenses: thisMonth?.expenses || 0,
        thisMonthProfit: thisMonth?.profit || 0,
        thisMonthMargin: thisMonth?.margin || 0,
        outstandingPayments: sumFromMinor(outstandingPayments._sum.balanceAmount),
        outstandingCount: outstandingPayments._count,
        inventoryValue: totalInventoryValue,
        cashReceived,
      },
      financialData,
      yearToDate: {
        revenue: financialData.reduce((sum, m) => sum + m.revenue, 0),
        expenses: financialData.reduce((sum, m) => sum + m.expenses, 0),
        profit: financialData.reduce((sum, m) => sum + m.profit, 0),
      },
    }

    const filtered = filterApiResponse(response, userRole, 'report_financial')
    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Error generating financial report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
