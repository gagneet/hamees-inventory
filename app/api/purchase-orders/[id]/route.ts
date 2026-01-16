import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: true,
      },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    return NextResponse.json({ purchaseOrder })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['delete_purchase_order'])
  if (error) return error

  try {
    const { id } = await params

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Only allow deletion if status is PENDING
    if (purchaseOrder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete pending purchase orders' },
        { status: 400 }
      )
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { active: false, status: 'CANCELLED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    )
  }
}
