/**
 * Section builders for GET /api/dashboard/enhanced-stats.
 * Each builder is only invoked for roles that receive that section (see shape.ts), and every
 * order-derived query is AND-scoped with the actor's order scope (lib/authz.ts).
 */

import type { OrderStatus, Prisma } from '@prisma/client'
import { addDays, differenceInDays, endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { shopStartOfDay } from '@/lib/locale'
import { prisma } from '@/lib/db'
import { canSeeAllOrders, orderItemScope, orderScope, scopedWhere, type Actor } from '@/lib/authz'
import { alertVisibilityScope } from '@/lib/alert-scope'
import { countCompletedItemsToday } from '@/app/api/production/_lib/workload'
import { subtractMoney, sumFromMinor, sumMoney } from '@/lib/money'

const OPEN_ORDER: Prisma.OrderWhereInput = { status: { notIn: ['DELIVERED', 'CANCELLED'] } }
/** Item stages (OrderItem.status) where a garment is being worked on. */
const IN_PRODUCTION_STAGES: OrderStatus[] = ['CUTTING', 'STITCHING', 'FINISHING']
const UNFINISHED_STAGES: OrderStatus[] = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING']

export type MonthWindow = { start: Date; end: Date }

export function monthWindows(now: Date) {
  return {
    thisMonth: { start: startOfMonth(now), end: endOfMonth(now) },
    lastMonth: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) },
  }
}

async function patternNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = (await prisma.garmentPattern.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) ?? []
  return new Map(rows.map((r) => [r.id, r.name]))
}

/**
 * Revenue recognised in a month = delivered orders completed in that month, measured as NET
 * SALES EXCLUDING TAX (taxableAmount = subTotal − discount). The tax charged is collected for
 * the tax authority and is never income, so it must not inflate revenue or profit — the same
 * definition the financial report uses.
 */
export async function deliveredRevenue(window: MonthWindow): Promise<number> {
  const result = await prisma.order.aggregate({
    where: { status: 'DELIVERED', completedDate: { gte: window.start, lte: window.end } },
    // Aggregates are not converted by the money extension — wrap each with sumFromMinor
    _sum: { taxableAmount: true, subTotal: true, discount: true },
  })
  // taxableAmount was only filled in from v0.32 onwards; fall back to gross − discount
  const net = sumFromMinor(result?._sum.taxableAmount)
  if (net > 0) return net
  return subtractMoney(sumFromMinor(result?._sum.subTotal), sumFromMinor(result?._sum.discount))
}

// ── Tailor workbench (scoped to the actor's assigned items) ──────────────────

export async function buildTailorSection(actor: Actor, now: Date, dailyTarget: number) {
  const scope = orderScope(actor)
  const ownItems: Prisma.OrderItemWhereInput | undefined = canSeeAllOrders(actor)
    ? undefined
    : { assignedTailorId: actor.id }

  // Items are counted by their own stage (lib/item-status.ts); a tailor's deadlines are the open
  // orders where one of THEIR garments is still unfinished
  const inProductionItems = scopedWhere<Prisma.OrderItemWhereInput>(
    { status: { in: IN_PRODUCTION_STAGES }, order: OPEN_ORDER },
    ownItems ?? {}
  )
  const openWork: Prisma.OrderWhereInput = ownItems
    ? { AND: [OPEN_ORDER, { items: { some: { ...ownItems, status: { in: UNFINISHED_STAGES } } } }] }
    : OPEN_ORDER

  const orderSelect = {
    id: true,
    orderNumber: true,
    deliveryDate: true,
    status: true,
    priority: true,
    customer: { select: { name: true } },
    items: { where: ownItems, select: { status: true, garmentPattern: { select: { name: true } } } },
  } satisfies Prisma.OrderSelect

  const todayStart = shopStartOfDay(now)
  const tomorrowStart = addDays(todayStart, 1)

  const [inProgressOrders, dueTodayOrders, overdueOrders, upcomingDeadlines, workloadByGarment, completedToday] =
    await Promise.all([
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>({ items: { some: inProductionItems } }, scope),
        select: orderSelect,
        orderBy: { deliveryDate: 'asc' },
      }),
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>(
          { AND: [openWork, { deliveryDate: { gte: todayStart, lt: tomorrowStart } }] },
          scope
        ),
        select: orderSelect,
        orderBy: { deliveryDate: 'asc' },
      }),
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>({ AND: [openWork, { deliveryDate: { lt: todayStart } }] }, scope),
        select: orderSelect,
        orderBy: { deliveryDate: 'asc' },
      }),
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>(
          { AND: [openWork, { deliveryDate: { gte: now, lte: addDays(now, 7) } }] },
          scope
        ),
        select: orderSelect,
        orderBy: { deliveryDate: 'asc' },
        take: 10,
      }),
      prisma.orderItem.groupBy({
        by: ['garmentPatternId'],
        where: inProductionItems,
        _count: { id: true },
      }),
      countCompletedItemsToday(ownItems ?? {}, now),
    ])

  const names = await patternNames((workloadByGarment ?? []).map((w) => w.garmentPatternId))

  return {
    // Garments (not orders) in cutting, stitching or finishing
    inProgress: (workloadByGarment ?? []).reduce((sum, w) => sum + w._count.id, 0),
    inProgressList: inProgressOrders,
    dueToday: dueTodayOrders.length,
    dueTodayList: dueTodayOrders,
    overdue: overdueOrders.length,
    overdueList: overdueOrders,
    workloadByGarment: (workloadByGarment ?? []).map((w) => ({
      name: names.get(w.garmentPatternId) || 'Unknown',
      count: w._count.id,
    })),
    upcomingDeadlines,
    completedToday,
    dailyTarget,
  }
}

