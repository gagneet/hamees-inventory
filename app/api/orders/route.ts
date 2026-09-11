import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { canViewField, hasFinancialAccess } from '@/lib/field-acl'
import { hasPermission } from '@/lib/permissions'
import { actorFromSession, isAssignableTailor, orderScope, scopedWhere } from '@/lib/authz'
import { formatCurrency } from '@/lib/locale'
import { orderTax, roundMoney } from '@/lib/order-finance'
import { InsufficientStockError, reserveAccessoryStock, reserveClothStock } from '@/lib/stock'
import { runReorderCheckQuietly } from '@/lib/reorder'
import { z } from 'zod'
import { OrderStatus, OrderPriority, BodyType, StitchingTier } from '@/lib/types'

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
  fabricCostOverride: z.number().min(0).nullish(),
  fabricCostOverrideReason: z.string().nullish(),

  isStitchingCostOverridden: z.boolean().default(false),
  stitchingCostOverride: z.number().min(0).nullish(),
  stitchingCostOverrideReason: z.string().nullish(),

  isAccessoriesCostOverridden: z.boolean().default(false),
  accessoriesCostOverride: z.number().min(0).nullish(),
  accessoriesCostOverrideReason: z.string().nullish(),

  pricingNotes: z.string().nullish(),

  items: z.array(
    z.object({
      garmentPatternId: z.string().min(1),
      clothInventoryId: z.string().min(1),
      quantityOrdered: z.number().int().positive().default(1), // Changed from 'quantity' to match frontend
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

const ORDER_STATUSES = new Set<string>(Object.values(OrderStatus))

export async function GET(request: Request) {
  const { error, session } = await requireAnyPermission(['view_orders'])
  if (error) return error
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const search = searchParams.get('search')
    const fabricId = searchParams.get('fabricId')
    const garmentPatternId = searchParams.get('garmentPatternId')
    // NOTE: minAmount, maxAmount, balanceAmount filtering restricted to OWNER/ADMIN roles
    // These are financial fields that not all roles should be able to filter by
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const deliveryDateFrom = searchParams.get('deliveryDateFrom')
    const deliveryDateTo = searchParams.get('deliveryDateTo')
    const isOverdue = searchParams.get('isOverdue')
    const balanceAmount = searchParams.get('balanceAmount')

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10') || 10))
    const skip = (page - 1) * limit

    const where: Record<string, any> = {}

    if (status) {
      if (!ORDER_STATUSES.has(status)) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
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

    // Filter by fabric and/or garment pattern (same item must match both)
    if (fabricId || garmentPatternId) {
      where.items = {
        some: {
          ...(fabricId && { clothInventoryId: fabricId }),
          ...(garmentPatternId && { garmentPatternId }),
        },
      }
    }

    const userRole = actor.role
    const canFilterFinancial = canViewField(userRole, 'order', 'totalAmount')

    // Filter by amount range (financial filter restricted by role)
    if (canFilterFinancial && (minAmount || maxAmount)) {
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

    // Filter by balance amount (financial filter restricted by role)
    if (canFilterFinancial && balanceAmount) {
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

    const whereWithoutStatus = { ...where }
    if (status && isOverdue !== 'true') {
      delete whereWithoutStatus.status
    }

    // ABAC: AND-combine with the actor's order scope so query params can't widen access
    const scope = orderScope(actor)
    const scopedFilter = scopedWhere(where, scope)
    const scopedFilterWithoutStatus = scopedWhere(whereWithoutStatus, scope)

    // Parallelize count, status-counts, and fetch queries
    const [totalItems, statusCountsRaw, orders] = await Promise.all([
      prisma.order.count({ where: scopedFilter }),
      // Always group by status (ignoring the status filter) so tabs show global counts
      prisma.order.groupBy({
        where: scopedFilterWithoutStatus,
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: scopedFilter,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              customerType: true,
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
        orderBy: canFilterFinancial ? { balanceAmount: 'desc' } : { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    const totalPages = Math.ceil(totalItems / limit)

    // Build status counts map { NEW: 4, CUTTING: 2, ... }
    const statusCounts: Record<string, number> = {}
    for (const row of statusCountsRaw) {
      statusCounts[row.status] = row._count._all
    }

    // FEATURETRACE: Apply ACL field filtering to orders response
    // Users without financial field access will not see amount fields (deep, incl. items)
    const filteredOrders = filterApiResponse(orders, userRole, 'order')

    return NextResponse.json({
      orders: filteredOrders,
      statusCounts,
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
  const actor = actorFromSession(session)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const validatedData = orderSchema.parse(body)

    // ── Authorization for money/pricing inputs ──────────────────────────────
    if (validatedData.advancePaid > 0 && !hasPermission(actor.role, 'record_payment')) {
      return NextResponse.json(
        { error: 'Your role cannot record payments. Create the order without an advance and ask an owner to record it.' },
        { status: 403 }
      )
    }
    const usesPricingInputs =
      validatedData.designerConsultationFee > 0 ||
      validatedData.isFabricCostOverridden ||
      validatedData.isStitchingCostOverridden ||
      validatedData.isAccessoriesCostOverridden
    if (usesPricingInputs && !hasFinancialAccess(actor.role, 'order')) {
      return NextResponse.json(
        { error: 'Your role cannot set pricing overrides or fees' },
        { status: 403 }
      )
    }

    const tailorIds = [
      ...new Set(validatedData.items.map((item) => item.assignedTailorId).filter((id): id is string => !!id)),
    ]
    if (tailorIds.length > 0 && !hasPermission(actor.role, 'assign_tailors')) {
      return NextResponse.json({ error: 'Your role cannot assign tailors' }, { status: 403 })
    }

    // ✨ PREMIUM PRICING SYSTEM (v0.22.0) - Itemized cost calculation
    let fabricCost = 0
    let accessoriesCost = 0
    let stitchingCost = 0
    const orderItems: any[] = []

    // Extract unique IDs to fetch all required data in parallel (avoid N+1 queries)
    const patternIds = [...new Set(validatedData.items.map((item) => item.garmentPatternId))]
    const clothIds = [...new Set(validatedData.items.map((item) => item.clothInventoryId))]
    const accessoryIds = [...new Set(
      validatedData.items
        .flatMap(item => item.accessories || [])
        .map(acc => acc.accessoryId)
    )]

    // Fetch all data in parallel to avoid async waterfalls
    const [customer, selectedMeasurement, tailors, customerMeasurements, patterns, cloths, accessories] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: validatedData.customerId },
        select: { id: true, state: true },
      }),
      validatedData.measurementId
        ? prisma.measurement.findFirst({
            where: { id: validatedData.measurementId, customerId: validatedData.customerId },
            select: { id: true },
          })
        : Promise.resolve(null),
      tailorIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: tailorIds } },
            select: { id: true, role: true, active: true },
          })
        : Promise.resolve([]),
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
        include: {
          accessories: {
            include: {
              accessory: true,
            },
          },
        },
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

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 400 })
    }

    // The order-level measurement must belong to this customer
    if (validatedData.measurementId && !selectedMeasurement) {
      return NextResponse.json({ error: 'Measurement does not belong to this customer' }, { status: 400 })
    }

    const tailorMap = new Map(tailors.map((t) => [t.id, t]))
    if (tailorIds.some((id) => !isAssignableTailor(tailorMap.get(id)))) {
      return NextResponse.json({ error: 'Orders can only be assigned to active tailors' }, { status: 400 })
    }

    // Create lookup maps for O(1) access
    const patternMap = new Map(patterns.map((pattern) => [pattern.id, pattern]))
    const clothMap = new Map(cloths.map((cloth) => [cloth.id, cloth]))
    const accessoryMap = new Map(accessories.map((accessory) => [accessory.id, accessory]))

    // Aggregate requirements across items (two items can use the same fabric/accessory)
    const clothRequired = new Map<string, number>()
    const accessoryRequired = new Map<string, number>()

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

      const estimatedMeters = (pattern.baseMeters + adjustment) * item.quantityOrdered
      clothRequired.set(cloth.id, (clothRequired.get(cloth.id) ?? 0) + estimatedMeters)

      // Calculate fabric cost
      const itemFabricCost = estimatedMeters * cloth.pricePerMeter
      fabricCost += itemFabricCost

      // Get accessories for this garment pattern (from GarmentAccessory) and merge with user-provided accessories
      const requiredAccessories = new Map<string, number>()

      // Add pattern's default accessories
      if (pattern.accessories && pattern.accessories.length > 0) {
        for (const garmentAcc of pattern.accessories) {
          const totalNeeded = garmentAcc.quantityPerGarment * item.quantityOrdered
          requiredAccessories.set(garmentAcc.accessoryId, totalNeeded)
        }
      }

      // Merge/override with user-provided accessories
      if (item.accessories && item.accessories.length > 0) {
        for (const acc of item.accessories) {
          const totalNeeded = acc.quantity * item.quantityOrdered
          requiredAccessories.set(acc.accessoryId, totalNeeded)
        }
      }

      // Calculate accessory cost
      let itemAccessoriesCost = 0
      for (const [accessoryId, quantityNeeded] of requiredAccessories.entries()) {
        const accessory = accessoryMap.get(accessoryId) ?? pattern.accessories.find((a) => a.accessoryId === accessoryId)?.accessory
        if (!accessory) {
          return NextResponse.json(
            { error: `Accessory not found: ${accessoryId}` },
            { status: 400 }
          )
        }
        accessoryMap.set(accessoryId, accessory)
        itemAccessoriesCost += quantityNeeded * accessory.pricePerUnit
        accessoryRequired.set(accessoryId, (accessoryRequired.get(accessoryId) ?? 0) + quantityNeeded)
      }
      accessoriesCost += itemAccessoriesCost

      // Calculate stitching cost based on tier
      let tierCharge = pattern.basicStitchingCharge // Default to BASIC
      if (validatedData.stitchingTier === StitchingTier.PREMIUM) {
        tierCharge = pattern.premiumStitchingCharge
      } else if (validatedData.stitchingTier === StitchingTier.LUXURY) {
        tierCharge = pattern.luxuryStitchingCharge
      }
      stitchingCost += tierCharge * item.quantityOrdered

      // Find matching measurement for this garment type
      const garmentTypeName = pattern.name.replace(/^(Men's|Women's|Kids)\s+/i, '').trim()
      const matchingMeasurement = customerMeasurements.find(
        (measurement) => measurement.garmentType.toLowerCase() === garmentTypeName.toLowerCase()
      )

      // Calculate item total
      const itemTotal = itemFabricCost + itemAccessoriesCost

      orderItems.push({
        garmentPatternId: item.garmentPatternId,
        clothInventoryId: item.clothInventoryId,
        quantityOrdered: item.quantityOrdered,
        bodyType: item.bodyType,
        estimatedMeters,
        pricePerUnit: itemTotal / item.quantityOrdered,
        totalPrice: itemTotal,
        measurementId: matchingMeasurement?.id,
        assignedTailorId: item.assignedTailorId || undefined,
      })
    }

    // Fast-fail stock check (re-checked atomically inside the transaction)
    for (const [clothId, meters] of clothRequired) {
      const cloth = clothMap.get(clothId)!
      const available = cloth.currentStock - cloth.reserved
      if (available < meters) {
        return NextResponse.json(
          { error: `Insufficient stock for ${cloth.name}. Available: ${available}m, Required: ${meters}m` },
          { status: 400 }
        )
      }
    }
    for (const [accessoryId, units] of accessoryRequired) {
      const accessory = accessoryMap.get(accessoryId)!
      const available = accessory.currentStock - accessory.reserved
      if (available < units) {
        return NextResponse.json(
          { error: `Insufficient stock for ${accessory.name}. Available: ${available}, Required: ${units}` },
          { status: 400 }
        )
      }
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

    // Tax per shop settings (SPLIT → CGST+SGST or IGST by customer region, SINGLE → one line, NONE → 0)
    const tax = await orderTax(subTotal, { customerRegion: customer.state })
    const { gstRate, cgst, sgst, igst, gstAmount, totalAmount } = tax
    const taxableAmount = subTotal

    // Validate advance payment doesn't exceed total amount
    if (validatedData.advancePaid > totalAmount) {
      return NextResponse.json(
        {
          error: `Advance payment (${formatCurrency(validatedData.advancePaid)}) cannot exceed total order amount (${formatCurrency(totalAmount)})`
        },
        { status: 400 }
      )
    }

    // Round to 2 decimal places to avoid floating-point precision errors
    const balanceAmount = roundMoney(totalAmount - validatedData.advancePaid)

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`

    // Create order in transaction
    const order = await prisma.$transaction(async (tx: TransactionClient) => {
      // Reserve stock first: each UPDATE only succeeds if enough unreserved stock remains
      for (const [clothId, meters] of clothRequired) {
        await reserveClothStock(tx, clothId, meters, clothMap.get(clothId)!.name)
      }
      for (const [accessoryId, units] of accessoryRequired) {
        await reserveAccessoryStock(tx, accessoryId, units, accessoryMap.get(accessoryId)!.name)
      }

      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: validatedData.customerId,
          measurementId: validatedData.measurementId || undefined,
          userId: actor.id,
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

          // Standard tax fields
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

      // Stock movements for each item's fabric reservation
      for (const item of newOrder.items) {
        await tx.stockMovement.create({
          data: {
            clothInventoryId: item.clothInventoryId,
            orderId: newOrder.id,
            userId: actor.id,
            type: 'ORDER_RESERVED',
            quantityMeters: -item.estimatedMeters,
            balanceAfterMeters: item.clothInventory!.currentStock - item.estimatedMeters,
            notes: `Reserved for order ${newOrder.orderNumber}`,
          },
        })
      }

      // Accessory stock movements
      for (const [accessoryId, totalQuantity] of accessoryRequired) {
        const accessory = accessoryMap.get(accessoryId)!
        await tx.accessoryStockMovement.create({
          data: {
            accessoryInventoryId: accessoryId,
            orderId: newOrder.id,
            userId: actor.id,
            type: 'ORDER_RESERVED',
            quantityUnits: -totalQuantity,
            balanceAfterUnits: accessory.currentStock - totalQuantity,
            notes: `Reserved for order ${newOrder.orderNumber}`,
          },
        })
      }

      // Note: Advance payment is stored in Order.advancePaid field only
      // Balance payments are recorded as PaymentInstallments via Record Payment feature
      // This avoids double-counting and keeps advance separate from balance installments

      return newOrder
    })

    // FEATURETRACE: Apply ACL field filtering to response
    const filtered = filterApiResponse(order, actor.role, 'order')

    // Send WhatsApp order confirmation (non-blocking with after())
    after(async () => {
      try {
        const { whatsappService } = await import('@/lib/whatsapp/whatsapp-service')
        await whatsappService.sendOrderConfirmation(order.id)
      } catch (error) {
        console.error('Failed to send WhatsApp confirmation:', error)
      }
    })

    // Reservations lower available stock: raise reorder alerts / draft POs as needed
    after(() => runReorderCheckQuietly({ trigger: 'order_created', userId: actor.id }))

    return NextResponse.json({ order: filtered }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
