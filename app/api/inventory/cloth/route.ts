import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const clothInventorySchema = z.object({
  sku: z.string().nullish(),
  name: z.string().nullish(),
  type: z.string().nullish(),
  brand: z.string().nullish(),
  color: z.string().nullish(),
  colorHex: z.string().nullish().default('#000000'),
  pattern: z.string().nullish(),
  quality: z.string().nullish(),
  pricePerMeter: z.number().nullish(),
  currentStock: z.number().nullish(),
  minimum: z.number().nullish(),
  supplier: z.string().nullish(),
  supplierId: z.string().nullish(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
})

// GET all cloth inventory
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lowStock = searchParams.get('lowStock') === 'true'

    const clothInventory = await prisma.clothInventory.findMany({
      where: lowStock
        ? {
            OR: [
              { currentStock: { lte: prisma.clothInventory.fields.minimum } },
            ],
          }
        : undefined,
      include: {
        supplierRel: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(clothInventory)
  } catch (error) {
    console.error('Error fetching cloth inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

// POST create new cloth inventory item
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = clothInventorySchema.parse(body)

    // Generate SKU if not provided
    const sku = data.sku || `CLT-${(data.type || 'UNK').substring(0, 3).toUpperCase()}-${(data.brand || 'UNK').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    const clothItem = await prisma.clothInventory.create({
      data: {
        sku,
        name: data.name,
        type: data.type,
        brand: data.brand,
        color: data.color,
        colorHex: data.colorHex,
        pattern: data.pattern,
        quality: data.quality,
        pricePerMeter: data.pricePerMeter,
        currentStock: data.currentStock,
        reserved: 0,
        totalPurchased: data.currentStock,
        minimum: data.minimum,
        supplier: data.supplier,
        ...(data.supplierId && { supplierId: data.supplierId }),
        ...(data.location && { location: data.location }),
        ...(data.notes && { notes: data.notes }),
      },
      include: {
        supplierRel: true,
      },
    })

    // Create stock movement for initial stock
    if (data.currentStock && data.currentStock > 0) {
      await prisma.stockMovement.create({
        data: {
          clothInventoryId: clothItem.id,
          type: 'PURCHASE',
          quantity: data.currentStock,
          balanceAfter: data.currentStock,
          userId: session.user.id,
          notes: 'Initial stock',
        },
      })
    }

    return NextResponse.json(clothItem, { status: 201 })
  } catch (error) {
    console.error('Error creating cloth inventory:', error)
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
