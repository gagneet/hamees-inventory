import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { filterApiResponse } from '@/lib/api-filter-response'
import { prisma } from '@/lib/db'

// GET lookup item by barcode/SKU
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requirePermission('view_inventory')
    if (error) return error
    const role = session.user.role

    const { searchParams } = new URL(request.url)
    const barcode = searchParams.get('barcode')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode parameter is required' },
        { status: 400 }
      )
    }

    // Search in cloth inventory
    const clothItem = await prisma.clothInventory.findUnique({
      where: { sku: barcode },
      include: { supplierRel: true },
    })

    if (clothItem) {
      return NextResponse.json({
        found: true,
        type: 'cloth',
        item: filterApiResponse(clothItem, role, 'inventory'),
      })
    }

    // Search in accessory inventory
    const accessoryItem = await prisma.accessoryInventory.findUnique({
      where: { sku: barcode },
      include: { supplierRel: true },
    })

    if (accessoryItem) {
      return NextResponse.json({
        found: true,
        type: 'accessory',
        item: filterApiResponse(accessoryItem, role, 'inventory'),
      })
    }

    // Not found
    return NextResponse.json({
      found: false,
      barcode,
    })
  } catch (error) {
    console.error('Error looking up barcode:', error)
    return NextResponse.json(
      { error: 'Failed to lookup barcode' },
      { status: 500 }
    )
  }
}
