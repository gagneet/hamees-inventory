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

    // Auto-generate stock alerts in background (non-blocking)
    // Using fire-and-forget pattern to avoid blocking dashboard response
    generateStockAlerts().catch(error => {
      console.error('Background alert generation failed:', error)
    })

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
            minimumStockMeters: true,
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
          isLowStock: availableStock < cloth.minimumStockMeters,
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

    const [newOrdersTodayList, readyForPickupList, pendingOrdersList, thisMonthOrdersList, orderPipeline, topCustomers] = await Promise.all([
      // New orders today - full details
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfDay(now),
          },
        },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          deliveryDate: true,
          status: true,
          totalAmount: true,
          balanceAmount: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              quantityOrdered: true,
              garmentPattern: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Ready for pickup - full details
      prisma.order.findMany({
        where: {
          status: 'READY',
        },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          deliveryDate: true,
          status: true,
          totalAmount: true,
          balanceAmount: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              quantityOrdered: true,
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

      // Pending orders (all non-delivered, non-cancelled) - full details
      prisma.order.findMany({
        where: {
          status: {
            notIn: ['DELIVERED', 'CANCELLED'],
          },
        },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          deliveryDate: true,
          status: true,
          totalAmount: true,
          balanceAmount: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              quantityOrdered: true,
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
        take: 50, // Limit to prevent huge response
      }),

      // This month orders - full details
      prisma.order.findMany({
        where: {
          orderDate: {
            gte: startOfMonth(now),
            lte: endOfMonth(now),
          },
        },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          deliveryDate: true,
          status: true,
          totalAmount: true,
          balanceAmount: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          items: {
            select: {
              id: true,
              quantityOrdered: true,
              garmentPattern: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          orderDate: 'desc',
        },
      }),

      // Order status funnel (pipeline)
      prisma.order.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),

      // Top customers (by order count, value, and activity)
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
              orderDate: true,
              items: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
        take: 100,
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
        const deliveredOrders = customer.orders.filter((o: CustomerOrder) => o.status === 'DELIVERED')
        const totalOrders = customer.orders.length
        const totalSpent = deliveredOrders.reduce((sum: number, o: CustomerOrder) => sum + o.totalAmount, 0)
        const pendingOrders = customer.orders.filter(
          (o: CustomerOrder) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
        ).length

        // Calculate total items across all orders
        const totalItems = customer.orders.reduce(
          (sum: number, o: CustomerOrder) => sum + (o.items?.length || 0),
          0
        )

        // Calculate months active (unique year-month combinations)
        const uniqueMonths = new Set(
          customer.orders.map((o: CustomerOrder) => {
            const date = new Date(o.orderDate)
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          })
        )
        const monthsActive = uniqueMonths.size

        // Calculate customer value score:
        // - Primary: Total revenue (weight: 1.0)
        // - Secondary: Number of orders (weight: 500 per order)
        // - Tertiary: Months active (weight: 1000 per month)
        // - Bonus: Total items (weight: 100 per item)
        const valueScore = totalSpent + (totalOrders * 500) + (monthsActive * 1000) + (totalItems * 100)

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalOrders,
          totalSpent,
          pendingOrders,
          totalItems,
          monthsActive,
          valueScore,
          isReturning: totalOrders > 1,
        }
      })
      .sort((a: { valueScore: number }, b: { valueScore: number }) => b.valueScore - a.valueScore)
      .slice(0, 20)

    // ===================
    // OWNER/ADMIN DATA (Parallelized)
    // ===================

    const [expensesThisMonth, expensesLastMonth, allPurchaseOrders, cashCollectedThisMonth, cashCollectedLastMonth] = await Promise.all([
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

      // Fetch all POs with payments to parse payment dates from notes
      prisma.purchaseOrder.findMany({
        where: {
          paidAmount: {
            gt: 0,
          },
          notes: {
            not: null,
          },
        },
        select: {
          paidAmount: true,
          notes: true,
          updatedAt: true,
        },
      }),

      // Cash collected this month from payment installments
      prisma.paymentInstallment.aggregate({
        where: {
          paidDate: {
            gte: startOfMonth(now),
            lte: endOfMonth(now),
          },
          status: 'PAID',
        },
        _sum: {
          paidAmount: true,
        },
      }),

      // Cash collected last month from payment installments
      prisma.paymentInstallment.aggregate({
        where: {
          paidDate: {
            gte: startOfMonth(subMonths(now, 1)),
            lte: endOfMonth(subMonths(now, 1)),
          },
          status: 'PAID',
        },
        _sum: {
          paidAmount: true,
        },
      }),
    ])

    // Parse payment dates from PO notes
    // Notes format: "[DD/MM/YYYY] Payment: AMOUNT via MODE"
    const thisMonthStart = startOfMonth(now)
    const thisMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    let poPaymentsThisMonth = 0
    let poPaymentsLastMonth = 0

    allPurchaseOrders.forEach((po: { notes: string | null }) => {
      if (!po.notes) return

      // Extract all payment entries from notes
      const paymentRegex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s+Payment:\s+([\d.]+)/g
      let match

      while ((match = paymentRegex.exec(po.notes)) !== null) {
        const [, day, month, year, amount] = match
        const paymentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        const paymentAmount = parseFloat(amount)

        // Check if payment was made this month
        if (paymentDate >= thisMonthStart && paymentDate <= thisMonthEnd) {
          poPaymentsThisMonth += paymentAmount
        }

        // Check if payment was made last month
        if (paymentDate >= lastMonthStart && paymentDate <= lastMonthEnd) {
          poPaymentsLastMonth += paymentAmount
        }
      }
    })

    const totalExpensesThisMonth = (expensesThisMonth._sum.totalAmount || 0) + poPaymentsThisMonth
    const totalExpensesLastMonth = (expensesLastMonth._sum.totalAmount || 0) + poPaymentsLastMonth

    // Revenue vs Expenses for last 6 months (Parallelized)
    const financialTrend = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const i = 5 - index // Reverse order: 5, 4, 3, 2, 1, 0
        const monthStart = startOfMonth(subMonths(now, i))
        const monthEnd = endOfMonth(subMonths(now, i))

        const [revenue, expenses] = await Promise.all([
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
        ])

        // Calculate PO payments for this month from parsed notes
        let monthPoPayments = 0
        allPurchaseOrders.forEach((po: { notes: string | null }) => {
          if (!po.notes) return

          const paymentRegex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s+Payment:\s+([\d.]+)/g
          let match

          while ((match = paymentRegex.exec(po.notes)) !== null) {
            const [, day, month, year, amount] = match
            const paymentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            const paymentAmount = parseFloat(amount)

            if (paymentDate >= monthStart && paymentDate <= monthEnd) {
              monthPoPayments += paymentAmount
            }
          }
        })

        const totalExpenses = (expenses._sum.totalAmount || 0) + monthPoPayments

        return {
          month: format(monthStart, 'MMM yyyy'),
          revenue: revenue._sum.totalAmount || 0,
          expenses: totalExpenses,
          profit: (revenue._sum.totalAmount || 0) - totalExpenses,
        }
      })
    )

    // Parallel fetch for remaining owner metrics
    const [outstandingPayments, revenueByFabric, revenueByGarmentType, deliveredOrders, allCustomers, stockMovements] = await Promise.all([
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

      // Revenue by garment type
      prisma.orderItem.groupBy({
        by: ['garmentPatternId'],
        where: {
          order: {
            status: 'DELIVERED',
          },
        },
        _sum: {
          totalPrice: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            totalPrice: 'desc',
          },
        },
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
          quantityMeters: true,
        },
      }),
    ])

    type RevenueByFabricItem = typeof revenueByFabric[number]

    const fabricRevenueDetails = await Promise.all(
      revenueByFabric.map(async (item: RevenueByFabricItem) => {
        const cloth = await prisma.clothInventory.findUnique({
          where: { id: item.clothInventoryId },
          select: { id: true, name: true, type: true, color: true, colorHex: true },
        })
        return {
          id: cloth?.id || item.clothInventoryId,
          name: cloth?.name || 'Unknown',
          type: cloth?.type || 'Unknown',
          color: cloth?.color || 'Unknown',
          colorHex: cloth?.colorHex || '#94a3b8', // Default slate-400 if no color
          revenue: item._sum.totalPrice || 0,
        }
      })
    )

    type RevenueByGarmentTypeItem = typeof revenueByGarmentType[number]

    const garmentTypeRevenueDetails = await Promise.all(
      revenueByGarmentType.map(async (item: RevenueByGarmentTypeItem) => {
        const garment = await prisma.garmentPattern.findUnique({
          where: { id: item.garmentPatternId },
          select: { id: true, name: true },
        })
        return {
          id: garment?.id || item.garmentPatternId,
          name: garment?.name || 'Unknown',
          revenue: item._sum.totalPrice || 0,
          orderCount: item._count.id,
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
        c.orders.map((order: { orderDate: Date }) => format(new Date(order.orderDate), 'MMM yyyy'))
      )

      // Must have orders in at least 2 different months
      if (uniqueMonths.size < 2) return false

      // Check if at least 2 orders are at least 2 weeks (14 days) apart
      const orderDates = c.orders.map((o: { orderDate: Date }) => new Date(o.orderDate).getTime())
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
    const fabricUsed = stockMovements.reduce((sum: number, m: any) => sum + Math.abs(m.quantityMeters), 0)
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
    // EFFICIENCY METRICS (Fabric Usage & Wastage)
    // ===================

    // Get efficiency data for current month AND all-time
    const [efficiencyDataMonth, efficiencyDataAllTime] = await Promise.all([
      // Current month data
      prisma.orderItem.findMany({
        where: {
          order: {
            createdAt: {
              gte: startOfMonth(now),
              lte: endOfMonth(now),
            },
          },
          actualMetersUsed: {
            not: null,
          },
        },
        select: {
          id: true,
          estimatedMeters: true,
          actualMetersUsed: true,
          wastageMeters: true,
          clothInventory: {
            select: {
              name: true,
              type: true,
              color: true,
              pricePerMeter: true,
            },
          },
          garmentPattern: {
            select: {
              name: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              orderDate: true,
            },
          },
        },
      }),

      // All-time data
      prisma.orderItem.findMany({
        where: {
          actualMetersUsed: {
            not: null,
          },
        },
        select: {
          id: true,
          estimatedMeters: true,
          actualMetersUsed: true,
          wastageMeters: true,
          clothInventory: {
            select: {
              pricePerMeter: true,
            },
          },
        },
      }),
    ])

    // Process current month data
    const efficiencyData = efficiencyDataMonth

    // Current month metrics
    // IMPORTANT: Calculate variance on-the-fly instead of reading stored wastage field
    // This ensures we always get accurate variance even if database records haven't been updated
    const totalEstimated = efficiencyData.reduce((sum: number, item: any) => sum + item.estimatedMeters, 0)
    const totalActualUsed = efficiencyData.reduce((sum: number, item: any) => sum + (item.actualMetersUsed || 0), 0)
    const totalWastage = efficiencyData.reduce((sum: number, item: any) => {
      // Calculate variance: actualUsed - estimated
      const calculatedVariance = (item.actualMetersUsed || 0) - item.estimatedMeters
      return sum + calculatedVariance
    }, 0)
    // Calculate financial impact of variance (variance × price per meter)
    const totalVarianceAmount = efficiencyData.reduce((sum: number, item: any) => {
      const calculatedVariance = (item.actualMetersUsed || 0) - item.estimatedMeters
      const varianceCost = calculatedVariance * item.clothInventory.pricePerMeter
      return sum + varianceCost
    }, 0)
    const efficiencyPercentage = totalEstimated > 0 ? ((totalEstimated - Math.abs(totalWastage)) / totalEstimated) * 100 : 0

    // All-time metrics
    const totalEstimatedAllTime = efficiencyDataAllTime.reduce((sum: number, item: any) => sum + item.estimatedMeters, 0)
    const totalActualUsedAllTime = efficiencyDataAllTime.reduce((sum: number, item: any) => sum + (item.actualMetersUsed || 0), 0)
    const totalWastageAllTime = efficiencyDataAllTime.reduce((sum: number, item: any) => {
      // Calculate variance: actualUsed - estimated
      const calculatedVariance = (item.actualMetersUsed || 0) - item.estimatedMeters
      return sum + calculatedVariance
    }, 0)
    // Calculate financial impact of variance (all-time)
    const totalVarianceAmountAllTime = efficiencyDataAllTime.reduce((sum: number, item: any) => {
      const calculatedVariance = (item.actualMetersUsed || 0) - item.estimatedMeters
      const varianceCost = calculatedVariance * item.clothInventory.pricePerMeter
      return sum + varianceCost
    }, 0)
    const efficiencyPercentageAllTime = totalEstimatedAllTime > 0 ? ((totalEstimatedAllTime - Math.abs(totalWastageAllTime)) / totalEstimatedAllTime) * 100 : 0

    // Group wastage by fabric type for detailed analysis
    const wastageByFabric = efficiencyData.reduce((acc: any[], item: any) => {
      const fabricKey = `${item.clothInventory.name} (${item.clothInventory.color})`
      const existing = acc.find((f: any) => f.fabricName === fabricKey)

      // Calculate variance on-the-fly
      const calculatedVariance = (item.actualMetersUsed || 0) - item.estimatedMeters
      const varianceCost = calculatedVariance * item.clothInventory.pricePerMeter

      if (existing) {
        existing.estimated += item.estimatedMeters
        existing.actualUsed += item.actualMetersUsed || 0
        existing.wastage += calculatedVariance
        existing.varianceAmount += varianceCost
        existing.orderCount += 1
      } else {
        acc.push({
          fabricName: fabricKey,
          fabricType: item.clothInventory.type,
          estimated: item.estimatedMeters,
          actualUsed: item.actualMetersUsed || 0,
          wastage: calculatedVariance,
          varianceAmount: varianceCost,
          orderCount: 1,
        })
      }

      return acc
    }, [])

    // Sort by highest wastage
    wastageByFabric.sort((a: any, b: any) => Math.abs(b.wastage) - Math.abs(a.wastage))

    const efficiencyMetrics = {
      // Current month metrics
      totalEstimated: Math.round(totalEstimated * 100) / 100,
      totalActualUsed: Math.round(totalActualUsed * 100) / 100,
      totalWastage: Math.round(totalWastage * 100) / 100,
      totalVarianceAmount: Math.round(totalVarianceAmount * 100) / 100,
      efficiencyPercentage: Math.round(efficiencyPercentage * 100) / 100,
      orderItemsAnalyzed: efficiencyData.length,
      // All-time metrics
      totalEstimatedAllTime: Math.round(totalEstimatedAllTime * 100) / 100,
      totalActualUsedAllTime: Math.round(totalActualUsedAllTime * 100) / 100,
      totalWastageAllTime: Math.round(totalWastageAllTime * 100) / 100,
      totalVarianceAmountAllTime: Math.round(totalVarianceAmountAllTime * 100) / 100,
      efficiencyPercentageAllTime: Math.round(efficiencyPercentageAllTime * 100) / 100,
      orderItemsAnalyzedAllTime: efficiencyDataAllTime.length,
      // Detailed breakdowns (current month only)
      wastageByFabric: wastageByFabric.slice(0, 10), // Top 10 fabrics
      detailedItems: efficiencyData.map((item: any) => {
        // Calculate variance on-the-fly for each item
        const calculatedVariance = (item.actualMetersUsed || 0) - item.estimatedMeters
        const varianceCost = calculatedVariance * item.clothInventory.pricePerMeter
        return {
          orderNumber: item.order.orderNumber,
          orderDate: item.order.orderDate,
          garmentType: item.garmentPattern.name,
          fabric: `${item.clothInventory.name} (${item.clothInventory.color})`,
          estimated: Math.round(item.estimatedMeters * 100) / 100,
          actualUsed: Math.round((item.actualMetersUsed || 0) * 100) / 100,
          wastage: Math.round(calculatedVariance * 100) / 100,
          varianceAmount: Math.round(varianceCost * 100) / 100,
        }
      }).slice(0, 20), // Top 20 recent items
    }

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
    // GENERAL STATS (for OwnerDashboard)
    // ===================

    const [revenueThisMonth, revenueLastMonth, totalOrders, deliveredOrdersCount] = await Promise.all([
      // Revenue this month
      prisma.order.aggregate({
        where: {
          completedDate: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
          status: 'DELIVERED',
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Revenue last month
      prisma.order.aggregate({
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
      }),

      // Total orders
      prisma.order.count(),

      // Delivered orders
      prisma.order.count({
        where: {
          status: 'DELIVERED',
        },
      }),
    ])

    // Fetch all cloth items to calculate inventory stats, low stock, and critical stock
    // (Prisma doesn't support field-to-field comparison in where clause)
    const allInventoryItems = await prisma.clothInventory.findMany({
      select: {
        id: true,
        currentStock: true,
        reserved: true,
        minimumStockMeters: true,
        pricePerMeter: true,
      },
    })

    // Fetch all accessory items for accessory stats
    const allAccessoryItems = await prisma.accessoryInventory.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        currentStock: true,
        reserved: true,
        minimumStockUnits: true,
        pricePerUnit: true,
      },
    })

    // Calculate using AVAILABLE stock (currentStock - reserved) not just currentStock
    // Low Stock: Available > minimum AND Available <= (minimum × 1.25) [warning zone: threshold+0.01 to threshold+25%]
    const lowStockCount = allInventoryItems.filter((item: any) => {
      const available = item.currentStock - item.reserved
      return available > item.minimumStockMeters && available <= item.minimumStockMeters * 1.25
    }).length

    // Critical Stock: Available <= minimum [at or below threshold]
    const criticalStockCount = allInventoryItems.filter((item: any) => {
      const available = item.currentStock - item.reserved
      return available <= item.minimumStockMeters
    }).length

    // Accessory low/critical stock
    const accessoryLowStockCount = allAccessoryItems.filter((item: any) => {
      const available = item.currentStock - item.reserved
      return available > item.minimumStockMeters && available <= item.minimumStockMeters * 1.25
    }).length

    const accessoryCriticalStockCount = allAccessoryItems.filter((item: any) => {
      const available = item.currentStock - item.reserved
      return available <= item.minimumStockMeters
    }).length

    // Calculate total value and total meters from all cloth inventory items
    const totalInventoryValue = allInventoryItems.reduce(
      (sum: number, item: any) => sum + (item.currentStock * item.pricePerMeter),
      0
    )
    const totalInventoryMeters = allInventoryItems.reduce(
      (sum: number, item: any) => sum + item.currentStock,
      0
    )

    // Calculate total accessory value and units
    const totalAccessoryValue = allAccessoryItems.reduce(
      (sum: number, item: any) => sum + (item.currentStock * item.pricePerUnit),
      0
    )
    const totalAccessoryUnits = allAccessoryItems.reduce(
      (sum: number, item: any) => sum + item.currentStock,
      0
    )
    const totalAccessoryReserved = allAccessoryItems.reduce(
      (sum: number, item: any) => sum + item.reserved,
      0
    )

    const revenueThisMonthAmount = revenueThisMonth._sum.totalAmount || 0
    const revenueLastMonthAmount = revenueLastMonth._sum.totalAmount || 0
    const revenueGrowth = revenueLastMonthAmount > 0
      ? ((revenueThisMonthAmount - revenueLastMonthAmount) / revenueLastMonthAmount) * 100
      : 0

    // Calculate order growth (this month vs last month)
    const ordersThisMonthCount = thisMonthOrdersList.length
    const ordersLastMonthCount = await prisma.order.count({
      where: {
        orderDate: {
          gte: startOfMonth(subMonths(now, 1)),
          lte: endOfMonth(subMonths(now, 1)),
        },
      },
    })
    const ordersGrowth = ordersLastMonthCount > 0
      ? ((ordersThisMonthCount - ordersLastMonthCount) / ordersLastMonthCount) * 100
      : 0

    const generalStats = {
      revenue: {
        thisMonth: revenueThisMonthAmount,
        lastMonth: revenueLastMonthAmount,
        growth: Math.round(revenueGrowth * 100) / 100,
      },
      orders: {
        total: totalOrders,
        delivered: deliveredOrdersCount,
        pending: pendingOrdersList.length,
        thisMonth: ordersThisMonthCount,
        lastMonth: ordersLastMonthCount,
        growth: Math.round(ordersGrowth * 100) / 100,
      },
      inventory: {
        totalItems: allInventoryItems.length,
        lowStock: lowStockCount,
        criticalStock: criticalStockCount,
        totalValue: Math.round(totalInventoryValue * 100) / 100,
        totalMeters: Math.round(totalInventoryMeters * 100) / 100,
        accessories: {
          totalItems: allAccessoryItems.length,
          totalUnits: totalAccessoryUnits,
          totalReserved: totalAccessoryReserved,
          totalValue: Math.round(totalAccessoryValue * 100) / 100,
          lowStock: accessoryLowStockCount,
          criticalStock: accessoryCriticalStockCount,
        },
      },
    }

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
        newOrdersToday: newOrdersTodayList.length,
        newOrdersTodayList: newOrdersTodayList,
        readyForPickup: readyForPickupList.length,
        readyForPickupList: readyForPickupList,
        pendingOrders: pendingOrdersList.length,
        pendingOrdersList: pendingOrdersList,
        thisMonthOrders: thisMonthOrdersList.length,
        thisMonthOrdersList: thisMonthOrdersList,
        orderPipeline: pipelineData,
        topCustomers: customerStats,
        // Revenue forecast
        revenueForecast: {
          deliveredRevenue: thisMonthOrdersList
            .filter((o: any) => o.status === 'DELIVERED')
            .reduce((sum: number, o: any) => sum + o.totalAmount, 0),
          pendingRevenue: thisMonthOrdersList
            .filter((o: any) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
            .reduce((sum: number, o: any) => sum + o.totalAmount, 0),
          forecastedRevenue: thisMonthOrdersList
            .filter((o: any) => o.status !== 'CANCELLED')
            .reduce((sum: number, o: any) => sum + o.totalAmount, 0),
          lastMonthRevenue: revenueLastMonthAmount,
          growthRate: revenueLastMonthAmount > 0
            ? ((thisMonthOrdersList
                .filter((o: any) => o.status !== 'CANCELLED')
                .reduce((sum: number, o: any) => sum + o.totalAmount, 0) - revenueLastMonthAmount) /
               revenueLastMonthAmount) * 100
            : 0,
        },
      },

      // Owner/Admin metrics
      financial: {
        expensesThisMonth: totalExpensesThisMonth,
        expensesLastMonth: totalExpensesLastMonth,
        cashCollectedThisMonth: cashCollectedThisMonth._sum.paidAmount || 0,
        cashCollectedLastMonth: cashCollectedLastMonth._sum.paidAmount || 0,
        financialTrend,
        outstandingPayments: outstandingPayments._sum.balanceAmount || 0,
        revenueByFabric: fabricRevenueDetails,
        revenueByGarmentType: garmentTypeRevenueDetails,
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
        efficiencyMetrics, // Added efficiency and wastage analysis
      },

      // General stats for OwnerDashboard
      generalStats,

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
