import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { whatsappService } from '@/lib/whatsapp/whatsapp-service'
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
            garmentPattern: {
              include: {
                accessories: {
                  include: {
                    accessory: true,
                  },
                },
              },
            },
          },
        },
        accessoryStockMovements: {
          where: {
            type: StockMovementType.ORDER_RESERVED,
          },
          include: {
            accessoryInventory: true,
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
      await prisma.$transaction(async (tx: any) => {
        // Batch update order items - prepare all updates
        const orderItemUpdates = order.items.map((item: any) => {
          const metersUsed = actualMetersUsed || item.estimatedMeters
          // Auto-calculate wastage: if actualMetersUsed is provided, calculate difference
          // Otherwise use provided wastage value or default to 0
          const wastedMeters = actualMetersUsed
            ? (actualMetersUsed - item.estimatedMeters)
            : (wastage || 0)
          return tx.orderItem.update({
            where: { id: item.id },
            data: {
              actualMetersUsed: metersUsed,
              wastage: wastedMeters,
            },
          })
        })

        // Batch update cloth inventory - prepare all updates
        const clothInventoryUpdates = order.items.map((item: any) => {
          const metersUsed = actualMetersUsed || item.estimatedMeters
          // Auto-calculate wastage: if actualMetersUsed is provided, calculate difference
          const wastedMeters = actualMetersUsed
            ? (actualMetersUsed - item.estimatedMeters)
            : (wastage || 0)
          return tx.clothInventory.update({
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
        })

        // Batch create stock movements - prepare all creates
        const stockMovementCreates = order.items.map((item: any) => {
          const metersUsed = actualMetersUsed || item.estimatedMeters
          // Auto-calculate wastage: if actualMetersUsed is provided, calculate difference
          const wastedMeters = actualMetersUsed
            ? (actualMetersUsed - item.estimatedMeters)
            : (wastage || 0)
          return tx.stockMovement.create({
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
        })

        // Execute all operations in parallel within transaction
        await Promise.all([
          ...orderItemUpdates,
          ...clothInventoryUpdates,
          ...stockMovementCreates,
        ])

        // Consume reserved accessories (convert reserved → used)
        for (const movement of order.accessoryStockMovements) {
          const quantityReserved = Math.abs(movement.quantityUnits) // Movement is negative for reservation

          // Update accessory inventory: decrement both currentStock and reserved
          await tx.accessoryInventory.update({
            where: { id: movement.accessoryInventoryId },
            data: {
              currentStock: {
                decrement: quantityReserved,
              },
              reserved: {
                decrement: quantityReserved,
              },
            },
          })

          // Create ORDER_USED movement
          await tx.accessoryStockMovement.create({
            data: {
              accessoryInventoryId: movement.accessoryInventoryId,
              orderId: order.id,
              userId: session.user.id,
              type: StockMovementType.ORDER_USED,
              quantity: -quantityReserved, // Negative for consumption
              balanceAfter: movement.accessoryInventory!.currentStock - quantityReserved,
              notes: `Order ${order.orderNumber} delivered - accessories consumed`,
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
      await prisma.$transaction(async (tx: any) => {
        // Batch update cloth inventory - prepare all updates
        const clothInventoryUpdates = order.items.map((item: any) =>
          tx.clothInventory.update({
            where: { id: item.clothInventoryId },
            data: {
              reserved: {
                decrement: item.estimatedMeters,
              },
            },
          })
        )

        // Batch create stock movements - prepare all creates
        const stockMovementCreates = order.items.map((item: any) =>
          tx.stockMovement.create({
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
        )

        // Execute all operations in parallel within transaction
        await Promise.all([
          ...clothInventoryUpdates,
          ...stockMovementCreates,
        ])

        // Release reserved accessories
        for (const movement of order.accessoryStockMovements) {
          const quantityReserved = Math.abs(movement.quantityUnits) // Movement is negative for reservation

          // Update accessory inventory: only decrement reserved (stock remains)
          await tx.accessoryInventory.update({
            where: { id: movement.accessoryInventoryId },
            data: {
              reserved: {
                decrement: quantityReserved,
              },
            },
          })

          // Create ORDER_CANCELLED movement
          await tx.accessoryStockMovement.create({
            data: {
              accessoryInventoryId: movement.accessoryInventoryId,
              orderId: order.id,
              userId: session.user.id,
              type: StockMovementType.ORDER_CANCELLED,
              quantity: quantityReserved, // Positive for release
              balanceAfter: movement.accessoryInventory!.currentStock,
              notes: `Order ${order.orderNumber} cancelled - accessories released`,
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
      await prisma.$transaction(async (tx: any) => {
        // If actualMetersUsed is provided, update all order items
        // This typically happens when status changes to CUTTING
        if (actualMetersUsed !== null && actualMetersUsed !== undefined) {
          const orderItemUpdates = order.items.map((item: any) => {
            // Auto-calculate wastage based on the difference
            const calculatedWastage = actualMetersUsed - item.estimatedMeters
            return tx.orderItem.update({
              where: { id: item.id },
              data: {
                actualMetersUsed: actualMetersUsed,
                wastage: calculatedWastage,
              },
            })
          })
          await Promise.all(orderItemUpdates)
        }

        await tx.order.update({
          where: { id },
          data: {
            status,
            notes: notes || order.notes,
          },
        })

        // Create audit history record
        const descriptionParts = [`Status changed from ${order.status} to ${status}`]
        if (actualMetersUsed !== null && actualMetersUsed !== undefined) {
          descriptionParts.push(`Actual meters used: ${actualMetersUsed}m`)
        }

        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            userId: session.user.id,
            changeType: 'STATUS_UPDATE',
            fieldName: 'status',
            oldValue: order.status,
            newValue: status,
            description: descriptionParts.join('. '),
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

    // Send WhatsApp notification for READY status (non-blocking with after())
    if (status === OrderStatus.READY && order.status !== OrderStatus.READY) {
      after(async () => {
        try {
          await whatsappService.sendOrderReady(id)
          console.log(`✅ WhatsApp notification sent for order ${order.orderNumber}`)
        } catch (error) {
          console.error('Failed to send WhatsApp notification:', error)
        }
      })
    }

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
