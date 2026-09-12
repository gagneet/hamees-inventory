/**
 * @featuretrace Bulk tailor assignment
 * POST /api/production/assign  { orderItemIds: string[1..100], tailorId: string | null }
 *
 * Permission: assign_tailors (OWNER, ADMIN, SALES_MANAGER, MASTER_TAILOR).
 * The target must be an ACTIVE TAILOR or MASTER_TAILOR; items must exist and belong to open
 * (non-delivered, non-cancelled) orders. Writes OrderHistory per item and an AuditLog entry.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/api-permissions'
import { TERMINAL_ORDER_STATUSES } from '@/lib/authz'
import { audit } from '@/lib/audit'
import { assignRequestSchema, checkAssignItems, checkAssignTarget } from '../_lib/assign'

export async function POST(request: Request) {
  const { session, error } = await requirePermission('assign_tailors')
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = assignRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }
  const { orderItemIds, tailorId } = parsed.data

  try {
    const tailor = tailorId
      ? await prisma.user.findUnique({
          where: { id: tailorId },
          select: { id: true, name: true, role: true, active: true },
        })
      : null
    const targetCheck = checkAssignTarget(tailorId, tailor)
    if (!targetCheck.ok) return NextResponse.json({ error: targetCheck.error }, { status: targetCheck.status })

    const items =
      (await prisma.orderItem.findMany({
        where: { id: { in: orderItemIds } },
        select: {
          id: true,
          orderId: true,
          assignedTailorId: true,
          assignedTailor: { select: { name: true } },
          garmentPattern: { select: { name: true } },
          order: { select: { orderNumber: true, status: true } },
        },
      })) ?? []
    const itemCheck = checkAssignItems(orderItemIds, items)
    if (!itemCheck.ok) return NextResponse.json({ error: itemCheck.error }, { status: itemCheck.status })

    const changed = items.filter((i) => i.assignedTailorId !== tailorId)
    if (changed.length === 0) {
      return NextResponse.json({ updated: 0, tailor: tailor ? { id: tailor.id, name: tailor.name } : null })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Re-check order status inside the transaction so a concurrent delivery/cancel wins
      const result = await tx.orderItem.updateMany({
        where: {
          id: { in: changed.map((i) => i.id) },
          order: { status: { notIn: [...TERMINAL_ORDER_STATUSES] } },
        },
        data: { assignedTailorId: tailorId },
      })

      for (const item of changed) {
        const previous = item.assignedTailor?.name ?? null
        const garment = item.garmentPattern.name
        await tx.orderHistory.create({
          data: {
            orderId: item.orderId,
            userId: session.user.id,
            changeType: tailor ? 'TAILOR_ASSIGNED' : 'TAILOR_UNASSIGNED',
            fieldName: 'assignedTailorId',
            oldValue: previous,
            newValue: tailor?.name ?? null,
            description: tailor
              ? `${garment} assigned to ${tailor.name}${previous ? ` (previously ${previous})` : ''}`
              : `${garment} unassigned${previous ? ` from ${previous}` : ''}`,
          },
        })
      }
      return result?.count ?? changed.length
    })

    await audit({
      userId: session.user.id,
      action: tailor ? 'TAILOR_ASSIGNED' : 'TAILOR_UNASSIGNED',
      entityType: 'OrderItem',
      entityId: changed.length === 1 ? changed[0].id : null,
      details: {
        orderItemIds: changed.map((i) => i.id),
        tailorId,
        previous: Object.fromEntries(changed.map((i) => [i.id, i.assignedTailorId])),
      },
    })

    return NextResponse.json({ updated, tailor: tailor ? { id: tailor.id, name: tailor.name } : null })
  } catch (err) {
    console.error('Error assigning tailor:', err)
    return NextResponse.json({ error: 'Failed to assign tailor' }, { status: 500 })
  }
}
