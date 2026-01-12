import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    const alert = await prisma.alert.findUnique({
      where: { id },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    let relatedItem = null
    if (alert.relatedType === 'INVENTORY' && alert.relatedId) {
      relatedItem = await prisma.clothInventory.findUnique({
        where: { id: alert.relatedId },
        include: {
          supplierRel: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      })
    }

    // Mark as read
    await prisma.alert.update({
      where: { id },
      data: { isRead: true },
    })

    return NextResponse.json({ alert, relatedItem })
  } catch (error) {
    console.error('Error fetching alert:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert' },
      { status: 500 }
    )
  }
}
