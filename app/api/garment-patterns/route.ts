import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

export async function GET(request: Request) {
  const { error } = await requireAnyPermission(['view_orders', 'create_order'])
  if (error) return error

  try {
    const patterns = await prisma.garmentPattern.findMany({
      include: {
        accessories: {
          include: {
            accessory: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ patterns })
  } catch (error) {
    console.error('Error fetching garment patterns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch garment patterns' },
      { status: 500 }
    )
  }
}
