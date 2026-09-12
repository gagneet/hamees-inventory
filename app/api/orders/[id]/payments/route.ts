import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { actorFromSession, requireOrderAccess } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { formatCurrency } from '@/lib/locale'
import { lockOrder, roundMoney, safeInstallmentNote } from '@/lib/order-finance'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  transactionRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
})

/** Validation failure raised inside the transaction (after locking and re-reading the order). */
class PaymentRejected extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/**
 * POST /api/orders/[id]/payments
 * Record a single payment for an order (record_payment: OWNER/ADMIN)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('record_payment')
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: orderId } = await params
    const body = await request.json()
    const validatedData = recordPaymentSchema.parse(body)

    const denied = await requireOrderAccess(actor, orderId)
    if (denied) return denied

    await getAppSettings()

    // Lock the order row first: a concurrent payment waits here, then reads the reduced
    // balance, so two payments can't both pass the balance check.
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      await lockOrder(tx, orderId)
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNumber: true, totalAmount: true, balanceAmount: true, status: true },
      })
      if (!order) throw new PaymentRejected('Order not found', 404)
      if (order.status === 'CANCELLED') throw new PaymentRejected('Cannot record payment for cancelled order')

      const paymentAmount = roundMoney(validatedData.amount)
      if (paymentAmount > order.balanceAmount + 0.001) {
        throw new PaymentRejected(
          `Payment amount (${formatCurrency(paymentAmount)}) cannot exceed balance (${formatCurrency(order.balanceAmount)})`
        )
      }

      const last = await tx.paymentInstallment.findFirst({
        where: { orderId: order.id },
        orderBy: { installmentNumber: 'desc' },
        select: { installmentNumber: true },
      })
      const nextInstallmentNumber = (last?.installmentNumber ?? 0) + 1
      const now = new Date()

      // installmentAmount represents the outstanding amount at the time of payment
      const installmentAmount = nextInstallmentNumber === 1 ? order.totalAmount : order.balanceAmount

      const installment = await tx.paymentInstallment.create({
        data: {
          orderId: order.id,
          installmentNumber: nextInstallmentNumber,
          installmentAmount: roundMoney(installmentAmount),
          paidAmount: paymentAmount,
          dueDate: now,
          paidDate: now,
          status: 'PAID',
          paymentMode: validatedData.paymentMode,
          transactionRef: validatedData.transactionRef,
          notes: safeInstallmentNote(validatedData.notes) || `Payment recorded via ${validatedData.paymentMode}`,
        },
      })

      const newBalanceAmount = roundMoney(order.balanceAmount - paymentAmount)
      await tx.order.update({
        where: { id: order.id },
        data: { balanceAmount: newBalanceAmount },
      })

      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          userId: actor.id,
          changeType: 'PAYMENT_RECORDED',
          description: `Payment of ${formatCurrency(paymentAmount)} recorded via ${validatedData.paymentMode}${
            validatedData.transactionRef ? ` (Ref: ${validatedData.transactionRef})` : ''
          }. New balance: ${formatCurrency(newBalanceAmount)}`,
        },
      })

      return { installment, newBalanceAmount, paymentAmount }
    })

    return NextResponse.json({
      success: true,
      installment: filterApiResponse(result.installment, actor.role, 'payment'),
      newBalanceAmount: result.newBalanceAmount,
      message: `Payment of ${formatCurrency(result.paymentAmount)} recorded successfully`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof PaymentRejected) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    )
  }
}
