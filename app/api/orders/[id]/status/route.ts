import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, checkStatusTransition, notFound, orderScope } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import {
  consumeAccessoryStock,
  consumeClothStock,
  releaseAccessoryReservation,
  releaseClothReservation,
  roundMeters,
} from '@/lib/stock'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
import { z } from 'zod'
import { OrderStatus } from '@/lib/types'

const statusUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  /** Total fabric measured for the whole order (split across items by their estimates) */
  actualMetersUsed: z.number().positive().nullish(),
  /** Total wastage for the whole order (split across items by their estimates) */
  wastage: z.number().nonnegative().nullish(),
  notes: z.string().max(5000).nullish(),
})

/** Thrown inside a transaction when another request changed the status first. */
class StatusConflictError extends Error {}

/**
 * Share an order-level measurement across its items in proportion to their estimated meters,
 * so a multi-item order is not charged the full amount once per item.
 */
function shareAcrossItems(items: { id: string; estimatedMeters: number }[], total: number): Map<string, number> {
  const estimated = items.reduce((sum, item) => sum + item.estimatedMeters, 0)
  return new Map(
    items.map((item) => [item.id, estimated > 0 ? (total * item.estimatedMeters) / estimated : total / items.length])
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order_status'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

  try {
    const { id } = await params
    const body = await request.json()
    const { status, actualMetersUsed, wastage, notes } = statusUpdateSchema.parse(body)

    // ABAC: tailors can only move orders that contain an item assigned to them
    const order = await prisma.order.findFirst({
      where: { id, ...orderScope(actor) },
      include: {
        items: {
          include: {
            clothInventory: true,
          },
        },
        accessoryStockMovements: {
          where: {
            type: 'ORDER_RESERVED',
          },
          include: {
            accessoryInventory: true,
          },
        },
      },
    })

    if (!order) {
      return notFound('Order')
    }

    // Terminal statuses (DELIVERED/CANCELLED) require update_order and can't be left again
    const transition = checkStatusTransition(actor, order.status, status)
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: transition.status })
    }

    // Order notes are customer-facing order details: only roles that can edit orders replace
    // them. A note sent with a status change by other roles (e.g. a tailor) goes into the history.
    const canEditNotes = hasPermission(actor.role, 'update_order')
    const historyNote = notes && !canEditNotes ? ` Note: ${notes}` : ''

    const measured = actualMetersUsed ? shareAcrossItems(order.items, actualMetersUsed) : null
    const reportedWastage = wastage ? shareAcrossItems(order.items, wastage) : null

    // Guarded status write: only succeeds if nobody changed the status since we read it,
    // so stock is never consumed/released twice by concurrent requests.
    const claimStatus = async (tx: TransactionClient, data: Record<string, unknown>) => {
      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status, ...(notes && canEditNotes ? { notes } : {}), ...data },
      })
      if (result.count === 0) throw new StatusConflictError()
    }

    const recordHistory = (tx: TransactionClient, description: string) =>
      tx.orderHistory.create({
        data: {
          orderId: order.id,
          userId: actor.id,
          changeType: 'STATUS_UPDATE',
          fieldName: 'status',
          oldValue: order.status,
          newValue: status,
          description: `${description}${historyNote}`,
        },
      })

    if (status === OrderStatus.DELIVERED) {
      // Delivery converts reserved stock into used stock
      await prisma.$transaction(async (tx: TransactionClient) => {
        await claimStatus(tx, { completedDate: new Date() })

        for (const item of order.items) {
          // Fabric consumed: this item's share of the measured total when provided (it already
          // includes wastage), otherwise the estimate plus its share of any reported wastage.
          const measuredMeters = measured?.get(item.id)
          const consumedMeters = measuredMeters ?? item.estimatedMeters + (reportedWastage?.get(item.id) ?? 0)
          const wastedMeters =
            measuredMeters !== undefined ? measuredMeters - item.estimatedMeters : reportedWastage?.get(item.id) ?? 0

          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              actualMetersUsed: roundMeters(consumedMeters),
              wastageMeters: roundMeters(wastedMeters),
            },
          })

          const levels = await consumeClothStock(tx, item.clothInventoryId, consumedMeters, item.estimatedMeters)

          await tx.stockMovement.create({
            data: {
              clothInventoryId: item.clothInventoryId,
              orderId: order.id,
              userId: actor.id,
              type: 'ORDER_USED',
              quantityMeters: -roundMeters(consumedMeters),
              balanceAfterMeters: levels?.currentStock ?? 0,
              notes: `Order ${order.orderNumber} delivered`,
            },
          })
        }

        // Consume reserved accessories (reserved → used)
        for (const movement of order.accessoryStockMovements) {
          const quantityReserved = Math.abs(movement.quantityUnits) // Movement is negative for reservation
          const levels = await consumeAccessoryStock(tx, movement.accessoryInventoryId, quantityReserved)

          await tx.accessoryStockMovement.create({
            data: {
              accessoryInventoryId: movement.accessoryInventoryId,
              orderId: order.id,
              userId: actor.id,
              type: 'ORDER_USED',
              quantityUnits: -quantityReserved, // Negative for consumption
              balanceAfterUnits: levels?.currentStock ?? 0,
              notes: `Order ${order.orderNumber} delivered - accessories consumed`,
            },
          })
        }

        await recordHistory(tx, `Status changed from ${order.status} to ${status}. Order delivered.`)
      })
    } else if (status === OrderStatus.CANCELLED) {
      // Cancellation releases reserved stock
      await prisma.$transaction(async (tx: TransactionClient) => {
        await claimStatus(tx, {})

        for (const item of order.items) {
          const levels = await releaseClothReservation(tx, item.clothInventoryId, item.estimatedMeters)
          await tx.stockMovement.create({
            data: {
              clothInventoryId: item.clothInventoryId,
              orderId: order.id,
              userId: actor.id,
              type: 'ORDER_CANCELLED',
              quantityMeters: roundMeters(item.estimatedMeters),
              balanceAfterMeters: levels?.currentStock ?? item.clothInventory.currentStock,
              notes: `Order ${order.orderNumber} cancelled - stock released`,
            },
          })
        }

        for (const movement of order.accessoryStockMovements) {
          const quantityReserved = Math.abs(movement.quantityUnits) // Movement is negative for reservation
          const levels = await releaseAccessoryReservation(tx, movement.accessoryInventoryId, quantityReserved)

          await tx.accessoryStockMovement.create({
            data: {
              accessoryInventoryId: movement.accessoryInventoryId,
              orderId: order.id,
              userId: actor.id,
              type: 'ORDER_CANCELLED',
              quantityUnits: quantityReserved, // Positive for release
              balanceAfterUnits: levels?.currentStock ?? movement.accessoryInventory.currentStock,
              notes: `Order ${order.orderNumber} cancelled - accessories released`,
            },
          })
        }

        await recordHistory(tx, `Status changed from ${order.status} to ${status}. Order cancelled and stock released.`)
      })
    } else {
      // Production stage change
      await prisma.$transaction(async (tx: TransactionClient) => {
        await claimStatus(tx, {})

        // actualMetersUsed is typically recorded when moving to CUTTING
        if (measured) {
          for (const item of order.items) {
            const itemMeters = measured.get(item.id) ?? item.estimatedMeters
            await tx.orderItem.update({
              where: { id: item.id },
              data: {
                actualMetersUsed: roundMeters(itemMeters),
                wastageMeters: roundMeters(itemMeters - item.estimatedMeters),
              },
            })
          }
        }

        const descriptionParts = [`Status changed from ${order.status} to ${status}`]
        if (actualMetersUsed !== null && actualMetersUsed !== undefined) {
          descriptionParts.push(`Actual meters used: ${actualMetersUsed}m`)
        }
        await recordHistory(tx, descriptionParts.join('. '))
      })
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            garmentPattern: true,
            clothInventory: true,
          },
        },
      },
    })

    // Send WhatsApp notification for READY status (non-blocking with after())
    if (status === OrderStatus.READY) {
      after(async () => {
        try {
          await whatsappService.sendOrderReady(id)
        } catch (error) {
          console.error('Failed to send WhatsApp notification:', error)
        }
      })
    }

    return NextResponse.json({ order: filterApiResponse(updatedOrder, actor.role, 'order') })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof StatusConflictError) {
      return NextResponse.json(
        { error: 'The order status was changed by someone else. Refresh and try again.' },
        { status: 409 }
      )
    }

    console.error('Error updating order status:', error)
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    )
  }
}
