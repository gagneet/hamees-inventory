import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { hasFinancialAccess } from '@/lib/field-acl'
import { actorFromSession } from '@/lib/authz'
import { addAccessoryStock, changeClothStock, roundMeters } from '@/lib/stock'
import { lockPurchaseOrder, roundMoney } from '@/lib/order-finance'
import { poItemInventoryInclude } from '@/lib/purchase-order-items'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const receiveSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        receivedQuantity: z.number().nonnegative(),
        clothInventoryId: z.string().nullish(),
        accessoryInventoryId: z.string().nullish(),
      })
    )
    .max(500),
  paidAmount: z.number().nonnegative().optional(),
  notes: z.string().max(2000).nullish(),
})

/** Validation failure detected against the purchase order (reported as 4xx). */
class ReceiveError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

function appendNote(existingNotes: string | null, note: string | null | undefined): string | null {
  if (!note) return existingNotes
  return [existingNotes, note].filter(Boolean).join('\n')
}

/**
 * POST /api/purchase-orders/[id]/receive
 * Record goods received against a PO's own lines (optionally with a payment).
 * Each line must belong to this PO; quantity is capped at ordered − already received.
 * Stock is credited to the line's linked inventory item. Only a legacy line with no link may name an
 * item in the request (fabric for CLOTH lines, accessory for ACCESSORY lines); that links the line
 * permanently. Naming a different item for an already-linked line is rejected (400).
 * Every receipt writes a stock movement naming the PO and line, so it can be traced.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('manage_inventory')
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { items, paidAmount, notes } = receiveSchema.parse(body)

    if ((paidAmount ?? 0) > 0 && !hasFinancialAccess(actor.role, 'purchase_order')) {
      return NextResponse.json({ error: 'Your role cannot record supplier payments' }, { status: 403 })
    }

    const lineIds = items.map((item) => item.id)
    if (new Set(lineIds).size !== lineIds.length) {
      return NextResponse.json({ error: 'Each purchase order line can only appear once' }, { status: 400 })
    }

    await prisma.$transaction(async (tx: TransactionClient) => {
      // Lock the PO row, then read: a concurrent receipt or payment waits here, so quantity caps
      // and the paid amount are checked against current values
      await lockPurchaseOrder(tx, id)
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      })

      if (!purchaseOrder) throw new ReceiveError('Purchase order not found', 404)
      if (purchaseOrder.status === 'CANCELLED') throw new ReceiveError('Cannot receive cancelled purchase order')
      if (!['APPROVED', 'PARTIAL'].includes(purchaseOrder.status)) {
        throw new ReceiveError('Purchase order must be approved before receiving items')
      }

      const poItems = new Map(purchaseOrder.items.map((item) => [item.id, item]))
      const receivedNow = new Map<string, number>()

      for (const line of items) {
        const poItem = poItems.get(line.id)
        if (!poItem) throw new ReceiveError('One or more lines are not part of this purchase order')

        const isCloth = poItem.itemType === 'CLOTH'
        const quantity = isCloth ? roundMeters(line.receivedQuantity) : line.receivedQuantity
        if (!isCloth && !Number.isInteger(quantity)) {
          throw new ReceiveError(`${poItem.itemName}: accessory quantities must be whole units`)
        }

        const outstanding = poItem.orderedQuantity - poItem.receivedQuantity
        if (quantity > outstanding + 0.0005) {
          throw new ReceiveError(
            `${poItem.itemName}: cannot receive ${quantity} ${poItem.unit}; only ${roundMeters(Math.max(0, outstanding))} outstanding`
          )
        }

        const requestedCloth = line.clothInventoryId || null
        const requestedAccessory = line.accessoryInventoryId || null
        if (requestedCloth && requestedAccessory) {
          throw new ReceiveError(`${poItem.itemName}: choose either a fabric or an accessory to credit, not both`)
        }
        if (requestedCloth && !isCloth) {
          throw new ReceiveError(`${poItem.itemName} is not a fabric line`)
        }
        if (requestedAccessory && isCloth) {
          throw new ReceiveError(`${poItem.itemName} is not an accessory line`)
        }

        // The line's own link decides what is credited; the request may only link a legacy line
        const linkedId = isCloth ? poItem.clothInventoryId : poItem.accessoryInventoryId
        const requestedId = isCloth ? requestedCloth : requestedAccessory
        if (linkedId && requestedId && requestedId !== linkedId) {
          throw new ReceiveError(`${poItem.itemName} is already linked to a different inventory item`)
        }
        const newLink = !linkedId && requestedId ? requestedId : null
        if (newLink) {
          const target = isCloth
            ? await tx.clothInventory.findUnique({ where: { id: newLink }, select: { active: true } })
            : await tx.accessoryInventory.findUnique({ where: { id: newLink }, select: { active: true } })
          if (!target || !target.active) {
            throw new ReceiveError(`${poItem.itemName}: the ${isCloth ? 'fabric' : 'accessory'} to link was not found or is inactive`)
          }
        }
        const targetId = linkedId ?? newLink
        if (!targetId && quantity > 0) {
          throw new ReceiveError(
            `${poItem.itemName} is not linked to inventory: choose the ${isCloth ? 'fabric' : 'accessory'} to credit`
          )
        }

        if (quantity <= 0 && !newLink) continue
        if (quantity > 0) receivedNow.set(poItem.id, quantity)

        // Optimistic guard: fails if another receipt updated this line concurrently
        const updated = await tx.pOItem.updateMany({
          where: { id: poItem.id, purchaseOrderId: id, receivedQuantity: poItem.receivedQuantity },
          data: {
            receivedQuantity: roundMeters(poItem.receivedQuantity + Math.max(0, quantity)),
            ...(newLink && (isCloth ? { clothInventoryId: newLink } : { accessoryInventoryId: newLink })),
          },
        })
        if (updated.count === 0) {
          throw new ReceiveError('This purchase order was updated by someone else. Refresh and try again.', 409)
        }

        if (quantity <= 0 || !targetId) continue

        if (isCloth) {
          const levels = await changeClothStock(tx, targetId, quantity, {
            countAsPurchase: true,
            label: poItem.itemName,
          })
          await tx.stockMovement.create({
            data: {
              clothInventoryId: targetId,
              userId: actor.id,
              type: 'PURCHASE',
              quantityMeters: quantity,
              balanceAfterMeters: levels.currentStock,
              notes: `Purchase Order ${purchaseOrder.poNumber} received (${poItem.itemName})`,
            },
          })
        } else {
          const levels = await addAccessoryStock(tx, targetId, quantity)
          if (!levels) throw new ReceiveError(`${poItem.itemName}: accessory not found`, 404)
          await tx.accessoryStockMovement.create({
            data: {
              accessoryInventoryId: targetId,
              userId: actor.id,
              type: 'PURCHASE',
              quantityUnits: quantity,
              balanceAfterUnits: levels.currentStock,
              notes: `Purchase Order ${purchaseOrder.poNumber} received (${poItem.itemName})`,
            },
          })
        }
      }

      // Status considers every PO line, not only the submitted rows
      const totalReceived = (itemId: string, already: number) => already + (receivedNow.get(itemId) ?? 0)
      const allFullyReceived = purchaseOrder.items.every(
        (poItem) => totalReceived(poItem.id, poItem.receivedQuantity) >= poItem.orderedQuantity - 0.0005
      )
      const anyReceived = purchaseOrder.items.some((poItem) => totalReceived(poItem.id, poItem.receivedQuantity) > 0)

      // Payments add to what was already paid, never beyond the balance
      const additionalPayment = roundMoney(paidAmount ?? 0)
      if (additionalPayment > purchaseOrder.balanceAmount + 0.01) {
        throw new ReceiveError('Payment amount exceeds the purchase order balance')
      }
      const newPaidAmount = roundMoney(purchaseOrder.paidAmount + additionalPayment)
      const newBalanceAmount = roundMoney(purchaseOrder.totalAmount - newPaidAmount)
      const paymentComplete = newBalanceAmount <= 0.01

      let newStatus = purchaseOrder.status
      if (allFullyReceived && paymentComplete) {
        newStatus = 'RECEIVED'
      } else if (anyReceived || newPaidAmount > 0) {
        newStatus = 'PARTIAL'
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: newStatus === 'RECEIVED' ? new Date() : purchaseOrder.receivedDate,
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          notes: appendNote(purchaseOrder.notes, notes),
        },
      })
    })

    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: poItemInventoryInclude },
      },
    })

    return NextResponse.json({ purchaseOrder: filterApiResponse(updatedPO, actor.role, 'purchase_order') })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof ReceiveError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Error && error.name === 'InsufficientStockError') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error receiving purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to receive purchase order' },
      { status: 500 }
    )
  }
}
