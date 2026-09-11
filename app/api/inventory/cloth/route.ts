import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermission, requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { prisma } from '@/lib/db'
import { roundMeters } from '@/lib/stock'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const clothInventorySchema = z.object({
  sku: z.string().nullish(),
  name: z.string().nullish(),
  type: z.string().nullish(),
  brand: z.string().nullish(),
  color: z.string().nullish(),
  colorHex: z.string().nullish().default('#000000'),
  pattern: z.string().nullish(),
  quality: z.string().nullish(),
  pricePerMeter: z.number().nonnegative().nullish(),
  currentStock: z.number().nonnegative().nullish(),
  minimumStockMeters: z.number().nonnegative().nullish(),
  supplier: z.string().nullish(),
  supplierId: z.string().nullish(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
})

// GET all cloth inventory
// Order takers (create_order) need the fabric list for the order form; prices are filtered by role.
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAnyPermission(['view_inventory', 'create_order'])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const lowStock = searchParams.get('lowStock') === 'true'
    const search = searchParams.get('search')

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '25') || 25))
    const skip = (page - 1) * limit

    const where: any = {}

    // Low stock filter
    if (lowStock) {
      where.OR = [
        { currentStock: { lte: prisma.clothInventory.fields.minimumStockMeters } },
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

    // Get total count for pagination
    const totalItems = await prisma.clothInventory.count({
      where: Object.keys(where).length > 0 ? where : undefined,
    })

    const items = await prisma.clothInventory.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        supplierRel: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    const totalPages = Math.ceil(totalItems / limit)
    const visibleItems = filterApiResponse(items, session.user.role, 'inventory')

    return NextResponse.json({
      items: visibleItems,
      clothInventory: visibleItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    })
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
    const { session, error } = await requirePermission('add_inventory')
    if (error) return error

    const body = await request.json()
    const data = clothInventorySchema.parse(body)

    // Generate SKU if not provided
    const sku = data.sku || `CLT-${(data.type || 'UNK').substring(0, 3).toUpperCase()}-${(data.brand || 'UNK').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email || undefined },
      select: { id: true }
    })

    if (!user) {
      console.error('User not found in database:', session.user.email)
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Use transaction to ensure atomicity
    const initialStock = roundMeters(data.currentStock || 0)

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const clothItem = await tx.clothInventory.create({
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
          currentStock: initialStock,
          reserved: 0,
          totalPurchased: initialStock,
          minimumStockMeters: data.minimumStockMeters || 0,
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
      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            clothInventoryId: clothItem.id,
            type: 'PURCHASE',
            quantityMeters: initialStock,
            balanceAfterMeters: initialStock,
            userId: user.id, // Use verified user ID
            notes: 'Initial stock',
          },
        })
      }

      return clothItem
    })

    return NextResponse.json(result, { status: 201 })
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
