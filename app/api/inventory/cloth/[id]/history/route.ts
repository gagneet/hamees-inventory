import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-permissions'
import { prisma } from '@/lib/db'
import { actorFromSession, canSeeAllOrders, orderScope } from '@/lib/authz'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('view_inventory')
    if (error) return error
    const actor = actorFromSession(session)
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params

    // Verify cloth item exists
    const cloth = await prisma.clothInventory.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!cloth) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Fetch stock movement history
    const movements = await prisma.stockMovement.findMany({
      where: { clothInventoryId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    // ABAC: roles scoped to their own orders (TAILOR) only see links to orders in their scope
    let visibleMovements = movements
    if (!canSeeAllOrders(actor)) {
      const linkedOrderIds = [...new Set(movements.map((m) => m.orderId).filter((v): v is string => !!v))]
      const visible = linkedOrderIds.length
        ? await prisma.order.findMany({
            where: { AND: [{ id: { in: linkedOrderIds } }, orderScope(actor)] },
            select: { id: true },
          })
        : []
      const visibleIds = new Set((visible ?? []).map((o) => o.id))
      visibleMovements = movements.map((m) =>
        m.orderId && !visibleIds.has(m.orderId) ? { ...m, orderId: null, order: null } : m
      )
    }

    return NextResponse.json({
      cloth,
      movements: visibleMovements,
      totalMovements: visibleMovements.length,
    })
  } catch (error) {
    console.error('Error fetching stock movement history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}
