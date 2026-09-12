import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
import { z } from 'zod'

const garmentPatternSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(1000).nullish(),
  baseMeters: z.number().positive('Base meters must be positive'),
  slimAdjustment: z.number().default(0),
  regularAdjustment: z.number().default(0),
  largeAdjustment: z.number().default(0.3),
  xlAdjustment: z.number().default(0.5),
  // The forms send `quantity`; the column is GarmentAccessory.quantityPerGarment (Int)
  accessories: z.array(
    z
      .object({
        accessoryId: z.string().min(1),
        quantity: z.number().int().positive().optional(),
        quantityPerGarment: z.number().int().positive().optional(),
      })
      .transform((acc, ctx) => {
        const quantityPerGarment = acc.quantityPerGarment ?? acc.quantity
        if (quantityPerGarment === undefined) {
          ctx.addIssue({ code: 'custom', message: 'Accessory quantity is required' })
          return z.NEVER
        }
        return { accessoryId: acc.accessoryId, quantityPerGarment }
      })
  ).max(50).default([]),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAnyPermission(['view_garment_types', 'view_orders', 'create_order'])
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

    return NextResponse.json({ pattern: filterApiResponse(pattern, session.user.role, 'inventory') })
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

    const existing = await prisma.garmentPattern.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Garment pattern not found' }, { status: 404 })
    }

    // Delete existing accessories and create new ones
    await prisma.$transaction(async (tx: TransactionClient) => {
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
              quantityPerGarment: acc.quantityPerGarment,
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
