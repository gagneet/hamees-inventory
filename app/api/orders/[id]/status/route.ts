import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { OrderStatus, StockMovementType } from '@/lib/types'

const statusUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  actualMetersUsed: z.number().positive().nullish(),
  wastage: z.number().nonnegative().nullish(),
  notes: z.string().nullish(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order_status'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { status, actualMetersUsed, wastage, notes } = statusUpdateSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            clothInventory: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Handle status-specific logic
    if (status === OrderStatus.DELIVERED && order.status !== OrderStatus.DELIVERED) {
      // When order is delivered, convert reserved stock to used stock
      // @ts-ignore
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          const metersUsed = actualMetersUsed || item.estimatedMeters
          const wastedMeters = wastage || 0

          // Update order item
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              actualMetersUsed: metersUsed,
              wastage: wastedMeters,
            },
          })

          // Update inventory: decrease current stock and reserved
          await tx.clothInventory.update({
            where: { id: item.clothInventoryId },
            data: {
              currentStock: {
                decrement: metersUsed + wastedMeters,
              },
              reserved: {
                decrement: item.estimatedMeters,
              },
            },
          })

          // Create stock movement for used fabric
          await tx.stockMovement.create({
            data: {
              clothInventoryId: item.clothInventoryId,
              orderId: order.id,
              userId: session.user.id,
              type: StockMovementType.ORDER_USED,
              quantity: -(metersUsed + wastedMeters),
              balanceAfter: item.clothInventory!.currentStock - (metersUsed + wastedMeters),
              notes: `Order ${order.orderNumber} delivered`,
            },
          })
        }

        // Update order status and set completedDate
        await tx.order.update({
          where: { id },
          data: {
            status,
            completedDate: new Date(),
            notes: notes || order.notes,
          },
        })

        // Create audit history record
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            userId: session.user.id,
            changeType: 'STATUS_UPDATE',
            fieldName: 'status',
            oldValue: order.status,
            newValue: status,
            description: `Status changed from ${order.status} to ${status}. Order delivered.`,
          },
        })
      })
    } else if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      // When order is cancelled, release reserved stock
        // @ts-ignore
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          // Update inventory: decrease reserved
          await tx.clothInventory.update({
            where: { id: item.clothInventoryId },
            data: {
              reserved: {
                decrement: item.estimatedMeters,
              },
            },
          })

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              clothInventoryId: item.clothInventoryId,
              orderId: order.id,
              userId: session.user.id,
              type: StockMovementType.ORDER_CANCELLED,
              quantity: item.estimatedMeters,
              balanceAfter: item.clothInventory!.currentStock,
              notes: `Order ${order.orderNumber} cancelled - stock released`,
            },
          })
        }

        // Update order status
        await tx.order.update({
          where: { id },
          data: {
            status,
            notes: notes || order.notes,
          },
        })

        // Create audit history record
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            userId: session.user.id,
            changeType: 'STATUS_UPDATE',
            fieldName: 'status',
            oldValue: order.status,
            newValue: status,
            description: `Status changed from ${order.status} to ${status}. Order cancelled and stock released.`,
          },
        })
      })
    } else {
      // Simple status update
        // @ts-ignore
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            status,
            notes: notes || order.notes,
          },
        })

        // Create audit history record
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            userId: session.user.id,
            changeType: 'STATUS_UPDATE',
            fieldName: 'status',
            oldValue: order.status,
            newValue: status,
            description: `Status changed from ${order.status} to ${status}`,
          },
        })
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

    return NextResponse.json({ order: updatedOrder })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating order status:', error)
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    )
  }
}
