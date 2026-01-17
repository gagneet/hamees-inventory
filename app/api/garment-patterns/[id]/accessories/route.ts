import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-permissions'

// GET /api/garment-patterns/[id]/accessories - Get all accessories required for a garment pattern
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth()
    if (error) return error

    const { id } = await params
    const accessories = await prisma.garmentAccessory.findMany({
      where: {
        garmentPatternId: id,
      },
      include: {
        accessory: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            currentStock: true,
          },
        },
      },
    })

    return NextResponse.json(accessories)
  } catch (error) {
    console.error('Error fetching accessories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
