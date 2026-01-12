import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { OrderStatus, OrderPriority, BodyType, StockMovementType } from '@/lib/types'

const orderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  measurementId: z.string().nullish(),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  priority: z.nativeEnum(OrderPriority).default(OrderPriority.NORMAL),
  advancePaid: z.number().min(0).default(0),
  notes: z.string().nullish(),
  items: z.array(
    z.object({
      garmentPatternId: z.string().min(1),
      clothInventoryId: z.string().min(1),
      quantity: z.number().int().positive().default(1),
      bodyType: z.nativeEnum(BodyType).default(BodyType.REGULAR),
      accessories: z.array(
        z.object({
          accessoryId: z.string(),
          quantity: z.number().int().positive().default(1),
        })
      ).optional().default([]),
    })
  ).min(1, 'At least one item is required'),
})

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_orders'])
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const search = searchParams.get('search')
    const fabricId = searchParams.get('fabricId')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const deliveryDateFrom = searchParams.get('deliveryDateFrom')
    const deliveryDateTo = searchParams.get('deliveryDateTo')
    const isOverdue = searchParams.get('isOverdue')

    const where: any = {}

    if (status) {
      where.status = status as OrderStatus
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Filter by fabric (clothInventoryId)
    if (fabricId) {
      where.items = {
        some: {
          clothInventoryId: fabricId
        }
      }
    }

    // Filter by amount range
    if (minAmount || maxAmount) {
      where.totalAmount = {}
      if (minAmount) {
        where.totalAmount.gte = parseFloat(minAmount)
      }
      if (maxAmount) {
        where.totalAmount.lte = parseFloat(maxAmount)
      }
    }

    // Filter by delivery date range
    if (deliveryDateFrom || deliveryDateTo) {
      where.deliveryDate = {}
      if (deliveryDateFrom) {
        where.deliveryDate.gte = new Date(deliveryDateFrom)
      }
      if (deliveryDateTo) {
        where.deliveryDate.lte = new Date(deliveryDateTo)
      }
    }

    // Filter overdue orders (delivery date < today AND not delivered/cancelled)
    if (isOverdue === 'true') {
      where.deliveryDate = {
        ...where.deliveryDate,
        lt: new Date()
      }
      where.status = {
        notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED]
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: {
          include: {
            garmentPattern: true,
            clothInventory: {
              select: {
                id: true,
                name: true,
                color: true,
                colorHex: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const { session, error } = await requireAnyPermission(['create_order'])
  if (error) return error

  try {
    const body = await request.json()
    const validatedData = orderSchema.parse(body)

    // Calculate order details
    let totalAmount = 0
    const orderItems: any[] = []

    for (const item of validatedData.items) {
      // Get pattern and cloth details
      const pattern = await prisma.garmentPattern.findUnique({
        where: { id: item.garmentPatternId },
      })

      const cloth = await prisma.clothInventory.findUnique({
        where: { id: item.clothInventoryId },
      })

      if (!pattern || !cloth) {
        return NextResponse.json(
          { error: 'Invalid pattern or cloth' },
          { status: 400 }
        )
      }

      // Calculate meters needed
      let adjustment = 0
      if (item.bodyType === BodyType.SLIM) adjustment = pattern.slimAdjustment
      if (item.bodyType === BodyType.LARGE) adjustment = pattern.largeAdjustment
      if (item.bodyType === BodyType.XL) adjustment = pattern.xlAdjustment

      const estimatedMeters = (pattern.baseMeters + adjustment) * item.quantity

      // Check stock availability
      const available = cloth.currentStock - cloth.reserved
      if (available < estimatedMeters) {
        return NextResponse.json(
          { error: `Insufficient stock for ${cloth.name}. Available: ${available}m, Required: ${estimatedMeters}m` },
          { status: 400 }
        )
      }

      let itemTotal = estimatedMeters * cloth.pricePerMeter

      // Calculate accessories cost
      if (item.accessories && item.accessories.length > 0) {
        for (const acc of item.accessories) {
          const accessory = await prisma.accessoryInventory.findUnique({
            where: { id: acc.accessoryId },
          })
          if (accessory) {
            const accessoryTotal = acc.quantity * item.quantity * accessory.pricePerUnit
            itemTotal += accessoryTotal
          }
        }
      }

      totalAmount += itemTotal

      orderItems.push({
        garmentPatternId: item.garmentPatternId,
        clothInventoryId: item.clothInventoryId,
        quantity: item.quantity,
        bodyType: item.bodyType,
        estimatedMeters,
        pricePerUnit: itemTotal / item.quantity,
        totalPrice: itemTotal,
      })
    }

    // Add stitching charges (can be customized)
    const stitchingCharges = orderItems.length * 1500
    totalAmount += stitchingCharges

    const balanceAmount = totalAmount - validatedData.advancePaid

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`

    // Create order in transaction
    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: validatedData.customerId,
          measurementId: validatedData.measurementId || undefined,
          userId: session.user.id,
          status: OrderStatus.NEW,
          priority: validatedData.priority,
          deliveryDate: new Date(validatedData.deliveryDate),
          totalAmount,
          advancePaid: validatedData.advancePaid,
          balanceAmount,
          notes: validatedData.notes,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              garmentPattern: true,
              clothInventory: true,
            },
          },
          customer: true,
        },
      })

      // Reserve fabric for each item
      for (const item of newOrder.items) {
        // Update reserved stock
        await tx.clothInventory.update({
          where: { id: item.clothInventoryId },
          data: {
            reserved: {
              increment: item.estimatedMeters,
            },
          },
        })

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            clothInventoryId: item.clothInventoryId,
            orderId: newOrder.id,
            userId: session.user.id,
            type: StockMovementType.ORDER_RESERVED,
            quantity: -item.estimatedMeters,
            balanceAfter: item.clothInventory!.currentStock - item.estimatedMeters,
            notes: `Reserved for order ${newOrder.orderNumber}`,
          },
        })
      }

      return newOrder
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
