import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, canSeeAllOrders, notFound, orderScope } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { lockOrder } from '@/lib/order-finance'
import { roundMeters } from '@/lib/stock'
import { checkItemStatusTransition, isTerminalStatus, STAGE_LABELS, syncOrderStatus } from '@/lib/item-status'
import type { TransactionClient } from '@/lib/prisma-client'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { z } from 'zod'
import { OrderStatus } from '@/lib/types'

const itemStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  /** Fabric measured for this item (e.g. when it is cut) */
  actualMetersUsed: z.number().positive().nullish(),
  notes: z.string().max(5000).nullish(),
})

/** Another request moved the item (or closed the order) after we read it. */
class StatusConflictError extends Error {}

/**
 * PATCH /api/orders/[id]/items/[itemId]/status — move one garment through production.
 *
 * Authorization: update_order_status, the order must be in the actor's scope, and a scoped role
 * (TAILOR) may only move items assigned to them — anything else is a 404. Transition rules are
 * in lib/item-status.ts. The order's status is then re-derived from its items (least advanced
 * stage); when that makes the order READY the customer is notified.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order_status'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id, itemId } = await params
    const { status, actualMetersUsed, notes } = itemStatusSchema.parse(await request.json())

    const order = await prisma.order.findFirst({
      where: { id, ...orderScope(actor) },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: {
          select: {
            id: true,
            status: true,
            assignedTailorId: true,
            estimatedMeters: true,
            garmentPattern: { select: { name: true } },
          },
        },
      },
    })
    if (!order) return notFound('Order')

    // A tailor can reach an order through one of their items, but not their colleagues' items
    const item = order.items.find((i) => i.id === itemId)
    if (!item || (!canSeeAllOrders(actor) && item.assignedTailorId !== actor.id)) {
      return notFound('Order item')
    }

    const transition = checkItemStatusTransition(actor, item, status, order.status)
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: transition.status })
    }

    // Item notes are order details: roles that can edit orders replace them; anyone else's
    // note is kept in the history instead
    const canEditNotes = hasPermission(actor.role, 'update_order')
    const garment = item.garmentPattern.name
    const meters = actualMetersUsed ?? null

    const sync = await prisma.$transaction(async (tx: TransactionClient) => {
      await lockOrder(tx, id)
      const locked = await tx.order.findUnique({ where: { id }, select: { status: true } })
      if (!locked || isTerminalStatus(locked.status)) throw new StatusConflictError()

      // Guarded write: only if nobody moved this item since we read it
      const claimed = await tx.orderItem.updateMany({
        where: { id: itemId, orderId: id, status: item.status },
        data: {
          status,
          statusUpdatedAt: new Date(),
          ...(meters !== null
            ? { actualMetersUsed: roundMeters(meters), wastageMeters: roundMeters(meters - item.estimatedMeters) }
            : {}),
          ...(notes && canEditNotes ? { notes } : {}),
        },
      })
      if (claimed.count === 0) throw new StatusConflictError()

      const parts = [`${garment} moved from ${STAGE_LABELS[item.status] ?? item.status} to ${STAGE_LABELS[status] ?? status}`]
      if (meters !== null) parts.push(`Actual meters used: ${roundMeters(meters)}m`)
      if (notes && !canEditNotes) parts.push(`Note: ${notes}`)

      await tx.orderHistory.create({
        data: {
          orderId: id,
          orderItemId: itemId,
          userId: actor.id,
          changeType: 'ITEM_STATUS_UPDATE',
          fieldName: 'status',
          oldValue: item.status,
          newValue: status,
          description: parts.join('. '),
        },
      })

      return syncOrderStatus(tx, id, actor.id, `${garment} moved to ${STAGE_LABELS[status] ?? status}`)
    })

    if (sync?.changed && sync.to === 'READY') {
      after(async () => {
        try {
          await whatsappService.sendOrderReady(id)
        } catch (err) {
          console.error('Failed to send WhatsApp notification:', err)
        }
      })
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { garmentPattern: true, clothInventory: true } },
      },
    })

    return NextResponse.json({
      order: filterApiResponse(updatedOrder, actor.role, 'order'),
      item: { id: itemId, status },
      orderStatus: sync?.to ?? order.status,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    if (error instanceof StatusConflictError) {
      return NextResponse.json(
        { error: 'This item was updated by someone else. Refresh and try again.' },
        { status: 409 }
      )
    }
    console.error('Error updating item status:', error)
    return NextResponse.json({ error: 'Failed to update item status' }, { status: 500 })
  }
}
