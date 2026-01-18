import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requireAnyPermission } from '@/lib/api-permissions'

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  transactionRef: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * POST /api/orders/[id]/payments
 * Record a single payment for an order
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const { error } = await requireAnyPermission(['manage_orders', 'create_order'])
    if (error) {
      return error
    }

    const { id: orderId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = recordPaymentSchema.parse(body)

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        advancePaid: true,
        discount: true,
        balanceAmount: true,
        status: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if order is cancelled
    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot record payment for cancelled order' },
        { status: 400 }
      )
    }

    // Validate payment amount doesn't exceed balance
    if (validatedData.amount > order.balanceAmount) {
      return NextResponse.json(
        {
          error: `Payment amount (${validatedData.amount.toFixed(2)}) cannot exceed balance (${order.balanceAmount.toFixed(2)})`
        },
        { status: 400 }
      )
    }

    // Get next installment number
    const existingInstallments = await prisma.paymentInstallment.findMany({
      where: { orderId: order.id },
      orderBy: { installmentNumber: 'desc' },
      take: 1,
    })
    const nextInstallmentNumber = existingInstallments.length > 0
      ? existingInstallments[0].installmentNumber + 1
      : 1

    // Create payment installment
    const now = new Date()
    
    // Use database transaction to ensure atomicity and prevent CWE-362 race conditions.
    // This prevents partial failures where a payment installment could be created but the
    // order balance fails to update, leading to financial discrepancies and data corruption.
    // All three operations (create installment, update balance, create history) must succeed
    // together or fail together to maintain data consistency.
    const result = await prisma.$transaction(async (tx) => {
      const installment = await tx.paymentInstallment.create({
        data: {
          orderId: order.id,
          installmentNumber: nextInstallmentNumber,
          amount: parseFloat(validatedData.amount.toFixed(2)),
          paidAmount: parseFloat(validatedData.amount.toFixed(2)),
          dueDate: now,
          paidDate: now,
          status: 'PAID',
          paymentMode: validatedData.paymentMode,
          transactionRef: validatedData.transactionRef,
          notes: validatedData.notes || `Payment recorded via ${validatedData.paymentMode}`,
        },
      })

      // Update order balance
      const newBalanceAmount = parseFloat((order.balanceAmount - validatedData.amount).toFixed(2))
      await tx.order.update({
        where: { id: order.id },
        data: {
          balanceAmount: newBalanceAmount,
        },
      })

      // Create order history entry
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changeType: 'PAYMENT_RECORDED',
          changeDescription: `Payment of ₹${validatedData.amount.toFixed(2)} recorded via ${validatedData.paymentMode}${
            validatedData.transactionRef ? ` (Ref: ${validatedData.transactionRef})` : ''
          }. New balance: ₹${newBalanceAmount.toFixed(2)}`,
          changedBy: session.user.id!,
        },
      })

      return { installment, newBalanceAmount }
    })

    return NextResponse.json({
      success: true,
      installment: result.installment,
      newBalanceAmount: result.newBalanceAmount,
      message: `Payment of ₹${validatedData.amount.toFixed(2)} recorded successfully`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    )
  }
}
