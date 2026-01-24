import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { generateStockAlerts } from '@/lib/generate-alerts'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auto-generate stock alerts in background (non-blocking)
    // Using fire-and-forget pattern to avoid blocking dashboard response
    generateStockAlerts().catch(error => {
      console.error('Background alert generation failed:', error)
    })

    // Get current month dates
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    // Inventory Stats - Cloth
    const totalInventoryValue = await prisma.clothInventory.aggregate({
      _sum: {
        currentStock: true,
      },
    })

    const clothInventory = await prisma.clothInventory.findMany({
      select: {
        currentStock: true,
        reserved: true,
        minimumStockMeters: true,
        pricePerMeter: true,
      },
    })

    // Low Stock: Available < (minimum × 1.1) but > minimum [warning zone, above minimum]
    // Critical Stock: Available <= minimum [urgent zone, at or below minimum]
    const clothLowStock = clothInventory.filter(
      (item: typeof clothInventory[0]) => {
        const available = item.currentStock - item.reserved
        const threshold = item.minimumStockMeters * 1.1
        return available < threshold && available > item.minimumStockMeters
      }
    ).length

    const clothCriticalStock = clothInventory.filter(
      (item: typeof clothInventory[0]) => {
        const available = item.currentStock - item.reserved
        return available <= item.minimumStockMeters
      }
    ).length

    const totalClothWorth = clothInventory.reduce(
      (sum: number, item: typeof clothInventory[0]) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    // Inventory Stats - Accessories
    const accessoryInventory = await prisma.accessoryInventory.findMany({
      select: {
        currentStock: true,
        minimumStockUnits: true,
        pricePerUnit: true,
      },
    })

    const accessoryLowStock = accessoryInventory.filter(
      (item: typeof accessoryInventory[0]) => {
        const threshold = item.minimumStockUnits * 1.1
        return item.currentStock < threshold && item.currentStock > item.minimumStockUnits
      }
    ).length

    const accessoryCriticalStock = accessoryInventory.filter(
      (item: typeof accessoryInventory[0]) => item.currentStock <= item.minimumStockUnits
    ).length

    const totalAccessoryWorth = accessoryInventory.reduce(
      (sum: number, item: typeof accessoryInventory[0]) => sum + item.currentStock * item.pricePerUnit,
      0
    )

    // Combined inventory stats
    const lowStockItems = clothLowStock + accessoryLowStock
    const criticalStockItems = clothCriticalStock + accessoryCriticalStock
    const totalInventoryWorth = totalClothWorth + totalAccessoryWorth
    const totalInventoryItems = clothInventory.length + accessoryInventory.length

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

    // Revenue Stats - Based on delivery/completion date
    const revenueThisMonth = await prisma.order.aggregate({
      where: {
        completedDate: {
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
        completedDate: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
        status: 'DELIVERED',
      },
      _sum: {
        totalAmount: true,
      },
    })

    // Revenue by month for last 6 months - Based on delivery/completion date
    const revenueByMonth = []
    for (let i = 5; i >= 0; i--) {
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

    // Top 10 selling fabrics
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
      take: 10,
    })

    const topFabricsWithDetails = await Promise.all(
      topFabrics
        .filter((item: typeof topFabrics[0]) => item.clothInventoryId)
        .map(async (item: typeof topFabrics[0]) => {
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

    // Recent alerts - reset expired dismissals first
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
        totalItems: totalInventoryItems,
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
