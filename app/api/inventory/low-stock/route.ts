import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type ClothInventoryItem = Awaited<ReturnType<typeof getClothInventory>>[number]
type AccessoryInventoryItem = Awaited<ReturnType<typeof getAccessoryInventory>>[number]

async function getClothInventory() {
  return await prisma.clothInventory.findMany({
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
}

async function getAccessoryInventory() {
  return await prisma.accessoryInventory.findMany({
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
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'low' or 'critical'

    // Get cloth inventory with low/critical stock
    const clothInventory = await getClothInventory()

    // Get accessory inventory with low/critical stock
    const accessoryInventory = await getAccessoryInventory()

    // Filter based on type
    // IMPORTANT: These calculations must match the dashboard API calculations
    // Low Stock: Available < minimum AND available >= minimum × 0.5 (between 50% and 100% of minimum)
    // Critical Stock: Available < minimum × 0.5 (below 50% of minimum)
    let lowStockCloth: ClothInventoryItem[] = []
    let lowStockAccessories: AccessoryInventoryItem[] = []

    if (type === 'critical') {
      // Critical: Below 50% of minimum threshold (urgent action needed)
      lowStockCloth = clothInventory.filter(
        (item: ClothInventoryItem) => {
          const available = item.currentStock - item.reserved
          return available < item.minimum * 0.5
        }
      )
      lowStockAccessories = accessoryInventory.filter(
        (item: AccessoryInventoryItem) => item.currentStock < item.minimum * 0.5
      )
    } else {
      // Low: Between 50% and 100% of minimum (warning zone)
      lowStockCloth = clothInventory.filter(
        (item: ClothInventoryItem) => {
          const available = item.currentStock - item.reserved
          return available < item.minimum && available >= item.minimum * 0.5
        }
      )
      lowStockAccessories = accessoryInventory.filter(
        (item: AccessoryInventoryItem) =>
          item.currentStock < item.minimum && item.currentStock >= item.minimum * 0.5
      )
    }

    // Format cloth items
    const clothItems = lowStockCloth.map((item: ClothInventoryItem) => ({
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
    const accessoryItems = lowStockAccessories.map((item: AccessoryInventoryItem) => ({
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