// ── Inventory manager ────────────────────────────────────────────────────────

export async function buildInventorySection(now: Date) {
  const [pendingPOs, fabricUsage, stockComparison] = await Promise.all([
    prisma.purchaseOrder.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } }),
    prisma.orderItem.groupBy({
      by: ['clothInventoryId'],
      where: { createdAt: { gte: subMonths(now, 1) } },
      _sum: { estimatedMeters: true },
      orderBy: { _sum: { estimatedMeters: 'desc' } },
      take: 20,
    }),
    prisma.clothInventory.findMany({
      select: { name: true, currentStock: true, reserved: true, type: true },
      take: 10,
      orderBy: { reserved: 'desc' },
    }),
  ])

  const clothIds = (fabricUsage ?? []).map((f) => f.clothInventoryId)
  const cloths =
    clothIds.length > 0
      ? ((await prisma.clothInventory.findMany({
          where: { id: { in: clothIds } },
          select: { id: true, name: true, currentStock: true, reserved: true, minimumStockMeters: true },
        })) ?? [])
      : []
  const clothById = new Map(cloths.map((c) => [c.id, c]))

  const fastMovingFabrics = (fabricUsage ?? [])
    .map((item) => {
      const cloth = clothById.get(item.clothInventoryId)
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
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)

  return {
    pendingPOs,
    fastMovingFabrics: fastMovingFabrics.slice(0, 10),
    stockComparison: (stockComparison ?? []).map((cloth) => ({
      name: cloth.name,
      type: cloth.type,
      available: cloth.currentStock - cloth.reserved,
      committed: cloth.reserved,
      total: cloth.currentStock,
    })),
  }
}

// ── Sales ────────────────────────────────────────────────────────────────────

const PIPELINE_ORDER = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY']

