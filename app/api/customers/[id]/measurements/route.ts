import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const measurementSchema = z.object({
  garmentType: z.string().min(1, 'Garment type is required'),
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
  crotch: z.number().nullish(),
  notes: z.string().nullish(),
  additionalMeasurements: z.record(z.string(), z.any()).nullish(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { id } = await params
    const measurements = await prisma.measurement.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ measurements })
  } catch (error) {
    console.error('Error fetching measurements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch measurements' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['manage_customers'])
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = measurementSchema.parse(body)

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Convert null to undefined for Prisma JSON fields
    const { additionalMeasurements, ...restData } = validatedData

    const measurement = await prisma.measurement.create({
      data: {
        ...restData,
        customerId: id,
        additionalMeasurements: additionalMeasurements || undefined,
      },
    })

    return NextResponse.json({ measurement }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating measurement:', error)
    return NextResponse.json(
      { error: 'Failed to create measurement' },
      { status: 500 }
    )
  }
}
