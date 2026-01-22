import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay } from 'date-fns'
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
        previousPeriodStart = startOfDay(subMonths(now, 1))
        previousPeriodEnd = endOfDay(subMonths(now, 1))
        break
      
      case 'week':
        currentPeriodStart = startOfDay(subMonths(now, 0))
        currentPeriodStart.setDate(currentPeriodStart.getDate() - 7)
        currentPeriodEnd = endOfDay(now)
        previousPeriodStart = startOfDay(subMonths(currentPeriodStart, 0))
        previousPeriodStart.setDate(previousPeriodStart.getDate() - 7)
        previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1)
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

  const clothLowStock = clothInventory.filter(item => {
    const available = item.currentStock - item.reserved
    const threshold = item.minimum * 1.1
    return available < threshold && available > item.minimum
  }).length

  const clothCriticalStock = clothInventory.filter(item => {
    const available = item.currentStock - item.reserved
    return available <= item.minimum
  }).length

  const totalClothWorth = clothInventory.reduce(
    (sum, item) => sum + item.currentStock * item.pricePerMeter,
    0
  )

  const accessoryInventory = await prisma.accessoryInventory.findMany({
    select: {
      currentStock: true,
      minimum: true,
      pricePerUnit: true,
    },
  })

  const accessoryLowStock = accessoryInventory.filter(item => {
    const threshold = item.minimum * 1.1
    return item.currentStock < threshold && item.currentStock > item.minimum
  }).length

  const accessoryCriticalStock = accessoryInventory.filter(
    item => item.currentStock <= item.minimum
  ).length

  const totalAccessoryWorth = accessoryInventory.reduce(
    (sum, item) => sum + item.currentStock * item.pricePerUnit,
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

  // Revenue trend based on date range
  const trendMonths = dateRange === 'year' ? 12 : dateRange === '6months' ? 6 : dateRange === '3months' ? 3 : 6
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

  const statusData = ordersByStatus.map(item => ({
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
      .filter(item => item.clothInventoryId)
      .map(async item => {
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
  const tailorStats = {
    inProgress: await prisma.order.count({
      where: {
        status: {
          in: ['CUTTING', 'STITCHING', 'FINISHING'],
        },
      },
    }),
    dueToday: await prisma.order.count({
      where: {
        deliveryDate: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
        status: {
          not: 'DELIVERED',
        },
      },
    }),
    overdue: await prisma.order.count({
      where: {
        deliveryDate: {
          lt: startOfDay(now),
        },
        status: {
          not: 'DELIVERED',
        },
      },
    }),
    workloadByType: await prisma.orderItem.groupBy({
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
    }),
  }

  // Inventory Manager Stats
  const inventoryStats = {
    lowStock: clothLowStock + accessoryLowStock,
    criticalStock: clothCriticalStock + accessoryCriticalStock,
    totalValue: totalClothWorth + totalAccessoryWorth,
    recentPurchases: await prisma.purchaseOrder.count({
      where: {
        createdAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        },
      },
    }),
  }

  // Sales Manager Stats
  const salesStats = {
    newOrders: ordersCurrentPeriod,
    revenue: revenueCurrentPeriod._sum.totalAmount || 0,
    pendingOrders,
    readyOrders,
    customerCount: await prisma.customer.count(),
  }

  // Financial Stats (Owner/Admin)
  const financialStats = {
    revenue: revenueCurrentPeriod._sum.totalAmount || 0,
    expenses: 0, // TODO: Implement expense tracking
    profit: revenueCurrentPeriod._sum.totalAmount || 0,
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
