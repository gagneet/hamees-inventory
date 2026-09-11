import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { generateOrderNumber } from '@/lib/utils'
import { InstallmentStatus } from '@prisma/client'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, requireOrderAccess } from '@/lib/authz'
import { getAppSettings, taxConfigFrom } from '@/lib/settings'
import { recomputeOrderTax } from '@/lib/tax'
import { isLegacyAdvanceInstallment, lockOrder, safeInstallmentNote } from '@/lib/order-finance'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const roundCurrency = (value: number) => parseFloat(value.toFixed(2))
const sum = (values: number[]) => roundCurrency(values.reduce((total, value) => total + value, 0))

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

/** Validation failure detected against the locked order (reported as 4xx). */
class SplitRejected extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/**
 * POST /api/orders/[id]/split
 * Moves some items to a new order.
 * - Order-level costs, the discount and every real payment are shared proportionally by item value;
 *   the advance stays with the original order up to its new total, the excess moves.
 * - Items are moved (not recreated), so tailor assignments and design uploads go with them.
 * - Accessory reservations for the moved garments move to the new order.
 * - Tax keeps the original order's rate and structure (recomputeOrderTax).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const validatedData = splitOrderSchema.parse(body)
    const { itemIds, deliveryDate, notes } = validatedData

    const denied = await requireOrderAccess(actor, id)
    if (denied) return denied

    const taxConfig = taxConfigFrom(await getAppSettings())

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Lock, then read: a payment or edit made concurrently can't be lost from the split
      await lockOrder(tx, id)

      const originalOrder = await tx.order.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              garmentPattern: { include: { accessories: true } },
              clothInventory: true,
            },
          },
          installments: {
            orderBy: {
              installmentNumber: 'asc',
            },
          },
          accessoryStockMovements: {
            where: { type: 'ORDER_RESERVED' },
            orderBy: { createdAt: 'asc' },
          },
          customer: true,
        },
      })

      if (!originalOrder) {
        throw new SplitRejected('Order not found', 404)
      }

      // Validate that order can be split
      if (originalOrder.items.length <= 1) {
        throw new SplitRejected('Order must have at least 2 items to split')
      }

      // Validate that we're not trying to split all items
      if (itemIds.length >= originalOrder.items.length) {
        throw new SplitRejected('Cannot split all items - at least one item must remain in original order')
      }

      // Validate that all itemIds exist in the order
      const itemsToSplit = originalOrder.items.filter((item) => itemIds.includes(item.id))
      if (itemsToSplit.length !== itemIds.length) {
        throw new SplitRejected('Some items not found in this order')
      }

      // Cannot split if order is already delivered or cancelled
      if (originalOrder.status === 'DELIVERED' || originalOrder.status === 'CANCELLED') {
        throw new SplitRejected(`Cannot split ${originalOrder.status.toLowerCase()} orders`)
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

      // Calculate subtotals (before tax)
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

      // Tax: both orders keep the original order's rate and structure, whatever the settings are now
      const taxOpts = { customerRegion: originalOrder.customer.state }
      const splitTax = recomputeOrderTax(splitSubTotal, originalOrder, taxConfig, taxOpts)
      const remainingTax = recomputeOrderTax(remainingSubTotal, originalOrder, taxConfig, taxOpts)
      const splitTotalAmount = splitTax.totalAmount
      const remainingTotalAmount = remainingTax.totalAmount

      // ADVANCE: keep it with the original order unless it exceeds that order's new total
      const originalAdvance = originalOrder.advancePaid
      let splitAdvance = 0
      let remainingAdvance = 0

      if (originalAdvance > 0) {
        if (remainingTotalAmount >= originalAdvance) {
          remainingAdvance = originalAdvance
          splitAdvance = 0
        } else {
          remainingAdvance = remainingTotalAmount
          splitAdvance = roundCurrency(originalAdvance - remainingTotalAmount)
        }

        remainingAdvance = roundCurrency(remainingAdvance)
        splitAdvance = roundCurrency(splitAdvance)
      }

      // INSTALLMENTS: installment #1 is only an advance if it is a legacy duplicate of Order.advancePaid
      // (lib/order-finance.ts). That row stays with the original order, mirroring its new advance.
      // Every real payment (and each installment's expected amount) is shared proportionally.
      const [firstInstallment] = originalOrder.installments
      const legacyAdvanceRow =
        firstInstallment && isLegacyAdvanceInstallment(firstInstallment, originalAdvance) ? firstInstallment : null
      const realInstallments = originalOrder.installments.filter((installment) => installment !== legacyAdvanceRow)

      const paid = allocatePaidAmounts(realInstallments.map((installment) => installment.paidAmount || 0), splitProportion)
      const expected = allocatePaidAmounts(
        realInstallments.map((installment) => installment.installmentAmount || 0),
        splitProportion
      )

      const splitPaidTotal = roundCurrency(splitAdvance + sum(paid.split))
      const remainingPaidTotal = roundCurrency(remainingAdvance + sum(paid.remaining))

      const discountRatio = originalOrder.totalAmount > 0 ? splitTotalAmount / originalOrder.totalAmount : 0
      const splitDiscount = roundCurrency((originalOrder.discount || 0) * discountRatio)
      const remainingDiscount = roundCurrency((originalOrder.discount || 0) - splitDiscount)

      const buildInstallments = (paidAmounts: number[], expectedAmounts: number[]) =>
        realInstallments.map((installment, index) => {
          const paidAmount = roundCurrency(paidAmounts[index] || 0)
          const installmentAmount = roundCurrency(expectedAmounts[index] || 0)
          const hasPayment = paidAmount > 0
          // Keep the recorded status unless this side of the split lost the whole payment
          const status =
            hasPayment || (installment.paidAmount || 0) <= 0
              ? installment.status
              : getInstallmentStatus(0, installmentAmount, installment.dueDate, installment.status)

          return {
            id: installment.id,
            data: {
              installmentAmount,
              dueDate: installment.dueDate,
              paidDate: hasPayment ? installment.paidDate : null,
              paidAmount,
              paymentMode: hasPayment ? installment.paymentMode : null,
              transactionRef: hasPayment ? installment.transactionRef : null,
              status,
              notes: installment.notes,
            },
          }
        })

      // Create new order with split items (with complete cost breakdown)
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: originalOrder.customerId,
          userId: actor.id,
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

          // Totals and tax
          totalAmount: splitTotalAmount,
          subTotal: splitSubTotal,
          gstRate: splitTax.gstRate,
          gstAmount: splitTax.gstAmount,
          cgst: splitTax.cgst,
          sgst: splitTax.sgst,
          igst: splitTax.igst,
          taxableAmount: splitSubTotal,
          advancePaid: splitAdvance,
          discount: splitDiscount,
          balanceAmount: roundCurrency(splitTotalAmount - splitDiscount - splitPaidTotal),
          discountReason: originalOrder.discountReason,
          notes: notes || `Split from order ${originalOrder.orderNumber}`,
        },
      })

      // Move the items (same rows: tailor assignment, measurement and design uploads stay attached)
      await tx.orderItem.updateMany({
        where: { id: { in: itemsToSplit.map((item) => item.id) }, orderId: id },
        data: { orderId: newOrder.id },
      })

      // Accessory reservations are held per order and accessory. Move the moved garments' pattern
      // accessories (quantity per garment × garments), capped at what the original order holds.
      // Per-order accessory overrides aren't stored per item, so any remainder stays with the original.
      const unitsToMove = new Map<string, number>()
      for (const item of itemsToSplit) {
        for (const accessory of item.garmentPattern.accessories) {
          unitsToMove.set(
            accessory.accessoryId,
            (unitsToMove.get(accessory.accessoryId) ?? 0) + accessory.quantityPerGarment * item.quantityOrdered
          )
        }
      }
      for (const [accessoryId, wanted] of unitsToMove) {
        let toMove = wanted
        for (const movement of originalOrder.accessoryStockMovements) {
          if (toMove <= 0) break
          if (movement.accessoryInventoryId !== accessoryId) continue
          const held = Math.abs(movement.quantityUnits)
          const take = Math.min(held, toMove)
          if (take <= 0) continue

          if (take === held) {
            await tx.accessoryStockMovement.update({ where: { id: movement.id }, data: { orderId: newOrder.id } })
          } else {
            await tx.accessoryStockMovement.update({
              where: { id: movement.id },
              data: { quantityUnits: -(held - take) },
            })
            await tx.accessoryStockMovement.create({
              data: {
                accessoryInventoryId: accessoryId,
                orderId: newOrder.id,
                userId: actor.id,
                type: 'ORDER_RESERVED',
                quantityUnits: -take,
                balanceAfterUnits: movement.balanceAfterUnits,
                notes: `Reservation moved from order ${originalOrder.orderNumber} (split)`,
              },
            })
          }
          toMove -= take
        }
      }

      // Installments: original order keeps its rows (with its share); the new order gets copies
      if (legacyAdvanceRow) {
        await tx.paymentInstallment.update({
          where: { id: legacyAdvanceRow.id },
          data: { paidAmount: remainingAdvance, installmentAmount: remainingTotalAmount },
        })
      }

      for (const installment of buildInstallments(paid.remaining, expected.remaining)) {
        await tx.paymentInstallment.update({ where: { id: installment.id }, data: installment.data })
      }

      const newInstallments = buildInstallments(paid.split, expected.split)
      if (newInstallments.length > 0) {
        await tx.paymentInstallment.createMany({
          data: newInstallments.map((installment, index) => ({
            ...installment.data,
            orderId: newOrder.id,
            installmentNumber: index + 1,
            notes: safeInstallmentNote(installment.data.notes) ?? null,
          })),
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

          // Totals and tax
          totalAmount: remainingTotalAmount,
          subTotal: remainingSubTotal,
          gstRate: remainingTax.gstRate,
          gstAmount: remainingTax.gstAmount,
          cgst: remainingTax.cgst,
          sgst: remainingTax.sgst,
          igst: remainingTax.igst,
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
          userId: actor.id,
          changeType: 'ORDER_SPLIT',
          description: `Split ${itemIds.length} item(s) to new order ${newOrder.orderNumber}`,
        },
      })

      // Create order history for new order
      await tx.orderHistory.create({
        data: {
          orderId: newOrder.id,
          userId: actor.id,
          changeType: 'ORDER_CREATED',
          description: `Created from split of order ${originalOrder.orderNumber}`,
        },
      })

      return { newOrder, originalOrder: await tx.order.findUnique({ where: { id } }) }
    })

    return NextResponse.json({
      success: true,
      message: `Order split successfully. New order: ${result.newOrder.orderNumber}`,
      newOrder: filterApiResponse(result.newOrder, actor.role, 'order'),
      originalOrder: filterApiResponse(result.originalOrder, actor.role, 'order'),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof SplitRejected) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error splitting order:', error)
    return NextResponse.json(
      { error: 'Failed to split order' },
      { status: 500 }
    )
  }
}