export async function buildSalesSection(
  actor: Actor,
  now: Date,
  forecast: { lastMonthRevenue: number } | null
) {
  const scope = orderScope(actor)
  const { thisMonth } = monthWindows(now)

  const salesOrderSelect = {
    id: true,
    orderNumber: true,
    orderDate: true,
    deliveryDate: true,
    status: true,
    totalAmount: true,
    // Net of tax and discount — the basis revenue is measured on (see deliveredRevenue above)
    taxableAmount: true,
    subTotal: true,
    discount: true,
    balanceAmount: true,
    customer: { select: { id: true, name: true, phone: true, email: true } },
    items: { select: { id: true, quantityOrdered: true, garmentPattern: { select: { name: true } } } },
  } satisfies Prisma.OrderSelect

  const [newOrdersTodayList, readyForPickupList, pendingOrdersList, pendingOrdersCount, thisMonthOrdersList, orderPipeline, topCustomers] =
    await Promise.all([
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>({ createdAt: { gte: shopStartOfDay(now) } }, scope),
        select: salesOrderSelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>({ status: 'READY' }, scope),
        select: salesOrderSelect,
        orderBy: { deliveryDate: 'asc' },
      }),
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>(OPEN_ORDER, scope),
        select: salesOrderSelect,
        orderBy: { deliveryDate: 'asc' },
        take: 50, // Limit to prevent huge response
      }),
      prisma.order.count({ where: scopedWhere<Prisma.OrderWhereInput>(OPEN_ORDER, scope) }),
      prisma.order.findMany({
        where: scopedWhere<Prisma.OrderWhereInput>({ orderDate: { gte: thisMonth.start, lte: thisMonth.end } }, scope),
        select: salesOrderSelect,
        orderBy: { orderDate: 'desc' },
      }),
      // Production pipeline: garments of open orders by their own stage
      prisma.orderItem.groupBy({
        by: ['status'],
        where: scopedWhere<Prisma.OrderItemWhereInput>({ order: OPEN_ORDER }, orderItemScope(actor)),
        _count: { status: true },
      }),
      prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          orders: {
            where: scope,
            select: { totalAmount: true, status: true, orderDate: true, items: { select: { id: true } } },
          },
        },
        take: 100,
      }),
    ])

  const pipelineData = PIPELINE_ORDER.map((status) => ({
    status,
    count: (orderPipeline ?? []).find((p) => p.status === status)?._count.status || 0,
  }))

  const customerStats = (topCustomers ?? [])
    .map((customer) => {
      const deliveredOrders = customer.orders.filter((o) => o.status === 'DELIVERED')
      const totalOrders = customer.orders.length
      // What this customer was invoiced (tax included) — a spend measure, not the P&L revenue
      const totalSpent = sumMoney(deliveredOrders.map((o) => o.totalAmount))
      const pendingOrders = customer.orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length
      const totalItems = customer.orders.reduce((sum, o) => sum + (o.items?.length || 0), 0)
      const monthsActive = new Set(customer.orders.map((o) => format(new Date(o.orderDate), 'yyyy-MM'))).size
      // Value score: revenue + 500/order + 1000/active month + 100/item
      const valueScore = totalSpent + totalOrders * 500 + monthsActive * 1000 + totalItems * 100
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
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, 20)

  const section = {
    newOrdersToday: newOrdersTodayList.length,
    newOrdersTodayList,
    readyForPickup: readyForPickupList.length,
    readyForPickupList,
    pendingOrders: pendingOrdersCount,
    pendingOrdersList,
    thisMonthOrders: thisMonthOrdersList.length,
    thisMonthOrdersList,
    orderPipeline: pipelineData,
    topCustomers: customerStats,
  }

  if (!forecast) return section

  // Revenue here must use the SAME basis as deliveredRevenue() — net sales excluding tax —
  // because lastMonthRevenue comes from it and growthRate compares the two. Summing
  // totalAmount instead would compare a tax-inclusive figure with a tax-exclusive one.
  const netOf = (order: { taxableAmount: number; subTotal: number; discount: number }) =>
    order.taxableAmount > 0 ? order.taxableAmount : subtractMoney(order.subTotal, order.discount)
  const sumAmounts = (filter: (status: string) => boolean) =>
    sumMoney(thisMonthOrdersList.filter((o) => filter(o.status)).map(netOf))
  const forecastedRevenue = sumAmounts((s) => s !== 'CANCELLED')
  return {
    ...section,
    revenueForecast: {
      deliveredRevenue: sumAmounts((s) => s === 'DELIVERED'),
      pendingRevenue: sumAmounts((s) => s !== 'DELIVERED' && s !== 'CANCELLED'),
      forecastedRevenue,
      lastMonthRevenue: forecast.lastMonthRevenue,
      growthRate:
        forecast.lastMonthRevenue > 0
          ? ((forecastedRevenue - forecast.lastMonthRevenue) / forecast.lastMonthRevenue) * 100
          : 0,
    },
  }
}

// ── Owner / Admin financials ─────────────────────────────────────────────────

