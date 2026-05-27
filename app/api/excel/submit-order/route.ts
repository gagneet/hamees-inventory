import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyExcelApiKey } from '@/lib/excel-api-auth'
import { generateOrderNumber } from '@/lib/utils'
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
 * @writes Customer, Measurement, Order, OrderItem, StockMovement, PaymentInstallment
 */

// ── Request schema ────────────────────────────────────────────────

const submitOrderSchema = z.object({
  // Customer
  customerMode: z.enum(['new', 'existing']).default('new'),
  customerId: z.string().optional(),        // Used when customerMode = existing
  customerName: z.string().min(1),
  customerPhone: z.string().min(6),
  customerWhatsApp: z.string().optional(),
  customerCity: z.string().optional(),
  customerAddress: z.string().optional(),
  preferredFit: z.string().optional(),      // SLIM / REGULAR / LARGE / XL

  // Order details
  garmentType: z.string().min(1),           // e.g. "Sherwani" — matched against GarmentPattern.name
  fabricName: z.string().optional(),        // e.g. "French Linen" — matched against ClothInventory.name
  fabricColor: z.string().optional(),       // e.g. "Navy Blue" — used to refine fabric lookup
  quantity: z.number().int().positive().default(1),
  bookingDate: z.string().optional(),       // ISO date string — defaults to today
  trialDate: z.string().optional(),
  deliveryDate: z.string(),                 // Required: ISO date string
  advancePaid: z.number().nonnegative().default(0),
  priority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
  notes: z.string().optional(),

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

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────
  const auth = verifyExcelApiKey(request)
  if (!auth.ok) return auth.error

  try {
    const body = await request.json()
    const data = submitOrderSchema.parse(body)

    // ── 1. Customer lookup / create ───────────────────────────
    let customer = data.customerId
      ? await prisma.customer.findUnique({ where: { id: data.customerId } })
      : await prisma.customer.findFirst({
          where: { phone: { equals: data.customerPhone, mode: 'insensitive' } },
        })

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: data.customerName.trim(),
          phone: data.customerPhone.trim(),
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
      include: {
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

    // ── 3. Cloth inventory lookup ─────────────────────────────
    let clothInventory = null
    if (data.fabricName) {
      clothInventory = await prisma.clothInventory.findFirst({
        where: {
          name: { contains: data.fabricName, mode: 'insensitive' },
          ...(data.fabricColor ? { color: { contains: data.fabricColor, mode: 'insensitive' } } : {}),
          active: true,
        },
      })
      // Fallback: match by name only (ignore color)
      if (!clothInventory && data.fabricColor) {
        clothInventory = await prisma.clothInventory.findFirst({
          where: {
            name: { contains: data.fabricName, mode: 'insensitive' },
            active: true,
          },
        })
      }
    }

    // If no fabric matched, use any active cloth (staff can correct in the web app)
    if (!clothInventory) {
      clothInventory = await prisma.clothInventory.findFirst({
        where: { active: true, currentStock: { gt: 0 } },
        orderBy: { currentStock: 'desc' },
      })
    }

    if (!clothInventory) {
      return NextResponse.json(
        { error: 'No cloth inventory items are available. Please add fabric stock to the system first.' },
        { status: 422 }
      )
    }

    // ── 4. Build measurement payload ──────────────────────────
    const measurementFields: Record<string, number | null> = {}
    for (const key of MEASUREMENT_KEYS) {
      const val = data[key]
      measurementFields[key] = val ?? null
    }

    // ── 5. Create measurement ─────────────────────────────────
    const measurement = await prisma.measurement.create({
      data: {
        customerId: customer.id,
        garmentType: garmentPattern.name,
        bodyType: (data.bodyType ?? data.preferredFit as any) ?? 'REGULAR',
        ...measurementFields,
        notes: data.measurementNotes || null,
        isActive: true,
      },
    })

    // ── 6. Create Order + OrderItem ───────────────────────────
    const deliveryDate = new Date(data.deliveryDate)
    const estimatedMeters = garmentPattern.estimatedMeters ?? 2.5
    const fabricCost = clothInventory.pricePerMeter * estimatedMeters * data.quantity
    const stitchingCost = garmentPattern.baseStitchingCost ?? 0
    const totalItemCost = fabricCost + stitchingCost
    const gstRate = 0.12
    const subTotal = totalItemCost
    const gstAmount = subTotal * gstRate
    const cgst = gstAmount / 2
    const sgst = gstAmount / 2
    const totalAmount = subTotal + gstAmount
    const balanceAmount = totalAmount - (data.advancePaid ?? 0)
    const orderNumber = await generateOrderNumber()

    const order = await prisma.$transaction(async (tx) => {
      // Reserve fabric stock
      await tx.clothInventory.update({
        where: { id: clothInventory!.id },
        data: { reserved: { increment: estimatedMeters * data.quantity } },
      })

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          clothInventoryId: clothInventory!.id,
          type: 'ORDER_RESERVED',
          quantityMeters: -(estimatedMeters * data.quantity),
          balanceAfterMeters: clothInventory!.currentStock - estimatedMeters * data.quantity,
          notes: `Reserved for order ${orderNumber} (via Excel)`,
        },
      })

      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer!.id,
          measurementId: measurement.id,
          deliveryDate,
          priority: data.priority,
          notes: data.notes || null,
          advancePaid: data.advancePaid ?? 0,
          subTotal,
          gstRate,
          gstAmount,
          cgst,
          sgst,
          igst: 0,
          totalAmount,
          balanceAmount,
          status: 'NEW',
          // Advance payment installment
          installments: data.advancePaid > 0 ? {
            create: {
              installmentNumber: 1,
              installmentAmount: data.advancePaid,
              paidAmount: data.advancePaid,
              paidDate: new Date(),
              status: 'PAID',
              paymentMode: 'CASH',
              notes: 'Advance received at booking (Excel import)',
            },
          } : undefined,
          items: {
            create: {
              garmentPatternId: garmentPattern.id,
              clothInventoryId: clothInventory!.id,
              measurementId: measurement.id,
              bodyType: (data.bodyType ?? data.preferredFit as any) ?? 'REGULAR',
              quantityOrdered: data.quantity,
              estimatedMeters,
              fabricCost,
              stitchingCost,
              totalPrice: totalItemCost,
            },
          },
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
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

    console.error('[Excel API] Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order. Please check the system logs.' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/excel/status — health check & lookup endpoint for the VBA macro.
 * Returns lists of active garment patterns and cloth inventory for populating dropdowns.
 */
export async function GET(request: Request) {
  const auth = verifyExcelApiKey(request)
  if (!auth.ok) return auth.error

  const [garmentPatterns, clothInventory] = await Promise.all([
    prisma.garmentPattern.findMany({
      where: { active: true },
      select: { id: true, name: true, baseStitchingCost: true, estimatedMeters: true },
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
