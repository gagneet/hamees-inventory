import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const garmentPatternSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullish(),
  baseMeters: z.number().positive('Base meters must be positive'),
  slimAdjustment: z.number().default(0),
  regularAdjustment: z.number().default(0),
  largeAdjustment: z.number().default(0.3),
  xlAdjustment: z.number().default(0.5),
  accessories: z.array(z.object({
    accessoryId: z.string(),
    quantity: z.number().positive(),
  })).default([]),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['view_orders', 'create_order'])
  if (error) return error

  try {
    const { id } = await params

    const pattern = await prisma.garmentPattern.findUnique({
      where: { id },
      include: {
        accessories: {
          include: {
            accessory: true,
          },
        },
      },
    })

    if (!pattern) {
      return NextResponse.json(
        { error: 'Garment pattern not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ pattern })
  } catch (error) {
    console.error('Error fetching garment pattern:', error)
    return NextResponse.json(
      { error: 'Failed to fetch garment pattern' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['manage_garment_types'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const data = garmentPatternSchema.parse(body)

    // Delete existing accessories and create new ones
    // @ts-ignore
    await prisma.$transaction(async (tx) => {
      // Delete old accessories
      await tx.garmentAccessory.deleteMany({
        where: { garmentPatternId: id },
      })

      // Update pattern
      await tx.garmentPattern.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          baseMeters: data.baseMeters,
          slimAdjustment: data.slimAdjustment,
          regularAdjustment: data.regularAdjustment,
          largeAdjustment: data.largeAdjustment,
          xlAdjustment: data.xlAdjustment,
          accessories: {
            create: data.accessories.map(acc => ({
              accessoryId: acc.accessoryId,
              quantity: acc.quantity,
            })),
          },
        },
      })
    })

    const updatedPattern = await prisma.garmentPattern.findUnique({
      where: { id },
      include: {
        accessories: {
          include: {
            accessory: true,
          },
        },
      },
    })

    return NextResponse.json({ pattern: updatedPattern })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating garment pattern:', error)
    return NextResponse.json(
      { error: 'Failed to update garment pattern' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['delete_garment_type'])
  if (error) return error

  try {
    const { id } = await params

    // Check if pattern is used in any orders
    const ordersCount = await prisma.orderItem.count({
      where: { garmentPatternId: id },
    })

    if (ordersCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete garment pattern. It is used in ${ordersCount} order(s)` },
        { status: 400 }
      )
    }

    await prisma.garmentPattern.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Garment pattern deleted successfully' })
  } catch (error) {
    console.error('Error deleting garment pattern:', error)
    return NextResponse.json(
      { error: 'Failed to delete garment pattern' },
      { status: 500 }
    )
  }
}
