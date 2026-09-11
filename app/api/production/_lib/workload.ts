/**
 * FEATURETRACE: Production workload (Master Tailor)
 *
 * Builds the per-tailor workload view used by:
 *   - GET /api/production/workload
 *   - GET /api/dashboard/enhanced-stats (production section, roles with view_production)
 *   - /production/tailors page
 *
 * Each item is counted by its OWN production stage (OrderItem.status, lib/item-status.ts);
 * the parent order only decides whether the item is still in production (open order).
 * Capacity comes from BusinessSettings.maxActiveItemsPerTailor; the daily target from
 * BusinessSettings.tailorDailyTarget. "Completed today" counts items moved to READY today
 * (OrderHistory ITEM_STATUS_UPDATE events), plus — for orders finished before items had their
 * own status — items of orders that moved to READY today without any item-level history.
 * Completions are attributed to the item's assignee. No financial data is read or returned.
 */

import type { Prisma } from '@prisma/client'
import { shopStartOfDay } from '@/lib/locale'
import { prisma } from '@/lib/db'
import { ASSIGNABLE_TAILOR_ROLES } from '@/lib/permissions'
import { PRODUCTION_ORDER_STATUSES } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import {
  ACTIVE_PRODUCTION_STATUSES,
  isActiveProductionStatus,
  type ActiveProductionStatus,
  type ProductionOverview,
  type TailorWorkload,
  type WorkloadItem,
} from './types'

export type RawTailor = { id: string; name: string; role: string }

export type RawWorkloadItem = {
  id: string
  orderId: string
  status: string
  quantityOrdered: number
  notes: string | null
  assignedTailorId: string | null
  assignedTailor: { name: string } | null
  garmentPattern: { name: string }
  order: {
    orderNumber: string
    status: string
    priority: string
    deliveryDate: Date
    customer: { name: string }
  }
}

