import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format, parse } from 'date-fns'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')

    let monthStart: Date
    let monthEnd: Date
    let monthName: string

    if (monthParam) {
      // Parse the month parameter (format: "MMM yyyy" e.g., "Jan 2026")
      const parsedDate = parse(monthParam, 'MMM yyyy', new Date())
      monthStart = startOfMonth(parsedDate)
      monthEnd = endOfMonth(parsedDate)
      monthName = monthParam
    } else {
      // Default to current month
      const now = new Date()
      monthStart = startOfMonth(now)
      monthEnd = endOfMonth(now)
      monthName = format(now, 'MMM yyyy')
    }

    // Get all delivered orders for the month
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        completedDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            clothInventory: {
              select: {
                name: true,
                type: true,
              },
            },
            garmentPattern: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        completedDate: 'desc',
      },
    })

    // Get inventory purchases for the month (stock movements of type PURCHASE)
    const inventoryPurchases = await prisma.stockMovement.findMany({
      where: {
        type: 'PURCHASE',
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      include: {
        clothInventory: {
          select: {
            name: true,
            type: true,
            pricePerMeter: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate totals
    const totalRevenue = deliveredOrders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    )

    const totalExpenses = inventoryPurchases.reduce(
      (sum, purchase) => sum + (purchase.quantity * (purchase.clothInventory?.pricePerMeter || 0)),
      0
    )

    const netProfit = totalRevenue - totalExpenses

    // Format the data for the UI
    const formattedOrders = deliveredOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      customerEmail: order.customer.email,
      totalAmount: order.totalAmount,
      advancePaid: order.advancePaid,
      balanceAmount: order.balanceAmount,
      completedDate: order.completedDate,
      items: order.items.map((item) => ({
        garmentName: item.garmentPattern?.name || 'Unknown',
        fabricName: item.clothInventory?.name || 'Unknown',
        fabricType: item.clothInventory?.type || 'Unknown',
        metersUsed: item.actualMetersUsed || item.estimatedMeters,
        wastage: item.wastage,
      })),
    }))

    const formattedPurchases = inventoryPurchases.map((purchase) => ({
      id: purchase.id,
      fabricName: purchase.clothInventory?.name || 'Unknown',
      fabricType: purchase.clothInventory?.type || 'Unknown',
      quantity: purchase.quantity,
      pricePerMeter: purchase.clothInventory?.pricePerMeter || 0,
      totalCost: purchase.quantity * (purchase.clothInventory?.pricePerMeter || 0),
      purchasedBy: purchase.user?.name || 'Unknown',
      createdAt: purchase.createdAt,
      notes: purchase.notes,
    }))

    return NextResponse.json({
      month: monthName,
      monthStart,
      monthEnd,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        orderCount: deliveredOrders.length,
        purchaseCount: inventoryPurchases.length,
      },
      orders: formattedOrders,
      purchases: formattedPurchases,
    })
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch expenses data' },
      { status: 500 }
    )
  }
}
