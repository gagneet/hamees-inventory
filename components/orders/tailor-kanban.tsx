'use client'

/**
 * @featuretrace Tailor Kanban Board
 * @component TailorKanban
 * @description Drag-free production board with ONE CARD PER GARMENT (order item). Each item
 *   moves through NEW → CUTTING → STITCHING → FINISHING → READY on its own, so two tailors
 *   working on the same order never move each other's work. The order's status is derived
 *   from its items (least advanced stage — lib/item-status.ts).
 *
 * @reads  items: KanbanItem[] — passed as prop; fetched by the server page (production/page.tsx)
 * @calls  PATCH /api/orders/:id/items/:itemId/status — one-click advance of one item
 * @calls  router.refresh() — re-renders server data after update
 *
 * @statuses NEW (incl. MATERIAL_SELECTED) → CUTTING → STITCHING → FINISHING → READY
 *   DELIVERED and CANCELLED are order-level and handled in the order detail page
 *
 * @scope The server page scopes items to the user: TAILOR sees only items assigned to them.
 * @assign Assignee chip per card; assign / change control only when canAssign (assign_tailors).
 *
 * @layout Horizontal scroll on mobile; equal-width columns on desktop (grid-cols-5)
 */

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  ArrowRight,
  Scissors,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  Package,
  Sparkles,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { shopStartOfDay } from '@/lib/locale'
import type { ProductionStage } from '@/lib/item-status'
import { AssignTailorDialog } from '@/components/orders/assign-tailor-dialog'

// ── Types ─────────────────────────────────────────────────────────

export type KanbanItem = {
  id: string
  /** The garment's own production stage */
  status: ProductionStage
  bodyType?: string | null
  garmentPattern: { name: string }
  clothInventory: { name: string; color: string; colorHex?: string | null }
  assignedTailor?: { id: string; name: string } | null
  order: {
    id: string
    orderNumber: string
    priority: string
    deliveryDate: string | Date
    customer: { name: string }
    /** Garments of the whole order that are READY, and how many it has in production */
    readyCount: number
    itemCount: number
  }
}

interface TailorKanbanProps {
  items: KanbanItem[]
  canAdvance?: boolean  // update_order_status (the page only passes a tailor their own items)
  canAssign?: boolean   // assign_tailors: OWNER, ADMIN, SALES_MANAGER, MASTER_TAILOR
}

// ── Status column config ──────────────────────────────────────────

type StatusKey = 'NEW' | 'CUTTING' | 'STITCHING' | 'FINISHING' | 'READY'

const COLUMNS: {
  status: StatusKey
  /** Item stages shown in this column (NEW also holds MATERIAL_SELECTED). */
  statuses: ProductionStage[]
  label: string
  icon: React.ElementType
  color: string
  headerBg: string
  borderColor: string
  nextStatus: StatusKey | null
  nextLabel: string | null
}[] = [
  {
    status: 'NEW',
    statuses: ['NEW', 'MATERIAL_SELECTED'],
    label: 'New',
    icon: Package,
    color: 'text-slate-600',
    headerBg: 'bg-slate-100',
    borderColor: 'border-t-slate-400',
    nextStatus: 'CUTTING',
    nextLabel: 'Start Cutting',
  },
  {
    status: 'CUTTING',
    statuses: ['CUTTING'],
    label: 'Cutting',
    icon: Scissors,
    color: 'text-blue-600',
    headerBg: 'bg-blue-50',
    borderColor: 'border-t-blue-500',
    nextStatus: 'STITCHING',
    nextLabel: 'Send to Stitching',
  },
  {
    status: 'STITCHING',
    statuses: ['STITCHING'],
    label: 'Stitching',
    icon: Sparkles,
    color: 'text-violet-600',
    headerBg: 'bg-violet-50',
    borderColor: 'border-t-violet-500',
    nextStatus: 'FINISHING',
    nextLabel: 'Send to Finishing',
  },
  {
    status: 'FINISHING',
    statuses: ['FINISHING'],
    label: 'Finishing',
    icon: Sparkles,
    color: 'text-amber-600',
    headerBg: 'bg-amber-50',
    borderColor: 'border-t-amber-500',
    nextStatus: 'READY',
    nextLabel: 'Mark as Ready',
  },
  {
    status: 'READY',
    statuses: ['READY'],
    label: 'Ready',
    icon: CheckCircle2,
    color: 'text-green-600',
    headerBg: 'bg-green-50',
    borderColor: 'border-t-green-500',
    nextStatus: null,
    nextLabel: null,
  },
]

