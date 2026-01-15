import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

// GET measurement history - retrieves the full version chain
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; measurementId: string }> }
) {
  const { error } = await requireAnyPermission(['view_customers'])
  if (error) return error

  try {
    const { id, measurementId } = await params

    // First, verify the measurement exists and belongs to this customer
    const currentMeasurement = await prisma.measurement.findUnique({
      where: { id: measurementId, customerId: id },
    })

    if (!currentMeasurement) {
      return NextResponse.json({ error: 'Measurement not found' }, { status: 404 })
    }

    // Build the history chain by following the replacesId links backwards
    const historyChain: any[] = []
    let nextId: string | null = measurementId

    // Follow the chain backwards to get all previous versions
    for (let i = 0; i < 100 && nextId; i++) {
      // Safety limit of 100 iterations
      const record: any = await prisma.measurement.findUnique({
        where: { id: nextId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          replaces: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!record) break

      historyChain.push(record)
      nextId = record.replaces?.id || null
    }

    // Also get any newer versions (if this measurement has been replaced)
    const newerVersions: any = await prisma.measurement.findMany({
      where: {
        replacesId: measurementId,
        customerId: id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      current: currentMeasurement,
      history: historyChain,
      newerVersions,
      totalVersions: historyChain.length + newerVersions.length,
    })
  } catch (error) {
    console.error('Error fetching measurement history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch measurement history' },
      { status: 500 }
    )
  }
}
