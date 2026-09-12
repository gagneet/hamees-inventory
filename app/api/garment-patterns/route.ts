import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
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

export async function GET(request: Request) {
  const { session, error } = await requireAnyPermission(['view_garment_types', 'view_orders', 'create_order'])
  if (error) return error

  try {
    const patterns = await prisma.garmentPattern.findMany({
      include: {
        accessories: {
          include: {
            accessory: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Stitching charges / accessory prices are financial data
    return NextResponse.json({ patterns: filterApiResponse(patterns, session.user.role, 'inventory') })
  } catch (error) {
    console.error('Error fetching garment patterns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch garment patterns' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['manage_garment_types'])
  if (error) return error

  try {
    const body = await request.json()
    const data = garmentPatternSchema.parse(body)

    const pattern = await prisma.garmentPattern.create({
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
      include: {
        accessories: {
          include: {
            accessory: true,
          },
        },
      },
    })

    return NextResponse.json({ pattern }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating garment pattern:', error)
    return NextResponse.json(
      { error: 'Failed to create garment pattern' },
      { status: 500 }
    )
  }
}
