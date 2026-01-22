import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'
import { OrderStatus, OrderPriority, BodyType, StockMovementType, StitchingTier } from '@/lib/types'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const orderSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  measurementId: z.string().nullish(),
  deliveryDate: z.string().min(1, 'Delivery date is required'),
  priority: z.nativeEnum(OrderPriority).default(OrderPriority.NORMAL),
  advancePaid: z.number().min(0).default(0),
  notes: z.string().nullish(),

  // ✨ PREMIUM PRICING SYSTEM (v0.22.0) - New fields
  stitchingTier: z.nativeEnum(StitchingTier).default(StitchingTier.BASIC),
  fabricWastagePercent: z.number().min(0).max(15).default(0),
  designerConsultationFee: z.number().min(0).default(0),

  // Workmanship premiums
  isHandStitched: z.boolean().default(false),
  isFullCanvas: z.boolean().default(false),
  isRushOrder: z.boolean().default(false),
  hasComplexDesign: z.boolean().default(false),
  additionalFittings: z.number().int().min(0).default(0),
  hasPremiumLining: z.boolean().default(false),

  // Manual overrides
  isFabricCostOverridden: z.boolean().default(false),
  fabricCostOverride: z.number().nullish(),
  fabricCostOverrideReason: z.string().nullish(),

  isStitchingCostOverridden: z.boolean().default(false),
  stitchingCostOverride: z.number().nullish(),
  stitchingCostOverrideReason: z.string().nullish(),

  isAccessoriesCostOverridden: z.boolean().default(false),
  accessoriesCostOverride: z.number().nullish(),
  accessoriesCostOverrideReason: z.string().nullish(),

  pricingNotes: z.string().nullish(),

  items: z.array(
    z.object({
      garmentPatternId: z.string().min(1),
      clothInventoryId: z.string().min(1),
      quantity: z.number().int().positive().default(1),
      bodyType: z.nativeEnum(BodyType).default(BodyType.REGULAR),
      assignedTailorId: z.string().nullish(), // Optional tailor assignment
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
    const balanceAmount = searchParams.get('balanceAmount')

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

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

    // Filter by balance amount (supports gt:0, gte:100, lt:500, lte:1000, eq:0)
    if (balanceAmount) {
      const [operator, value] = balanceAmount.split(':')
      const numValue = parseFloat(value)

      if (!isNaN(numValue)) {
        where.balanceAmount = {}
        switch (operator) {
          case 'gt':
            // Use 0.01 threshold to exclude floating-point errors near zero
            where.balanceAmount.gt = numValue === 0 ? 0.01 : numValue
            break
          case 'gte':
            where.balanceAmount.gte = numValue
            break
          case 'lt':
            where.balanceAmount.lt = numValue
            break
          case 'lte':
            where.balanceAmount.lte = numValue
            break
          case 'eq':
            // For equality, use a range to account for floating-point precision
            if (numValue === 0) {
              where.balanceAmount = {
                gte: -0.01,
                lte: 0.01
              }
            } else {
              where.balanceAmount.equals = numValue
            }
            break
          default:
            // If no operator, treat as gt (greater than) with 0.01 threshold
            where.balanceAmount.gt = parseFloat(balanceAmount) === 0 ? 0.01 : parseFloat(balanceAmount)
        }
      }
    }

    // Parallelize count and fetch queries to avoid sequential waiting
    const [totalItems, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
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
        orderBy: { balanceAmount: 'desc' }, // Sort by balance amount (high to low) by default
        skip,
        take: limit,
      }),
    ])

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    })
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

    // ✨ PREMIUM PRICING SYSTEM (v0.22.0) - Itemized cost calculation
    let fabricCost = 0
    let accessoriesCost = 0
    let stitchingCost = 0
    const orderItems: any[] = []

    // Extract unique IDs to fetch all required data in parallel (avoid N+1 queries)
    const patternIds = [...new Set(validatedData.items.map(item => item.garmentPatternId))]
    const clothIds = [...new Set(validatedData.items.map(item => item.clothInventoryId))]
    const accessoryIds = [...new Set(
      validatedData.items
        .flatMap(item => item.accessories || [])
        .map(acc => acc.accessoryId)
    )]

    // Fetch all data in parallel to avoid async waterfalls
    const [customerMeasurements, patterns, cloths, accessories] = await Promise.all([
      prisma.measurement.findMany({
        where: {
          customerId: validatedData.customerId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.garmentPattern.findMany({
        where: { id: { in: patternIds } },
      }),
      prisma.clothInventory.findMany({
        where: { id: { in: clothIds } },
      }),
      accessoryIds.length > 0
        ? prisma.accessoryInventory.findMany({
            where: { id: { in: accessoryIds } },
          })
        : Promise.resolve([]),
    ])

    // Create lookup maps for O(1) access
    const patternMap = new Map(patterns.map(p => [p.id, p]))
    const clothMap = new Map(cloths.map(c => [c.id, c]))
    const accessoryMap = new Map(accessories.map(a => [a.id, a]))

    for (const item of validatedData.items) {
      // Get pattern and cloth from lookup maps
      const pattern = patternMap.get(item.garmentPatternId)
      const cloth = clothMap.get(item.clothInventoryId)

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

      // Calculate fabric cost
      const itemFabricCost = estimatedMeters * cloth.pricePerMeter
      fabricCost += itemFabricCost

      // Calculate accessories cost using lookup map
      let itemAccessoriesCost = 0
      if (item.accessories && item.accessories.length > 0) {
        for (const acc of item.accessories) {
          const accessory = accessoryMap.get(acc.accessoryId)
          if (accessory) {
            const accessoryTotal = acc.quantity * item.quantity * accessory.pricePerUnit
            itemAccessoriesCost += accessoryTotal
          }
        }
      }
      accessoriesCost += itemAccessoriesCost

      // Calculate stitching cost based on tier
      let tierCharge = pattern.basicStitchingCharge // Default to BASIC
      if (validatedData.stitchingTier === StitchingTier.PREMIUM) {
        tierCharge = pattern.premiumStitchingCharge
      } else if (validatedData.stitchingTier === StitchingTier.LUXURY) {
        tierCharge = pattern.luxuryStitchingCharge
      }
      stitchingCost += tierCharge * item.quantity

      // Find matching measurement for this garment type
      const garmentTypeName = pattern.name.replace(/^(Men's|Women's|Kids)\s+/i, '').trim()
      const matchingMeasurement = customerMeasurements.find(
        m => m.garmentType.toLowerCase() === garmentTypeName.toLowerCase()
      )

      // Calculate item total
      const itemTotal = itemFabricCost + itemAccessoriesCost

      orderItems.push({
        garmentPatternId: item.garmentPatternId,
        clothInventoryId: item.clothInventoryId,
        quantity: item.quantity,
        bodyType: item.bodyType,
        estimatedMeters,
        pricePerUnit: itemTotal / item.quantity,
        totalPrice: itemTotal,
        measurementId: matchingMeasurement?.id,
        assignedTailorId: item.assignedTailorId || undefined,
      })
    }

    // Apply fabric wastage
    const fabricWastageAmount = parseFloat((fabricCost * (validatedData.fabricWastagePercent / 100)).toFixed(2))

    // Calculate workmanship premiums
    let workmanshipPremiums = 0
    let handStitchingCost = 0
    let fullCanvasCost = 0
    let rushOrderCost = 0
    let complexDesignCost = 0
    let additionalFittingsCost = 0
    let premiumLiningCost = 0

    if (validatedData.isHandStitched) {
      handStitchingCost = parseFloat((stitchingCost * 0.40).toFixed(2)) // +40%
      workmanshipPremiums += handStitchingCost
    }

    if (validatedData.isFullCanvas) {
      fullCanvasCost = 5000 // Fixed premium
      workmanshipPremiums += fullCanvasCost
    }

    if (validatedData.isRushOrder) {
      rushOrderCost = parseFloat((stitchingCost * 0.50).toFixed(2)) // +50%
      workmanshipPremiums += rushOrderCost
    }

    if (validatedData.hasComplexDesign) {
      complexDesignCost = parseFloat((stitchingCost * 0.30).toFixed(2)) // +30%
      workmanshipPremiums += complexDesignCost
    }

    if (validatedData.additionalFittings > 0) {
      additionalFittingsCost = validatedData.additionalFittings * 1500
      workmanshipPremiums += additionalFittingsCost
    }

    if (validatedData.hasPremiumLining) {
      premiumLiningCost = 5000 // Fixed premium
      workmanshipPremiums += premiumLiningCost
    }

    // Apply manual overrides
    if (validatedData.isFabricCostOverridden && validatedData.fabricCostOverride != null) {
      fabricCost = validatedData.fabricCostOverride
    }

    if (validatedData.isStitchingCostOverridden && validatedData.stitchingCostOverride != null) {
      stitchingCost = validatedData.stitchingCostOverride
    }

    if (validatedData.isAccessoriesCostOverridden && validatedData.accessoriesCostOverride != null) {
      accessoriesCost = validatedData.accessoriesCostOverride
    }

    // Calculate subtotal
    const subTotal = parseFloat((
      fabricCost +
      fabricWastageAmount +
      accessoriesCost +
      stitchingCost +
      workmanshipPremiums +
      validatedData.designerConsultationFee
    ).toFixed(2))

    // Calculate GST (12% for garments - split into CGST 6% + SGST 6% for intra-state)
    const gstRate = 12
    const gstAmount = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
    const cgst = parseFloat((gstAmount / 2).toFixed(2))
    const sgst = parseFloat((gstAmount / 2).toFixed(2))
    const igst = 0 // Assuming intra-state transaction
    const taxableAmount = subTotal
    const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))

    // Round to 2 decimal places to avoid floating-point precision errors
    const balanceAmount = parseFloat((totalAmount - validatedData.advancePaid).toFixed(2))

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`

    // Create order in transaction
    const order = await prisma.$transaction(async (tx: TransactionClient) => {
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

          // ✨ PREMIUM PRICING SYSTEM (v0.22.0) - Itemized costs
          fabricCost,
          fabricWastagePercent: validatedData.fabricWastagePercent,
          fabricWastageAmount,
          accessoriesCost,
          stitchingCost,
          stitchingTier: validatedData.stitchingTier,
          workmanshipPremiums,
          designerConsultationFee: validatedData.designerConsultationFee,

          // Workmanship premium details
          isHandStitched: validatedData.isHandStitched,
          handStitchingCost,

          isFullCanvas: validatedData.isFullCanvas,
          fullCanvasCost,

          isRushOrder: validatedData.isRushOrder,
          rushOrderCost,

          hasComplexDesign: validatedData.hasComplexDesign,
          complexDesignCost,

          additionalFittings: validatedData.additionalFittings,
          additionalFittingsCost,

          hasPremiumLining: validatedData.hasPremiumLining,
          premiumLiningCost,

          // Manual overrides
          isFabricCostOverridden: validatedData.isFabricCostOverridden,
          fabricCostOverride: validatedData.fabricCostOverride,
          fabricCostOverrideReason: validatedData.fabricCostOverrideReason,

          isStitchingCostOverridden: validatedData.isStitchingCostOverridden,
          stitchingCostOverride: validatedData.stitchingCostOverride,
          stitchingCostOverrideReason: validatedData.stitchingCostOverrideReason,

          isAccessoriesCostOverridden: validatedData.isAccessoriesCostOverridden,
          accessoriesCostOverride: validatedData.accessoriesCostOverride,
          accessoriesCostOverrideReason: validatedData.accessoriesCostOverrideReason,

          pricingNotes: validatedData.pricingNotes,

          // Standard GST fields
          subTotal,
          gstRate,
          cgst,
          sgst,
          igst,
          gstAmount,
          taxableAmount,
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

      // Create payment installment for advance payment (if any)
      if (validatedData.advancePaid > 0) {
        await tx.paymentInstallment.create({
          data: {
            orderId: newOrder.id,
            installmentNumber: 1,
            amount: validatedData.advancePaid,
            dueDate: new Date(), // Advance is paid immediately
            paidDate: new Date(), // Mark as paid
            paidAmount: validatedData.advancePaid,
            paymentMode: 'CASH', // Default to cash, can be made configurable
            status: 'PAID',
            notes: 'Advance payment on order creation',
          },
        })
      }

      return newOrder
    })

    // Send WhatsApp order confirmation (non-blocking with after())
    after(async () => {
      try {
        const { whatsappService } = await import('@/lib/whatsapp/whatsapp-service')
        await whatsappService.sendOrderConfirmation(order.id)
        console.log(`✅ WhatsApp confirmation sent for order ${order.orderNumber}`)
      } catch (error) {
        console.error('Failed to send WhatsApp confirmation:', error)
      }
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
