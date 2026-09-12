import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyExcelApiKey } from '@/lib/excel-api-auth'
import { generateOrderNumber } from '@/lib/utils'
import { getAppSettings } from '@/lib/settings'
import { formatCurrency } from '@/lib/locale'
import { priceNewOrder, roundMoney } from '@/lib/order-finance'
import { InsufficientStockError, reserveClothStock, roundMeters } from '@/lib/stock'
import { BodyType } from '@/lib/types'
import { normalizePhone } from '@/lib/phone'
import { findCustomersByPhone } from '@/lib/phone-lookup'
import { z } from 'zod'

/**
 * @featuretrace Excel VBA → API Submit Order
 * @route POST /api/excel/submit-order
 * @description Receives order data from the Excel VBA macro (hamees_orders_template.xlsm)
 *   and creates or updates a customer, measurement, and order record.
 *
 * Authentication: X-Excel-Api-Key header (static key, set in EXCEL_API_KEY env var)
 *
 * Flow:
 *   1. Verify API key
 *   2. Look up or create customer by phone number
 *   3. Look up garment pattern by name (case-insensitive)
 *   4. Look up cloth inventory by name + color (best-effort, falls back to first match by name)
 *   5. Create measurement record for this order
 *   6. Create Order + OrderItem with stock reservation
 *   7. Return { orderId, orderNumber, customerId }
 *
 * @reads ClothInventory, GarmentPattern, Customer
 * @writes Customer, Measurement, Order, OrderItem, StockMovement
 */

// ── Request schema ────────────────────────────────────────────────

const submitOrderSchema = z.object({
  // Customer
  customerMode: z.enum(['new', 'existing']).default('new'),
  customerId: z.string().optional(),        // Used when customerMode = existing
  customerName: z.string().trim().min(1).max(200),
  customerPhone: z.string().trim().min(6).max(20),
  customerWhatsApp: z.string().optional(),
  customerCity: z.string().optional(),
  customerAddress: z.string().optional(),
  preferredFit: z.string().optional(),      // SLIM / REGULAR / LARGE / XL

  // Order details
  garmentType: z.string().min(1),           // e.g. "Sherwani" — matched against GarmentPattern.name
  fabricName: z.string().optional(),        // e.g. "French Linen" — matched against ClothInventory.name
  fabricColor: z.string().optional(),       // e.g. "Navy Blue" — used to refine fabric lookup
  quantity: z.number().int().positive().max(100).default(1),
  bookingDate: z.string().optional(),       // ISO date string — defaults to today
  trialDate: z.string().optional(),
  deliveryDate: z.string(),                 // Required: ISO date string
  advancePaid: z.number().nonnegative().default(0),
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  notes: z.string().max(5000).optional(),

  // Measurements (all in cm, all optional)
  bodyType: z.enum(['SLIM', 'REGULAR', 'LARGE', 'XL']).optional(),
  neck: z.number().nullish(),
  chest: z.number().nullish(),
  waist: z.number().nullish(),
  hip: z.number().nullish(),
  shoulder: z.number().nullish(),
  sleeveLength: z.number().nullish(),
  shirtLength: z.number().nullish(),
  inseam: z.number().nullish(),
  outseam: z.number().nullish(),
  thigh: z.number().nullish(),
  knee: z.number().nullish(),
  bottomOpening: z.number().nullish(),
  jacketLength: z.number().nullish(),
  lapelWidth: z.number().nullish(),
  bicep: z.number().nullish(),
  cuff: z.number().nullish(),
  armCircumference: z.number().nullish(),
  crossChest: z.number().nullish(),
  backLength: z.number().nullish(),
  seat: z.number().nullish(),
  rise: z.number().nullish(),
  elbow: z.number().nullish(),
  measurementNotes: z.string().optional(),
})

// Measurement field keys (for building measurement create payload)
const MEASUREMENT_KEYS = [
  'neck','chest','waist','hip','shoulder','sleeveLength','shirtLength',
  'inseam','outseam','thigh','knee','bottomOpening','jacketLength','lapelWidth',
  'bicep','cuff','armCircumference','crossChest','backLength','seat','rise','elbow',
] as const

