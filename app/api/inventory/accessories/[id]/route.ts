import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { InsufficientStockError, setAccessoryStockLevel } from '@/lib/stock'

const updateAccessorySchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  color: z.string().nullish(),
  currentStock: z.number().int().nonnegative().optional(),
  pricePerUnit: z.number().nonnegative().optional(),
  minimumStockUnits: z.number().int().nonnegative().optional(),
  notes: z.string().nullish(),
  // Phase 1 Enhancement Fields
  colorCode: z.string().nullish(),
  threadWeight: z.string().nullish(),
  buttonSize: z.string().nullish(),
  holePunchSize: z.string().nullish(),
  material: z.string().nullish(),
  finish: z.string().nullish(),
  recommendedFor: z.array(z.string()).nullish(),
  styleCategory: z.string().nullish(),
  productImage: z.string().nullish(),
  closeUpImage: z.string().nullish(),
  // Optional audit note for history tracking
  _auditNote: z.string().optional(),
})

// GET single accessory item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('view_inventory')
    if (error) return error

    const { id } = await params

    const item = await prisma.accessoryInventory.findUnique({
      where: { id },
      include: {
        supplierRel: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(filterApiResponse(item, session.user.role, 'inventory'))
  } catch (error) {
    console.error('Error fetching accessory item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    )
  }
}

// PATCH update accessory item
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
    const validatedData = updateAccessorySchema.parse(body)

    // Extract audit note (not stored in accessory table)
    const { _auditNote, ...updateData } = validatedData

    // Check if item exists
    const existingItem = await prisma.accessoryInventory.findUnique({
      where: { id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Clean up data: remove undefined/null values to avoid Prisma type issues.
    // Stock is not written here: it goes through lib/stock so it is guarded and audited.
    const { currentStock: newStock, ...descriptive } = updateData
    const cleanedData = Object.fromEntries(
      Object.entries(descriptive).filter(([_, value]) => value !== undefined && value !== null)
    )

    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(cleanedData).length > 0) {
          await tx.accessoryInventory.update({ where: { id }, data: cleanedData as any })
        }
        if (newStock !== undefined && newStock !== existingItem.currentStock) {
          // Row-locked set; refuses to go below the quantity reserved for orders
          const levels = await setAccessoryStockLevel(tx, id, newStock, existingItem.name)
          const delta = levels.currentStock - levels.previousStock
          if (delta !== 0) {
            await tx.accessoryStockMovement.create({
              data: {
                accessoryInventoryId: id,
                userId: session.user.id,
                type: 'ADJUSTMENT',
                quantityUnits: delta,
                balanceAfterUnits: levels.currentStock,
                notes: _auditNote?.trim() || 'Manual stock correction',
              },
            })
          }
        }
      })
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: 'Stock cannot be set below the quantity reserved for orders' },
          { status: 400 }
        )
      }
      throw err
    }

    const updatedItem = await prisma.accessoryInventory.findUnique({
      where: { id },
      include: {
        supplierRel: true,
      },
    })

    return NextResponse.json(filterApiResponse(updatedItem, session.user.role as UserRole, 'inventory'))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating accessory item:', error)
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    )
  }
}

// DELETE accessory item
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
    const existingItem = await prisma.accessoryInventory.findUnique({
      where: { id },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Delete the item (cascade will handle garment accessories)
    await prisma.accessoryInventory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting accessory item:', error)
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    )
  }
}
