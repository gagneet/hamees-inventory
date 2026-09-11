import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermission, requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const accessoryInventorySchema = z.object({
  sku: z.string().nullish(),
  type: z.enum(['Button', 'Thread', 'Zipper', 'Lining', 'Elastic', 'Hook', 'Other']).nullish(),
  name: z.string().nullish(),
  color: z.string().nullish(),
  currentStock: z.number().int().nonnegative().nullish(),
  pricePerUnit: z.number().nonnegative().nullish(),
  minimumStockUnits: z.number().int().nonnegative().nullish(),
  supplierId: z.string().nullish(),
})

// GET all accessory inventory
// Order takers (create_order) need the accessory list for the order form; prices are filtered by role.
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAnyPermission(['view_inventory', 'create_order'])
    if (error) return error

    const { searchParams } = new URL(request.url)
    const lowStock = searchParams.get('lowStock') === 'true'
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '25') || 25))
    const skip = (page - 1) * limit

    const where: any = {}

    // Low stock filter
    if (lowStock) {
      where.currentStock = { lte: prisma.accessoryInventory.fields.minimumStockUnits }
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

    // Get total count for pagination
    const totalItems = await prisma.accessoryInventory.count({
      where: Object.keys(where).length > 0 ? where : undefined,
    })

    const items = await prisma.accessoryInventory.findMany({
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
      accessories: visibleItems,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    })
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
    const { error } = await requirePermission('add_inventory')
    if (error) return error

    const body = await request.json()
    const data = accessoryInventorySchema.parse(body)

    // Generate SKU if not provided
    const sku = data.sku || `ACC-${(data.type || 'OTH').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`

    const accessoryItem = await prisma.accessoryInventory.create({
      data: {
        sku,
        type: data.type || 'Other',
        name: data.name || 'Unnamed Accessory',
        ...(data.color && { color: data.color }),
        currentStock: data.currentStock || 0,
        pricePerUnit: data.pricePerUnit || 0,
        minimumStockUnits: data.minimumStockUnits || 0,
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