/** PO payments are recorded in notes as "[DD/MM/YYYY] Payment: AMOUNT via MODE". */
function poPaymentsBetween(pos: Array<{ notes: string | null }>, start: Date, end: Date): number {
  let total = 0
  for (const po of pos) {
    if (!po.notes) continue
    const paymentRegex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s+Payment:\s+([\d.]+)/g
    let match
    while ((match = paymentRegex.exec(po.notes)) !== null) {
      const [, day, month, year, amount] = match
      const paymentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (paymentDate >= start && paymentDate <= end) total += parseFloat(amount)
    }
  }
  return total
}

export async function buildFinancialSection(now: Date) {
  const { thisMonth, lastMonth } = monthWindows(now)

  const [expensesThisMonth, expensesLastMonth, paidPurchaseOrders, cashCollectedThisMonth, cashCollectedLastMonth] =
    await Promise.all([
      prisma.expense.aggregate({
        where: { expenseDate: { gte: thisMonth.start, lte: thisMonth.end } },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { expenseDate: { gte: lastMonth.start, lte: lastMonth.end } },
        _sum: { totalAmount: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { paidAmount: { gt: 0 }, notes: { not: null } },
        select: { paidAmount: true, notes: true, updatedAt: true },
      }),
      prisma.paymentInstallment.aggregate({
        where: {
          paidDate: { gte: thisMonth.start, lte: thisMonth.end },
          status: 'PAID',
          order: { status: { notIn: ['CANCELLED'] } },
        },
        _sum: { paidAmount: true },
      }),
      prisma.paymentInstallment.aggregate({
        where: {
          paidDate: { gte: lastMonth.start, lte: lastMonth.end },
          status: 'PAID',
          order: { status: { notIn: ['CANCELLED'] } },
        },
        _sum: { paidAmount: true },
      }),
    ])

  const pos = paidPurchaseOrders ?? []
  const totalExpensesThisMonth =
    (sumFromMinor(expensesThisMonth?._sum.totalAmount)) + poPaymentsBetween(pos, thisMonth.start, thisMonth.end)
  const totalExpensesLastMonth =
    (sumFromMinor(expensesLastMonth?._sum.totalAmount)) + poPaymentsBetween(pos, lastMonth.start, lastMonth.end)

  // Revenue vs expenses for the last 6 months
  const financialTrend = await Promise.all(
    Array.from({ length: 6 }, async (_, index) => {
      const i = 5 - index
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))
      const [revenue, expenses] = await Promise.all([
        deliveredRevenue({ start: monthStart, end: monthEnd }),
        prisma.expense.aggregate({
          where: { expenseDate: { gte: monthStart, lte: monthEnd } },
          _sum: { totalAmount: true },
        }),
      ])
      const totalExpenses = (sumFromMinor(expenses?._sum.totalAmount)) + poPaymentsBetween(pos, monthStart, monthEnd)
      return {
        month: format(monthStart, 'MMM yyyy'),
        revenue,
        expenses: totalExpenses,
        profit: revenue - totalExpenses,
      }
    })
  )

  const [outstandingPayments, revenueByFabric, revenueByGarmentType, deliveredOrders, allCustomers, stockMovements, totalFabric] =
    await Promise.all([
      prisma.order.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { balanceAmount: true } }),
      prisma.orderItem.groupBy({
        by: ['clothInventoryId'],
        where: { order: { status: 'DELIVERED' } },
        _sum: { totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10,
      }),
      prisma.orderItem.groupBy({
        by: ['garmentPatternId'],
        where: { order: { status: 'DELIVERED' } },
        _sum: { totalPrice: true },
        _count: { id: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
      }),
      prisma.order.findMany({
        where: { status: 'DELIVERED', completedDate: { not: null } },
        select: { orderDate: true, completedDate: true },
        take: 100,
      }),
      prisma.customer.findMany({
        select: {
          id: true,
          orders: {
            where: { status: 'DELIVERED' },
            select: { id: true, orderDate: true, status: true },
            orderBy: { orderDate: 'asc' },
          },
        },
      }),
      prisma.stockMovement.findMany({
        where: { createdAt: { gte: subMonths(now, 1) }, type: 'ORDER_USED' },
        select: { quantityMeters: true },
      }),
      prisma.clothInventory.aggregate({ _sum: { currentStock: true } }),
    ])

  const fabricIds = (revenueByFabric ?? []).map((r) => r.clothInventoryId)
  const fabrics =
    fabricIds.length > 0
      ? ((await prisma.clothInventory.findMany({
          where: { id: { in: fabricIds } },
          select: { id: true, name: true, type: true, color: true, colorHex: true },
        })) ?? [])
      : []
  const fabricById = new Map(fabrics.map((f) => [f.id, f]))
  const fabricRevenueDetails = (revenueByFabric ?? []).map((item) => {
    const cloth = fabricById.get(item.clothInventoryId)
    return {
      id: cloth?.id || item.clothInventoryId,
      name: cloth?.name || 'Unknown',
      type: cloth?.type || 'Unknown',
      color: cloth?.color || 'Unknown',
      colorHex: cloth?.colorHex || '#94a3b8',
      revenue: sumFromMinor(item._sum.totalPrice),
    }
  })

  const garmentNames = await patternNames((revenueByGarmentType ?? []).map((r) => r.garmentPatternId))
  const garmentTypeRevenueDetails = (revenueByGarmentType ?? []).map((item) => ({
    id: item.garmentPatternId,
    name: garmentNames.get(item.garmentPatternId) || 'Unknown',
    revenue: sumFromMinor(item._sum.totalPrice),
    orderCount: item._count.id,
  }))

  const fulfillmentTimes = (deliveredOrders ?? []).map((o) => differenceInDays(o.completedDate!, o.orderDate))
  const avgFulfillmentTime =
    fulfillmentTimes.length > 0 ? fulfillmentTimes.reduce((sum, t) => sum + t, 0) / fulfillmentTimes.length : 0

  // Returning customers: 3+ delivered orders, in 2+ months, with 2 orders at least 14 days apart
  const customers = allCustomers ?? []
  const returningCustomers = customers.filter((c) => {
    if (c.orders.length < 3) return false
    const uniqueMonths = new Set(c.orders.map((o) => format(new Date(o.orderDate), 'MMM yyyy')))
    if (uniqueMonths.size < 2) return false
    const times = c.orders.map((o) => new Date(o.orderDate).getTime())
    const span = Math.max(...times) - Math.min(...times)
    return span / (1000 * 60 * 60 * 24) >= 14
  }).length
  const newCustomers = customers.length - returningCustomers

  const fabricUsed = (stockMovements ?? []).reduce((sum, m) => sum + Math.abs(m.quantityMeters), 0)
  const fabricStock = totalFabric?._sum.currentStock || 0
  const stockTurnoverRatio = fabricStock > 0 ? (fabricUsed / fabricStock) * 100 : 0

  return {
    expensesThisMonth: totalExpensesThisMonth,
    expensesLastMonth: totalExpensesLastMonth,
    cashCollectedThisMonth: sumFromMinor(cashCollectedThisMonth?._sum.paidAmount),
    cashCollectedLastMonth: sumFromMinor(cashCollectedLastMonth?._sum.paidAmount),
    financialTrend,
    outstandingPayments: sumFromMinor(outstandingPayments?._sum.balanceAmount),
    revenueByFabric: fabricRevenueDetails,
    revenueByGarmentType: garmentTypeRevenueDetails,
    avgFulfillmentTime: Math.round(avgFulfillmentTime),
    customerRetention: {
      new: newCustomers,
      returning: returningCustomers,
      retentionRate: customers.length > 0 ? Math.round((returningCustomers / customers.length) * 100) : 0,
    },
    stockTurnoverRatio: Math.round(stockTurnoverRatio * 10) / 10,
    efficiencyMetrics: await buildEfficiencyMetrics(now),
  }
}

