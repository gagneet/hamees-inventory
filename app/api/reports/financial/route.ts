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

    // Revenue and expenses by month
    const financialData = []
    for (let i = months - 1; i >= 0; i--) {
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

      financialData.push({
        month: format(monthStart, 'MMM yyyy'),
        revenue: revenueAmount,
        expenses: expenseAmount,
        profit,
        margin: revenueAmount > 0 ? (profit / revenueAmount) * 100 : 0,
      })
    }

    // Current month P&L
    const thisMonth = financialData[financialData.length - 1]

    // Outstanding payments
    const outstandingPayments = await prisma.order.aggregate({
      where: {
        balanceAmount: { gt: 0 },
        status: { notIn: ['CANCELLED'] },
      },
      _sum: { balanceAmount: true },
      _count: true,
    })

    // Inventory value
    const inventoryValue = await prisma.clothInventory.findMany({
      select: {
        currentStock: true,
        pricePerMeter: true,
      },
    })

    const totalInventoryValue = inventoryValue.reduce(
      (sum, item) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    // Cash flow (installments received this month)
    const paymentsReceived = await prisma.paymentInstallment.aggregate({
      where: {
        paidDate: {
          gte: startOfMonth(new Date()),
        },
        status: 'PAID',
      },
      _sum: { amount: true },
    })

    return NextResponse.json({
      summary: {
        thisMonthRevenue: thisMonth?.revenue || 0,
        thisMonthExpenses: thisMonth?.expenses || 0,
        thisMonthProfit: thisMonth?.profit || 0,
        thisMonthMargin: thisMonth?.margin || 0,
        outstandingPayments: outstandingPayments._sum.balanceAmount || 0,
        outstandingCount: outstandingPayments._count,
        inventoryValue: totalInventoryValue,
        cashReceived: paymentsReceived._sum.amount || 0,
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
