import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { StockMovementType } from '@/lib/types'

const receiveSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      receivedQuantity: z.number().nonnegative(),
      clothInventoryId: z.string().nullish(),
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

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (purchaseOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot receive cancelled purchase order' },
        { status: 400 }
      )
    }

    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      // Update PO items with received quantities
      for (const item of items) {
        await tx.pOItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: item.receivedQuantity,
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
                type: StockMovementType.PURCHASE,
                quantity: item.receivedQuantity,
                balanceAfter: newStock,
                notes: `Purchase Order ${purchaseOrder.poNumber} received`,
              },
            })
          }
        }
      }

      // Check if all items fully received
      const allFullyReceived = items.every((item) => {
        const poItem = purchaseOrder.items.find((i) => i.id === item.id)
        return poItem && item.receivedQuantity >= poItem.quantity
      })

      const anyPartiallyReceived = items.some((item) => {
        const poItem = purchaseOrder.items.find((i) => i.id === item.id)
        return poItem && item.receivedQuantity > 0 && item.receivedQuantity < poItem.quantity
      })

      const newStatus = allFullyReceived
        ? 'RECEIVED'
        : anyPartiallyReceived
        ? 'PARTIAL'
        : 'PENDING'

      // Update purchase order
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: newStatus === 'RECEIVED' ? new Date() : purchaseOrder.receivedDate,
          paidAmount: paidAmount !== undefined ? paidAmount : purchaseOrder.paidAmount,
          balanceAmount:
            paidAmount !== undefined
              ? purchaseOrder.totalAmount - paidAmount
              : purchaseOrder.balanceAmount,
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
