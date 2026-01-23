import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { hasPermission, type UserRole } from '@/lib/permissions'

const updateAccessorySchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  color: z.string().nullish(),
  currentStock: z.number().int().optional(),
  pricePerUnit: z.number().optional(),
  minimum: z.number().int().optional(),
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
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    return NextResponse.json(item)
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

    // Clean up data: remove undefined/null values to avoid Prisma type issues
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null)
    )

    // Update the item (accessories don't have stock movements, simpler update)
    const updatedItem = await prisma.accessoryInventory.update({
      where: { id },
      data: cleanedData as any,
      include: {
        supplierRel: true,
      },
    })

    return NextResponse.json(updatedItem)
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
