import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAnyPermission(['view_orders', 'create_order'])
  if (error) return error

  try {
    const { id } = await params

    const pattern = await prisma.garmentPattern.findUnique({
      where: { id },
      include: {
        accessories: {
          include: {
            accessory: true,
          },
        },
      },
    })

    if (!pattern) {
      return NextResponse.json(
        { error: 'Garment pattern not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ pattern })
  } catch (error) {
    console.error('Error fetching garment pattern:', error)
    return NextResponse.json(
      { error: 'Failed to fetch garment pattern' },
      { status: 500 }
    )
  }
}
