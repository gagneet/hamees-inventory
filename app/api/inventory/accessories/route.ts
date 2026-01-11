import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const accessoryInventorySchema = z.object({
  type: z.enum(['Button', 'Thread', 'Zipper', 'Lining', 'Elastic', 'Hook', 'Other']).nullish(),
  name: z.string().nullish(),
  color: z.string().nullish(),
  currentStock: z.number().nullish(),
  pricePerUnit: z.number().nullish(),
  minimum: z.number().nullish(),
  supplierId: z.string().nullish(),
})

// GET all accessory inventory
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lowStock = searchParams.get('lowStock') === 'true'
    const type = searchParams.get('type')

    const accessories = await prisma.accessoryInventory.findMany({
      where: {
        ...(lowStock && {
          currentStock: { lte: prisma.accessoryInventory.fields.minimum },
        }),
        ...(type && { type }),
      },
      include: {
        supplierRel: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(accessories)
  } catch (error) {
    console.error('Error fetching accessory inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

// POST create new accessory inventory item
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = accessoryInventorySchema.parse(body)

    const accessoryItem = await prisma.accessoryInventory.create({
      data: {
        type: data.type,
        name: data.name,
        ...(data.color && { color: data.color }),
        currentStock: data.currentStock,
        pricePerUnit: data.pricePerUnit,
        minimum: data.minimum,
        ...(data.supplierId && { supplierId: data.supplierId }),
      },
      include: {
        supplierRel: true,
      },
    })

    return NextResponse.json(accessoryItem, { status: 201 })
  } catch (error) {
    console.error('Error creating accessory inventory:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid data', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 }
    )
  }
}
