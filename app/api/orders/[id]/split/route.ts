import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { generateOrderNumber } from '@/lib/utils'
import { InstallmentStatus } from '@prisma/client'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const roundCurrency = (value: number) => parseFloat(value.toFixed(2))

const allocatePaidAmounts = (amounts: number[], ratio: number) => {
  if (amounts.length === 0) {
    return { split: [], remaining: [] }
  }

  const total = amounts.reduce((sum, amount) => sum + amount, 0)
  const targetSplitTotal = roundCurrency(total * ratio)
  const split = amounts.map((amount) => roundCurrency(amount * ratio))
  const splitSum = roundCurrency(split.reduce((sum, amount) => sum + amount, 0))
  const diff = roundCurrency(targetSplitTotal - splitSum)

  if (split.length > 0 && Math.abs(diff) >= 0.01) {
    split[split.length - 1] = roundCurrency(split[split.length - 1] + diff)
  }

  const remaining = amounts.map((amount, index) => roundCurrency(amount - split[index]))
  return { split, remaining }
}

const getInstallmentStatus = (
  paidAmount: number,
  installmentAmount: number,
  dueDate: Date,
  currentStatus: string
): InstallmentStatus => {
  if (currentStatus === 'CANCELLED') return InstallmentStatus.CANCELLED

  if (paidAmount <= 0) {
    return dueDate < new Date() ? InstallmentStatus.OVERDUE : InstallmentStatus.PENDING
  }

  if (paidAmount >= installmentAmount) return InstallmentStatus.PAID
  return InstallmentStatus.PARTIAL
}

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
        installments: {
          orderBy: {
            installmentNumber: 'asc',
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
    const itemsToSplit = originalOrder.items.filter((item) => itemIds.includes(item.id))
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
    const splitItemsTotal = itemsToSplit.reduce((sum, item) => sum + item.totalPrice, 0)
    const remainingItems = originalOrder.items.filter((item) => !itemIds.includes(item.id))
    const remainingItemsTotal = remainingItems.reduce((sum, item) => sum + item.totalPrice, 0)
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

    // IMPROVED ADVANCE PAYMENT DISTRIBUTION LOGIC
    // Business Rule: Keep advance with original order unless it exceeds remaining total
    const originalAdvance = originalOrder.advancePaid
    let splitAdvance = 0
    let remainingAdvance = 0

    if (originalAdvance > 0) {
      // Check if remaining order can accommodate full advance payment
      if (remainingTotalAmount >= originalAdvance) {
        // Original order keeps full advance (customer's original payment stays with their order)
        remainingAdvance = originalAdvance
        splitAdvance = 0
      } else {
        // Remaining order gets full amount, split order gets the excess
        remainingAdvance = remainingTotalAmount
        splitAdvance = roundCurrency(originalAdvance - remainingTotalAmount)
      }

      // Ensure proper rounding
      remainingAdvance = roundCurrency(remainingAdvance)
      splitAdvance = roundCurrency(splitAdvance)
    }

    // Handle additional installments (balance payments after advance)
    const hasOtherPayments = originalOrder.installments.length > 1
    let remainingPaidAmounts = [remainingAdvance]
    let splitPaidAmounts = [splitAdvance]

    if (hasOtherPayments) {
      // Get all balance payments (installments after #1)
      const otherPayments = originalOrder.installments
        .slice(1)
        .map((installment) => installment.paidAmount || 0)

      // Split balance payments proportionally between orders
      const { split: splitOther, remaining: remainingOther } =
        allocatePaidAmounts(otherPayments, splitProportion)

      // Combine advance with balance payments
      remainingPaidAmounts = [remainingAdvance, ...remainingOther]
      splitPaidAmounts = [splitAdvance, ...splitOther]
    }

    const splitPaidTotal = roundCurrency(splitPaidAmounts.reduce((sum, amount) => sum + amount, 0))
    const remainingPaidTotal = roundCurrency(remainingPaidAmounts.reduce((sum, amount) => sum + amount, 0))

    const discountRatio = originalOrder.totalAmount > 0 ? splitTotalAmount / originalOrder.totalAmount : 0
    const splitDiscount = roundCurrency((originalOrder.discount || 0) * discountRatio)
    const remainingDiscount = roundCurrency((originalOrder.discount || 0) - splitDiscount)

    const buildInstallments = (totalAmount: number, paidAmountsForOrder: number[]) => {
      let runningBalance = totalAmount

      return originalOrder.installments.map((installment, index) => {
        const paidAmount = roundCurrency(paidAmountsForOrder[index] || 0)
        const installmentAmount = roundCurrency(Math.max(0, runningBalance))
        runningBalance = roundCurrency(runningBalance - paidAmount)

        const status = getInstallmentStatus(
          paidAmount,
          installmentAmount,
          installment.dueDate,
          installment.status
        )
        const hasPayment = paidAmount > 0

        return {
          id: installment.id,
          installmentNumber: installment.installmentNumber,
          installmentAmount,
          dueDate: installment.dueDate,
          paidDate: hasPayment ? installment.paidDate : null,
          paidAmount,
          paymentMode: hasPayment ? installment.paymentMode : null,
          transactionRef: hasPayment ? installment.transactionRef : null,
          status,
          notes: installment.notes,
        }
      })
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
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
          discount: splitDiscount,
          balanceAmount: roundCurrency(splitTotalAmount - splitDiscount - splitPaidTotal),
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
            quantityOrdered: item.quantityOrdered,
            bodyType: item.bodyType,
            estimatedMeters: item.estimatedMeters,
            actualMetersUsed: item.actualMetersUsed,
            wastageMeters: item.wastageMeters,
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

      // Build installments for both orders based on paid amounts
      const hasInstallments = originalOrder.installments.length > 0
      const updatedInstallments = hasInstallments
        ? buildInstallments(remainingTotalAmount, remainingPaidAmounts)
        : []
      const newInstallments = hasInstallments
        ? buildInstallments(splitTotalAmount, splitPaidAmounts).map((installment) => ({
          ...installment,
          orderId: newOrder.id,
        }))
        : []

      if (newInstallments.length > 0) {
        await tx.paymentInstallment.createMany({
          data: newInstallments.map(({ id, ...data }) => data),
        })
      }

      for (const installment of updatedInstallments) {
        await tx.paymentInstallment.update({
          where: { id: installment.id },
          data: {
            installmentAmount: installment.installmentAmount,
            dueDate: installment.dueDate,
            paidDate: installment.paidDate,
            paidAmount: installment.paidAmount,
            paymentMode: installment.paymentMode,
            transactionRef: installment.transactionRef,
            status: installment.status,
            notes: installment.notes,
          },
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
          discount: remainingDiscount,
          balanceAmount: roundCurrency(remainingTotalAmount - remainingDiscount - remainingPaidTotal),
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
