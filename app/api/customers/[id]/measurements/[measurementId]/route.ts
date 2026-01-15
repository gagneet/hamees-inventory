import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const measurementUpdateSchema = z.object({
  garmentType: z.string().min(1, 'Garment type is required').optional(),
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
  notes: z.string().nullish(),
  additionalMeasurements: z.record(z.string(), z.any()).nullish(),
})

// GET single measurement with history
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; measurementId: string }> }
) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { id, measurementId } = await params

    const measurement = await prisma.measurement.findUnique({
      where: { id: measurementId, customerId: id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        replaces: {
          select: {
            id: true,
            garmentType: true,
            createdAt: true,
            isActive: true,
          },
        },
        replacedBy: {
          select: {
            id: true,
            garmentType: true,
            createdAt: true,
            isActive: true,
          },
        },
      },
    })

    if (!measurement) {
      return NextResponse.json({ error: 'Measurement not found' }, { status: 404 })
    }

    return NextResponse.json({ measurement })
  } catch (error) {
    console.error('Error fetching measurement:', error)
    return NextResponse.json(
      { error: 'Failed to fetch measurement' },
      { status: 500 }
    )
  }
}

// PATCH (update) measurement - creates new version and marks old as inactive
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; measurementId: string }> }
) {
  const { session, error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const { id, measurementId } = await params
    const body = await request.json()
    const validatedData = measurementUpdateSchema.parse(body)

    // Verify measurement exists and belongs to this customer
    const existingMeasurement = await prisma.measurement.findUnique({
      where: { id: measurementId, customerId: id },
    })

    if (!existingMeasurement) {
      return NextResponse.json({ error: 'Measurement not found' }, { status: 404 })
    }

    // Create new measurement version
    const { additionalMeasurements, ...restData } = validatedData

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      // Mark old measurement as inactive
      await tx.measurement.update({
        where: { id: measurementId },
        data: { isActive: false },
      })

      // Create new version
      const additionalMeasurementsValue = additionalMeasurements ?? existingMeasurement.additionalMeasurements

      const newMeasurement = await tx.measurement.create({
        data: {
          customerId: id,
          userId: session!.user.id,
          garmentType: validatedData.garmentType || existingMeasurement.garmentType,
          bodyType: validatedData.bodyType ?? existingMeasurement.bodyType,
          neck: validatedData.neck ?? existingMeasurement.neck,
          chest: validatedData.chest ?? existingMeasurement.chest,
          waist: validatedData.waist ?? existingMeasurement.waist,
          hip: validatedData.hip ?? existingMeasurement.hip,
          shoulder: validatedData.shoulder ?? existingMeasurement.shoulder,
          sleeveLength: validatedData.sleeveLength ?? existingMeasurement.sleeveLength,
          shirtLength: validatedData.shirtLength ?? existingMeasurement.shirtLength,
          inseam: validatedData.inseam ?? existingMeasurement.inseam,
          outseam: validatedData.outseam ?? existingMeasurement.outseam,
          thigh: validatedData.thigh ?? existingMeasurement.thigh,
          knee: validatedData.knee ?? existingMeasurement.knee,
          bottomOpening: validatedData.bottomOpening ?? existingMeasurement.bottomOpening,
          jacketLength: validatedData.jacketLength ?? existingMeasurement.jacketLength,
          lapelWidth: validatedData.lapelWidth ?? existingMeasurement.lapelWidth,
          notes: validatedData.notes ?? existingMeasurement.notes,
          additionalMeasurements: additionalMeasurementsValue || undefined,
          replacesId: measurementId, // Link to previous version
          isActive: true,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      return newMeasurement
    })

    return NextResponse.json({
      measurement: result,
      message: 'Measurement updated successfully. Previous version preserved in history.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating measurement:', error)
    return NextResponse.json(
      { error: 'Failed to update measurement' },
      { status: 500 }
    )
  }
}

// DELETE measurement (soft delete by marking inactive)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; measurementId: string }> }
) {
  const { error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const { id, measurementId } = await params

    // Verify measurement exists and belongs to this customer
    const measurement = await prisma.measurement.findUnique({
      where: { id: measurementId, customerId: id },
      include: {
        orders: true,
        orderItems: true,
      },
    })

    if (!measurement) {
      return NextResponse.json({ error: 'Measurement not found' }, { status: 404 })
    }

    // Check if measurement is used in any orders
    if (measurement.orders.length > 0 || measurement.orderItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete measurement that is used in orders',
          ordersCount: measurement.orders.length,
          orderItemsCount: measurement.orderItems.length,
        },
        { status: 400 }
      )
    }

    // Soft delete by marking as inactive
    await prisma.measurement.update({
      where: { id: measurementId },
      data: { isActive: false },
    })

    return NextResponse.json({
      message: 'Measurement deleted successfully',
      measurementId,
    })
  } catch (error) {
    console.error('Error deleting measurement:', error)
    return NextResponse.json(
      { error: 'Failed to delete measurement' },
      { status: 500 }
    )
  }
}
