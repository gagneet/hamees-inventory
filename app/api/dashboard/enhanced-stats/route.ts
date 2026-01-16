import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, addDays, startOfDay } from 'date-fns'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('range') || 'month' // day, week, month

    const now = new Date()
    const userRole = session.user.role

    // Date filtering based on range
    let startDate: Date
    let endDate = endOfMonth(now)

    switch (dateRange) {
      case 'day':
        startDate = startOfDay(now)
        endDate = now
        break
      case 'week':
        startDate = addDays(now, -7)
        break
      default:
        startDate = startOfMonth(now)
    }

    // ===================
    // TAILOR-SPECIFIC DATA
    // ===================

    // Orders in progress (stitching phase)
    const inProgressOrders = await prisma.order.count({
      where: {
        status: {
          in: ['CUTTING', 'STITCHING', 'FINISHING'],
        },
      },
    })

    // Orders due today
    const ordersToday = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: startOfDay(now),
          lte: endDate,
        },
        status: {
          not: 'DELIVERED',
        },
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryDate: true,
        status: true,
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            garmentPattern: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    const dueToday = ordersToday.filter(
      (order) => differenceInDays(order.deliveryDate, now) === 0
    ).length

    // Overdue orders
    const overdueOrders = await prisma.order.findMany({
      where: {
        deliveryDate: {
          lt: startOfDay(now),
        },
        status: {
          not: 'DELIVERED',
        },
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryDate: true,
        status: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    })

    // Workload by garment type (for stitching phase)
    const workloadByGarment = await prisma.orderItem.groupBy({
      by: ['garmentPatternId'],
      where: {
        order: {
          status: {
            in: ['CUTTING', 'STITCHING', 'FINISHING'],
          },
        },
      },
      _count: {
        id: true,
      },
    })

    const workloadDetails = await Promise.all(
      workloadByGarment.map(async (item) => {
        const pattern = await prisma.garmentPattern.findUnique({
          where: { id: item.garmentPatternId },
          select: { name: true },
        })
        return {
          name: pattern?.name || 'Unknown',
          count: item._count.id,
        }
      })
    )

    // Upcoming deadlines (next 7 days)
    const upcomingDeadlines = await prisma.order.findMany({
      where: {
        deliveryDate: {
          gte: now,
          lte: addDays(now, 7),
        },
        status: {
          not: 'DELIVERED',
        },
      },
      select: {
        id: true,
        orderNumber: true,
        deliveryDate: true,
        status: true,
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            garmentPattern: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        deliveryDate: 'asc',
      },
    })

    // ===================
    // INVENTORY MANAGER DATA
    // ===================

    // Pending purchase orders
    const pendingPOs = await prisma.purchaseOrder.count({
      where: {
        status: {
          in: ['PENDING', 'PARTIAL'],
        },
      },
    })

    // Fast-moving fabrics (high usage rate with low stock)
    const fabricUsage = await prisma.orderItem.groupBy({
      by: ['clothInventoryId'],
      where: {
        createdAt: {
          gte: subMonths(now, 1),
        },
      },
      _sum: {
        estimatedMeters: true,
      },
      orderBy: {
        _sum: {
          estimatedMeters: 'desc',
        },
      },
      take: 20,
    })

    const fastMovingFabrics = await Promise.all(
      fabricUsage.map(async (item) => {
        const cloth = await prisma.clothInventory.findUnique({
          where: { id: item.clothInventoryId },
          select: {
            id: true,
            name: true,
            currentStock: true,
            reserved: true,
            minimum: true,
            pricePerMeter: true,
          },
        })

        if (!cloth) return null

        const availableStock = cloth.currentStock - cloth.reserved
        const usageRate = item._sum.estimatedMeters || 0
        const daysOfStockRemaining = usageRate > 0 ? (availableStock / usageRate) * 30 : 999

        return {
          id: cloth.id,
          name: cloth.name,
          currentStock: cloth.currentStock,
          availableStock,
          usageRate,
          daysRemaining: Math.round(daysOfStockRemaining),
          isLowStock: availableStock < cloth.minimum,
          needsReorder: daysOfStockRemaining < 30,
        }
      })
    )

    const fastMovingFiltered = fastMovingFabrics
      .filter((f) => f !== null)
      .sort((a, b) => (a!.daysRemaining - b!.daysRemaining))

    // Committed vs Available stock
    const stockComparison = await prisma.clothInventory.findMany({
      select: {
        name: true,
        currentStock: true,
        reserved: true,
        type: true,
      },
      take: 10,
      orderBy: {
        reserved: 'desc',
      },
    })

    const stockComparisonData = stockComparison.map((cloth) => ({
      name: cloth.name,
      type: cloth.type,
      available: cloth.currentStock - cloth.reserved,
      committed: cloth.reserved,
      total: cloth.currentStock,
    }))

    // ===================
    // SALES MANAGER DATA
    // ===================

    // New orders today
    const newOrdersToday = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay(now),
        },
      },
    })

    // Ready for pickup
    const readyForPickup = await prisma.order.count({
      where: {
        status: 'READY',
      },
    })

    // Order status funnel (pipeline)
    const orderPipeline = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    const pipelineOrder = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY']
    const pipelineData = pipelineOrder.map((status) => {
      const data = orderPipeline.find((p) => p.status === status)
      return {
        status,
        count: data?._count.status || 0,
      }
    })

    // Top customers (by order count and value)
    const topCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        orders: {
          select: {
            totalAmount: true,
            status: true,
          },
        },
      },
      take: 50,
    })

    const customerStats = topCustomers
      .map((customer) => {
        const totalOrders = customer.orders.length
        const totalSpent = customer.orders
          .filter((o) => o.status === 'DELIVERED')
          .reduce((sum, o) => sum + o.totalAmount, 0)
        const pendingOrders = customer.orders.filter(
          (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        ).length

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalOrders,
          totalSpent,
          pendingOrders,
          isReturning: totalOrders > 1,
        }
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)

    // ===================
    // OWNER/ADMIN DATA
    // ===================

    // Expenses for the month
    const expensesThisMonth = await prisma.expense.aggregate({
      where: {
        expenseDate: {
          gte: startOfMonth(now),
          lte: endOfMonth(now),
        },
      },
      _sum: {
        totalAmount: true,
      },
    })

    const expensesLastMonth = await prisma.expense.aggregate({
      where: {
        expenseDate: {
          gte: startOfMonth(subMonths(now, 1)),
          lte: endOfMonth(subMonths(now, 1)),
        },
      },
      _sum: {
        totalAmount: true,
      },
    })

    // Revenue vs Expenses for last 6 months
    const financialTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))

      const revenue = await prisma.order.aggregate({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
          status: 'DELIVERED',
        },
        _sum: {
          totalAmount: true,
        },
      })

      const expenses = await prisma.expense.aggregate({
        where: {
          expenseDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          totalAmount: true,
        },
      })

      financialTrend.push({
        month: format(monthStart, 'MMM yyyy'),
        revenue: revenue._sum.totalAmount || 0,
        expenses: expenses._sum.totalAmount || 0,
        profit: (revenue._sum.totalAmount || 0) - (expenses._sum.totalAmount || 0),
      })
    }

    // Outstanding payments (balanceAmount on active orders)
    const outstandingPayments = await prisma.order.aggregate({
      where: {
        status: {
          not: 'CANCELLED',
        },
      },
      _sum: {
        balanceAmount: true,
      },
    })

    // Revenue by fabric category
    const revenueByFabric = await prisma.orderItem.groupBy({
      by: ['clothInventoryId'],
      where: {
        order: {
          status: 'DELIVERED',
        },
      },
      _sum: {
        totalPrice: true,
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc',
        },
      },
      take: 10,
    })

    const fabricRevenueDetails = await Promise.all(
      revenueByFabric.map(async (item) => {
        const cloth = await prisma.clothInventory.findUnique({
          where: { id: item.clothInventoryId },
          select: { name: true, type: true },
        })
        return {
          name: cloth?.name || 'Unknown',
          type: cloth?.type || 'Unknown',
          revenue: item._sum.totalPrice || 0,
        }
      })
    )

    // Average fulfillment time
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        completedDate: {
          not: null,
        },
      },
      select: {
        orderDate: true,
        completedDate: true,
      },
      take: 100,
    })

    const fulfillmentTimes = deliveredOrders.map((order) =>
      differenceInDays(order.completedDate!, order.orderDate)
    )

    const avgFulfillmentTime =
      fulfillmentTimes.length > 0
        ? fulfillmentTimes.reduce((sum, time) => sum + time, 0) / fulfillmentTimes.length
        : 0

    // Customer retention (new vs returning)
    const allCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        orders: {
          select: {
            id: true,
          },
        },
      },
    })

    const returningCustomers = allCustomers.filter((c) => c.orders.length > 1).length
    const newCustomers = allCustomers.filter((c) => c.orders.length === 1).length

    // Stock turnover ratio (last 30 days)
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: subMonths(now, 1),
        },
        type: 'ORDER_USED',
      },
      select: {
        quantity: true,
      },
    })

    const fabricUsed = stockMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0)
    const totalFabricValue = await prisma.clothInventory.aggregate({
      _sum: {
        currentStock: true,
      },
    })

    const stockTurnoverRatio =
      (totalFabricValue._sum.currentStock || 0) > 0
        ? (fabricUsed / (totalFabricValue._sum.currentStock || 1)) * 100
        : 0

    // ===================
    // RETURN RESPONSE
    // ===================

    return NextResponse.json({
      userRole,
      dateRange,

      // Tailor metrics
      tailor: {
        inProgress: inProgressOrders,
        dueToday,
        overdue: overdueOrders.length,
        overdueList: overdueOrders.slice(0, 10),
        workloadByGarment: workloadDetails,
        upcomingDeadlines: upcomingDeadlines.slice(0, 10),
        dailyTarget: 5, // This could be configurable
      },

      // Inventory Manager metrics
      inventory: {
        pendingPOs,
        fastMovingFabrics: fastMovingFiltered.slice(0, 10),
        stockComparison: stockComparisonData,
      },

      // Sales Manager metrics
      sales: {
        newOrdersToday,
        readyForPickup,
        orderPipeline: pipelineData,
        topCustomers: customerStats,
      },

      // Owner/Admin metrics
      financial: {
        expensesThisMonth: expensesThisMonth._sum.totalAmount || 0,
        expensesLastMonth: expensesLastMonth._sum.totalAmount || 0,
        financialTrend,
        outstandingPayments: outstandingPayments._sum.balanceAmount || 0,
        revenueByFabric: fabricRevenueDetails,
        avgFulfillmentTime: Math.round(avgFulfillmentTime),
        customerRetention: {
          new: newCustomers,
          returning: returningCustomers,
          retentionRate:
            allCustomers.length > 0
              ? Math.round((returningCustomers / allCustomers.length) * 100)
              : 0,
        },
        stockTurnoverRatio: Math.round(stockTurnoverRatio * 10) / 10,
      },
    })
  } catch (error) {
    console.error('Error fetching enhanced dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
