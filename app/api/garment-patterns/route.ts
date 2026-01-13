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

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_orders', 'create_order'])
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

    return NextResponse.json({ patterns })
  } catch (error) {
    console.error('Error fetching garment patterns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch garment patterns' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['manage_inventory'])
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
            quantity: acc.quantity,
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
