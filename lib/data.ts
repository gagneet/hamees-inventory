import { prisma } from "@/lib/db"
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import type { OrderStatus, DashboardStats } from "@/lib/types"

export async function getDashboardStats(): Promise<DashboardStats | null> {
  try {
    const sixMonthsAgo = subMonths(new Date(), 5)
    const firstDayOfSixMonthsAgo = startOfMonth(sixMonthsAgo)

    const monthlyRevenue = await prisma.order.groupBy({
      by: ['completedDate'],
      where: {
        status: 'DELIVERED',
        completedDate: {
          gte: firstDayOfSixMonthsAgo,
        },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        completedDate: 'asc',
      },
    })

    const revenueByMonth = Array.from({ length: 6 }).map((_, i) => {
      const monthDate = subMonths(new Date(), i)
      const monthName = format(monthDate, 'MMM')
      return {
        month: monthName,
        revenue: 0,
      }
    }).reverse()

    monthlyRevenue.forEach((revenue: { completedDate: Date | null; _sum: { totalAmount: number | null } }) => {
      if (revenue.completedDate) {
        const monthName = format(revenue.completedDate, 'MMM')
        const monthData = revenueByMonth.find((m) => m.month === monthName)
        if (monthData) {
          monthData.revenue += revenue._sum.totalAmount || 0
        }
      }
    })

    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    const statusData = ordersByStatus.map((item: { status: OrderStatus; _count: { status: number } }) => ({
      status: item.status,
      count: item._count.status,
    }))

    const topFabrics = await prisma.orderItem.groupBy({
      by: ['clothInventoryId'],
      _sum: {
        estimatedMeters: true,
      },
      orderBy: {
        _sum: {
          estimatedMeters: 'desc',
        },
      },
      take: 5,
    })

    const clothIds = topFabrics
      .filter((item: { clothInventoryId: string | null }) => item.clothInventoryId)
      .map((item: { clothInventoryId: string | null }) => item.clothInventoryId!) as string[]
    const cloths = await prisma.clothInventory.findMany({
      where: {
        id: { in: clothIds },
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    })
    const clothMap = new Map(
      cloths.map((cloth: { id: string; name: string | null; type: string | null }) => [cloth.id, cloth])
    )
    const topFabricsWithDetails = topFabrics
      .filter((item: { clothInventoryId: string | null }) => item.clothInventoryId)
      .map((item: { clothInventoryId: string | null; _sum: { estimatedMeters: number | null } }) => {
        const cloth = clothMap.get(item.clothInventoryId as string)
        return {
          name: cloth?.name || 'Unknown',
          type: cloth?.type || 'Unknown',
          metersUsed: item._sum.estimatedMeters || 0,
        }
      })

    const clothInventory = await prisma.clothInventory.findMany({
      select: {
        pricePerMeter: true,
        currentStock: true,
        reserved: true,
        minimum: true,
      },
    })

    const lowStockItems = clothInventory.filter(
      (item: { currentStock: number; reserved: number; minimum: number }) => item.currentStock - item.reserved < item.minimum
    ).length

    const criticalStockItems = clothInventory.filter(
      (item: { currentStock: number; reserved: number; minimum: number }) =>
        item.minimum > 0 && (item.currentStock - item.reserved) / item.minimum <= 0.5
    ).length

    const totalInventoryWorth = clothInventory.reduce(
      (sum: number, item: { currentStock: number; pricePerMeter: number }) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    const recentAlerts = await prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return {
      revenue: {
        byMonth: revenueByMonth,
      },
      charts: {
        ordersByStatus: statusData,
        topFabrics: topFabricsWithDetails,
      },
      inventory: {
        lowStock: lowStockItems,
        criticalStock: criticalStockItems,
        totalValue: totalInventoryWorth,
        totalItems: clothInventory.length,
        totalMeters: clothInventory.reduce(
          (sum: number, item: { currentStock: number }) => sum + item.currentStock,
          0
        ),
      },
      alerts: {
        recent: recentAlerts,
      },
    }
  } catch (error) {
    console.error('Failed to get dashboard stats:', error)
    return null
  }
}
