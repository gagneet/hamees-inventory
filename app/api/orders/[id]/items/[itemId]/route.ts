import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { hasPermission } from '@/lib/permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, canSeeAllOrders, isAssignableTailor, notFound, orderScope } from '@/lib/authz'
import { getAppSettings, taxConfigFrom } from '@/lib/settings'
import { recomputeOrderTax } from '@/lib/tax'
import { formatCurrency } from '@/lib/locale'
import { computeOrderBalance, lockOrder, roundMoney } from '@/lib/order-finance'
import { InsufficientStockError, releaseClothReservation, reserveClothStock } from '@/lib/stock'
import { audit } from '@/lib/audit'
import { runReorderCheckQuietly } from '@/lib/reorder'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const updateOrderItemSchema = z.object({
  garmentPatternId: z.string().optional(),
  clothInventoryId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  assignedTailorId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

/** The order was closed (delivered/cancelled) by a concurrent request. */
class OrderClosedError extends Error {}

/**
 * PATCH /api/orders/[id]/items/[itemId]
 *
 * Authorization:
 *   - fabric change (re-prices the order): update_order
 *   - (re)assigning a tailor: assign_tailors; target must be an active TAILOR/MASTER_TAILOR
 *   - notes: anyone who can reach the order; scoped roles (TAILOR) only on items assigned to them
 * Garment-type and quantity changes are not supported on existing items (they would change
 * stitching charges and premiums); split the order or create a new one instead.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order', 'update_order_status', 'assign_tailors'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: orderId, itemId } = await context.params
    const body = await request.json()
    const validatedData = updateOrderItemSchema.parse(body)

    // Item must belong to this order, and the order must be in the actor's scope
    const existingItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
        order: orderScope(actor),
      },
      include: {
        order: true,
        garmentPattern: true,
        clothInventory: true,
        assignedTailor: { select: { id: true, name: true } },
      },
    })

    if (!existingItem) {
      return notFound('Order item')
    }

    // Don't allow editing delivered or cancelled orders
    if (existingItem.order.status === 'DELIVERED' || existingItem.order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot edit items for delivered or cancelled orders' },
        { status: 400 }
      )
    }

    const garmentChanging =
      validatedData.garmentPatternId !== undefined && validatedData.garmentPatternId !== existingItem.garmentPatternId
    const quantityChanging =
      validatedData.quantity !== undefined && validatedData.quantity !== existingItem.quantityOrdered
    const fabricChanging =
      validatedData.clothInventoryId !== undefined && validatedData.clothInventoryId !== existingItem.clothInventoryId
    const tailorChanging =
      validatedData.assignedTailorId !== undefined &&
      (validatedData.assignedTailorId || null) !== existingItem.assignedTailorId
    const notesChanging = validatedData.notes !== undefined && validatedData.notes !== existingItem.notes

    if (garmentChanging || quantityChanging) {
      return NextResponse.json(
        { error: 'Changing the garment type or quantity of an existing item is not supported. Split the order or create a new one.' },
        { status: 400 }
      )
    }

    if (fabricChanging && !hasPermission(actor.role, 'update_order')) {
      return NextResponse.json({ error: 'Your role cannot change the fabric of an order item' }, { status: 403 })
    }

    if (tailorChanging && !hasPermission(actor.role, 'assign_tailors')) {
      return NextResponse.json({ error: 'Your role cannot assign tailors' }, { status: 403 })
    }

    // Scoped roles may annotate only their own work
    if (notesChanging && !canSeeAllOrders(actor) && existingItem.assignedTailorId !== actor.id) {
      return NextResponse.json({ error: 'You can only update items assigned to you' }, { status: 403 })
    }

    if (!fabricChanging && !tailorChanging && !notesChanging) {
      return NextResponse.json({ message: 'No changes detected' })
    }

    const updateData: Record<string, unknown> = {}

    // Tailor assignment
    let newTailor: { id: string; name: string } | null = null
    if (tailorChanging) {
      if (validatedData.assignedTailorId) {
        const tailor = await prisma.user.findUnique({
          where: { id: validatedData.assignedTailorId },
          select: { id: true, name: true, role: true, active: true },
        })
        if (!isAssignableTailor(tailor)) {
          return NextResponse.json(
            { error: 'Items can only be assigned to an active tailor or master tailor' },
            { status: 400 }
          )
        }
        newTailor = { id: tailor!.id, name: tailor!.name }
      }
      updateData.assignedTailorId = validatedData.assignedTailorId || null
    }

    if (notesChanging) {
      updateData.notes = validatedData.notes
    }

    // Fabric change: re-price the item. estimatedMeters is the item's total meters (all garments).
    let newCloth: { id: string; name: string; color: string; pricePerMeter: number; currentStock: number } | null = null
    let fabricDelta = 0
    if (fabricChanging) {
      newCloth = await prisma.clothInventory.findUnique({
        where: { id: validatedData.clothInventoryId! },
        select: { id: true, name: true, color: true, pricePerMeter: true, currentStock: true },
      })
      if (!newCloth) {
        return NextResponse.json({ error: 'Invalid cloth inventory' }, { status: 400 })
      }

      const oldFabricCost = existingItem.estimatedMeters * existingItem.clothInventory.pricePerMeter
      const accessoriesPart = Math.max(0, existingItem.totalPrice - oldFabricCost)
      const newFabricCost = existingItem.estimatedMeters * newCloth.pricePerMeter
      const newTotalPrice = roundMoney(newFabricCost + accessoriesPart)
      fabricDelta = newFabricCost - oldFabricCost

      updateData.clothInventoryId = newCloth.id
      updateData.totalPrice = newTotalPrice
      updateData.pricePerUnit = roundMoney(newTotalPrice / existingItem.quantityOrdered)
    }

    const settings = await getAppSettings()

    const updatedItem = await prisma.$transaction(async (tx: TransactionClient) => {
      // Lock the order and re-check its status: a delivery or cancellation that happened after
      // the read above must not be followed by a reservation or re-pricing on a closed order
      await lockOrder(tx, orderId)
      const locked = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } })
      if (!locked || locked.status === 'DELIVERED' || locked.status === 'CANCELLED') {
        throw new OrderClosedError()
      }

      if (fabricChanging && newCloth) {
        const meters = existingItem.estimatedMeters

        // Reserve on the new fabric first (fails atomically if not enough stock), then release the old one
        const newLevels = await reserveClothStock(tx, newCloth.id, meters, `${newCloth.name} (${newCloth.color})`)
        const oldLevels = await releaseClothReservation(tx, existingItem.clothInventoryId, meters)

        await tx.stockMovement.create({
          data: {
            type: 'ORDER_CANCELLED',
            quantityMeters: meters, // released back to available stock
            balanceAfterMeters: oldLevels?.currentStock ?? existingItem.clothInventory.currentStock,
            clothInventoryId: existingItem.clothInventoryId,
            orderId,
            userId: actor.id,
            notes: `Fabric changed on order ${existingItem.order.orderNumber} - reservation released`,
          },
        })
        await tx.stockMovement.create({
          data: {
            type: 'ORDER_RESERVED',
            quantityMeters: -meters,
            balanceAfterMeters: (newLevels?.currentStock ?? newCloth.currentStock) - meters,
            clothInventoryId: newCloth.id,
            orderId,
            userId: actor.id,
            notes: `Reserved for order ${existingItem.order.orderNumber} (fabric change)`,
          },
        })
      }

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
            },
          },
        },
      })

      // Re-price the order: adjust fabric cost (+ proportional wastage), recompute tax and balance.
      if (fabricChanging) {
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: { customer: { select: { state: true } } },
        })

        if (currentOrder) {
          const applyFabric = !currentOrder.isFabricCostOverridden
          const wastageDelta = applyFabric ? (fabricDelta * currentOrder.fabricWastagePercent) / 100 : 0
          const subTotal = roundMoney(currentOrder.subTotal + (applyFabric ? fabricDelta : 0) + wastageDelta)

          // Keep the order's own rate and tax structure (split / integrated / single / none),
          // whatever the shop's tax settings are now
          const tax = recomputeOrderTax(subTotal, currentOrder, taxConfigFrom(settings), {
            customerRegion: currentOrder.customer.state,
          })

          const balanceAmount = await computeOrderBalance(tx, {
            id: orderId,
            totalAmount: tax.totalAmount,
            advancePaid: currentOrder.advancePaid,
            discount: currentOrder.discount,
          })

          await tx.order.update({
            where: { id: orderId },
            data: {
              fabricCost: roundMoney(currentOrder.fabricCost + (applyFabric ? fabricDelta : 0)),
              fabricWastageAmount: roundMoney(currentOrder.fabricWastageAmount + wastageDelta),
              subTotal,
              taxableAmount: subTotal,
              gstRate: tax.gstRate,
              cgst: tax.cgst,
              sgst: tax.sgst,
              igst: tax.igst,
              gstAmount: tax.gstAmount,
              totalAmount: tax.totalAmount,
              balanceAmount,
            },
          })
        }
      }

      // Order history entry
      const changeDescription: string[] = []
      if (fabricChanging && newCloth) {
        changeDescription.push(
          `Fabric changed from ${existingItem.clothInventory.name} (${existingItem.clothInventory.color}) to ${newCloth.name} (${newCloth.color})`
        )
        changeDescription.push(
          `Order item price updated from ${formatCurrency(existingItem.totalPrice)} to ${formatCurrency(updated.totalPrice)}`
        )
      }
      if (tailorChanging) {
        changeDescription.push(
          newTailor
            ? `${existingItem.garmentPattern.name} assigned to ${newTailor.name}${existingItem.assignedTailor ? ` (was ${existingItem.assignedTailor.name})` : ''}`
            : `${existingItem.garmentPattern.name} unassigned from ${existingItem.assignedTailor?.name ?? 'tailor'}`
        )
      }

      if (changeDescription.length > 0) {
        await tx.orderHistory.create({
          data: {
            orderId,
            userId: actor.id,
            changeType: 'ITEM_UPDATED',
            description: changeDescription.join('; '),
          },
        })
      }

      return updated
    })

    // The reservation moved between fabrics: re-check reorder needs for both
    if (fabricChanging) {
      after(() => runReorderCheckQuietly({ trigger: 'order_item_fabric_changed', userId: actor.id }))
    }

    if (tailorChanging) {
      await audit({
        userId: actor.id,
        action: newTailor ? 'TAILOR_ASSIGNED' : 'TAILOR_UNASSIGNED',
        entityType: 'OrderItem',
        entityId: itemId,
        details: {
          orderId,
          fromTailorId: existingItem.assignedTailorId,
          toTailorId: newTailor?.id ?? null,
        },
      })
    }

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

    // FEATURETRACE: Apply ACL field filtering to response
    const filteredItem = filterApiResponse(updatedItem, actor.role, 'order_item')
    const filteredOrder = filterApiResponse(updatedOrder, actor.role, 'order')

    return NextResponse.json({
      updatedOrderItem: filteredItem,
      updatedOrder: filteredOrder,
      message: fabricChanging
        ? 'Order item updated successfully. Order totals have been recalculated.'
        : 'Order item updated successfully.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof OrderClosedError) {
      return NextResponse.json(
        { error: 'The order was delivered or cancelled in the meantime; its items can no longer be edited' },
        { status: 409 }
      )
    }

    console.error('Error updating order item:', error)
    return NextResponse.json(
      { error: 'Failed to update order item' },
      { status: 500 }
    )
  }
}
