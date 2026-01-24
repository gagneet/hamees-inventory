import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_financial_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '12')

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

        const revenueAmount = revenue._sum.totalAmount || 0
        const expenseAmount = expenses._sum.totalAmount || 0
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

    // Parallelize independent database queries to avoid sequential waiting
    const [outstandingPayments, inventoryValueResult, paymentsReceived] = await Promise.all([
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

      // Cash flow (installments received this month)
      prisma.paymentInstallment.aggregate({
        where: {
          paidDate: {
            gte: startOfMonth(new Date()),
          },
          status: 'PAID',
        },
        _sum: { installmentAmount: true },
      }),
    ])

    const totalInventoryValue = Number(inventoryValueResult[0]?.totalValue || 0)

    return NextResponse.json({
      summary: {
        thisMonthRevenue: thisMonth?.revenue || 0,
        thisMonthExpenses: thisMonth?.expenses || 0,
        thisMonthProfit: thisMonth?.profit || 0,
        thisMonthMargin: thisMonth?.margin || 0,
        outstandingPayments: outstandingPayments._sum.balanceAmount || 0,
        outstandingCount: outstandingPayments._count,
        inventoryValue: totalInventoryValue,
        cashReceived: paymentsReceived._sum.installmentAmount || 0,
      },
      financialData,
      yearToDate: {
        revenue: financialData.reduce((sum, m) => sum + m.revenue, 0),
        expenses: financialData.reduce((sum, m) => sum + m.expenses, 0),
        profit: financialData.reduce((sum, m) => sum + m.profit, 0),
      },
    })
  } catch (error) {
    console.error('Error generating financial report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
