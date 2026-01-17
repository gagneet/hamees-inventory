import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const orderEditSchema = z.object({
  deliveryDate: z.string().datetime().optional(),
  advancePaid: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  discountReason: z.string().nullish(),
  notes: z.string().nullish(),
  tailorNotes: z.string().nullish(),
  priority: z.enum(['NORMAL', 'URGENT']).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['update_order'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const data = orderEditSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

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
        description: `Delivery date changed from ${order.deliveryDate.toLocaleDateString('en-IN')} to ${new Date(data.deliveryDate).toLocaleDateString('en-IN')}`,
      })
    }

    if (data.advancePaid !== undefined && data.advancePaid !== order.advancePaid) {
      changes.push({
        field: 'advancePaid',
        oldValue: order.advancePaid.toString(),
        newValue: data.advancePaid.toString(),
        description: `Advance payment changed from ₹${order.advancePaid} to ₹${data.advancePaid}`,
      })
    }

    if (data.discount !== undefined && data.discount !== order.discount) {
      changes.push({
        field: 'discount',
        oldValue: order.discount.toString(),
        newValue: data.discount.toString(),
        description: `Discount changed from ₹${order.discount} to ₹${data.discount}${data.discountReason ? ` (Reason: ${data.discountReason})` : ''}`,
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
    // Round to 2 decimal places to avoid floating-point precision errors
    const balanceAmount = parseFloat((order.totalAmount - advancePaid - discount).toFixed(2))

    // Update order and create history in a transaction
    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      // Update the order
      await tx.order.update({
        where: { id },
        data: {
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : order.deliveryDate,
          advancePaid: data.advancePaid ?? order.advancePaid,
          discount: data.discount ?? order.discount,
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
            userId: session.user.id,
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

    return NextResponse.json({ order: updatedOrder })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
