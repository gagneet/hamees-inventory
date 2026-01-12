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
    const search = searchParams.get('search')

    const where: any = {}

    // Low stock filter
    if (lowStock) {
      where.OR = [
        { currentStock: { lte: prisma.clothInventory.fields.minimum } },
      ]
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
      ]
    }

    const items = await prisma.clothInventory.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        supplierRel: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ items })
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
        name: data.name || 'Unnamed Fabric',
        type: data.type || 'Cotton',
        brand: data.brand || 'Unknown',
        color: data.color || 'Mixed',
        colorHex: data.colorHex || '#000000',
        pattern: data.pattern || 'Plain',
        quality: data.quality || 'Standard',
        pricePerMeter: data.pricePerMeter || 0,
        currentStock: data.currentStock || 0,
        reserved: 0,
        totalPurchased: data.currentStock || 0,
        minimum: data.minimum || 0,
        supplier: data.supplier || 'Unknown',
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
