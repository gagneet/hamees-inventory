import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Verify cloth item exists
    const cloth = await prisma.clothInventory.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!cloth) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Fetch stock movement history
    const movements = await prisma.stockMovement.findMany({
      where: { clothInventoryId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      cloth,
      movements,
      totalMovements: movements.length,
    })
  } catch (error) {
    console.error('Error fetching stock movement history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
