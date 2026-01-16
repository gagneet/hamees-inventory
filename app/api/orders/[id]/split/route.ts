import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { generateOrderNumber } from '@/lib/utils'

const splitOrderSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'At least one item must be selected'),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order'])
  if (error) return error

  const { id } = await params

  try {
    const body = await request.json()
    const validatedData = splitOrderSchema.parse(body)
    const { itemIds, deliveryDate, notes } = validatedData

    // Fetch the original order with all items
    const originalOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            garmentPattern: true,
            clothInventory: true,
          },
        },
        customer: true,
      },
    })

    if (!originalOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate that order can be split
    if (originalOrder.items.length <= 1) {
      return NextResponse.json(
        { error: 'Order must have at least 2 items to split' },
        { status: 400 }
      )
    }

    // Validate that we're not trying to split all items
    if (itemIds.length >= originalOrder.items.length) {
      return NextResponse.json(
        { error: 'Cannot split all items - at least one item must remain in original order' },
        { status: 400 }
      )
    }

    // Validate that all itemIds exist in the order
    const itemsToSplit = originalOrder.items.filter(item => itemIds.includes(item.id))
    if (itemsToSplit.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'Some items not found in this order' },
        { status: 400 }
      )
    }

    // Cannot split if order is already delivered or cancelled
    if (originalOrder.status === 'DELIVERED' || originalOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `Cannot split ${originalOrder.status.toLowerCase()} orders` },
        { status: 400 }
      )
    }

    // Calculate new totals
    const splitItemsTotal = itemsToSplit.reduce((sum, item) => sum + item.totalPrice, 0)

    const remainingItems = originalOrder.items.filter(item => !itemIds.includes(item.id))
    const remainingItemsTotal = remainingItems.reduce((sum, item) => sum + item.totalPrice, 0)

    // Calculate GST (12% = 6% CGST + 6% SGST)
    const splitSubTotal = parseFloat(splitItemsTotal.toFixed(2))
    const splitGstAmount = parseFloat((splitSubTotal * 0.12).toFixed(2))
    const splitTotalAmount = parseFloat((splitSubTotal + splitGstAmount).toFixed(2))

    const remainingSubTotal = parseFloat(remainingItemsTotal.toFixed(2))
    const remainingGstAmount = parseFloat((remainingSubTotal * 0.12).toFixed(2))
    const remainingTotalAmount = parseFloat((remainingSubTotal + remainingGstAmount).toFixed(2))

    // Calculate advance payment split (proportional to total amounts)
    const advanceRatio = originalOrder.advancePaid / originalOrder.totalAmount
    const splitAdvance = parseFloat((splitTotalAmount * advanceRatio).toFixed(2))
    const remainingAdvance = parseFloat((originalOrder.advancePaid - splitAdvance).toFixed(2))

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create new order with split items
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: originalOrder.customerId,
          userId: session.user.id,
          measurementId: originalOrder.measurementId,
          status: originalOrder.status, // Same status as original
          priority: originalOrder.priority,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : originalOrder.deliveryDate,
          totalAmount: splitTotalAmount,
          subTotal: splitSubTotal,
          gstRate: 12,
          gstAmount: splitGstAmount,
          cgst: parseFloat((splitGstAmount / 2).toFixed(2)),
          sgst: parseFloat((splitGstAmount / 2).toFixed(2)),
          igst: 0,
          taxableAmount: splitSubTotal,
          advancePaid: splitAdvance,
          balanceAmount: parseFloat((splitTotalAmount - splitAdvance - (originalOrder.discount || 0) * (splitTotalAmount / originalOrder.totalAmount)).toFixed(2)),
          discount: parseFloat(((originalOrder.discount || 0) * (splitTotalAmount / originalOrder.totalAmount)).toFixed(2)),
          discountReason: originalOrder.discountReason,
          notes: notes || `Split from order ${originalOrder.orderNumber}`,
        },
      })

      // Move items to new order
      for (const item of itemsToSplit) {
        // Create new item in new order
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            garmentPatternId: item.garmentPatternId,
            clothInventoryId: item.clothInventoryId,
            measurementId: item.measurementId,
            quantity: item.quantity,
            bodyType: item.bodyType,
            estimatedMeters: item.estimatedMeters,
            actualMetersUsed: item.actualMetersUsed,
            wastage: item.wastage,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.totalPrice,
            notes: item.notes,
          },
        })

        // Delete original item
        await tx.orderItem.delete({
          where: { id: item.id },
        })
      }

      // Update original order totals
      await tx.order.update({
        where: { id },
        data: {
          totalAmount: remainingTotalAmount,
          subTotal: remainingSubTotal,
          gstAmount: remainingGstAmount,
          cgst: parseFloat((remainingGstAmount / 2).toFixed(2)),
          sgst: parseFloat((remainingGstAmount / 2).toFixed(2)),
          taxableAmount: remainingSubTotal,
          advancePaid: remainingAdvance,
          balanceAmount: parseFloat((remainingTotalAmount - remainingAdvance - (originalOrder.discount || 0) * (remainingTotalAmount / originalOrder.totalAmount)).toFixed(2)),
          discount: parseFloat(((originalOrder.discount || 0) * (remainingTotalAmount / originalOrder.totalAmount)).toFixed(2)),
        },
      })

      // Create order history for original order
      await tx.orderHistory.create({
        data: {
          orderId: id,
          userId: session.user.id,
          changeType: 'ORDER_SPLIT',
          description: `Split ${itemIds.length} item(s) to new order ${newOrder.orderNumber}`,
        },
      })

      // Create order history for new order
      await tx.orderHistory.create({
        data: {
          orderId: newOrder.id,
          userId: session.user.id,
          changeType: 'ORDER_CREATED',
          description: `Created from split of order ${originalOrder.orderNumber}`,
        },
      })

      return { newOrder, originalOrder: await tx.order.findUnique({ where: { id } }) }
    })

    return NextResponse.json({
      success: true,
      message: `Order split successfully. New order: ${result.newOrder.orderNumber}`,
      newOrder: result.newOrder,
      originalOrder: result.originalOrder,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error splitting order:', error)
    return NextResponse.json(
      { error: 'Failed to split order' },
      { status: 500 }
    )
  }
}
