import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { z } from 'zod'

const adjustStockSchema = z.object({
  quantity: z.number(), // Positive for additions, negative for reductions
  type: z.enum(['PURCHASE', 'ADJUSTMENT', 'RETURN', 'WASTAGE']),
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check permissions - ADMIN or INVENTORY_MANAGER only
  if (!hasPermission(session.user.role as UserRole, 'manage_inventory')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const validatedData = adjustStockSchema.parse(body)

    // Get current cloth item
    const cloth = await prisma.clothInventory.findUnique({
      where: { id },
    })

    if (!cloth) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Calculate new stock
    const newStock = cloth.currentStock + validatedData.quantity

    if (newStock < 0) {
      return NextResponse.json(
        { error: 'Insufficient stock for reduction' },
        { status: 400 }
      )
    }

    // Update stock and create movement in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Update cloth inventory
      const updated = await tx.clothInventory.update({
        where: { id },
        data: {
          currentStock: newStock,
          totalPurchased:
            validatedData.type === 'PURCHASE'
              ? cloth.totalPurchased + validatedData.quantity
              : cloth.totalPurchased,
        },
      })

      // Create stock movement record
      await tx.stockMovement.create({
        data: {
          clothInventoryId: id,
          userId: session.user.id,
          type: validatedData.type,
          quantity: validatedData.quantity,
          balanceAfter: newStock,
          notes:
            validatedData.notes ||
            `Stock ${validatedData.type.toLowerCase()} - ${validatedData.quantity >= 0 ? '+' : ''}${validatedData.quantity}m`,
        },
      })

      return updated
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error adjusting stock:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    )
  }
}