// ── Helpers ───────────────────────────────────────────────────────

/** Shop-local calendar days until delivery, so the server render (UTC) and the browser agree. */
function getDaysLeft(deliveryDate: string | Date): number {
  const due = shopStartOfDay(deliveryDate).getTime()
  const today = shopStartOfDay(new Date()).getTime()
  return Math.round((due - today) / 86_400_000)
}

function DeliveryBadge({ deliveryDate }: { deliveryDate: string | Date }) {
  const days = getDaysLeft(deliveryDate)
  const label =
    days < 0  ? `${Math.abs(days)}d overdue` :
    days === 0 ? 'Due today' :
    days === 1 ? 'Due tomorrow' :
    `${days}d left`

  // Use Clock for time-sensitive (≤1 day) cases; CalendarDays for future dates
  const Icon = days <= 1 ? Clock : CalendarDays

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
      days < 0  ? 'bg-red-100 text-red-700' :
      days === 0 ? 'bg-amber-100 text-amber-700' :
      days === 1 ? 'bg-orange-100 text-orange-700' :
                   'bg-slate-100 text-slate-600'
    )}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ── Kanban card (one garment) ─────────────────────────────────────

function ItemCard({
  item,
  nextStatus,
  nextLabel,
  canAdvance,
  canAssign,
  onAdvance,
  advancing,
}: {
  item: KanbanItem
  nextStatus: StatusKey | null
  nextLabel: string | null
  canAdvance: boolean
  canAssign: boolean
  onAdvance: (item: KanbanItem, status: StatusKey) => void
  advancing: boolean
}) {
  const { order } = item
  const days = getDaysLeft(order.deliveryDate)
  const isUrgent = order.priority === 'URGENT' || days <= 1
  const garment = `${item.garmentPattern.name}${item.bodyType ? ` · ${item.bodyType}` : ''}`

  return (
    <Card
      className={cn(
        'shadow-sm hover:shadow-md transition-shadow',
        isUrgent && 'border-red-300 ring-1 ring-red-200',
      )}
      aria-label={`${item.garmentPattern.name} — order ${order.orderNumber}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Garment + urgency */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-semibold text-slate-800 truncate" title={garment}>{garment}</p>
          <div className="flex items-center gap-1 shrink-0">
            {isUrgent && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
            {order.priority === 'URGENT' && (
              <Badge className="text-[9px] py-0 px-1 bg-red-500 text-white">URGENT</Badge>
            )}
          </div>
        </div>

        {/* Order number + customer */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <Link
            href={`/orders/${order.id}`}
            className="font-medium text-slate-600 hover:text-blue-600 hover:underline truncate"
          >
            {order.orderNumber}
          </Link>
          <span className="text-slate-500 truncate">{order.customer.name}</span>
        </div>

        {/* Assignee */}
        <div className="flex items-center justify-between gap-1 text-[10px]">
          <span className={item.assignedTailor ? 'text-slate-500 truncate' : 'text-amber-700'}>
            {item.assignedTailor ? `👤 ${item.assignedTailor.name}` : 'Unassigned'}
          </span>
          {canAssign && (
            <AssignTailorDialog
              variant="compact"
              orderId={order.id}
              itemId={item.id}
              currentTailorId={item.assignedTailor?.id ?? null}
              currentTailorName={item.assignedTailor?.name ?? null}
              garmentName={item.garmentPattern.name}
            />
          )}
        </div>

        {/* Fabric with colour swatch */}
        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
          {item.clothInventory.colorHex && (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full border border-slate-200 shrink-0"
              style={{ backgroundColor: item.clothInventory.colorHex }}
            />
          )}
          {item.clothInventory.name} ({item.clothInventory.color})
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <DeliveryBadge deliveryDate={order.deliveryDate} />
          {order.itemCount > 1 && (
            <span className="text-[10px] text-slate-500">
              {order.readyCount} of {order.itemCount} items ready
            </span>
          )}
        </div>
      </CardContent>

      {/* Advance button */}
      {canAdvance && nextStatus && nextLabel && (
        <div className="border-t px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={advancing}
            onClick={() => onAdvance(item, nextStatus)}
            className="w-full h-7 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 gap-1"
          >
            {advancing
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <ArrowRight className="h-3 w-3" />
            }
            {advancing ? 'Updating…' : nextLabel}
          </Button>
        </div>
      )}
    </Card>
  )
}

// ── Main Kanban board ─────────────────────────────────────────────

/** Move one item and keep the "x of y ready" hint of its order's other cards in step. */
function applyMove(items: KanbanItem[], moved: KanbanItem, status: ProductionStage): KanbanItem[] {
  const delta = (status === 'READY' ? 1 : 0) - (moved.status === 'READY' ? 1 : 0)
  return items.map((i) => {
    if (i.order.id !== moved.order.id) return i
    const order = delta ? { ...i.order, readyCount: i.order.readyCount + delta } : i.order
    return i.id === moved.id ? { ...i, status, order } : { ...i, order }
  })
}

export function TailorKanban({ items, canAdvance = true, canAssign = false }: TailorKanbanProps) {
  const router = useRouter()
  // Item ids currently being advanced
  const [advancing, setAdvancing] = useState<Set<string>>(new Set())
  // Local optimistic state — move cards immediately, roll back on error
  const [localItems, setLocalItems] = useState<KanbanItem[]>(items)

  // Keep local state in sync when parent re-renders (after router.refresh)
  React.useEffect(() => { setLocalItems(items) }, [items])

  const handleAdvance = useCallback(async (item: KanbanItem, newStatus: StatusKey) => {
    const previousItems = localItems
    setLocalItems(prev => applyMove(prev, item, newStatus))
    setAdvancing(prev => new Set(prev).add(item.id))

    try {
      const res = await fetch(`/api/orders/${item.order.id}/items/${item.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Update failed')

      const columnLabel = COLUMNS.find(c => c.status === newStatus)?.label ?? newStatus
      toast.success(
        data.orderStatus === 'READY' && newStatus === 'READY'
          ? `${item.garmentPattern.name} ready — order ${item.order.orderNumber} is complete`
          : `${item.garmentPattern.name} moved to ${columnLabel}`
      )
      router.refresh()
    } catch (err: unknown) {
      // Roll back on failure
      setLocalItems(previousItems)
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setAdvancing(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }, [localItems, router])

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="grid grid-cols-5 gap-3 min-w-[900px]">
        {COLUMNS.map(col => {
          const Icon = col.icon
          const colItems = localItems.filter(i => col.statuses.includes(i.status))
          return (
            <div key={col.status} className="flex flex-col gap-2">
              {/* Column header */}
              <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border-t-4',
                col.headerBg, col.borderColor
              )}>
                <span className={cn('flex items-center gap-1.5 text-sm font-semibold', col.color)}>
                  <Icon className="h-4 w-4" />
                  {col.label}
                </span>
                <span className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  colItems.length > 0 ? 'bg-white shadow-sm' : 'bg-transparent opacity-40',
                  col.color
                )}>
                  {colItems.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[200px]">
                {colItems.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    No items
                  </div>
                ) : (
                  colItems.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      nextStatus={col.nextStatus}
                      nextLabel={col.nextLabel}
                      canAdvance={canAdvance}
                      canAssign={canAssign}
                      advancing={advancing.has(item.id)}
                      onAdvance={handleAdvance}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
