import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().nullish(),
  items: z.array(
    z.object({
      itemName: z.string().min(1),
      itemType: z.enum(['CLOTH', 'ACCESSORY']),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      pricePerUnit: z.number().nonnegative(),
    })
  ),
  notes: z.string().nullish(),
})

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')

    const where: any = { active: true }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ purchaseOrders })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAnyPermission(['manage_inventory'])
  if (error) return error

  try {
    const body = await request.json()
    const { supplierId, expectedDate, items, notes } = purchaseOrderSchema.parse(body)

    // Calculate totals
    const totalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.pricePerUnit,
      0
    )

    // Generate PO number
    const poCount = await prisma.purchaseOrder.count()
    const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(4, '0')}`

    // Create purchase order with items
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        totalAmount,
        balanceAmount: totalAmount,
        notes: notes || null,
        status: 'PENDING',
        items: {
          create: items.map((item) => ({
            itemName: item.itemName,
            itemType: item.itemType,
            orderedQuantity: item.quantity,
            unit: item.unit,
            pricePerUnit: item.pricePerUnit,
            totalPrice: item.quantity * item.pricePerUnit,
          })),
        },
      },
      include: {
        supplier: true,
        items: true,
      },
    })

    return NextResponse.json({ purchaseOrder }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}
