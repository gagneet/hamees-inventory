import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING']).optional(),
  transactionRef: z.string().nullish(),
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
    const { amount, paymentMode, transactionRef, notes } = paymentSchema.parse(body)

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (purchaseOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot make payment on cancelled purchase order' },
        { status: 400 }
      )
    }

    // Validate payment amount doesn't exceed balance
    if (amount > purchaseOrder.balanceAmount) {
      return NextResponse.json(
        {
          error: `Payment amount (${amount.toFixed(2)}) exceeds balance amount (${purchaseOrder.balanceAmount.toFixed(2)})`,
        },
        { status: 400 }
      )
    }

    // Calculate new amounts
    const newPaidAmount = purchaseOrder.paidAmount + amount
    const newBalanceAmount = purchaseOrder.totalAmount - newPaidAmount

    // Determine if payment is complete
    const paymentComplete = newBalanceAmount <= 0.01 // Allow for floating point errors

    // Check if all items are received
    const items = await prisma.pOItem.findMany({
      where: { purchaseOrderId: id },
    })

    const allItemsReceived = items.every((item: any) => item.receivedQuantity >= item.quantityOrdered)

    // Determine new status
    let newStatus = purchaseOrder.status
    if (allItemsReceived && paymentComplete) {
      newStatus = 'RECEIVED' // Fully complete
    } else if (newPaidAmount > 0 || items.some((item: any) => item.receivedQuantity > 0)) {
      newStatus = 'PARTIAL' // Partial payment or partial receipt
    }

    // Update purchase order
    const updatedPO = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalanceAmount,
        status: newStatus,
        notes: notes
          ? `${purchaseOrder.notes || ''}\n[${new Date().toLocaleDateString('en-IN')}] Payment: ${amount.toFixed(2)} via ${paymentMode || 'Cash'}${notes ? ` - ${notes}` : ''}`
          : purchaseOrder.notes,
      },
      include: {
        supplier: true,
        items: true,
      },
    })

    return NextResponse.json({
      purchaseOrder: updatedPO,
      message: paymentComplete
        ? 'Payment completed successfully!'
        : `Payment of ${amount.toFixed(2)} recorded. Balance remaining: ${newBalanceAmount.toFixed(2)}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error processing payment:', error)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
