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

    // First, check if the garment pattern exists
    const garmentPattern = await prisma.garmentPattern.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!garmentPattern) {
      return NextResponse.json(
        { error: 'Garment pattern not found' },
        { status: 404 }
      )
    }

    // Now fetch the accessories for this garment pattern
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
      { error: 'Failed to fetch accessories for garment pattern' },
      { status: 500 }
    )
  }
}
