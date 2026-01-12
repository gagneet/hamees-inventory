import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current month dates
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    // Inventory Stats
    const totalInventoryValue = await prisma.clothInventory.aggregate({
      _sum: {
        currentStock: true,
      },
    })

    const clothInventory = await prisma.clothInventory.findMany({
      select: {
        currentStock: true,
        reserved: true,
        minimum: true,
        pricePerMeter: true,
      },
    })

    const lowStockItems = clothInventory.filter(
      (item: typeof clothInventory[0]) => item.currentStock - item.reserved < item.minimum
    ).length

    const criticalStockItems = clothInventory.filter(
      (item: typeof clothInventory[0]) => item.currentStock - item.reserved < item.minimum * 0.5
    ).length

    const totalInventoryWorth = clothInventory.reduce(
      (sum: number, item: typeof clothInventory[0]) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    // Order Stats
    const totalOrders = await prisma.order.count()

    const pendingOrders = await prisma.order.count({
      where: {
        status: {
          in: ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING'],
        },
      },
    })

    const ordersThisMonth = await prisma.order.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    })

    const ordersLastMonth = await prisma.order.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    })

    const readyOrders = await prisma.order.count({
      where: { status: 'READY' },
    })

    const deliveredOrders = await prisma.order.count({
      where: { status: 'DELIVERED' },
    })

    // Revenue Stats
    const revenueThisMonth = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
        status: 'DELIVERED',
      },
      _sum: {
        totalAmount: true,
      },
    })

    const revenueLastMonth = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
        status: 'DELIVERED',
      },
      _sum: {
        totalAmount: true,
      },
    })

    // Revenue by month for last 6 months
    const revenueByMonth = []
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

      revenueByMonth.push({
        month: format(monthStart, 'MMM yyyy'),
        revenue: revenue._sum.totalAmount || 0,
      })
    }

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    const statusData = ordersByStatus.map((item: typeof ordersByStatus[0]) => ({
      status: item.status,
      count: item._count.status,
    }))

    // Top 5 selling fabrics
    const topFabrics = await prisma.orderItem.groupBy({
      by: ['clothInventoryId'],
      _sum: {
        actualMetersUsed: true,
      },
      orderBy: {
        _sum: {
          actualMetersUsed: 'desc',
        },
      },
      take: 5,
    })

    const topFabricsWithDetails = await Promise.all(
      topFabrics
        .filter((item: typeof topFabrics[0]) => item.clothInventoryId)
        .map(async (item: typeof topFabrics[0]) => {
          const cloth = await prisma.clothInventory.findUnique({
            where: { id: item.clothInventoryId! },
            select: { name: true, type: true },
          })
          return {
            name: cloth?.name || 'Unknown',
            type: cloth?.type || 'Unknown',
            metersUsed: item._sum.actualMetersUsed || 0,
          }
        })
    )

    // Recent alerts
    const recentAlerts = await prisma.alert.findMany({
      where: {
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    })

    // Stock movements (last 30 days)
    const stockMovements = await prisma.stockMovement.findMany({
      where: {
        createdAt: {
          gte: subMonths(now, 1),
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 50,
    })

    // Calculate growth percentages
    const orderGrowth =
      ordersLastMonth > 0
        ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100
        : 100

    const revenueGrowth =
      (revenueLastMonth._sum.totalAmount || 0) > 0
        ? (((revenueThisMonth._sum.totalAmount || 0) -
            (revenueLastMonth._sum.totalAmount || 0)) /
            (revenueLastMonth._sum.totalAmount || 0)) *
          100
        : 100

    return NextResponse.json({
      inventory: {
        totalItems: clothInventory.length,
        lowStock: lowStockItems,
        criticalStock: criticalStockItems,
        totalValue: totalInventoryWorth,
        totalMeters: totalInventoryValue._sum.currentStock || 0,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        ready: readyOrders,
        delivered: deliveredOrders,
        thisMonth: ordersThisMonth,
        lastMonth: ordersLastMonth,
        growth: orderGrowth,
      },
      revenue: {
        thisMonth: revenueThisMonth._sum.totalAmount || 0,
        lastMonth: revenueLastMonth._sum.totalAmount || 0,
        growth: revenueGrowth,
        byMonth: revenueByMonth,
      },
      charts: {
        ordersByStatus: statusData,
        topFabrics: topFabricsWithDetails,
        stockMovements: stockMovements.length,
      },
      alerts: {
        unread: recentAlerts.length,
        recent: recentAlerts,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}