export const workloadItemSelect = {
  id: true,
  orderId: true,
  status: true,
  quantityOrdered: true,
  notes: true,
  assignedTailorId: true,
  assignedTailor: { select: { name: true } },
  garmentPattern: { select: { name: true } },
  order: {
    select: {
      orderNumber: true,
      status: true,
      priority: true,
      deliveryDate: true,
      customer: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderItemSelect

const MS_PER_DAY = 86_400_000

/** Whole shop-local calendar days from `now` until `date` (negative once past). The server runs in UTC. */
export function shopDaysUntil(date: Date, now: Date): number {
  return Math.round((shopStartOfDay(date).getTime() - shopStartOfDay(now).getTime()) / MS_PER_DAY)
}

export function toWorkloadItem(raw: RawWorkloadItem, now: Date): WorkloadItem {
  const daysLeft = shopDaysUntil(raw.order.deliveryDate, now)
  return {
    id: raw.id,
    orderId: raw.orderId,
    orderNumber: raw.order.orderNumber,
    status: raw.status,
    orderStatus: raw.order.status,
    priority: raw.order.priority,
    deliveryDate: raw.order.deliveryDate.toISOString(),
    garmentName: raw.garmentPattern.name,
    customerName: raw.order.customer.name,
    notes: raw.notes,
    quantity: raw.quantityOrdered,
    assignedTailorId: raw.assignedTailorId,
    assignedTailorName: raw.assignedTailor?.name ?? null,
    daysLeft,
    isOverdue: daysLeft < 0 && isActiveProductionStatus(raw.status),
  }
}

/** Urgent first, then soonest delivery. */
export function compareWorkloadItems(a: WorkloadItem, b: WorkloadItem): number {
  const pa = a.priority === 'URGENT' ? 0 : 1
  const pb = b.priority === 'URGENT' ? 0 : 1
  if (pa !== pb) return pa - pb
  return a.daysLeft - b.daysLeft
}

function emptyStatusCounts(): Record<ActiveProductionStatus, number> {
  return Object.fromEntries(ACTIVE_PRODUCTION_STATUSES.map((s) => [s, 0])) as Record<ActiveProductionStatus, number>
}

/** Pure aggregation — unit tested without a database. */
export function buildProductionOverview(input: {
  tailors: RawTailor[]
  items: RawWorkloadItem[]
  completedByTailor: Record<string, number>
  now: Date
  maxActiveItemsPerTailor: number
  dailyTarget: number
}): ProductionOverview {
  const { now } = input
  const capacity = Math.max(1, input.maxActiveItemsPerTailor)

  const byTailor = new Map<string, TailorWorkload>()
  for (const t of input.tailors) {
    byTailor.set(t.id, {
      id: t.id,
      name: t.name,
      role: t.role,
      activeCount: 0,
      readyCount: 0,
      byStatus: emptyStatusCounts(),
      overdueCount: 0,
      dueTodayCount: 0,
      completedToday: input.completedByTailor[t.id] ?? 0,
      capacity,
      utilisation: 0,
      overCapacity: false,
      items: [],
    })
  }

  const unassigned: WorkloadItem[] = []
  const overdue: WorkloadItem[] = []
  let activeItems = 0
  let readyItems = 0

  for (const raw of input.items) {
    // Items of delivered / cancelled orders never appear in the workload
    if (!(PRODUCTION_ORDER_STATUSES as readonly string[]).includes(raw.order.status)) continue
    const item = toWorkloadItem(raw, now)
    const active = isActiveProductionStatus(item.status)
    if (active) activeItems++
    else if (item.status === 'READY') readyItems++
    else continue

    if (item.isOverdue) overdue.push(item)

    const tailor = item.assignedTailorId ? byTailor.get(item.assignedTailorId) : undefined
    if (!tailor) {
      // Unassigned, or assigned to someone who can no longer take work → needs (re)assignment
      if (active) unassigned.push(item)
      continue
    }

    tailor.items.push(item)
    if (active) {
      tailor.activeCount++
      tailor.byStatus[item.status as ActiveProductionStatus]++
      if (item.isOverdue) tailor.overdueCount++
      if (item.daysLeft === 0) tailor.dueTodayCount++
    } else {
      tailor.readyCount++
    }
  }

  const tailors = [...byTailor.values()]
  for (const t of tailors) {
    t.items.sort(compareWorkloadItems)
    t.utilisation = Math.round((t.activeCount / capacity) * 100)
    t.overCapacity = t.activeCount > capacity
  }
  unassigned.sort(compareWorkloadItems)
  overdue.sort((a, b) => a.daysLeft - b.daysLeft)

  const assignedItems = tailors.reduce((sum, t) => sum + t.activeCount, 0)
  return {
    generatedAt: now.toISOString(),
    maxActiveItemsPerTailor: capacity,
    dailyTarget: input.dailyTarget,
    tailors,
    unassigned,
    overdue,
    totals: {
      tailorCount: tailors.length,
      activeItems,
      assignedItems,
      unassignedItems: unassigned.length,
      overdueItems: overdue.length,
      readyItems,
      completedToday: tailors.reduce((sum, t) => sum + t.completedToday, 0),
      tailorsOverCapacity: tailors.filter((t) => t.overCapacity).length,
    },
  }
}

/**
 * Items that reached READY since `since`: item-level events, plus every item of an order that
 * moved to READY without item-level history (orders finished before per-item status).
 */
async function itemsReadySince(since: Date): Promise<Prisma.OrderItemWhereInput | null> {
  const [itemEvents, legacyOrderEvents] = await Promise.all([
    prisma.orderHistory.findMany({
      where: { changeType: 'ITEM_STATUS_UPDATE', newValue: 'READY', createdAt: { gte: since }, orderItemId: { not: null } },
      select: { orderItemId: true },
    }),
    prisma.orderHistory.findMany({
      where: {
        changeType: 'STATUS_UPDATE',
        newValue: 'READY',
        createdAt: { gte: since },
        order: { history: { none: { changeType: 'ITEM_STATUS_UPDATE' } } },
      },
      select: { orderId: true },
    }),
  ])
  const itemIds = [...new Set((itemEvents ?? []).map((e) => e.orderItemId).filter((id): id is string => !!id))]
  const orderIds = [...new Set((legacyOrderEvents ?? []).map((e) => e.orderId))]
  if (itemIds.length === 0 && orderIds.length === 0) return null

  const or: Prisma.OrderItemWhereInput[] = []
  if (itemIds.length > 0) or.push({ id: { in: itemIds } })
  if (orderIds.length > 0) or.push({ orderId: { in: orderIds } })
  return { OR: or }
}

/** Items completed (moved to READY) today, grouped by assignee. */
export async function completedItemsTodayByTailor(now = new Date()): Promise<Record<string, number>> {
  const ready = await itemsReadySince(shopStartOfDay(now))
  if (!ready) return {}
  const groups =
    (await prisma.orderItem.groupBy({
      by: ['assignedTailorId'],
      where: { AND: [ready, { assignedTailorId: { not: null } }] },
      _count: { id: true },
    })) ?? []
  const out: Record<string, number> = {}
  for (const g of groups) {
    if (g.assignedTailorId) out[g.assignedTailorId] = g._count.id
  }
  return out
}

/** Items completed today matching `itemWhere` (e.g. one tailor's items). */
export async function countCompletedItemsToday(itemWhere: Prisma.OrderItemWhereInput, now = new Date()): Promise<number> {
  const ready = await itemsReadySince(shopStartOfDay(now))
  if (!ready) return 0
  return (await prisma.orderItem.count({ where: { AND: [ready, itemWhere] } })) ?? 0
}

export async function loadAssignableTailors(): Promise<RawTailor[]> {
  return (
    (await prisma.user.findMany({
      where: { active: true, role: { in: ASSIGNABLE_TAILOR_ROLES } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })) ?? []
  )
}

export async function loadProductionOverview(now = new Date()): Promise<ProductionOverview> {
  const settings = await getAppSettings()
  const [tailors, items, completedByTailor] = await Promise.all([
    loadAssignableTailors(),
    prisma.orderItem.findMany({
      where: {
        status: { in: [...PRODUCTION_ORDER_STATUSES] },
        order: { status: { in: [...PRODUCTION_ORDER_STATUSES] } },
      },
      select: workloadItemSelect,
    }),
    completedItemsTodayByTailor(now),
  ])

  return buildProductionOverview({
    tailors,
    items: (items ?? []) as RawWorkloadItem[],
    completedByTailor,
    now,
    maxActiveItemsPerTailor: settings.maxActiveItemsPerTailor,
    dailyTarget: settings.tailorDailyTarget,
  })
}
