/**
 * FEATURETRACE: Production report (Master Tailor / Owner)
 *
 * Throughput, turnaround and on-time delivery per tailor for a date range.
 *   - An order "completes production" at its FIRST transition to READY (or DELIVERED when READY
 *     was skipped), taken from OrderHistory STATUS_UPDATE events; orders with no history fall
 *     back to Order.completedDate.
 *   - Completed items are attributed to each item's current assignee.
 *   - Turnaround = completion − order date (days). On time = completed by the end of the
 *     delivery date.
 *   - Stage durations = time between consecutive status events of orders completed in range.
 * No financial data is read or returned.
 */

import { addDays, differenceInCalendarDays, format, subDays } from 'date-fns'
import { shopEndOfDay, shopStartOfDay } from '@/lib/locale'
import { prisma } from '@/lib/db'
import { ASSIGNABLE_TAILOR_ROLES } from '@/lib/permissions'
import { PRODUCTION_ORDER_STATUSES } from '@/lib/authz'
import { isActiveProductionStatus } from '@/app/api/production/_lib/types'

const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_REPORT_DAYS = 366
export const DEFAULT_REPORT_DAYS = 30
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type ReportRange = { from: Date; to: Date }

// Calendar days are anchored at 12:00 UTC so shopStartOfDay/shopEndOfDay map them to the same
// calendar date in the shop's time zone (independent of the server's time zone).
function parseDay(value: string): Date | null {
  if (!DATE_RE.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  // Reject rollovers such as 2026-02-31
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date
}

/** Midday (shop-local) of the shop's current day — a safe anchor for calendar arithmetic. */
function shopToday(now: Date): Date {
  return new Date(shopStartOfDay(now).getTime() + 12 * 60 * 60 * 1000)
}

/** Validate ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). Defaults to the last 30 days. */
export function parseReportRange(
  params: URLSearchParams,
  now = new Date()
): { ok: true; range: ReportRange } | { ok: false; error: string } {
  const fromParam = params.get('from')
  const toParam = params.get('to')

  const to = toParam ? parseDay(toParam) : shopToday(now)
  if (!to) return { ok: false, error: '`to` must be a valid date (YYYY-MM-DD)' }
  const from = fromParam ? parseDay(fromParam) : subDays(to, DEFAULT_REPORT_DAYS - 1)
  if (!from) return { ok: false, error: '`from` must be a valid date (YYYY-MM-DD)' }

  if (from > to) return { ok: false, error: '`from` must be on or before `to`' }
  if (differenceInCalendarDays(to, from) + 1 > MAX_REPORT_DAYS) {
    return { ok: false, error: `Date range cannot exceed ${MAX_REPORT_DAYS} days` }
  }
  return { ok: true, range: { from: shopStartOfDay(from), to: shopEndOfDay(to) } }
}

// ── Pure aggregation ─────────────────────────────────────────────────────────

export type ReportTailor = { id: string; name: string; role: string; active: boolean }

export type CompletedItemInput = {
  assignedTailorId: string | null
  quantity: number
  orderDate: Date
  deliveryDate: Date
  completedAt: Date
}

export type BacklogItemInput = {
  assignedTailorId: string | null
  orderStatus: string
  deliveryDate: Date
}

export type StatusEventInput = { orderId: string; newValue: string | null; createdAt: Date }

export interface TailorReportRow {
  id: string | null
  name: string
  role: string | null
  active: boolean
  completedItems: number
  completedGarments: number
  avgTurnaroundDays: number | null
  onTimeRate: number | null
  backlog: number
  overdue: number
}

export interface ProductionReport {
  range: { from: string; to: string }
  summary: {
    completedItems: number
    completedGarments: number
    avgTurnaroundDays: number | null
    onTimeRate: number | null
    backlog: number
    overdue: number
    unassignedBacklog: number
  }
  tailors: TailorReportRow[]
  daily: Array<{ date: string; completed: number }>
  stages: Array<{ status: string; avgDays: number | null; samples: number }>
}

const round1 = (n: number) => Math.round(n * 10) / 10

function avg(values: number[]): number | null {
  return values.length ? round1(values.reduce((s, v) => s + v, 0) / values.length) : null
}

function rate(hits: number, total: number): number | null {
  return total > 0 ? Math.round((hits / total) * 100) : null
}

export function buildProductionReport(input: {
  range: ReportRange
  now: Date
  tailors: ReportTailor[]
  completed: CompletedItemInput[]
  backlog: BacklogItemInput[]
  statusEvents: StatusEventInput[]
  orderDates: Record<string, Date>
}): ProductionReport {
  const { range, now } = input
  const today = shopStartOfDay(now)

  type Acc = { completed: CompletedItemInput[]; backlog: number; overdue: number }
  const acc = new Map<string | null, Acc>()
  const bucket = (id: string | null) => {
    let a = acc.get(id)
    if (!a) {
      a = { completed: [], backlog: 0, overdue: 0 }
      acc.set(id, a)
    }
    return a
  }
  for (const t of input.tailors) bucket(t.id)

  for (const item of input.completed) bucket(item.assignedTailorId).completed.push(item)

  let backlog = 0
  let overdue = 0
  for (const item of input.backlog) {
    if (!isActiveProductionStatus(item.orderStatus)) continue
    const a = bucket(item.assignedTailorId)
    a.backlog++
    backlog++
    if (item.deliveryDate < today) {
      a.overdue++
      overdue++
    }
  }

  const turnaround = (i: CompletedItemInput) => Math.max(0, (i.completedAt.getTime() - i.orderDate.getTime()) / DAY_MS)
  const onTime = (i: CompletedItemInput) => i.completedAt <= shopEndOfDay(i.deliveryDate)

  const tailorById = new Map(input.tailors.map((t) => [t.id, t]))
  const tailors: TailorReportRow[] = [...acc.entries()].map(([id, a]) => {
    const t = id ? tailorById.get(id) : undefined
    return {
      id,
      name: id === null ? 'Unassigned' : (t?.name ?? 'Former staff'),
      role: t?.role ?? null,
      active: t?.active ?? false,
      completedItems: a.completed.length,
      completedGarments: a.completed.reduce((s, i) => s + i.quantity, 0),
      avgTurnaroundDays: avg(a.completed.map(turnaround)),
      onTimeRate: rate(a.completed.filter(onTime).length, a.completed.length),
      backlog: a.backlog,
      overdue: a.overdue,
    }
  })
  // Hide empty "Unassigned"/former-staff rows; keep every current tailor (even idle ones)
  const visible = tailors
    .filter((r) => (r.id && tailorById.get(r.id)?.active) || r.completedItems > 0 || r.backlog > 0)
    .sort((a, b) => {
      if ((a.id === null) !== (b.id === null)) return a.id === null ? 1 : -1
      return b.completedItems - a.completedItems || a.name.localeCompare(b.name)
    })

  // Daily completions across the range
  const days = differenceInCalendarDays(range.to, range.from) + 1
  const dailyMap = new Map<string, number>()
  for (let i = 0; i < days; i++) dailyMap.set(format(addDays(range.from, i), 'yyyy-MM-dd'), 0)
  for (const item of input.completed) {
    const key = format(item.completedAt, 'yyyy-MM-dd')
    if (dailyMap.has(key)) dailyMap.set(key, dailyMap.get(key)! + 1)
  }

  // Average time spent in each production stage
  const eventsByOrder = new Map<string, StatusEventInput[]>()
  for (const e of input.statusEvents) {
    const list = eventsByOrder.get(e.orderId) ?? []
    list.push(e)
    eventsByOrder.set(e.orderId, list)
  }
  const stageDurations = new Map<string, number[]>()
  for (const [orderId, events] of eventsByOrder) {
    events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    let stage = 'NEW'
    let enteredAt = input.orderDates[orderId]
    for (const e of events) {
      if (enteredAt && isActiveProductionStatus(stage)) {
        const list = stageDurations.get(stage) ?? []
        list.push(Math.max(0, (e.createdAt.getTime() - enteredAt.getTime()) / DAY_MS))
        stageDurations.set(stage, list)
      }
      if (!e.newValue) continue
      stage = e.newValue
      enteredAt = e.createdAt
      if (stage === 'READY' || stage === 'DELIVERED' || stage === 'CANCELLED') break
    }
  }
  const stages = PRODUCTION_ORDER_STATUSES.filter(isActiveProductionStatus).map((status) => {
    const list = stageDurations.get(status) ?? []
    return { status, avgDays: avg(list), samples: list.length }
  })

  const allCompleted = input.completed
  return {
    range: { from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd') },
    summary: {
      completedItems: allCompleted.length,
      completedGarments: allCompleted.reduce((s, i) => s + i.quantity, 0),
      avgTurnaroundDays: avg(allCompleted.map(turnaround)),
      onTimeRate: rate(allCompleted.filter(onTime).length, allCompleted.length),
      backlog,
      overdue,
      unassignedBacklog: acc.get(null)?.backlog ?? 0,
    },
    tailors: visible,
    daily: [...dailyMap.entries()].map(([date, completed]) => ({ date, completed })),
    stages,
  }
}

// ── Loader ───────────────────────────────────────────────────────────────────

export async function loadProductionReport(range: ReportRange, now = new Date()): Promise<ProductionReport> {
  const COMPLETION = ['READY', 'DELIVERED']

  // 1. Orders with a completion event in range, then their FIRST completion overall
  const inRange =
    (await prisma.orderHistory.findMany({
      where: {
        changeType: 'STATUS_UPDATE',
        newValue: { in: COMPLETION },
        createdAt: { gte: range.from, lte: range.to },
      },
      select: { orderId: true },
    })) ?? []
  const candidateIds = [...new Set(inRange.map((e) => e.orderId))]

  const statusEvents =
    candidateIds.length > 0
      ? ((await prisma.orderHistory.findMany({
          where: { orderId: { in: candidateIds }, changeType: 'STATUS_UPDATE' },
          select: { orderId: true, newValue: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })) ?? [])
      : []

  const completedAt = new Map<string, Date>()
  for (const e of statusEvents) {
    if (e.newValue && COMPLETION.includes(e.newValue) && !completedAt.has(e.orderId)) {
      completedAt.set(e.orderId, e.createdAt)
    }
  }
  for (const [orderId, at] of completedAt) {
    if (at < range.from || at > range.to) completedAt.delete(orderId)
  }

  // 2. Fallback: delivered orders without any status history (imported / legacy data)
  const legacy =
    (await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        completedDate: { gte: range.from, lte: range.to },
        history: { none: { changeType: 'STATUS_UPDATE' } },
      },
      select: { id: true, completedDate: true },
    })) ?? []
  for (const o of legacy) if (o.completedDate) completedAt.set(o.id, o.completedDate)

  const completedOrderIds = [...completedAt.keys()]

  const [completedItems, backlogItems, tailorUsers] = await Promise.all([
    completedOrderIds.length > 0
      ? prisma.orderItem.findMany({
          where: { orderId: { in: completedOrderIds } },
          select: {
            orderId: true,
            assignedTailorId: true,
            quantityOrdered: true,
            order: { select: { orderDate: true, deliveryDate: true } },
          },
        })
      : Promise.resolve([]),
    prisma.orderItem.findMany({
      where: { order: { status: { in: [...PRODUCTION_ORDER_STATUSES] } } },
      select: { assignedTailorId: true, order: { select: { status: true, deliveryDate: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ASSIGNABLE_TAILOR_ROLES } },
      select: { id: true, name: true, role: true, active: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const completed: CompletedItemInput[] = (completedItems ?? []).map((i) => ({
    assignedTailorId: i.assignedTailorId,
    quantity: i.quantityOrdered,
    orderDate: i.order.orderDate,
    deliveryDate: i.order.deliveryDate,
    completedAt: completedAt.get(i.orderId)!,
  }))

  // Anyone who completed work but is no longer a tailor still gets a named row
  const knownIds = new Set((tailorUsers ?? []).map((u) => u.id))
  const extraIds = [...new Set(completed.map((c) => c.assignedTailorId).filter((id): id is string => !!id && !knownIds.has(id)))]
  const extraUsers =
    extraIds.length > 0
      ? ((await prisma.user.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true, role: true, active: true },
        })) ?? [])
      : []

  const orderDates: Record<string, Date> = {}
  for (const i of completedItems ?? []) orderDates[i.orderId] = i.order.orderDate

  return buildProductionReport({
    range,
    now,
    tailors: [...(tailorUsers ?? []), ...extraUsers],
    completed,
    backlog: (backlogItems ?? []).map((i) => ({
      assignedTailorId: i.assignedTailorId,
      orderStatus: i.order.status,
      deliveryDate: i.order.deliveryDate,
    })),
    statusEvents: statusEvents.filter((e) => completedAt.has(e.orderId)),
    orderDates,
  })
}
