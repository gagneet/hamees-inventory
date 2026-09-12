/**
 * FEATURETRACE: Per-item production status
 *
 * Each OrderItem moves through the production stages on its own (one tailor per garment).
 * The order's status during production is DERIVED: the least advanced stage among its items,
 * so an order is READY only when every garment is READY. DELIVERED and CANCELLED stay
 * order-level decisions (front office) and are copied onto every item.
 *
 * Item transition rules (checkItemStatusTransition):
 *   1. Only production stages (NEW … READY) can be set on an item.
 *   2. Items of a delivered or cancelled order can't change (400).
 *   3. A scoped role (TAILOR, no view_all_orders) may move only items assigned to them;
 *      anything else looks like a missing item (404, same as out-of-scope).
 *   4. Forward moves (any number of stages) are allowed.
 *   5. Backward moves: roles that see all orders (owner, admin, master tailor, …) may move an
 *      item back any number of stages; a tailor may go back exactly one stage on their own
 *      item, to undo a mistaken click. Anything further back is a 403.
 *
 * Client-safe: no runtime import of lib/authz or lib/db (authz pulls in the database client),
 * only types. The view_all_orders check and the terminal statuses mirror lib/authz.
 */

import type { OrderStatus } from '@prisma/client'
import type { TransactionClient } from '@/lib/prisma-client'
import type { Actor, TransitionCheck } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'

/** Production stages in order, least advanced first. */
export const PRODUCTION_STAGES = ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING', 'READY'] as const
export type ProductionStage = (typeof PRODUCTION_STAGES)[number]

/** Same as TERMINAL_ORDER_STATUSES in lib/authz. */
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'] as const

export const STAGE_LABELS: Record<string, string> = {
  NEW: 'New',
  MATERIAL_SELECTED: 'Material Selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function isProductionStage(status: string): status is ProductionStage {
  return (PRODUCTION_STAGES as readonly string[]).includes(status)
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/** Position in PRODUCTION_STAGES, or -1 for DELIVERED / CANCELLED. */
export function stageIndex(status: string): number {
  return (PRODUCTION_STAGES as readonly string[]).indexOf(status)
}

/** The stage after `status`, or null at READY (or for terminal statuses). */
export function nextStage(status: string): ProductionStage | null {
  const i = stageIndex(status)
  return i >= 0 && i < PRODUCTION_STAGES.length - 1 ? PRODUCTION_STAGES[i + 1] : null
}

/**
 * The order status implied by its items: the least advanced production stage.
 * Items already in a terminal status are ignored. Returns null when no item is in production
 * (an order without items keeps whatever status it has).
 */
export function deriveOrderStatus(items: ReadonlyArray<{ status: string }>): ProductionStage | null {
  let least = -1
  for (const item of items) {
    const i = stageIndex(item.status)
    if (i < 0) continue
    if (least < 0 || i < least) least = i
  }
  return least < 0 ? null : PRODUCTION_STAGES[least]
}

/** "x of y items ready" for an order's items (terminal items excluded from both counts). */
export function itemProgress(items: ReadonlyArray<{ status: string }>): { ready: number; total: number } {
  const inProduction = items.filter((item) => isProductionStage(item.status))
  return { ready: inProduction.filter((item) => item.status === 'READY').length, total: inProduction.length }
}

export function checkItemStatusTransition(
  actor: Actor,
  item: { assignedTailorId: string | null; status: string },
  to: string,
  orderStatus: string
): TransitionCheck {
  if (!isProductionStage(to)) {
    return { ok: false, status: 400, reason: 'Items can only move between production stages; deliver or cancel the whole order instead' }
  }
  if (isTerminalStatus(orderStatus)) {
    return { ok: false, status: 400, reason: `Items of a ${orderStatus.toLowerCase()} order cannot change status` }
  }
  // Same test as canSeeAllOrders() in lib/authz
  const seesAll = hasPermission(actor.role, 'view_all_orders')
  if (!seesAll && item.assignedTailorId !== actor.id) {
    return { ok: false, status: 404, reason: 'Order item not found' }
  }
  if (item.status === to) {
    return { ok: false, status: 400, reason: `Item is already ${STAGE_LABELS[to] ?? to}` }
  }

  const from = stageIndex(item.status)
  const target = stageIndex(to)
  if (from < 0 || target > from || seesAll) return { ok: true }
  if (from - target === 1) return { ok: true }
  return { ok: false, status: 403, reason: 'Tailors can only move an item back one stage' }
}

/**
 * Re-derive an order's status from its items inside a transaction (the caller holds lockOrder).
 * Closed orders and orders without production items are left alone. Writes a STATUS_UPDATE
 * history row when the status changes and returns the old and new status.
 */
export async function syncOrderStatus(
  tx: TransactionClient,
  orderId: string,
  userId: string,
  reason = 'derived from item stages'
): Promise<{ from: string; to: string; changed: boolean } | null> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true, items: { select: { status: true } } },
  })
  if (!order || isTerminalStatus(order.status)) return null

  const derived = deriveOrderStatus(order.items)
  if (!derived || derived === order.status) return { from: order.status, to: order.status, changed: false }

  await tx.order.update({ where: { id: orderId }, data: { status: derived as OrderStatus } })
  await tx.orderHistory.create({
    data: {
      orderId,
      userId,
      changeType: 'STATUS_UPDATE',
      fieldName: 'status',
      oldValue: order.status,
      newValue: derived,
      description: `Status changed from ${order.status} to ${derived} (${reason})`,
    },
  })
  return { from: order.status, to: derived, changed: true }
}
