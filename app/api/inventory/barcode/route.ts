import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET lookup item by barcode/SKU
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        item: clothItem,
      })
    }

    // TODO: Search in accessory inventory when schema is updated
    // const accessoryItem = await prisma.accessoryInventory.findUnique({
    //   where: { sku: barcode },
    //   include: { supplierRel: true },
    // })

    // if (accessoryItem) {
    //   return NextResponse.json({
    //     found: true,
    //     type: 'accessory',
    //     item: accessoryItem,
    //   })
    // }

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
