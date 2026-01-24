import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { hasPermission, type UserRole } from '@/lib/permissions'

// Type for Prisma transaction client
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const updateClothSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  pattern: z.string().optional(),
  quality: z.string().optional(),
  pricePerMeter: z.number().optional(),
  currentStock: z.number().optional(),
  minimum: z.number().optional(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
  // Phase 1 Enhancement Fields
  fabricComposition: z.string().nullish(),
  gsm: z.number().int().nullish(),
  threadCount: z.number().int().nullish(),
  weaveType: z.string().nullish(),
  fabricWidth: z.string().nullish(),
  shrinkagePercent: z.number().nullish(),
  colorFastness: z.string().nullish(),
  seasonSuitability: z.array(z.string()).nullish(),
  occasionType: z.array(z.string()).nullish(),
  careInstructions: z.string().nullish(),
  swatchImage: z.string().nullish(),
  textureImage: z.string().nullish(),
  // Optional audit note for history tracking
  _auditNote: z.string().optional(),
})

// GET single cloth item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const item = await prisma.clothInventory.findUnique({
      where: { id },
      include: {
        supplierRel: true,
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('Error fetching cloth item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PATCH update cloth item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - ADMIN or INVENTORY_MANAGER only
    if (!hasPermission(session.user.role as UserRole, 'manage_inventory')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateClothSchema.parse(body)

    // Extract audit note (not stored in cloth table)
    const { _auditNote, ...updateData } = validatedData

    // Check if item exists
    const existingItem = await prisma.clothInventory.findUnique({
      where: { id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if stock is changing
    const stockChanged = updateData.currentStock !== undefined &&
                        updateData.currentStock !== existingItem.currentStock

    // Clean up data: remove undefined/null values to avoid Prisma type issues
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null)
    )

    // Update item and create stock movement if needed (in transaction)
    const updatedItem = await prisma.$transaction(async (tx: TransactionClient) => {
      // Update the cloth item
      const updated = await tx.clothInventory.update({
        where: { id },
        data: cleanedData,
        include: {
          supplierRel: true,
        },
      })

      // Create stock movement record if stock changed
      if (stockChanged && updateData.currentStock !== undefined) {
        const quantityChange = updateData.currentStock - existingItem.currentStock

        await tx.stockMovement.create({
          data: {
            clothInventoryId: id,
            userId: session.user.id,
            type: 'ADJUSTMENT',
            quantityMeters: quantityChange,
            balanceAfterMeters: updateData.currentStock,
            notes: _auditNote || `Stock adjusted from ${existingItem.currentStock}m to ${updateData.currentStock}m`,
          },
        })
      }

      return updated
    })

    return NextResponse.json(updatedItem)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating cloth item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE cloth item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user.role as UserRole, 'delete_inventory')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Check if item exists
    const existingItem = await prisma.clothInventory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Prevent deletion if item is used in orders
    if (existingItem._count.orderItems > 0) {
      return NextResponse.json(
        { error: 'Cannot delete item that is used in orders' },
        { status: 400 }
      )
    }

    // Delete the item
    await prisma.clothInventory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting cloth item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
