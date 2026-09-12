import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { canViewField } from '@/lib/field-acl'
import { actorFromSession, requireOrderAccess } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { formatCurrency } from '@/lib/locale'
import {
  computeOrderBalance,
  isLegacyAdvanceInstallment,
  lockOrder,
  roundMoney,
  safeInstallmentNote,
} from '@/lib/order-finance'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const updateInstallmentSchema = z.object({
  paidAmount: z.number().min(0),
  paidDate: z.string().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'NET_BANKING']).optional(),
  transactionRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
})

/** Validation failure detected against the locked order (reported as 4xx). */
class InstallmentRejected extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/** Recompute and store the parent order's balance after an installment changes. */
async function refreshOrderBalance(tx: TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, totalAmount: true, advancePaid: true, discount: true },
  })
  if (!order) return
  const balanceAmount = await computeOrderBalance(tx, order)
  await tx.order.update({ where: { id: orderId }, data: { balanceAmount } })
}

// GET /api/installments/[id] - Get single installment
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Installments are payment records: only roles that can see payment amounts may read them
    const { session, error } = await requirePermission('view_orders')
    if (error) return error
    if (!canViewField(session.user.role, 'payment', 'amount')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const installment = await prisma.paymentInstallment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    })

    if (!installment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    const denied = await requireOrderAccess(actor, installment.orderId)
    if (denied) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })

    return NextResponse.json(installment)
  } catch (error) {
    console.error('Error fetching installment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch installment' },
      { status: 500 }
    )
  }
}

// PATCH /api/installments/[id] - Record payment for installment (never beyond the order balance)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('record_payment')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const validatedData = updateInstallmentSchema.parse(body)

    const existingInstallment = await prisma.paymentInstallment.findUnique({
      where: { id },
      select: { orderId: true },
    })

    if (!existingInstallment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    const denied = await requireOrderAccess(actor, existingInstallment.orderId)
    if (denied) return NextResponse.json({ error: 'Installment not found' }, { status: 404 })

    await getAppSettings()

    // Lock the order, then re-read: concurrent payments on the same order run one after another
    const updatedInstallment = await prisma.$transaction(async (tx: TransactionClient) => {
      await lockOrder(tx, existingInstallment.orderId)

      const installment = await tx.paymentInstallment.findUnique({ where: { id } })
      if (!installment) throw new InstallmentRejected('Installment not found', 404)
      const order = await tx.order.findUnique({
        where: { id: installment.orderId },
        select: { id: true, status: true, totalAmount: true, advancePaid: true, discount: true },
      })
      if (!order) throw new InstallmentRejected('Installment not found', 404)
      if (order.status === 'CANCELLED') throw new InstallmentRejected('Cannot record payment for a cancelled order')

      // A legacy row that mirrors the advance is not a payment of its own; editing it would count
      // the advance twice. The advance is changed on the order instead.
      if (isLegacyAdvanceInstallment(installment, order.advancePaid)) {
        throw new InstallmentRejected('This installment records the advance. Change the advance on the order instead.')
      }

      // Outstanding balance if this installment's current payment were removed
      const balance = await computeOrderBalance(tx, order)
      const available = roundMoney(balance + (installment.paidAmount || 0))
      const paidAmount = roundMoney(validatedData.paidAmount)
      if (paidAmount > available + 0.005) {
        throw new InstallmentRejected(
          `Payment (${formatCurrency(paidAmount)}) cannot exceed the outstanding balance (${formatCurrency(Math.max(0, available))})`
        )
      }

      type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED'
      let newStatus: InstallmentStatus
      if (paidAmount === 0) {
        newStatus = installment.dueDate < new Date() ? 'OVERDUE' : 'PENDING'
      } else if (paidAmount >= installment.installmentAmount) {
        newStatus = 'PAID'
      } else {
        newStatus = 'PARTIAL'
      }

      await tx.paymentInstallment.update({
        where: { id },
        data: {
          paidAmount,
          paidDate: validatedData.paidDate ? new Date(validatedData.paidDate) : undefined,
          paymentMode: validatedData.paymentMode,
          transactionRef: validatedData.transactionRef,
          notes: safeInstallmentNote(validatedData.notes),
          status: newStatus,
        },
      })
      await refreshOrderBalance(tx, order.id)
      return tx.paymentInstallment.findUnique({ where: { id }, include: { order: true } })
    })

    return NextResponse.json({
      success: true,
      installment: updatedInstallment,
      message: 'Payment recorded successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof InstallmentRejected) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Error updating installment:', error)
    return NextResponse.json(
      { error: 'Failed to update installment' },
      { status: 500 }
    )
  }
}

// DELETE /api/installments/[id] - Delete installment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('delete_order')
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params

    // Check if installment exists
    const installment = await prisma.paymentInstallment.findUnique({
      where: { id },
    })

    if (!installment) {
      return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
    }

    // Don't allow deletion of installments that hold received money
    if (installment.paidAmount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete installments with recorded payments' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.paymentInstallment.delete({ where: { id } })
      await refreshOrderBalance(tx, installment.orderId)
    })

    return NextResponse.json({
      success: true,
      message: 'Installment deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting installment:', error)
    return NextResponse.json(
      { error: 'Failed to delete installment' },
      { status: 500 }
    )
  }
}