type EfficiencyItem = {
  estimatedMeters: number
  actualMetersUsed: number | null
  clothInventory: { pricePerMeter: number }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const variance = (item: EfficiencyItem) => (item.actualMetersUsed || 0) - item.estimatedMeters

function efficiencyTotals(items: EfficiencyItem[]) {
  const estimated = items.reduce((sum, i) => sum + i.estimatedMeters, 0)
  const actual = items.reduce((sum, i) => sum + (i.actualMetersUsed || 0), 0)
  // Variance is recalculated (actual − estimated) rather than read from the stored wastage field
  const wastage = items.reduce((sum, i) => sum + variance(i), 0)
  const varianceAmount = items.reduce((sum, i) => sum + variance(i) * i.clothInventory.pricePerMeter, 0)
  const efficiency = estimated > 0 ? ((estimated - Math.abs(wastage)) / estimated) * 100 : 0
  return { estimated, actual, wastage, varianceAmount, efficiency }
}

async function buildEfficiencyMetrics(now: Date) {
  const { thisMonth } = monthWindows(now)
  const [monthItems, allTimeItems] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { createdAt: { gte: thisMonth.start, lte: thisMonth.end } },
        actualMetersUsed: { not: null },
      },
      select: {
        id: true,
        estimatedMeters: true,
        actualMetersUsed: true,
        wastageMeters: true,
        clothInventory: { select: { name: true, type: true, color: true, pricePerMeter: true } },
        garmentPattern: { select: { name: true } },
        order: { select: { orderNumber: true, orderDate: true } },
      },
    }),
    prisma.orderItem.findMany({
      where: { actualMetersUsed: { not: null } },
      select: { estimatedMeters: true, actualMetersUsed: true, clothInventory: { select: { pricePerMeter: true } } },
    }),
  ])

  const month = monthItems ?? []
  const current = efficiencyTotals(month)
  const allTime = efficiencyTotals(allTimeItems ?? [])

  type FabricWastage = {
    fabricName: string
    fabricType: string
    estimated: number
    actualUsed: number
    wastage: number
    varianceAmount: number
    orderCount: number
  }
  const byFabric = new Map<string, FabricWastage>()
  for (const item of month) {
    const key = `${item.clothInventory.name} (${item.clothInventory.color})`
    const v = variance(item)
    const entry = byFabric.get(key) ?? {
      fabricName: key,
      fabricType: item.clothInventory.type,
      estimated: 0,
      actualUsed: 0,
      wastage: 0,
      varianceAmount: 0,
      orderCount: 0,
    }
    entry.estimated += item.estimatedMeters
    entry.actualUsed += item.actualMetersUsed || 0
    entry.wastage += v
    entry.varianceAmount += v * item.clothInventory.pricePerMeter
    entry.orderCount += 1
    byFabric.set(key, entry)
  }
  const wastageByFabric = [...byFabric.values()].sort((a, b) => Math.abs(b.wastage) - Math.abs(a.wastage))

  return {
    totalEstimated: r2(current.estimated),
    totalActualUsed: r2(current.actual),
    totalWastage: r2(current.wastage),
    totalVarianceAmount: r2(current.varianceAmount),
    efficiencyPercentage: r2(current.efficiency),
    orderItemsAnalyzed: month.length,
    totalEstimatedAllTime: r2(allTime.estimated),
    totalActualUsedAllTime: r2(allTime.actual),
    totalWastageAllTime: r2(allTime.wastage),
    totalVarianceAmountAllTime: r2(allTime.varianceAmount),
    efficiencyPercentageAllTime: r2(allTime.efficiency),
    orderItemsAnalyzedAllTime: (allTimeItems ?? []).length,
    wastageByFabric: wastageByFabric.slice(0, 10),
    detailedItems: month.slice(0, 20).map((item) => {
      const v = variance(item)
      return {
        orderNumber: item.order.orderNumber,
        orderDate: item.order.orderDate,
        garmentType: item.garmentPattern.name,
        fabric: `${item.clothInventory.name} (${item.clothInventory.color})`,
        estimated: r2(item.estimatedMeters),
        actualUsed: r2(item.actualMetersUsed || 0),
        wastage: r2(v),
        varianceAmount: r2(v * item.clothInventory.pricePerMeter),
      }
    }),
  }
}

