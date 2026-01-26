import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const updateOrderItemSchema = z.object({
  garmentPatternId: z.string().optional(),
  clothInventoryId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  assignedTailorId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update orders OR update order status
    // (assigning tailor is a workflow operation allowed for order status managers)
    const canUpdate = hasPermission(session.user.role as UserRole, 'update_order') ||
                      hasPermission(session.user.role as UserRole, 'update_order_status')

    if (!canUpdate) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: orderId, itemId } = await context.params
    const body = await request.json()

    // Validate request body
    const validatedData = updateOrderItemSchema.parse(body)

    // Check if order item exists and belongs to the order
    const existingItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId: orderId,
      },
      include: {
        order: true,
        garmentPattern: true,
        clothInventory: true,
      },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      )
    }

    // Don't allow editing delivered or cancelled orders
    if (existingItem.order.status === 'DELIVERED' || existingItem.order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot edit items for delivered or cancelled orders' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    let fabricChanged = false
    let garmentChanged = false
    const oldClothInventoryId = existingItem.clothInventoryId
    let newEstimatedMeters = existingItem.estimatedMeters
    let needsPriceRecalculation = false

    // If garment pattern is changing, recalculate fabric requirement
    if (validatedData.garmentPatternId && validatedData.garmentPatternId !== existingItem.garmentPatternId) {
      // IMPORTANT: Garment pattern changes are now disabled in UI
      // This code is kept for backwards compatibility but should not be used
      const newGarmentPattern = await prisma.garmentPattern.findUnique({
        where: { id: validatedData.garmentPatternId },
      })

      if (!newGarmentPattern) {
        return NextResponse.json(
          { error: 'Invalid garment pattern' },
          { status: 400 }
        )
      }

      // Recalculate estimated meters based on body type
      const bodyTypeAdjustments = {
        SLIM: newGarmentPattern.slimAdjustment,
        REGULAR: newGarmentPattern.regularAdjustment,
        LARGE: newGarmentPattern.largeAdjustment,
        XL: newGarmentPattern.xlAdjustment,
      }

      newEstimatedMeters = newGarmentPattern.baseMeters + bodyTypeAdjustments[existingItem.bodyType]
      updateData.garmentPatternId = validatedData.garmentPatternId
      updateData.estimatedMeters = newEstimatedMeters
      garmentChanged = true
      needsPriceRecalculation = true
    }

    let newClothInventory: { pricePerMeter: number } | null = null

    // If cloth inventory is changing, validate it exists and recalculate pricing
    if (validatedData.clothInventoryId && validatedData.clothInventoryId !== existingItem.clothInventoryId) {
      newClothInventory = await prisma.clothInventory.findUnique({
        where: { id: validatedData.clothInventoryId },
      })

      if (!newClothInventory) {
        return NextResponse.json(
          { error: 'Invalid cloth inventory' },
          { status: 400 }
        )
      }

      updateData.clothInventoryId = validatedData.clothInventoryId
      fabricChanged = true
      needsPriceRecalculation = true

      // Calculate new fabric cost
      const newFabricCost = newEstimatedMeters * newClothInventory.pricePerMeter * existingItem.quantityOrdered

      // Keep accessories cost the same (unless garment changed)
      // For fabric-only changes, we reuse the existing accessories
      const existingAccessoriesCost = existingItem.totalPrice - (existingItem.estimatedMeters * existingItem.clothInventory.pricePerMeter * existingItem.quantityOrdered)

      // Calculate new total price for this order item
      const newTotalPrice = newFabricCost + existingAccessoriesCost
      const newPricePerUnit = newTotalPrice / existingItem.quantityOrdered

      updateData.totalPrice = parseFloat(newTotalPrice.toFixed(2))
      updateData.pricePerUnit = parseFloat(newPricePerUnit.toFixed(2))
    }

    // If quantity is changing
    if (validatedData.quantity !== undefined) {
      updateData.quantityOrdered = validatedData.quantity
    }

    // If notes are changing
    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes
    }

    // If assigned tailor is changing
    if (validatedData.assignedTailorId !== undefined) {
      // Validate tailor exists if provided
      if (validatedData.assignedTailorId) {
        const tailor = await prisma.user.findUnique({
          where: { id: validatedData.assignedTailorId },
        })

        if (!tailor) {
          return NextResponse.json(
            { error: 'Invalid tailor assignment' },
            { status: 400 }
          )
        }

        // Optionally validate that user is actually a TAILOR role
        if (tailor.role !== 'TAILOR') {
          return NextResponse.json(
            { error: 'Assigned user must have TAILOR role' },
            { status: 400 }
          )
        }
      }

      updateData.assignedTailorId = validatedData.assignedTailorId
    }

    // Update the order item using a transaction
    const updatedItem = await prisma.$transaction(async (tx: TransactionClient) => {
      // If fabric is changing, update stock reservations
      if (fabricChanged) {
        const oldCloth = await tx.clothInventory.findUnique({
          where: { id: oldClothInventoryId },
        })

        const newCloth = await tx.clothInventory.findUnique({
          where: { id: validatedData.clothInventoryId! },
        })

        if (oldCloth && newCloth) {
          // Release reservation from old cloth
          await tx.clothInventory.update({
            where: { id: oldClothInventoryId },
            data: {
              reserved: {
                decrement: existingItem.estimatedMeters * existingItem.quantityOrdered,
              },
            },
          })

          // Add reservation to new cloth
          const estimatedMeters = (updateData.estimatedMeters as number | undefined) ?? existingItem.estimatedMeters
          const quantityOrdered = (updateData.quantityOrdered as number | undefined) ?? existingItem.quantityOrdered
          const metersToReserve = estimatedMeters * quantityOrdered

          await tx.clothInventory.update({
            where: { id: validatedData.clothInventoryId! },
            data: {
              reserved: {
                increment: metersToReserve,
              },
            },
          })

          // Create stock movement records
          await tx.stockMovement.create({
            data: {
              type: 'ORDER_CANCELLED',
              quantityMeters: -(existingItem.estimatedMeters * existingItem.quantityOrdered),
              balanceAfterMeters: oldCloth.currentStock,
              clothInventoryId: oldClothInventoryId,
              orderId: orderId,
              userId: session.user.id,
            },
          })

          await tx.stockMovement.create({
            data: {
              type: 'ORDER_RESERVED',
              quantityMeters: metersToReserve,
              balanceAfterMeters: newCloth.currentStock - metersToReserve,
              clothInventoryId: validatedData.clothInventoryId!,
              orderId: orderId,
              userId: session.user.id,
            },
          })
        }
      }

      // Update the order item
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          garmentPattern: true,
          clothInventory: true,
          assignedTailor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Recalculate order totals if price changed
      if (needsPriceRecalculation) {
        // Get all order items to recalculate total
        const allOrderItems = await tx.orderItem.findMany({
          where: { orderId: orderId },
        })

        // Calculate new subtotal (sum of all item prices)
        const newSubTotal = allOrderItems.reduce((sum, item) => sum + item.totalPrice, 0)

        // Get current order to preserve stitching charges, premiums, etc.
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
        })

        if (currentOrder) {
          // Recalculate GST (12% on subtotal)
          const gstRate = 12
          const newGstAmount = (newSubTotal * gstRate) / 100
          const newCgst = newGstAmount / 2
          const newSgst = newGstAmount / 2

          // Calculate new total (subtotal + GST)
          const newTotalAmount = newSubTotal + newGstAmount

          // Recalculate balance using paid installments (advance is included there)
          const paidInstallments = await tx.paymentInstallment.aggregate({
            where: {
              orderId: orderId,
              status: 'PAID',
            },
            _sum: {
              paidAmount: true,
            },
          })
          const totalPaidInstallments = paidInstallments._sum.paidAmount || 0
          const newBalanceAmount = newTotalAmount - currentOrder.discount - totalPaidInstallments

          // Update order with new calculated values
          await tx.order.update({
            where: { id: orderId },
            data: {
              subTotal: parseFloat(newSubTotal.toFixed(2)),
              gstAmount: parseFloat(newGstAmount.toFixed(2)),
              cgst: parseFloat(newCgst.toFixed(2)),
              sgst: parseFloat(newSgst.toFixed(2)),
              totalAmount: parseFloat(newTotalAmount.toFixed(2)),
              balanceAmount: parseFloat(newBalanceAmount.toFixed(2)),
              taxableAmount: parseFloat(newSubTotal.toFixed(2)),
            },
          })
        }
      }

      // Create order history entry
      const changeDescription = []
      if (garmentChanged) {
        changeDescription.push(`Garment changed from ${existingItem.garmentPattern.name} to ${updated.garmentPattern.name}`)
      }
      if (fabricChanged) {
        changeDescription.push(
          `Fabric changed from ${existingItem.clothInventory.name} (${existingItem.clothInventory.color}) to ${updated.clothInventory.name} (${updated.clothInventory.color})`
        )
      }
      if (needsPriceRecalculation) {
        changeDescription.push(`Order item price updated from ₹${existingItem.totalPrice.toFixed(2)} to ₹${updated.totalPrice.toFixed(2)}`)
      }

      if (changeDescription.length > 0) {
        await tx.orderHistory.create({
          data: {
            orderId: orderId,
            userId: session.user.id,
            changeType: 'ITEM_UPDATED',
            description: changeDescription.join('; '),
          },
        })
      }

      return updated
    })

    // Fetch updated order with all items to return complete info
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            garmentPattern: true,
            clothInventory: true,
          },
        },
      },
    })

    return NextResponse.json({
      updatedOrderItem: updatedItem,
      updatedOrder: updatedOrder,
      message: 'Order item updated successfully. Order totals have been recalculated.',
    })
  } catch (error) {
    console.error('Error updating order item:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update order item' },
      { status: 500 }
    )
  }
}
