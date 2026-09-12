import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { hasFinancialAccess } from '@/lib/field-acl'
import { getAppSettings } from '@/lib/settings'
import { formatCurrency, formatDate } from '@/lib/locale'
import { lockPurchaseOrder, roundMoney } from '@/lib/order-finance'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const paymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING']).optional(),
  transactionRef: z.string().max(100).nullish(),
  notes: z.string().max(1000).nullish(),
})

class PaymentError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

function appendNote(existingNotes: string | null, note: string | null | undefined): string | null {
  if (!note) return existingNotes
  return [existingNotes, note].filter(Boolean).join('\n')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('manage_inventory')
  if (error) return error
  if (!hasFinancialAccess(session.user.role, 'purchase_order')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { amount, paymentMode, transactionRef, notes } = paymentSchema.parse(body)

    await getAppSettings()

    // Lock the PO row, then read + validate + write. A plain read inside the transaction does not
    // block other writers under READ COMMITTED; the row lock makes a concurrent payment or
    // receipt wait and then see the reduced balance.
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      await lockPurchaseOrder(tx, id)
      const purchaseOrder = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      })

      if (!purchaseOrder) throw new PaymentError('Purchase order not found', 404)
      if (purchaseOrder.status === 'CANCELLED') throw new PaymentError('Cannot make payment on cancelled purchase order')
      if (!['APPROVED', 'PARTIAL'].includes(purchaseOrder.status)) {
        throw new PaymentError('Purchase order must be approved before recording payment')
      }

      const payment = roundMoney(amount)
      if (payment > purchaseOrder.balanceAmount + 0.01) {
        throw new PaymentError(
          `Payment amount (${formatCurrency(payment)}) exceeds balance amount (${formatCurrency(purchaseOrder.balanceAmount)})`
        )
      }

      const newPaidAmount = roundMoney(purchaseOrder.paidAmount + payment)
      const newBalanceAmount = roundMoney(purchaseOrder.totalAmount - newPaidAmount)
      const paymentComplete = newBalanceAmount <= 0.01

      const allItemsReceived = purchaseOrder.items.every((item) => item.receivedQuantity >= item.orderedQuantity)
      let newStatus = purchaseOrder.status
      if (allItemsReceived && paymentComplete) {
        newStatus = 'RECEIVED'
      } else if (newPaidAmount > 0 || purchaseOrder.items.some((item) => item.receivedQuantity > 0)) {
        newStatus = 'PARTIAL'
      }

      const paymentNote = `[${formatDate(new Date())}] Payment: ${formatCurrency(payment)} via ${paymentMode || 'CASH'}${
        transactionRef ? ` (Ref: ${transactionRef})` : ''
      }${notes ? ` - ${notes}` : ''}`

      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus,
          notes: appendNote(purchaseOrder.notes, paymentNote),
        },
        include: {
          supplier: true,
          items: true,
        },
      })

      return { updatedPO, paymentComplete, payment, newBalanceAmount }
    })

    return NextResponse.json({
      purchaseOrder: filterApiResponse(result.updatedPO, session.user.role, 'purchase_order'),
      message: result.paymentComplete
        ? 'Payment completed successfully!'
        : `Payment of ${formatCurrency(result.payment)} recorded. Balance remaining: ${formatCurrency(result.newBalanceAmount)}`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error processing payment:', error)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