// ── General stats (shaped per role in shape.ts) ──────────────────────────────

export async function buildGeneralStats(
  actor: Actor,
  now: Date,
  opts: { includeRevenue: boolean; includeInventory: boolean }
) {
  const scope = orderScope(actor)
  const { thisMonth, lastMonth } = monthWindows(now)
  const count = (where: Prisma.OrderWhereInput) => prisma.order.count({ where: scopedWhere(where, scope) })

  const [totalOrders, deliveredOrders, pendingOrders, ordersThisMonth, ordersLastMonth, revenue, inventory] =
    await Promise.all([
      count({}),
      count({ status: 'DELIVERED' }),
      count(OPEN_ORDER),
      count({ orderDate: { gte: thisMonth.start, lte: thisMonth.end } }),
      count({ orderDate: { gte: lastMonth.start, lte: lastMonth.end } }),
      opts.includeRevenue ? Promise.all([deliveredRevenue(thisMonth), deliveredRevenue(lastMonth)]) : null,
      opts.includeInventory ? buildInventoryStats() : null,
    ])

  const growth = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 100 * 100) / 100 : 0

  return {
    ...(revenue && {
      revenue: { thisMonth: revenue[0], lastMonth: revenue[1], growth: growth(revenue[0], revenue[1]) },
    }),
    orders: {
      total: totalOrders ?? 0,
      delivered: deliveredOrders ?? 0,
      pending: pendingOrders ?? 0,
      thisMonth: ordersThisMonth ?? 0,
      lastMonth: ordersLastMonth ?? 0,
      growth: growth(ordersThisMonth ?? 0, ordersLastMonth ?? 0),
    },
    ...(inventory && { inventory }),
  }
}

