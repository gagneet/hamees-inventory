/**
 * Validation for bulk tailor assignment (POST /api/production/assign).
 * Pure functions so the rules are unit-testable without a database.
 */

import { z } from 'zod'
import { isAssignableTailor, TERMINAL_ORDER_STATUSES } from '@/lib/authz'

export const MAX_ASSIGN_ITEMS = 100

export const assignRequestSchema = z.object({
  orderItemIds: z
    .array(z.string().trim().min(1).max(64))
    .min(1, 'Select at least one item')
    .max(MAX_ASSIGN_ITEMS, `At most ${MAX_ASSIGN_ITEMS} items can be assigned at once`)
    .transform((ids) => [...new Set(ids)]),
  /** Target tailor, or null to unassign. */
  tailorId: z.string().trim().min(1).max(64).nullable(),
})

export type AssignRequest = z.infer<typeof assignRequestSchema>

export type AssignCandidateItem = {
  id: string
  orderId: string
  assignedTailorId: string | null
  order: { orderNumber: string; status: string }
}

export type AssignCheck = { ok: true } | { ok: false; status: number; error: string }

export function checkAssignTarget(
  tailorId: string | null,
  tailor: { role: string; active: boolean } | null | undefined
): AssignCheck {
  if (tailorId === null) return { ok: true }
  if (!isAssignableTailor(tailor)) {
    return { ok: false, status: 400, error: 'Selected user is not an active tailor or master tailor' }
  }
  return { ok: true }
}

export function checkAssignItems(requestedIds: string[], items: AssignCandidateItem[]): AssignCheck {
  const found = new Set(items.map((i) => i.id))
  if (requestedIds.some((id) => !found.has(id))) {
    return { ok: false, status: 404, error: 'One or more order items were not found' }
  }
  const closed = items.find((i) => (TERMINAL_ORDER_STATUSES as readonly string[]).includes(i.order.status))
  if (closed) {
    return {
      ok: false,
      status: 400,
      error: `Order ${closed.order.orderNumber} is ${closed.order.status.toLowerCase()}; its items cannot be reassigned`,
    }
  }
  return { ok: true }
}
