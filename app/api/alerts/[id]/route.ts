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

    // Stock alerts carry the item they are about: fabric ('cloth'/legacy 'INVENTORY') or accessory.
    // Both are returned in one shape (minimum, unit, unitPrice) so the page does not have to know
    // which kind it is; prices are stripped for roles without inventory cost access.
    type RelatedItem = {
      kind: 'cloth' | 'accessory'
      unit: 'm' | 'pcs'
      id: string
      sku: string
      name: string
      type: string
      currentStock: number
      reserved: number
      minimum: number
      unitPrice?: number
      supplierRel: { id: string; name: string; phone: string | null; email: string | null } | null
    }
    const supplierRel = { select: { id: true, name: true, phone: true, email: true } } as const
    const kind: RelatedItem['kind'] | null =
      alert.relatedType === 'accessory'
        ? 'accessory'
        : alert.relatedType === 'cloth' || alert.relatedType === 'INVENTORY'
          ? 'cloth'
          : null

    let relatedItem: RelatedItem | null = null
    if (kind === 'cloth' && alert.relatedId) {
      const cloth = await prisma.clothInventory.findUnique({ where: { id: alert.relatedId }, include: { supplierRel } })
      if (cloth) {
        // Only the price is role-dependent; identity and stock levels are visible to anyone who sees alerts
        const { pricePerMeter } = filterObjectByRole(cloth, role, 'inventory')
        relatedItem = {
          kind,
          unit: 'm',
          id: cloth.id,
          sku: cloth.sku,
          name: cloth.name,
          type: cloth.type,
          currentStock: cloth.currentStock,
          reserved: cloth.reserved,
          minimum: cloth.minimumStockMeters,
          unitPrice: pricePerMeter,
          supplierRel: cloth.supplierRel,
        }
      }
    } else if (kind === 'accessory' && alert.relatedId) {
      const accessory = await prisma.accessoryInventory.findUnique({ where: { id: alert.relatedId }, include: { supplierRel } })
      if (accessory) {
        const { pricePerUnit } = filterObjectByRole(accessory, role, 'inventory')
        relatedItem = {
          kind,
          unit: 'pcs',
          id: accessory.id,
          sku: accessory.sku,
          name: accessory.name,
          type: accessory.type,
          currentStock: accessory.currentStock,
          reserved: accessory.reserved,
          minimum: accessory.minimumStockUnits,
          unitPrice: pricePerUnit,
          supplierRel: accessory.supplierRel,
        }
      }
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