async function buildInventoryStats() {
  // Prisma can't compare two columns in WHERE, so thresholds are evaluated in memory
  const [cloth, accessories] = await Promise.all([
    prisma.clothInventory.findMany({
      select: { id: true, currentStock: true, reserved: true, minimumStockMeters: true, pricePerMeter: true },
    }),
    prisma.accessoryInventory.findMany({
      select: { id: true, currentStock: true, reserved: true, minimumStockUnits: true, pricePerUnit: true },
    }),
  ])
  const clothItems = cloth ?? []
  const accessoryItems = accessories ?? []

  // Low: available above minimum but within +25%. Critical: available at or below minimum.
  const isLow = (available: number, min: number) => available > min && available <= min * 1.25
  const isCritical = (available: number, min: number) => available <= min

  return {
    totalItems: clothItems.length,
    lowStock: clothItems.filter((i) => isLow(i.currentStock - i.reserved, i.minimumStockMeters)).length,
    criticalStock: clothItems.filter((i) => isCritical(i.currentStock - i.reserved, i.minimumStockMeters)).length,
    totalValue: r2(clothItems.reduce((sum, i) => sum + i.currentStock * i.pricePerMeter, 0)),
    totalMeters: r2(clothItems.reduce((sum, i) => sum + i.currentStock, 0)),
    accessories: {
      totalItems: accessoryItems.length,
      totalUnits: accessoryItems.reduce((sum, i) => sum + i.currentStock, 0),
      totalReserved: accessoryItems.reduce((sum, i) => sum + i.reserved, 0),
      totalValue: r2(accessoryItems.reduce((sum, i) => sum + i.currentStock * i.pricePerUnit, 0)),
      lowStock: accessoryItems.filter((i) => isLow(i.currentStock - i.reserved, i.minimumStockUnits)).length,
      criticalStock: accessoryItems.filter((i) => isCritical(i.currentStock - i.reserved, i.minimumStockUnits)).length,
    },
  }
}

// ── Shared ───────────────────────────────────────────────────────────────────

export async function buildAlerts(actor: Actor) {
  // Payment reminders quote balances: hidden from roles without order financial access
  const where: Prisma.AlertWhereInput = {
    AND: [{ isRead: false, isDismissed: false }, alertVisibilityScope(actor.role)],
  }
  const [unread, recent] = await Promise.all([
    prisma.alert.count({ where }),
    prisma.alert.findMany({ where, orderBy: { createdAt: 'desc' }, take: 5 }),
  ])
  return { unread: unread ?? 0, recent: recent ?? [] }
}

export async function buildOrderStatus(actor: Actor) {
  const rows = (await prisma.order.groupBy({ by: ['status'], where: orderScope(actor), _count: { status: true } })) ?? []
  return rows.map((row) => ({ status: row.status, count: row._count.status }))
}
