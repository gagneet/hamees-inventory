import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { StockMovementType } from '@/lib/types'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
type PurchaseOrder = Awaited<ReturnType<typeof getPurchaseOrder>>
type POItem = NonNullable<PurchaseOrder>['items'][number]

async function getPurchaseOrder(id: string) {
  return await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  })
}

const receiveSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      receivedQuantity: z.number().nonnegative(),
      clothInventoryId: z.string().nullish(),
      accessoryInventoryId: z.string().nullish(),
    })
  ),
  paidAmount: z.number().nonnegative().optional(),
  notes: z.string().nullish(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['manage_inventory'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { items, paidAmount, notes } = receiveSchema.parse(body)

    const purchaseOrder = await getPurchaseOrder(id)

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (purchaseOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot receive cancelled purchase order' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx: TransactionClient) => {
      // Update PO items with received quantities
      for (const item of items) {
        const poItem = purchaseOrder.items.find((i: POItem) => i.id === item.id)
        if (!poItem) continue

        // Add to existing received quantity instead of replacing
        const newReceivedQuantity = poItem.receivedQuantity + item.receivedQuantity

        await tx.pOItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: newReceivedQuantity,
          },
        })

        // If cloth item and inventory ID provided, update stock
        if (item.clothInventoryId && item.receivedQuantity > 0) {
          const cloth = await tx.clothInventory.findUnique({
            where: { id: item.clothInventoryId },
          })

          if (cloth) {
            const newStock = cloth.currentStock + item.receivedQuantity

            await tx.clothInventory.update({
              where: { id: item.clothInventoryId },
              data: {
                currentStock: newStock,
                totalPurchased: cloth.totalPurchased + item.receivedQuantity,
              },
            })

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                clothInventoryId: item.clothInventoryId,
                userId: session.user.id,
                type: 'PURCHASE',
                quantityMeters: item.receivedQuantity,
                balanceAfterMeters: newStock,
                notes: `Purchase Order ${purchaseOrder.poNumber} received`,
              },
            })
          }
        }

        // If accessory item and inventory ID provided, update stock
        if (item.accessoryInventoryId && item.receivedQuantity > 0) {
          const accessory = await tx.accessoryInventory.findUnique({
            where: { id: item.accessoryInventoryId },
          })

          if (accessory) {
            const newStock = accessory.currentStock + Math.round(item.receivedQuantity)

            await tx.accessoryInventory.update({
              where: { id: item.accessoryInventoryId },
              data: {
                currentStock: newStock,
              },
            })
          }
        }
      }

      // Check if all items fully received (check total received quantity)
      const allFullyReceived = items.every((item) => {
        const poItem = purchaseOrder.items.find((i: POItem) => i.id === item.id)
        if (!poItem) return false
        const totalReceived = poItem.receivedQuantity + item.receivedQuantity
        return totalReceived >= poItem.orderedQuantity
      })

      const anyPartiallyReceived = items.some((item) => {
        const poItem = purchaseOrder.items.find((i: POItem) => i.id === item.id)
        if (!poItem) return false
        const totalReceived = poItem.receivedQuantity + item.receivedQuantity
        return totalReceived > 0 && totalReceived < poItem.orderedQuantity
      })

      // Calculate new payment amounts (ADD instead of REPLACE)
      const additionalPayment = paidAmount !== undefined ? paidAmount : 0
      const newPaidAmount = purchaseOrder.paidAmount + additionalPayment
      const newBalanceAmount = purchaseOrder.totalAmount - newPaidAmount

      // Check if payment is complete (allow for floating point errors)
      const paymentComplete = newBalanceAmount <= 0.01

      // Determine status based on BOTH items received AND payment complete
      let newStatus = 'PENDING'
      if (allFullyReceived && paymentComplete) {
        newStatus = 'RECEIVED' // Both items and payment complete
      } else if (anyPartiallyReceived || newPaidAmount > 0) {
        newStatus = 'PARTIAL' // Partial receipt or partial payment
      }

      // Update purchase order
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: newStatus === 'RECEIVED' ? new Date() : purchaseOrder.receivedDate,
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          notes: notes ? `${purchaseOrder.notes || ''}\n${notes}` : purchaseOrder.notes,
        },
      })
    })

    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
      },
    })

    return NextResponse.json({ purchaseOrder: updatedPO })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error receiving purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to receive purchase order' },
      { status: 500 }
    )
  }
}
