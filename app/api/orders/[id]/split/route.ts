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
    const itemsToSplit = originalOrder.items.filter((item: any) => itemIds.includes(item.id))
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

    // Calculate new totals - PROPORTIONAL SPLIT of ALL order costs
    // Item totals (fabric + accessories only)
    const splitItemsTotal = itemsToSplit.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
    const remainingItems = originalOrder.items.filter((item: any) => !itemIds.includes(item.id))
    const remainingItemsTotal = remainingItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
    const originalItemsTotal = splitItemsTotal + remainingItemsTotal

    // Calculate proportions based on item totals (fabric + accessories)
    const splitProportion = originalItemsTotal > 0 ? splitItemsTotal / originalItemsTotal : 0.5
    const remainingProportion = 1 - splitProportion

    // Proportionally distribute ALL order-level costs
    const splitFabricCost = parseFloat((originalOrder.fabricCost * splitProportion).toFixed(2))
    const remainingFabricCost = parseFloat((originalOrder.fabricCost - splitFabricCost).toFixed(2))

    const splitFabricWastage = parseFloat((originalOrder.fabricWastageAmount * splitProportion).toFixed(2))
    const remainingFabricWastage = parseFloat((originalOrder.fabricWastageAmount - splitFabricWastage).toFixed(2))

    const splitAccessoriesCost = parseFloat((originalOrder.accessoriesCost * splitProportion).toFixed(2))
    const remainingAccessoriesCost = parseFloat((originalOrder.accessoriesCost - splitAccessoriesCost).toFixed(2))

    const splitStitchingCost = parseFloat((originalOrder.stitchingCost * splitProportion).toFixed(2))
    const remainingStitchingCost = parseFloat((originalOrder.stitchingCost - splitStitchingCost).toFixed(2))

    const splitWorkmanshipPremiums = parseFloat((originalOrder.workmanshipPremiums * splitProportion).toFixed(2))
    const remainingWorkmanshipPremiums = parseFloat((originalOrder.workmanshipPremiums - splitWorkmanshipPremiums).toFixed(2))

    const splitDesignerFee = parseFloat((originalOrder.designerConsultationFee * splitProportion).toFixed(2))
    const remainingDesignerFee = parseFloat((originalOrder.designerConsultationFee - splitDesignerFee).toFixed(2))

    // Calculate subtotals (before GST)
    const splitSubTotal = parseFloat((
      splitFabricCost +
      splitFabricWastage +
      splitAccessoriesCost +
      splitStitchingCost +
      splitWorkmanshipPremiums +
      splitDesignerFee
    ).toFixed(2))

    const remainingSubTotal = parseFloat((
      remainingFabricCost +
      remainingFabricWastage +
      remainingAccessoriesCost +
      remainingStitchingCost +
      remainingWorkmanshipPremiums +
      remainingDesignerFee
    ).toFixed(2))

    // Calculate GST (12% = 6% CGST + 6% SGST)
    const splitGstAmount = parseFloat((splitSubTotal * 0.12).toFixed(2))
    const splitTotalAmount = parseFloat((splitSubTotal + splitGstAmount).toFixed(2))

    const remainingGstAmount = parseFloat((remainingSubTotal * 0.12).toFixed(2))
    const remainingTotalAmount = parseFloat((remainingSubTotal + remainingGstAmount).toFixed(2))

    // Calculate advance payment split (proportional to total amounts)
    const advanceRatio = originalOrder.advancePaid / originalOrder.totalAmount
    const splitAdvance = parseFloat((splitTotalAmount * advanceRatio).toFixed(2))
    const remainingAdvance = parseFloat((originalOrder.advancePaid - splitAdvance).toFixed(2))

    // Start transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create new order with split items (with complete cost breakdown)
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: originalOrder.customerId,
          userId: session.user.id,
          measurementId: originalOrder.measurementId,
          status: originalOrder.status, // Same status as original
          priority: originalOrder.priority,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : originalOrder.deliveryDate,

          // Complete itemized cost breakdown
          fabricCost: splitFabricCost,
          fabricWastagePercent: originalOrder.fabricWastagePercent,
          fabricWastageAmount: splitFabricWastage,
          accessoriesCost: splitAccessoriesCost,
          stitchingCost: splitStitchingCost,
          stitchingTier: originalOrder.stitchingTier,
          workmanshipPremiums: splitWorkmanshipPremiums,
          designerConsultationFee: splitDesignerFee,

          // Workmanship premium flags (proportional split)
          isHandStitched: originalOrder.isHandStitched,
          handStitchingCost: parseFloat((originalOrder.handStitchingCost * splitProportion).toFixed(2)),
          isFullCanvas: originalOrder.isFullCanvas,
          fullCanvasCost: parseFloat((originalOrder.fullCanvasCost * splitProportion).toFixed(2)),
          isRushOrder: originalOrder.isRushOrder,
          rushOrderCost: parseFloat((originalOrder.rushOrderCost * splitProportion).toFixed(2)),
          hasComplexDesign: originalOrder.hasComplexDesign,
          complexDesignCost: parseFloat((originalOrder.complexDesignCost * splitProportion).toFixed(2)),
          additionalFittings: Math.floor(originalOrder.additionalFittings * splitProportion),
          additionalFittingsCost: parseFloat((originalOrder.additionalFittingsCost * splitProportion).toFixed(2)),
          hasPremiumLining: originalOrder.hasPremiumLining,
          premiumLiningCost: parseFloat((originalOrder.premiumLiningCost * splitProportion).toFixed(2)),

          // Totals and GST
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
            quantity: item.quantityOrdered,
            bodyType: item.bodyType,
            estimatedMeters: item.estimatedMeters,
            actualMetersUsed: item.actualMetersUsed,
            wastage: item.wastageMeters,
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

      // Update original order totals (with complete cost breakdown)
      await tx.order.update({
        where: { id },
        data: {
          // Complete itemized cost breakdown
          fabricCost: remainingFabricCost,
          fabricWastageAmount: remainingFabricWastage,
          accessoriesCost: remainingAccessoriesCost,
          stitchingCost: remainingStitchingCost,
          workmanshipPremiums: remainingWorkmanshipPremiums,
          designerConsultationFee: remainingDesignerFee,

          // Workmanship premium costs (proportional)
          handStitchingCost: parseFloat((originalOrder.handStitchingCost * remainingProportion).toFixed(2)),
          fullCanvasCost: parseFloat((originalOrder.fullCanvasCost * remainingProportion).toFixed(2)),
          rushOrderCost: parseFloat((originalOrder.rushOrderCost * remainingProportion).toFixed(2)),
          complexDesignCost: parseFloat((originalOrder.complexDesignCost * remainingProportion).toFixed(2)),
          additionalFittings: originalOrder.additionalFittings - Math.floor(originalOrder.additionalFittings * splitProportion),
          additionalFittingsCost: parseFloat((originalOrder.additionalFittingsCost * remainingProportion).toFixed(2)),
          premiumLiningCost: parseFloat((originalOrder.premiumLiningCost * remainingProportion).toFixed(2)),

          // Totals and GST
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