function resolveBodyType(value?: string | null): BodyType | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase()
  if (normalized === 'NORMAL' || normalized === 'MEDIUM') return BodyType.REGULAR
  if (normalized === BodyType.SLIM) return BodyType.SLIM
  if (normalized === BodyType.REGULAR) return BodyType.REGULAR
  if (normalized === BodyType.LARGE) return BodyType.LARGE
  if (normalized === BodyType.XL) return BodyType.XL
  return null
}

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────
  const auth = verifyExcelApiKey(request)
  if (!auth.ok) return auth.error

  try {
    const body = await request.json()
    const data = submitOrderSchema.parse(body)

    // Phone numbers are stored in E.164; numbers without +code are read in the shop's region
    const { phoneRegion } = await getAppSettings()
    const customerPhone = normalizePhone(data.customerPhone, phoneRegion)
    if (!customerPhone.ok) {
      return NextResponse.json({ error: customerPhone.error }, { status: 400 })
    }

    // ── 0. Resolve system user (for StockMovement.userId) ────
    // Excel submissions are unauthenticated (API key only); attribute stock
    // movements to the first OWNER in the system as a system actor.
    const systemUser = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    const systemUserId = systemUser?.id
    if (!systemUserId) {
      return NextResponse.json(
        { error: 'System configuration error: no OWNER account found. Please set up the application first.' },
        { status: 503 }
      )
    }

    // ── 1. Customer lookup / create ───────────────────────────
    let customer = data.customerId
      ? await prisma.customer.findUnique({ where: { id: data.customerId } })
      : await findCustomersByPhone(customerPhone.e164, phoneRegion).then(([match]) =>
          match ? prisma.customer.findUnique({ where: { id: match.id } }) : null
        )

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: data.customerName.trim(),
          phone: customerPhone.e164,
          city: data.customerCity?.trim() || null,
          address: data.customerAddress?.trim() || null,
        },
      })
    } else if (data.customerMode === 'existing') {
      // Update city/address if provided and currently blank
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          city: customer.city || data.customerCity?.trim() || undefined,
          address: customer.address || data.customerAddress?.trim() || undefined,
        },
      })
    }

    // ── 2. Garment pattern lookup ─────────────────────────────
    // Case-insensitive name match; use first result if no exact match
    const garmentPattern = await prisma.garmentPattern.findFirst({
      where: {
        name: { contains: data.garmentType, mode: 'insensitive' },
        active: true,
      },
      select: {
        id: true,
        name: true,
        baseMeters: true,
        slimAdjustment: true,
        largeAdjustment: true,
        xlAdjustment: true,
        basicStitchingCharge: true,
        accessories: {
          include: { accessory: true },
        },
      },
    })

    if (!garmentPattern) {
      return NextResponse.json(
        { error: `Garment type "${data.garmentType}" not found. Please check the garment name in the web app.` },
        { status: 422 }
      )
    }

    const bodyTypeValue = data.bodyType ?? resolveBodyType(data.preferredFit) ?? BodyType.REGULAR
    let bodyTypeAdjustment = 0
    if (bodyTypeValue === BodyType.SLIM) bodyTypeAdjustment = garmentPattern.slimAdjustment
    if (bodyTypeValue === BodyType.LARGE) bodyTypeAdjustment = garmentPattern.largeAdjustment
    if (bodyTypeValue === BodyType.XL) bodyTypeAdjustment = garmentPattern.xlAdjustment

    const estimatedMeters = (garmentPattern.baseMeters ?? 2.5) + bodyTypeAdjustment
    const requiredMeters = roundMeters(estimatedMeters * data.quantity)

    // ── 3. Cloth inventory lookup ─────────────────────────────
    let clothInventory = null
    if (data.fabricName) {
      const exactMatches = await prisma.clothInventory.findMany({
        where: {
          name: { contains: data.fabricName, mode: 'insensitive' },
          ...(data.fabricColor ? { color: { contains: data.fabricColor, mode: 'insensitive' } } : {}),
          active: true,
        },
        orderBy: { currentStock: 'desc' },
      })
      clothInventory = exactMatches.find(c => (c.currentStock - c.reserved) >= requiredMeters) ?? null
      // Fallback: match by name only (ignore color)
      if (!clothInventory && data.fabricColor) {
        const nameMatches = await prisma.clothInventory.findMany({
          where: {
            name: { contains: data.fabricName, mode: 'insensitive' },
            active: true,
          },
          orderBy: { currentStock: 'desc' },
        })
        clothInventory = nameMatches.find(c => (c.currentStock - c.reserved) >= requiredMeters) ?? null
      }
    }

    // If no fabric matched, use any active cloth with sufficient available stock
    if (!clothInventory) {
      const fallbackStock = await prisma.clothInventory.findMany({
        where: { active: true, currentStock: { gt: 0 } },
        orderBy: { currentStock: 'desc' },
      })
      clothInventory = fallbackStock.find(c => (c.currentStock - c.reserved) >= requiredMeters) ?? null
    }

    if (!clothInventory) {
      return NextResponse.json(
        { error: 'No cloth inventory items have sufficient available stock for this order.' },
        { status: 422 }
      )
    }

    // ── 4. Build measurement payload ──────────────────────────
    const measurementFields: Record<string, number | null> = {}
    for (const key of MEASUREMENT_KEYS) {
      const val = data[key]
      measurementFields[key] = val ?? null
    }

    // ── 5. Create Order + OrderItem ───────────────────────────
    // GST comes from the configured tax settings (same as the main orders route).
    // OrderItem has no fabricCost/stitchingCost columns — those are Order-level fields.
    // advancePaid is stored in Order.advancePaid only — no PaymentInstallment created
    // (same behaviour as the main orders route; balance payments use PaymentInstallment).
    const deliveryDate = new Date(data.deliveryDate)
    const fabricCostVal = clothInventory.pricePerMeter * requiredMeters
    const stitchingCostVal = (garmentPattern.basicStitchingCharge ?? 0) * data.quantity
    const totalItemCost = fabricCostVal + stitchingCostVal
    await getAppSettings() // primes the shop's currency/locale for the messages below
    // One pricing definition for every order (lib/order-pricing.ts). The Excel macro carries no
    // discount, so the taxable value is the whole subtotal — but it is derived, never assumed.
    const pricing = await priceNewOrder(roundMoney(totalItemCost), 0, { customerRegion: customer.state })
    const { subTotal, gstRate, gstAmount, cgst, sgst, igst, taxableAmount, totalAmount } = pricing
    const advancePaid = roundMoney(data.advancePaid ?? 0)
    if (advancePaid > totalAmount) {
      return NextResponse.json(
        { error: `Advance (${formatCurrency(advancePaid)}) cannot exceed the order total (${formatCurrency(totalAmount)})` },
        { status: 422 }
      )
    }
    const balanceAmount = roundMoney(totalAmount - advancePaid)
    const orderNumber = await generateOrderNumber()
    const availableStock = clothInventory.currentStock - clothInventory.reserved

    // Fast pre-check; the authoritative check is the guarded reservation inside the transaction
    if (availableStock < requiredMeters) {
      return NextResponse.json(
        { error: `Insufficient fabric stock. Available: ${availableStock.toFixed(2)}m, Required: ${requiredMeters.toFixed(2)}m` },
        { status: 422 }
      )
    }

    const order = await prisma.$transaction(async (tx) => {
      const measurement = await tx.measurement.create({
        data: {
          customerId: customer.id,
          garmentType: garmentPattern.name,
          bodyType: bodyTypeValue,
          ...measurementFields,
          notes: data.measurementNotes || null,
          isActive: true,
        },
      })

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer!.id,
          userId: systemUserId,           // required field — attributed to system OWNER
          measurementId: measurement.id,
          deliveryDate,
          priority: data.priority,
          notes: data.notes || null,
          // Itemised costs (Order-level)
          fabricCost: fabricCostVal,
          stitchingCost: stitchingCostVal,
          advancePaid,
          subTotal,
          gstRate,
          gstAmount,
          taxableAmount,
          cgst,
          sgst,
          igst,
          totalAmount,
          balanceAmount,
          status: 'NEW',
          items: {
            create: {
              garmentPatternId: garmentPattern.id,
              clothInventoryId: clothInventory!.id,
              measurementId: measurement.id,
              bodyType: bodyTypeValue,
              quantityOrdered: data.quantity,
              estimatedMeters: requiredMeters,
              pricePerUnit: roundMoney(totalItemCost / data.quantity),  // required on OrderItem
              totalPrice: roundMoney(totalItemCost),
            },
          },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      })

      // Reserve fabric stock (atomic: fails if another order took the stock meanwhile)
      const levels = await reserveClothStock(tx, clothInventory!.id, requiredMeters, clothInventory!.name)

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          clothInventoryId: clothInventory!.id,
          orderId: newOrder.id,
          userId: systemUserId,
          type: 'ORDER_RESERVED',
          quantityMeters: -requiredMeters,
          balanceAfterMeters: roundMeters((levels?.currentStock ?? clothInventory!.currentStock) - requiredMeters),
          notes: `Reserved for order ${orderNumber} (via Excel)`,
        },
      })

      return newOrder
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer.name,
      totalAmount: order.totalAmount,
      balanceAmount: order.balanceAmount,
      message: `Order ${order.orderNumber} created successfully for ${order.customer.name}`,
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues.map(i => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      )
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }

    console.error('[Excel API] Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order. Please check the system logs.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/excel/submit-order — health check & lookup endpoint for the VBA macro.
 * Returns lists of active garment patterns and cloth inventory for populating dropdowns.
 */
export async function GET(request: Request) {
  const auth = verifyExcelApiKey(request)
  if (!auth.ok) return auth.error

  const [garmentPatterns, clothInventory] = await Promise.all([
    prisma.garmentPattern.findMany({
      where: { active: true },
      select: { id: true, name: true, basicStitchingCharge: true, baseMeters: true },
      orderBy: { name: 'asc' },
    }),
    prisma.clothInventory.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true, pricePerMeter: true, currentStock: true, reserved: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    status: 'ok',
    garmentPatterns,
    clothInventory: clothInventory.map(c => ({
      ...c,
      availableStock: c.currentStock - c.reserved,
    })),
  })
}
