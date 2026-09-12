import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requireAnyPermission } from '@/lib/api-permissions'
import { actorFromSession, requireOrderAccess } from '@/lib/authz'

const tailorNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note cannot be empty').max(1000, 'Note is too long'),
})

/**
 * POST /api/orders/[id]/tailor-notes
 * Add a tailor work note to order history
 * Creates an OrderHistory entry with type TAILOR_NOTE_ADDED
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Tailors can add notes on orders in their scope; also sales/admin/owner
  const { session, error } = await requireAnyPermission(['update_order', 'update_order_status'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id: orderId } = await params
    const body = await request.json()
    const validatedData = tailorNoteSchema.parse(body)

    const denied = await requireOrderAccess(actor, orderId)
    if (denied) return denied

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const historyEntry = await prisma.orderHistory.create({
      data: {
        orderId: order.id,
        userId: actor.id,
        changeType: 'TAILOR_NOTE_ADDED',
        description: validatedData.note,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      note: historyEntry,
      message: 'Work note added successfully',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error adding tailor note:', error)
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    )
  }
}
