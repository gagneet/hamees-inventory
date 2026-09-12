/**
 * @featuretrace Production Board (Tailor Kanban)
 * @page /orders/production
 * @description Server-rendered page that fetches the garments (order items) of active orders
 *   and passes them to the TailorKanban client component — one card per item, placed in the
 *   column of the item's own production stage.
 *
 * @access view_orders (orders layout guard) + object-level scope (lib/authz.ts):
 *         TAILOR sees only the items assigned to them; roles with view_all_orders see every item.
 *         update_order_status enables one-click advance (canAdvance) via the item status API.
 *         assign_tailors enables per-item assign / change controls (canAssign).
 *
 * @reads  OrderItem (status, garment, fabric, assignee) + order (number, priority, due date,
 *         customer, all item stages for the "x of y ready" hint)
 * @calls  TailorKanban — client component for one-click status updates and assignment
 */

import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, Scissors } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { TailorKanban, type KanbanItem } from '@/components/orders/tailor-kanban'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'
import { itemProgress, type ProductionStage } from '@/lib/item-status'
import {
  actorFromSession,
  canSeeAllOrders,
  orderItemScope,
  PRODUCTION_ORDER_STATUSES,
  scopedWhere,
  type Actor,
} from '@/lib/authz'

export const dynamic = 'force-dynamic'

async function getActiveItems(actor: Actor): Promise<KanbanItem[]> {
  const ownItemsOnly = !canSeeAllOrders(actor)
  const rows = await prisma.orderItem.findMany({
    where: scopedWhere<Prisma.OrderItemWhereInput>(
      {
        status: { in: [...PRODUCTION_ORDER_STATUSES] },
        order: { status: { in: [...PRODUCTION_ORDER_STATUSES] } },
      },
      ownItemsOnly ? { assignedTailorId: actor.id } : orderItemScope(actor)
    ),
    orderBy: [{ order: { priority: 'desc' } }, { order: { deliveryDate: 'asc' } }, { createdAt: 'asc' }],
    select: {
      id: true,
      status: true,
      bodyType: true,
      garmentPattern: { select: { name: true } },
      clothInventory: { select: { name: true, color: true, colorHex: true } },
      assignedTailor: { select: { id: true, name: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          priority: true,
          deliveryDate: true,
          customer: { select: { name: true } },
          items: { select: { status: true } },
        },
      },
    },
  })

  return rows.map(({ order: { items, ...order }, ...item }) => {
    const progress = itemProgress(items)
    return {
      ...item,
      status: item.status as ProductionStage,
      order: {
        ...order,
        deliveryDate: order.deliveryDate.toISOString(),
        readyCount: progress.ready,
        itemCount: progress.total,
      },
    }
  })
}

export default async function ProductionBoardPage() {
  const session = await auth()
  const actor = actorFromSession(session)
  if (!actor) redirect('/login')

  const userRole = actor.role as UserRole
  if (!hasPermission(userRole, 'view_orders')) redirect('/dashboard')

  const items = await getActiveItems(actor)
  const canAdvance = hasPermission(userRole, 'update_order_status')
  const canAssign = hasPermission(userRole, 'assign_tailors')
  const ownWorkOnly = !canSeeAllOrders(actor)

  // Per-item totals for the summary line
  const count = (...statuses: string[]) => items.filter(i => statuses.includes(i.status)).length
  const totals = {
    NEW:       count('NEW', 'MATERIAL_SELECTED'),
    CUTTING:   count('CUTTING'),
    STITCHING: count('STITCHING'),
    FINISHING: count('FINISHING'),
    READY:     count('READY'),
  }
  const total = items.length
  const orderCount = new Set(items.map(i => i.order.id)).size

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/orders">Orders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Production Board</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl flex items-center gap-2">
            <Scissors className="h-6 w-6 text-slate-600" />
            Production Board
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} {total === 1 ? 'garment' : 'garments'} across {orderCount} {orderCount === 1 ? 'order' : 'orders'}
            {' · '}
            <span>{totals.NEW} new · {totals.CUTTING} cutting · {totals.STITCHING} stitching · {totals.FINISHING} finishing</span>
            {totals.READY > 0 && (
              <>
                {' · '}
                <span className="text-green-600 font-medium">{totals.READY} ready</span>
              </>
            )}
          </p>
          {ownWorkOnly && (
            <p className="text-xs text-slate-400 mt-0.5">
              Showing only the garments assigned to you.
            </p>
          )}
          {!canAdvance && (
            <p className="text-xs text-slate-400 mt-0.5">
              You have read-only access — status updates are disabled for your role.
            </p>
          )}
        </div>
      </div>

      {/* Kanban board */}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          <Scissors className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No garments in production</p>
          <p className="text-sm mt-1">
            {ownWorkOnly ? 'Nothing is assigned to you right now' : 'All orders have been delivered or cancelled'}
          </p>
        </div>
      ) : (
        <TailorKanban items={items} canAdvance={canAdvance} canAssign={canAssign} />
      )}
    </DashboardLayout>
  )
}
