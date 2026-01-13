import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'
import { z } from 'zod'

const compareSchema = z.object({
  measurementId1: z.string().min(1),
  measurementId2: z.string().min(1),
})

export async function POST(request: Request) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const body = await request.json()
    const { measurementId1, measurementId2 } = compareSchema.parse(body)

    const [measurement1, measurement2] = await Promise.all([
      prisma.measurement.findUnique({ where: { id: measurementId1 } }),
      prisma.measurement.findUnique({ where: { id: measurementId2 } }),
    ])

    if (!measurement1 || !measurement2) {
      return NextResponse.json(
        { error: 'One or both measurements not found' },
        { status: 404 }
      )
    }

    // Calculate differences
    const fields = [
      'neck', 'chest', 'waist', 'hip', 'shoulder', 'sleeveLength',
      'shirtLength', 'inseam', 'outseam', 'thigh', 'knee',
      'bottomOpening', 'jacketLength', 'lapelWidth'
    ]

    const differences: Record<string, { old: number | null; new: number | null; diff: number | null }> = {}

    fields.forEach(field => {
      const val1 = measurement1[field as keyof typeof measurement1] as number | null
      const val2 = measurement2[field as keyof typeof measurement2] as number | null

      if (val1 !== null || val2 !== null) {
        differences[field] = {
          old: val1,
          new: val2,
          diff: val1 !== null && val2 !== null ? val2 - val1 : null
        }
      }
    })

    return NextResponse.json({
      measurement1,
      measurement2,
      differences,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error comparing measurements:', error)
    return NextResponse.json(
      { error: 'Failed to compare measurements' },
      { status: 500 }
    )
  }
}
