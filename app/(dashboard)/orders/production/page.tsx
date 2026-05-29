/**
 * @featuretrace Production Board (Tailor Kanban)
 * @page /orders/production
 * @description Server-rendered page that fetches all active (non-delivered, non-cancelled)
 *   orders and passes them to the TailorKanban client component.
 *   Tailors can advance any order to its next production status with one click.
 *
 * @access view_orders permission required — all roles with view_orders can access this page
 *         VIEWER may access with view_orders but canAdvance=false
 *         update_order_status permission enables one-click status advance (canAdvance=true)
 *
 * @reads  Order (status, priority, deliveryDate) + customer + items (garmentPattern, clothInventory)
 * @calls  TailorKanban — client component for one-click status updates
 */

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
import { TailorKanban, type KanbanOrder } from '@/components/orders/tailor-kanban'
import { hasPermission } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'

async function getActiveOrders(): Promise<KanbanOrder[]> {
  const rows = await prisma.order.findMany({
    where: {
      status: { in: ['NEW', 'CUTTING', 'STITCHING', 'FINISHING', 'READY'] },
    },
    orderBy: [
      { priority: 'desc' },
      { deliveryDate: 'asc' },
    ],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      priority: true,
      deliveryDate: true,
      customer: {
        select: { name: true, phone: true },
      },
      items: {
        select: {
          id: true,
          bodyType: true,
          garmentPattern: { select: { name: true } },
          clothInventory: { select: { name: true, color: true, colorHex: true } },
          assignedTailor: { select: { name: true } },
        },
      },
    },
  })

  // Map to KanbanOrder shape; coerce status type
  return rows.map(o => ({
    ...o,
    status: o.status as KanbanOrder['status'],
    deliveryDate: o.deliveryDate.toISOString(),
    assignedTailor: o.items[0]?.assignedTailor ?? null,
    items: o.items.map(item => ({
      id: item.id,
      bodyType: item.bodyType,
      garmentPattern: item.garmentPattern,
      clothInventory: item.clothInventory,
    })),
  }))
}

export default async function ProductionBoardPage() {
  const session = await auth()
  if (!session?.user) redirect('/')

  const userRole = session.user.role as UserRole
  if (!hasPermission(userRole, 'view_orders')) redirect('/dashboard')

  const orders = await getActiveOrders()
  const canAdvance = hasPermission(userRole, 'update_order_status')

  // Group totals for the summary line
  const totals = {
    NEW:       orders.filter(o => o.status === 'NEW').length,
    CUTTING:   orders.filter(o => o.status === 'CUTTING').length,
    STITCHING: orders.filter(o => o.status === 'STITCHING').length,
    FINISHING: orders.filter(o => o.status === 'FINISHING').length,
    READY:     orders.filter(o => o.status === 'READY').length,
  }
  const total = orders.length

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
            {total} active {total === 1 ? 'order' : 'orders'} in pipeline
            {' · '}
            {totals.READY > 0 && (
              <span className="text-green-600 font-medium">{totals.READY} ready for pickup</span>
            )}
            {totals.READY === 0 && (
              <span>{totals.NEW} new · {totals.CUTTING} cutting · {totals.STITCHING} stitching · {totals.FINISHING} finishing</span>
            )}
          </p>
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
          <p className="text-lg font-medium">No active orders in production</p>
          <p className="text-sm mt-1">All orders have been delivered or cancelled</p>
        </div>
      ) : (
        <TailorKanban orders={orders} canAdvance={canAdvance} />
      )}
    </DashboardLayout>
  )
}
