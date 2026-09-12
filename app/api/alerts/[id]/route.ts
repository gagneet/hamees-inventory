import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { hasPermission } from '@/lib/permissions'
import { filterObjectByRole } from '@/lib/field-acl'
import { alertVisibilityScope } from '@/lib/alert-scope'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requirePermission('view_alerts')
    if (error) return error
    const role = session.user.role

    const { id } = await params

    const alert = await prisma.alert.findFirst({
      where: { AND: [{ id }, alertVisibilityScope(role)] },
    })

    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
    }

    let relatedItem = null
    if ((alert.relatedType === 'cloth' || alert.relatedType === 'INVENTORY') && alert.relatedId) {
      const cloth = await prisma.clothInventory.findUnique({
        where: { id: alert.relatedId },
        include: {
          supplierRel: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
        },
      })
      relatedItem = cloth ? filterObjectByRole(cloth, role, 'inventory') : null
    }

    // Opening an alert marks it read — only for roles that manage alerts
    if (!alert.isRead && hasPermission(role, 'manage_alerts')) {
      await prisma.alert.update({
        where: { id },
        data: { isRead: true },
      })
    }

    return NextResponse.json({ alert, relatedItem })
  } catch (error) {
    console.error('Error fetching alert:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alert' },
      { status: 500 }
    )
  }
}
