import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAnyPermission } from '@/lib/api-permissions'

// Supplier list is needed to raise purchase orders and add stock
export async function GET() {
  try {
    const { error } = await requireAnyPermission(['view_suppliers', 'manage_purchase_orders', 'add_inventory'])
    if (error) return error

    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ suppliers })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}
