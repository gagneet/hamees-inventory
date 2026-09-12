import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { prisma } from '@/lib/db'
import { changeClothStock, InsufficientStockError, roundMeters } from '@/lib/stock'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const adjustStockSchema = z
  .object({
    quantity: z.number().finite().refine((n) => roundMeters(n) !== 0, 'Quantity must not be zero'), // + additions, − reductions
    type: z.enum(['PURCHASE', 'ADJUSTMENT', 'RETURN', 'WASTAGE']),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => data.type !== 'PURCHASE' || data.quantity > 0, {
    message: 'Purchases must add stock',
    path: ['quantity'],
  })

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requirePermission('manage_inventory')
  if (error) return error

  try {
    const { id } = await context.params
    const body = await request.json()
    const validatedData = adjustStockSchema.parse(body)
    const quantity = roundMeters(validatedData.quantity)

    const cloth = await prisma.clothInventory.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!cloth) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Atomic, guarded update: stock can't drop below what's reserved for orders
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const levels = await changeClothStock(tx, id, quantity, {
        countAsPurchase: validatedData.type === 'PURCHASE',
        label: cloth.name,
      })

      await tx.stockMovement.create({
        data: {
          clothInventoryId: id,
          userId: session.user.id,
          type: validatedData.type,
          quantityMeters: quantity,
          balanceAfterMeters: levels.currentStock,
          notes:
            validatedData.notes ||
            `Stock ${validatedData.type.toLowerCase()} - ${quantity >= 0 ? '+' : ''}${quantity}m`,
        },
      })

      return tx.clothInventory.findUnique({ where: { id } })
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error adjusting stock:', error)
    return NextResponse.json(
      { error: 'Failed to adjust stock' },
      { status: 500 }
    )
  }
}
