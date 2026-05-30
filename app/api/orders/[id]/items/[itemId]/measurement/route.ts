import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

/**
 * @featuretrace Order Item Measurement Link API
 * @route POST /api/orders/:id/items/:itemId/measurement
 * @description Links an existing customer measurement or creates a new measurement and links it to the order item atomically.
 */

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const linkMeasurementSchema = z.object({
  measurementId: z.string().min(1, 'Measurement ID is required'),
})

const createMeasurementSchema = z.object({
  garmentType: z.string().min(1, 'Garment type is required'),
  bodyType: z.enum(['SLIM', 'REGULAR', 'LARGE', 'XL']).nullish(),
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
  notes: z.string().nullish(),
  additionalMeasurements: z.record(z.string(), z.any()).nullish(),
})

const addOrLinkMeasurementSchema = z.union([linkMeasurementSchema, createMeasurementSchema])

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  const { session, error } = await requireAnyPermission(['manage_measurements'])
  if (error) return error

  try {
    const { id: orderId, itemId } = await context.params
    const body = await request.json()
    const validatedData = addOrLinkMeasurementSchema.parse(body)

    const existingItem = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
      include: {
        order: {
          select: {
            id: true,
            customerId: true,
            status: true,
          },
        },
      },
    })

    if (!existingItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
    }

    if (existingItem.order.status === 'DELIVERED' || existingItem.order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot update measurements for delivered or cancelled orders' },
        { status: 400 }
      )
    }

    if ('measurementId' in validatedData) {
      const measurement = await prisma.measurement.findFirst({
        where: {
          id: validatedData.measurementId,
          customerId: existingItem.order.customerId,
          isActive: true,
        },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
      })

      if (!measurement) {
        return NextResponse.json(
          { error: 'Measurement not found for this customer' },
          { status: 404 }
        )
      }

      await prisma.orderItem.update({
        where: { id: itemId },
        data: { measurementId: measurement.id },
      })

      return NextResponse.json({
        measurement,
        message: 'Measurement linked to order item successfully',
      })
    }

    const { additionalMeasurements, ...restData } = validatedData

    const measurement = await prisma.$transaction(async (tx: TransactionClient) => {
      const createdMeasurement = await tx.measurement.create({
        data: {
          ...restData,
          customerId: existingItem.order.customerId,
          userId: session!.user.id,
          additionalMeasurements: additionalMeasurements || undefined,
          isActive: true,
        },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
      })

      await tx.orderItem.update({
        where: { id: itemId },
        data: { measurementId: createdMeasurement.id },
      })

      return createdMeasurement
    })

    return NextResponse.json(
      {
        measurement,
        message: 'Measurement created and linked to order item successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating or linking order item measurement:', error)
    return NextResponse.json(
      { error: 'Failed to create or link measurement' },
      { status: 500 }
    )
  }
}
