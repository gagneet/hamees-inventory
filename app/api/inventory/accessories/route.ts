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
    const search = searchParams.get('search')

    const where: any = {}

    // Low stock filter
    if (lowStock) {
      where.currentStock = { lte: prisma.accessoryInventory.fields.minimum }
    }

    // Type filter
    if (type) {
      where.type = type
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
      ]
    }

    const items = await prisma.accessoryInventory.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        supplierRel: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items })
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
        type: data.type || 'Other',
        name: data.name || 'Unnamed Accessory',
        ...(data.color && { color: data.color }),
        currentStock: data.currentStock || 0,
        pricePerUnit: data.pricePerUnit || 0,
        minimum: data.minimum || 0,
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
