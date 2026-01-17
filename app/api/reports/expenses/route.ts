import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_expense_reports'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '6')

    // Expenses by month
    const expensesByMonth = []
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(subMonths(new Date(), i))

      const expenses = await prisma.expense.aggregate({
        where: {
          expenseDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { totalAmount: true },
        _count: true,
      })

      expensesByMonth.push({
        month: format(monthStart, 'MMM yyyy'),
        amount: expenses._sum.totalAmount || 0,
        count: expenses._count,
      })
    }

    // Expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        expenseDate: {
          gte: subMonths(new Date(), months),
        },
      },
      _sum: { totalAmount: true },
      _count: true,
    })

    const categoryData = expensesByCategory.map((item) => ({
      category: item.category,
      amount: item._sum.totalAmount || 0,
      count: item._count,
    }))

    // Total expenses
    const totalExpenses = categoryData.reduce((sum, cat) => sum + cat.amount, 0)

    // This month vs last month
    const thisMonthExpenses = await prisma.expense.aggregate({
      where: {
        expenseDate: {
          gte: startOfMonth(new Date()),
        },
      },
      _sum: { totalAmount: true },
    })

    const lastMonthExpenses = await prisma.expense.aggregate({
      where: {
        expenseDate: {
          gte: startOfMonth(subMonths(new Date(), 1)),
          lte: endOfMonth(subMonths(new Date(), 1)),
        },
      },
      _sum: { totalAmount: true },
    })

    const growth =
      (lastMonthExpenses._sum.totalAmount || 0) > 0
        ? (((thisMonthExpenses._sum.totalAmount || 0) -
            (lastMonthExpenses._sum.totalAmount || 0)) /
            (lastMonthExpenses._sum.totalAmount || 1)) *
          100
        : 0

    // Top expenses
    const topExpenses = await prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: subMonths(new Date(), months),
        },
      },
      orderBy: { totalAmount: 'desc' },
      take: 10,
      include: {
        paidByUser: {
          select: { name: true },
        },
      },
    })

    return NextResponse.json({
      summary: {
        totalExpenses,
        thisMonth: thisMonthExpenses._sum.totalAmount || 0,
        lastMonth: lastMonthExpenses._sum.totalAmount || 0,
        growth: growth.toFixed(1),
        transactionCount: expensesByMonth.reduce((sum, m) => sum + m.count, 0),
      },
      expensesByMonth,
      expensesByCategory: categoryData,
      topExpenses: topExpenses.map((expense) => ({
        id: expense.id,
        title: expense.description,
        category: expense.category,
        amount: expense.totalAmount,
        date: expense.expenseDate,
        user: expense.paidByUser,
      })),
    })
  } catch (error) {
    console.error('Error generating expense report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
