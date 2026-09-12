/**
 * FEATURETRACE: Object-level authorization (ABAC) — prevents BOLA/IDOR
 *
 * RBAC (lib/permissions.ts) answers "may this role perform this action at all?".
 * This module answers "may this user act on THIS record?" using record attributes:
 *
 *   - Order scope: roles with `view_all_orders` see every order. Everyone else (TAILOR)
 *     only sees orders that have at least one item assigned to them
 *     (OrderItem.assignedTailorId === user.id).
 *   - Customer / measurement scope follows the order scope: a TAILOR can only reach
 *     customers (and their measurements) linked to an order in their scope.
 *   - Order status transitions: DELIVERED / CANCELLED are terminal and require
 *     `update_order`; production roles can only move orders through production stages.
 *
 * Out-of-scope records are reported as 404 (not 403) so IDs cannot be probed.
 * Always combine scopes with the route's own filters via scopedWhere() (AND), never spread,
 * so a query parameter can't widen the scope.
 */

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hasPermission, ASSIGNABLE_TAILOR_ROLES, type UserRole } from '@/lib/permissions'

export interface Actor {
  id: string
  role: UserRole
}

type SessionLike = { user?: { id?: string | null; role?: string | null } | null } | null | undefined

export function actorFromSession(session: SessionLike): Actor | null {
  const id = session?.user?.id
  const role = session?.user?.role as UserRole | undefined
  if (!id || !role) return null
  return { id, role }
}

export function canSeeAllOrders(actor: Actor): boolean {
  return hasPermission(actor.role, 'view_all_orders')
}

/** Orders the actor may see. */
export function orderScope(actor: Actor): Prisma.OrderWhereInput {
  if (canSeeAllOrders(actor)) return {}
  return { items: { some: { assignedTailorId: actor.id } } }
}

/** Order items whose parent order the actor may see. */
export function orderItemScope(actor: Actor): Prisma.OrderItemWhereInput {
  if (canSeeAllOrders(actor)) return {}
  return { order: orderScope(actor) }
}

/** Customers the actor may see. */
export function customerScope(actor: Actor): Prisma.CustomerWhereInput {
  if (canSeeAllOrders(actor)) return {}
  return { orders: { some: orderScope(actor) } }
}

/** Measurements the actor may see. */
export function measurementScope(actor: Actor): Prisma.MeasurementWhereInput {
  if (canSeeAllOrders(actor)) return {}
  return { customer: customerScope(actor) }
}

/** AND-combine a route's filter with the actor's scope so neither can widen the other. */
export function scopedWhere<T extends object>(where: T | undefined | null, scope: T): T {
  const hasWhere = !!where && Object.keys(where).length > 0
  const hasScope = Object.keys(scope).length > 0
  if (!hasWhere) return scope
  if (!hasScope) return where as T
  return { AND: [where, scope] } as unknown as T
}

export function notFound(what = 'Resource'): NextResponse {
  return NextResponse.json({ error: `${what} not found` }, { status: 404 })
}

export async function canAccessOrder(actor: Actor, orderId: string): Promise<boolean> {
  if (canSeeAllOrders(actor)) return true
  const count = await prisma.order.count({ where: { id: orderId, ...orderScope(actor) } })
  return count > 0
}

export async function canAccessCustomer(actor: Actor, customerId: string): Promise<boolean> {
  if (canSeeAllOrders(actor)) return true
  const count = await prisma.customer.count({ where: { id: customerId, ...customerScope(actor) } })
  return count > 0
}

/** Returns a 404 response when the actor can't reach the order, otherwise null. */
export async function requireOrderAccess(actor: Actor, orderId: string): Promise<NextResponse | null> {
  return (await canAccessOrder(actor, orderId)) ? null : notFound('Order')
}

/** Returns a 404 response when the actor can't reach the customer, otherwise null. */
export async function requireCustomerAccess(actor: Actor, customerId: string): Promise<NextResponse | null> {
  return (await canAccessCustomer(actor, customerId)) ? null : notFound('Customer')
}

// ── Order status transition policy ───────────────────────────────────────────

export const TERMINAL_ORDER_STATUSES = ['DELIVERED', 'CANCELLED'] as const
export const PRODUCTION_ORDER_STATUSES = [
  'NEW',
  'MATERIAL_SELECTED',
  'CUTTING',
  'STITCHING',
  'FINISHING',
  'READY',
] as const

export type TransitionCheck = { ok: true } | { ok: false; status: number; reason: string }

export function checkStatusTransition(actor: Actor, from: string, to: string): TransitionCheck {
  if (from === to) {
    return { ok: false, status: 400, reason: `Order is already ${to}` }
  }
  if ((TERMINAL_ORDER_STATUSES as readonly string[]).includes(from)) {
    return { ok: false, status: 400, reason: `A ${from.toLowerCase()} order cannot change status` }
  }
  if (
    (TERMINAL_ORDER_STATUSES as readonly string[]).includes(to) &&
    !hasPermission(actor.role, 'update_order')
  ) {
    return { ok: false, status: 403, reason: `Your role cannot mark orders as ${to.toLowerCase()}` }
  }
  return { ok: true }
}

/** Whether a user can receive production assignments. */
export function isAssignableTailor(user: { role: string; active: boolean } | null | undefined): boolean {
  return !!user && user.active && (ASSIGNABLE_TAILOR_ROLES as string[]).includes(user.role)
}
