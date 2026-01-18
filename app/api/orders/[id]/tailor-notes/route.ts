import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { requireAnyPermission } from '@/lib/api-permissions'

const tailorNoteSchema = z.object({
  note: z.string().min(1, 'Note cannot be empty').max(1000, 'Note is too long'),
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
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - tailors can add notes, also sales/admin/owner
    const { error } = await requireAnyPermission(['update_order', 'manage_orders'])
    if (error) {
      return error
    }

    const { id: orderId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = tailorNoteSchema.parse(body)

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

// Create OrderHistory entry for the tailor note
const historyEntry = await prisma.orderHistory.create({
  data: {
    orderId: order.id,
    userId: session.user.id!,
    changeType: 'TAILOR_NOTE_ADDED',
    changeDescription: validatedData.note,
  },
  include: {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
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
