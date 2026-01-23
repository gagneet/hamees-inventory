import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, subDays, format, startOfDay, endOfDay, addDays, differenceInDays } from 'date-fns'
import { generateStockAlerts } from '@/lib/generate-alerts'

/**
 * Date range presets for dashboard filtering
 */
export type DateRangePreset = 'today' | 'week' | 'month' | '3months' | '6months' | 'year'

/**
 * Custom date range with start and end dates
 */
export interface CustomDateRange {
  start: Date
  end: Date
}

/**
 * Get dashboard data with optional date range filtering
 * 
 * @param dateRange - Date range preset (defaults to 'month')
 * @param customRange - Optional custom date range (overrides preset)
 * @returns Complete dashboard statistics for all role types
 */
export async function getDashboardData(
  dateRange: DateRangePreset = 'month',
  customRange?: CustomDateRange
) {
  // Auto-generate stock alerts in background (non-blocking)
  generateStockAlerts().catch(error => {
    console.error('Background alert generation failed:', error)
  })

  const now = new Date()
  
  // Determine date range based on preset or custom range
  let currentPeriodStart: Date
  let currentPeriodEnd: Date
  let previousPeriodStart: Date
  let previousPeriodEnd: Date

  if (customRange) {
    // Use custom date range
    currentPeriodStart = startOfDay(customRange.start)
    currentPeriodEnd = endOfDay(customRange.end)
    
    // Calculate previous period with same duration
    const durationMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime()
    previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1)
    previousPeriodStart = new Date(previousPeriodEnd.getTime() - durationMs)
  } else {
    // Use preset date range
    switch (dateRange) {
      case 'today':
        currentPeriodStart = startOfDay(now)
        currentPeriodEnd = endOfDay(now)
        previousPeriodStart = startOfDay(subDays(now, 1))
        previousPeriodEnd = endOfDay(subDays(now, 1))
        break
      
      case 'week':
        currentPeriodStart = startOfDay(subDays(now, 7))
        currentPeriodEnd = endOfDay(now)
        previousPeriodStart = startOfDay(subDays(now, 14))
        previousPeriodEnd = endOfDay(subDays(now, 8))
        break
      
      case '3months':
        currentPeriodStart = startOfMonth(subMonths(now, 2))
        currentPeriodEnd = endOfMonth(now)
        previousPeriodStart = startOfMonth(subMonths(now, 5))
        previousPeriodEnd = endOfMonth(subMonths(now, 3))
        break
      
      case '6months':
        currentPeriodStart = startOfMonth(subMonths(now, 5))
        currentPeriodEnd = endOfMonth(now)
        previousPeriodStart = startOfMonth(subMonths(now, 11))
        previousPeriodEnd = endOfMonth(subMonths(now, 6))
        break
      
      case 'year':
        currentPeriodStart = startOfMonth(subMonths(now, 11))
        currentPeriodEnd = endOfMonth(now)
        previousPeriodStart = startOfMonth(subMonths(now, 23))
        previousPeriodEnd = endOfMonth(subMonths(now, 12))
        break
      
      case 'month':
      default:
        currentPeriodStart = startOfMonth(now)
        currentPeriodEnd = endOfMonth(now)
        previousPeriodStart = startOfMonth(subMonths(now, 1))
        previousPeriodEnd = endOfMonth(subMonths(now, 1))
        break
    }
  }

  // ===== Inventory Stats =====
  const clothInventory = await prisma.clothInventory.findMany({
    select: {
      currentStock: true,
      reserved: true,
      minimum: true,
      pricePerMeter: true,
    },
  })

  const clothLowStock = clothInventory.filter((item: any) => {
    const available = item.currentStock - item.reserved
    const threshold = item.minimum * 1.1
    return available < threshold && available > item.minimum
  }).length

  const clothCriticalStock = clothInventory.filter((item: any) => {
    const available = item.currentStock - item.reserved
    return available <= item.minimum
  }).length

  const totalClothWorth = clothInventory.reduce(
    (sum: number, item: any) => sum + item.currentStock * item.pricePerMeter,
    0
  )

  const accessoryInventory = await prisma.accessoryInventory.findMany({
    select: {
      currentStock: true,
      minimum: true,
      pricePerUnit: true,
    },
  })

  const accessoryLowStock = accessoryInventory.filter((item: any) => {
    const threshold = item.minimum * 1.1
    return item.currentStock < threshold && item.currentStock > item.minimum
  }).length

  const accessoryCriticalStock = accessoryInventory.filter(
    (item: any) => item.currentStock <= item.minimum
  ).length

  const totalAccessoryWorth = accessoryInventory.reduce(
    (sum: number, item: any) => sum + item.currentStock * item.pricePerUnit,
    0
  )

  // ===== Order Stats =====
  const totalOrders = await prisma.order.count()

  const pendingOrders = await prisma.order.count({
    where: {
      status: {
        in: ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING'],
      },
    },
  })

  const ordersCurrentPeriod = await prisma.order.count({
    where: {
      createdAt: {
        gte: currentPeriodStart,
        lte: currentPeriodEnd,
      },
    },
  })

  const ordersPreviousPeriod = await prisma.order.count({
    where: {
      createdAt: {
        gte: previousPeriodStart,
        lte: previousPeriodEnd,
      },
    },
  })

  const readyOrders = await prisma.order.count({
    where: { status: 'READY' },
  })

  const deliveredOrders = await prisma.order.count({
    where: { status: 'DELIVERED' },
  })

  // ===== Revenue Stats =====
  const revenueCurrentPeriod = await prisma.order.aggregate({
    where: {
      completedDate: {
        gte: currentPeriodStart,
        lte: currentPeriodEnd,
      },
      status: 'DELIVERED',
    },
    _sum: {
      totalAmount: true,
    },
  })

  const revenuePreviousPeriod = await prisma.order.aggregate({
    where: {
      completedDate: {
        gte: previousPeriodStart,
        lte: previousPeriodEnd,
      },
      status: 'DELIVERED',
    },
    _sum: {
      totalAmount: true,
    },
  })

  // Revenue trend based on date range - determine months to show in chart
  const trendMonthsMap: Record<DateRangePreset, number> = {
    'today': 1,
    'week': 1,
    'month': 6,
    '3months': 3,
    '6months': 6,
    'year': 12,
  }
  const trendMonths = trendMonthsMap[dateRange]
  const revenueByMonth = []
  for (let i = trendMonths - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))

    const revenue = await prisma.order.aggregate({
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
    })

    revenueByMonth.push({
      month: format(monthStart, 'MMM yyyy'),
      revenue: revenue._sum.totalAmount || 0,
    })
  }

  // ===== Orders by Status =====
  const ordersByStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: {
      status: true,
    },
  })

  const statusData = ordersByStatus.map((item: any) => ({
    status: item.status,
    count: item._count.status,
  }))

  // ===== Top Fabrics =====
  const topFabrics = await prisma.orderItem.groupBy({
    by: ['clothInventoryId'],
    where: {
      order: {
        completedDate: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
    },
    _sum: {
      actualMetersUsed: true,
    },
    orderBy: {
      _sum: {
        actualMetersUsed: 'desc',
      },
    },
    take: 10,
  })

  const topFabricsWithDetails = await Promise.all(
    topFabrics
      .filter((item: any) => item.clothInventoryId)
      .map(async (item: any) => {
        const cloth = await prisma.clothInventory.findUnique({
          where: { id: item.clothInventoryId! },
          select: { id: true, name: true, type: true, color: true, colorHex: true },
        })
        return {
          id: cloth?.id || '',
          name: cloth?.name || 'Unknown',
          type: cloth?.type || 'Unknown',
          color: cloth?.colorHex || '#1E3A8A',
          metersUsed: item._sum.actualMetersUsed || 0,
        }
      })
  )

  // ===== Alerts =====
  await prisma.alert.updateMany({
    where: {
      isDismissed: true,
      dismissedUntil: {
        lte: now,
      },
    },
    data: {
      isDismissed: false,
      dismissedUntil: null,
    },
  })

  const recentAlerts = await prisma.alert.findMany({
    where: {
      isRead: false,
      isDismissed: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  })

  // ===== Role-Specific Stats =====
  
  // Tailor Dashboard Stats
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
          lte: endOfDay(now),
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

  const tailorStats = {
    inProgress: inProgressOrders.length,
    inProgressList: inProgressOrders,
    dueToday: dueTodayFiltered.length,
    dueTodayList: dueTodayFiltered,
    overdue: overdueOrders.length,
    overdueList: overdueOrders,
    workloadByGarment: workloadDetails,
    upcomingDeadlines: upcomingDeadlines.slice(0, 10),
    dailyTarget: 5, // This could be configurable
  }

  // Inventory Manager Stats
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

  const inventoryStats = {
    pendingPOs,
    fastMovingFabrics: fastMovingFiltered.slice(0, 10),
    stockComparison: stockComparisonData,
  }

  // Sales Manager Stats
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

  const salesStats = {
    newOrdersToday,
    readyForPickup,
    orderPipeline: pipelineData,
    topCustomers: customerStats,
  }

  // Financial Stats (Owner/Admin)
  // NOTE: Expense tracking not yet integrated with date range filtering
  // The /api/expenses route handles expense data separately
  const financialStats = {
    revenue: revenueCurrentPeriod._sum.totalAmount || 0,
    expenses: 0, // Expenses are tracked separately - see /api/expenses
    profit: revenueCurrentPeriod._sum.totalAmount || 0, // Profit = Revenue when expenses not integrated
    outstandingPayments: await prisma.order.aggregate({
      where: {
        balanceAmount: {
          gt: 0,
        },
      },
      _sum: {
        balanceAmount: true,
      },
    }),
  }

  // Calculate growth percentages
  const orderGrowth =
    ordersPreviousPeriod > 0
      ? ((ordersCurrentPeriod - ordersPreviousPeriod) / ordersPreviousPeriod) * 100
      : ordersCurrentPeriod > 0 ? 100 : 0

  const revenueGrowth =
    (revenuePreviousPeriod._sum.totalAmount || 0) > 0
      ? (((revenueCurrentPeriod._sum.totalAmount || 0) -
          (revenuePreviousPeriod._sum.totalAmount || 0)) /
          (revenuePreviousPeriod._sum.totalAmount || 0)) *
        100
      : (revenueCurrentPeriod._sum.totalAmount || 0) > 0 ? 100 : 0

  // Return consolidated data
  return {
    dateRange: {
      preset: customRange ? 'custom' : dateRange,
      start: currentPeriodStart,
      end: currentPeriodEnd,
    },
    generalStats: {
      inventory: {
        totalItems: clothInventory.length + accessoryInventory.length,
        lowStock: clothLowStock + accessoryLowStock,
        criticalStock: clothCriticalStock + accessoryCriticalStock,
        totalValue: totalClothWorth + totalAccessoryWorth,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        ready: readyOrders,
        delivered: deliveredOrders,
        thisMonth: ordersCurrentPeriod,
        currentPeriod: ordersCurrentPeriod,
        previousPeriod: ordersPreviousPeriod,
        growth: orderGrowth,
      },
      revenue: {
        currentPeriod: revenueCurrentPeriod._sum.totalAmount || 0,
        previousPeriod: revenuePreviousPeriod._sum.totalAmount || 0,
        growth: revenueGrowth,
        byMonth: revenueByMonth,
      },
    },
    tailor: tailorStats,
    inventory: inventoryStats,
    sales: salesStats,
    financial: financialStats,
    orderStatus: statusData,
    topFabrics: topFabricsWithDetails,
    alerts: recentAlerts,
  }
}
