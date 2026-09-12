import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { hasPermission } from '@/lib/permissions'
import { actorFromSession, requireOrderAccess } from '@/lib/authz'
import { getAppSettings } from '@/lib/settings'
import { formatCurrency, formatDate } from '@/lib/locale'
import {
  computeOrderBalance,
  installmentsPaid,
  lockOrder,
  roundMoney,
  syncLegacyAdvanceInstallment,
} from '@/lib/order-finance'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Validation failure detected against the locked order (reported as 400). */
class OrderEditRejected extends Error {}

const orderEditSchema = z.object({
  deliveryDate: z.string().datetime().optional(),
  advancePaid: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  discountReason: z.string().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
  tailorNotes: z.string().max(5000).nullish(),
  priority: z.enum(['NORMAL', 'URGENT']).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const data = orderEditSchema.parse(body)

    const denied = await requireOrderAccess(actor, id)
    if (denied) return denied

    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Changing money received or discounts is a payment operation
    const touchesPayments =
      (data.advancePaid !== undefined && data.advancePaid !== order.advancePaid) ||
      (data.discount !== undefined && data.discount !== order.discount) ||
      (data.discountReason !== undefined && data.discountReason !== order.discountReason)
    if (touchesPayments && !hasPermission(actor.role, 'record_payment')) {
      return NextResponse.json({ error: 'Your role cannot change advance payments or discounts' }, { status: 403 })
    }

    // Prime locale formatting with the shop's currency/time zone
    await getAppSettings()

    // Track changes for audit
    const changes: Array<{
      field: string
      oldValue: string
      newValue: string
      description: string
    }> = []

    if (data.deliveryDate && data.deliveryDate !== order.deliveryDate.toISOString()) {
      changes.push({
        field: 'deliveryDate',
        oldValue: order.deliveryDate.toISOString(),
        newValue: data.deliveryDate,
        description: `Delivery date changed from ${formatDate(order.deliveryDate)} to ${formatDate(data.deliveryDate)}`,
      })
    }

    if (data.advancePaid !== undefined && data.advancePaid !== order.advancePaid) {
      changes.push({
        field: 'advancePaid',
        oldValue: order.advancePaid.toString(),
        newValue: data.advancePaid.toString(),
        description: `Advance payment changed from ${formatCurrency(order.advancePaid)} to ${formatCurrency(data.advancePaid)}`,
      })
    }

    if (data.discount !== undefined && data.discount !== order.discount) {
      changes.push({
        field: 'discount',
        oldValue: order.discount.toString(),
        newValue: data.discount.toString(),
        description: `Discount changed from ${formatCurrency(order.discount)} to ${formatCurrency(data.discount)}${data.discountReason ? ` (Reason: ${data.discountReason})` : ''}`,
      })
    }

    if (data.discountReason !== undefined && data.discountReason !== order.discountReason) {
      changes.push({
        field: 'discountReason',
        oldValue: order.discountReason || '(empty)',
        newValue: data.discountReason || '(empty)',
        description: 'Discount reason updated',
      })
    }

    if (data.notes !== undefined && data.notes !== order.notes) {
      changes.push({
        field: 'notes',
        oldValue: order.notes || '(empty)',
        newValue: data.notes || '(empty)',
        description: 'Customer notes updated',
      })
    }

    if (data.tailorNotes !== undefined && data.tailorNotes !== order.tailorNotes) {
      changes.push({
        field: 'tailorNotes',
        oldValue: order.tailorNotes || '(empty)',
        newValue: data.tailorNotes || '(empty)',
        description: 'Tailor notes updated',
      })
    }

    if (data.priority && data.priority !== order.priority) {
      changes.push({
        field: 'priority',
        oldValue: order.priority,
        newValue: data.priority,
        description: `Priority changed from ${order.priority} to ${data.priority}`,
      })
    }

    if (changes.length === 0) {
      return NextResponse.json({ message: 'No changes detected' })
    }

    // Calculate new balance if advance or discount changed
    const advancePaid = data.advancePaid ?? order.advancePaid
    const discount = data.discount ?? order.discount

    // Update order and create history in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // Lock the order so a payment recorded at the same time is included in the check below
      await lockOrder(tx, id)
      const current = await tx.order.findUnique({
        where: { id },
        select: { totalAmount: true, advancePaid: true },
      })
      if (!current) throw new OrderEditRejected('Order not found')

      // Advance + discount + balance payments already received must not exceed the total
      const paidViaInstallments = await installmentsPaid(tx, { id, advancePaid: current.advancePaid })
      if (roundMoney(advancePaid + discount + paidViaInstallments) > current.totalAmount + 0.005) {
        throw new OrderEditRejected(
          `Advance payment (${formatCurrency(advancePaid)}) plus discount (${formatCurrency(discount)})` +
            (paidViaInstallments > 0 ? ` plus payments received (${formatCurrency(paidViaInstallments)})` : '') +
            ` cannot exceed total order amount (${formatCurrency(current.totalAmount)})`
        )
      }

      // A legacy installment that mirrors the advance must keep mirroring it
      await syncLegacyAdvanceInstallment(tx, id, current.advancePaid, advancePaid)

      // Balance = Total - Advance - Discount - Balance Installments (legacy-safe, see lib/order-finance.ts)
      const balanceAmount = await computeOrderBalance(tx, {
        id,
        totalAmount: current.totalAmount,
        advancePaid,
        discount,
      })

      await tx.order.update({
        where: { id },
        data: {
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : order.deliveryDate,
          advancePaid,
          discount,
          discountReason: data.discountReason !== undefined ? data.discountReason : order.discountReason,
          balanceAmount,
          notes: data.notes !== undefined ? data.notes : order.notes,
          tailorNotes: data.tailorNotes !== undefined ? data.tailorNotes : order.tailorNotes,
          priority: data.priority ?? order.priority,
        },
      })

      // Create audit history records for each change
      for (const change of changes) {
        await tx.orderHistory.create({
          data: {
            orderId: order.id,
            userId: actor.id,
            changeType: 'ORDER_EDIT',
            fieldName: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            description: change.description,
          },
        })
      }
    })

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            garmentPattern: true,
            clothInventory: true,
          },
        },
      },
    })

    // FEATURETRACE: Apply ACL field filtering to response
    const filtered = filterApiResponse(updatedOrder, actor.role, 'order')

    return NextResponse.json({ order: filtered })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof OrderEditRejected) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
