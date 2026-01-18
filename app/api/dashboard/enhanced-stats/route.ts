import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays, addDays, startOfDay } from 'date-fns'
import { generateStockAlerts } from '@/lib/generate-alerts'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auto-generate stock alerts before fetching stats
    await generateStockAlerts()

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
    // TAILOR-SPECIFIC DATA (Parallelized)
    // ===================

    const [inProgressOrders, ordersToday, overdueOrders] = await Promise.all([
      // Orders in progress (stitching phase) - full details
      prisma.order.findMany({
        where: {
          status: {
            in: ['CUTTING', 'STITCHING', 'FINISHING'],
          },
        },
        select: {
          id: true,
          orderNumber: true,
          deliveryDate: true,
          status: true,
          totalAmount: true,
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
      }),

      // Orders due today
      prisma.order.findMany({
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
          totalAmount: true,
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
      }),

      // Overdue orders
      prisma.order.findMany({
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
          totalAmount: true,
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
      }),
    ])

    type OrderWithDetails = typeof ordersToday[number]

    const dueTodayFiltered = ordersToday.filter(
      (order: OrderWithDetails) => differenceInDays(order.deliveryDate, now) === 0
    )

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

    type WorkloadItem = typeof workloadByGarment[number]

    const workloadDetails = await Promise.all(
      workloadByGarment.map(async (item: WorkloadItem) => {
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
    // INVENTORY MANAGER DATA (Parallelized)
    // ===================

    const [pendingPOs, fabricUsage] = await Promise.all([
      // Pending purchase orders
      prisma.purchaseOrder.count({
        where: {
          status: {
            in: ['PENDING', 'PARTIAL'],
          },
        },
      }),

      // Fast-moving fabrics (high usage rate with low stock)
      prisma.orderItem.groupBy({
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
      }),
    ])

    type FabricUsageItem = typeof fabricUsage[number]

    const fastMovingFabrics = await Promise.all(
      fabricUsage.map(async (item: FabricUsageItem) => {
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

    type FabricDetail = typeof fastMovingFabrics[number]

    const fastMovingFiltered = fastMovingFabrics
      .filter((f: FabricDetail) => f !== null)
      .sort((a: FabricDetail, b: FabricDetail) => (a!.daysRemaining - b!.daysRemaining))

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

    type StockComparisonItem = typeof stockComparison[number]

    const stockComparisonData = stockComparison.map((cloth: StockComparisonItem) => ({
      name: cloth.name,
      type: cloth.type,
      available: cloth.currentStock - cloth.reserved,
      committed: cloth.reserved,
      total: cloth.currentStock,
    }))

    // ===================
    // SALES MANAGER DATA (Parallelized)
    // ===================

    const [newOrdersToday, readyForPickup, orderPipeline, topCustomers] = await Promise.all([
      // New orders today
      prisma.order.count({
        where: {
          createdAt: {
            gte: startOfDay(now),
          },
        },
      }),

      // Ready for pickup
      prisma.order.count({
        where: {
          status: 'READY',
        },
      }),

      // Order status funnel (pipeline)
      prisma.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),

      // Top customers (by order count and value)
      prisma.customer.findMany({
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
      }),
    ])

    const pipelineOrder = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY']
    type PipelineItem = typeof orderPipeline[number]

    const pipelineData = pipelineOrder.map((status) => {
      const data = orderPipeline.find((p: PipelineItem) => p.status === status)
      return {
        status,
        count: data?._count.status || 0,
      }
    })

    type TopCustomer = typeof topCustomers[number]
    type CustomerOrder = TopCustomer['orders'][number]

    const customerStats = topCustomers
      .map((customer: TopCustomer) => {
        const totalOrders = customer.orders.length
        const totalSpent = customer.orders
          .filter((o: CustomerOrder) => o.status === 'DELIVERED')
          .reduce((sum: number, o: CustomerOrder) => sum + o.totalAmount, 0)
        const pendingOrders = customer.orders.filter(
          (o: CustomerOrder) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
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
      .sort((a: { totalSpent: number }, b: { totalSpent: number }) => b.totalSpent - a.totalSpent)
      .slice(0, 10)

    // ===================
    // OWNER/ADMIN DATA (Parallelized)
    // ===================

    const [expensesThisMonth, expensesLastMonth, poPaymentsThisMonth, poPaymentsLastMonth] = await Promise.all([
      // Expenses for this month
      prisma.expense.aggregate({
        where: {
          expenseDate: {
            gte: startOfMonth(now),
            lte: endOfMonth(now),
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Expenses for last month
      prisma.expense.aggregate({
        where: {
          expenseDate: {
            gte: startOfMonth(subMonths(now, 1)),
            lte: endOfMonth(subMonths(now, 1)),
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Purchase Order payments for this month
      prisma.purchaseOrder.aggregate({
        where: {
          createdAt: {
            gte: startOfMonth(now),
            lte: endOfMonth(now),
          },
          paidAmount: {
            gt: 0,
          },
        },
        _sum: {
          paidAmount: true,
        },
      }),

      // Purchase Order payments for last month
      prisma.purchaseOrder.aggregate({
        where: {
          createdAt: {
            gte: startOfMonth(subMonths(now, 1)),
            lte: endOfMonth(subMonths(now, 1)),
          },
          paidAmount: {
            gt: 0,
          },
        },
        _sum: {
          paidAmount: true,
        },
      }),
    ])

    const totalExpensesThisMonth = (expensesThisMonth._sum.totalAmount || 0) + (poPaymentsThisMonth._sum.paidAmount || 0)
    const totalExpensesLastMonth = (expensesLastMonth._sum.totalAmount || 0) + (poPaymentsLastMonth._sum.paidAmount || 0)

    // Revenue vs Expenses for last 6 months (Parallelized)
    const financialTrend = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const i = 5 - index // Reverse order: 5, 4, 3, 2, 1, 0
        const monthStart = startOfMonth(subMonths(now, i))
        const monthEnd = endOfMonth(subMonths(now, i))

        const [revenue, expenses, poPayments] = await Promise.all([
          prisma.order.aggregate({
            where: {
              completedDate: {
                gte: monthStart,
                lte: monthEnd,
              },
              status: 'DELIVERED',
            },
            _sum: {
              totalAmount: true,
            },
          }),

          prisma.expense.aggregate({
            where: {
              expenseDate: {
                gte: monthStart,
                lte: monthEnd,
              },
            },
            _sum: {
              totalAmount: true,
            },
          }),

          prisma.purchaseOrder.aggregate({
            where: {
              createdAt: {
                gte: monthStart,
                lte: monthEnd,
              },
              paidAmount: {
                gt: 0,
              },
            },
            _sum: {
              paidAmount: true,
            },
          }),
        ])

        const totalExpenses = (expenses._sum.totalAmount || 0) + (poPayments._sum.paidAmount || 0)

        return {
          month: format(monthStart, 'MMM yyyy'),
          revenue: revenue._sum.totalAmount || 0,
          expenses: totalExpenses,
          profit: (revenue._sum.totalAmount || 0) - totalExpenses,
        }
      })
    )

    // Parallel fetch for remaining owner metrics
    const [outstandingPayments, revenueByFabric, deliveredOrders, allCustomers, stockMovements] = await Promise.all([
      // Outstanding payments (balanceAmount on active orders)
      prisma.order.aggregate({
        where: {
          status: {
            not: 'CANCELLED',
          },
        },
        _sum: {
          balanceAmount: true,
        },
      }),

      // Revenue by fabric category
      prisma.orderItem.groupBy({
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
      }),

      // Average fulfillment time - delivered orders
      prisma.order.findMany({
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
      }),

      // Customer retention (new vs returning) - need full order data
      prisma.customer.findMany({
        select: {
          id: true,
          orders: {
            where: {
              status: 'DELIVERED', // Only count delivered orders
            },
            select: {
              id: true,
              orderDate: true,
              status: true,
            },
            orderBy: {
              orderDate: 'asc',
            },
          },
        },
      }),

      // Stock turnover - movements
      prisma.stockMovement.findMany({
        where: {
          createdAt: {
            gte: subMonths(now, 1),
          },
          type: 'ORDER_USED',
        },
        select: {
          quantity: true,
        },
      }),
    ])

    type RevenueByFabricItem = typeof revenueByFabric[number]

    const fabricRevenueDetails = await Promise.all(
      revenueByFabric.map(async (item: RevenueByFabricItem) => {
        const cloth = await prisma.clothInventory.findUnique({
          where: { id: item.clothInventoryId },
          select: { id: true, name: true, type: true },
        })
        return {
          id: cloth?.id || item.clothInventoryId,
          name: cloth?.name || 'Unknown',
          type: cloth?.type || 'Unknown',
          revenue: item._sum.totalPrice || 0,
        }
      })
    )

    type DeliveredOrder = typeof deliveredOrders[number]

    const fulfillmentTimes = deliveredOrders.map((order: DeliveredOrder) =>
      differenceInDays(order.completedDate!, order.orderDate)
    )

    const avgFulfillmentTime =
      fulfillmentTimes.length > 0
        ? fulfillmentTimes.reduce((sum: number, time: number) => sum + time, 0) / fulfillmentTimes.length
        : 0

    type AllCustomer = typeof allCustomers[number]
    type StockMovement = typeof stockMovements[number]

    // Returning customers: 3+ DELIVERED orders, 2+ months, 2+ orders at least 2 weeks apart
    const returningCustomers = allCustomers.filter((c: AllCustomer) => {
      // Must have at least 3 delivered orders
      if (c.orders.length < 3) return false

      // Get unique months from orders
      const uniqueMonths = new Set(
        c.orders.map(order => format(new Date(order.orderDate), 'MMM yyyy'))
      )

      // Must have orders in at least 2 different months
      if (uniqueMonths.size < 2) return false

      // Check if at least 2 orders are at least 2 weeks (14 days) apart
      const orderDates = c.orders.map(o => new Date(o.orderDate).getTime())
      let hasTwoWeeksApart = false

      for (let i = 0; i < orderDates.length - 1; i++) {
        for (let j = i + 1; j < orderDates.length; j++) {
          const daysDiff = Math.abs(orderDates[j] - orderDates[i]) / (1000 * 60 * 60 * 24)
          if (daysDiff >= 14) {
            hasTwoWeeksApart = true
            break
          }
        }
        if (hasTwoWeeksApart) break
      }

      return hasTwoWeeksApart
    }).length

    // New/Existing customers: All others (< 3 delivered orders OR don't meet returning criteria)
    const newCustomers = allCustomers.length - returningCustomers

    // Stock turnover ratio calculation (stockMovements already fetched above)
    const fabricUsed = stockMovements.reduce((sum: number, m: StockMovement) => sum + Math.abs(m.quantity), 0)
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
    // SHARED DATA (Alerts, Order Status)
    // ===================

    const [recentAlerts, ordersByStatus] = await Promise.all([
      // Recent unread alerts
      prisma.alert.findMany({
        where: {
          isRead: false,
          isDismissed: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      }),

      // Orders by status for pie chart
      prisma.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),
    ])

    type OrderStatusItem = typeof ordersByStatus[number]

    const orderStatusData = ordersByStatus.map((item: OrderStatusItem) => ({
      status: item.status,
      count: item._count.status,
    }))

    // ===================
    // RETURN RESPONSE
    // ===================

    return NextResponse.json({
      userRole,
      dateRange,

      // Tailor metrics
      tailor: {
        inProgress: inProgressOrders.length,
        inProgressList: inProgressOrders,
        dueToday: dueTodayFiltered.length,
        dueTodayList: dueTodayFiltered,
        overdue: overdueOrders.length,
        overdueList: overdueOrders,
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
        expensesThisMonth: totalExpensesThisMonth,
        expensesLastMonth: totalExpensesLastMonth,
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

      // Shared data for all roles
      alerts: {
        unread: recentAlerts.length,
        recent: recentAlerts,
      },

      orderStatus: orderStatusData,
    })
  } catch (error) {
    console.error('Error fetching enhanced dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
