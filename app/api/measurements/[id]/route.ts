import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const measurementUpdateSchema = z.object({
  garmentType: z.string().min(1).optional(),
  neck: z.number().positive().optional(),
  chest: z.number().positive().optional(),
  waist: z.number().positive().optional(),
  hip: z.number().positive().optional(),
  shoulder: z.number().positive().optional(),
  sleeveLength: z.number().positive().optional(),
  shirtLength: z.number().positive().optional(),
  inseam: z.number().positive().optional(),
  outseam: z.number().positive().optional(),
  thigh: z.number().positive().optional(),
  knee: z.number().positive().optional(),
  bottomOpening: z.number().positive().optional(),
  jacketLength: z.number().positive().optional(),
  lapelWidth: z.number().positive().optional(),
  notes: z.string().optional(),
  additionalMeasurements: z.record(z.string(), z.any()).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { id } = await params
    const measurement = await prisma.measurement.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['manage_measurements'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = measurementUpdateSchema.parse(body)

    const measurement = await prisma.measurement.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json({ measurement })
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['delete_measurement'])
  if (error) return error

  try {
    const { id } = await params
    await prisma.measurement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting measurement:', error)
    return NextResponse.json(
      { error: 'Failed to delete measurement' },
      { status: 500 }
    )
  }
}
