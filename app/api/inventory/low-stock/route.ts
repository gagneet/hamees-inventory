import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'low' or 'critical'

    // Get cloth inventory with low/critical stock
    const clothInventory = await prisma.clothInventory.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        brand: true,
        currentStock: true,
        reserved: true,
        minimum: true,
        pricePerMeter: true,
      },
    })

    // Get accessory inventory with low/critical stock
    const accessoryInventory = await prisma.accessoryInventory.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        supplier: true,
        currentStock: true,
        minimum: true,
        pricePerUnit: true,
      },
    })

    // Filter based on type
    let lowStockCloth = clothInventory.filter(
      (item) => item.currentStock - item.reserved < item.minimum
    )
    let lowStockAccessories = accessoryInventory.filter(
      (item) => item.currentStock < item.minimum
    )

    if (type === 'critical') {
      lowStockCloth = clothInventory.filter(
        (item) => item.currentStock - item.reserved < item.minimum * 0.5
      )
      lowStockAccessories = accessoryInventory.filter(
        (item) => item.currentStock < item.minimum * 0.5
      )
    }

    // Format cloth items
    const clothItems = lowStockCloth.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      category: 'cloth' as const,
      brand: item.brand,
      color: item.color,
      currentStock: item.currentStock,
      available: item.currentStock - item.reserved,
      reserved: item.reserved,
      minimum: item.minimum,
      unit: 'meters',
      pricePerUnit: item.pricePerMeter,
      value: item.currentStock * item.pricePerMeter,
    }))

    // Format accessory items
    const accessoryItems = lowStockAccessories.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      category: 'accessory' as const,
      brand: item.supplier || 'N/A',
      color: null,
      currentStock: item.currentStock,
      available: item.currentStock,
      reserved: 0,
      minimum: item.minimum,
      unit: 'pieces',
      pricePerUnit: item.pricePerUnit,
      value: item.currentStock * item.pricePerUnit,
    }))

    // Combine and sort by available stock (lowest first)
    const allItems = [...clothItems, ...accessoryItems].sort(
      (a, b) => a.available - b.available
    )

    return NextResponse.json({
      type: type || 'low',
      totalItems: allItems.length,
      clothItems: clothItems.length,
      accessoryItems: accessoryItems.length,
      items: allItems,
    })
  } catch (error) {
    console.error('Error fetching low stock items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch low stock items' },
      { status: 500 }
    )
  }
}
