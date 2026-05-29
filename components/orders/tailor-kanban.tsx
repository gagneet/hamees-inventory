'use client'

/**
 * @featuretrace Tailor Kanban Board
 * @component TailorKanban
 * @description Drag-free production pipeline board. Shows active orders (NEW → CUTTING →
 *   STITCHING → FINISHING → READY) as swimlane columns with one-click status advance.
 *   Tailors can move any order to the next stage without navigating to the order detail page.
 *
 * @reads  orders: KanbanOrder[] — passed as prop; fetched by parent server component (production/page.tsx) via prisma.order.findMany()
 * @calls  PATCH /api/orders/:id/status — one-click advance to next status
 * @calls  router.refresh() — re-renders server data after update
 *
 * @statuses NEW → CUTTING → STITCHING → FINISHING → READY
 *   DELIVERED and CANCELLED are excluded from the board (handled in order detail)
 *
 * @layout Horizontal scroll on mobile; equal-width columns on desktop (lg:grid-cols-5)
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

// ── Types ─────────────────────────────────────────────────────────

export type KanbanOrder = {
  id: string
  orderNumber: string
  status: 'NEW' | 'CUTTING' | 'STITCHING' | 'FINISHING' | 'READY'
  priority: string
  deliveryDate: string | Date
  customer: { name: string; phone: string }
  items: Array<{
    id: string
    garmentPattern: { name: string }
    clothInventory: { name: string; color: string; colorHex?: string | null }
    bodyType?: string | null
  }>
  assignedTailor?: { name: string } | null
}

interface TailorKanbanProps {
  orders: KanbanOrder[]
  canAdvance?: boolean  // false for VIEWER; true for TAILOR and above
}

// ── Status column config ──────────────────────────────────────────

type StatusKey = 'NEW' | 'CUTTING' | 'STITCHING' | 'FINISHING' | 'READY'

const COLUMNS: {
  status: StatusKey
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

function getDaysLeft(deliveryDate: string | Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(deliveryDate)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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

// ── Kanban card ───────────────────────────────────────────────────

function OrderCard({
  order,
  nextStatus,
  nextLabel,
  canAdvance,
  onAdvance,
  advancing,
}: {
  order: KanbanOrder
  nextStatus: StatusKey | null
  nextLabel: string | null
  canAdvance: boolean
  onAdvance: (orderId: string, status: StatusKey) => void
  advancing: boolean
}) {
  const garmentNames = order.items.map(i => i.garmentPattern.name).join(', ')
  const days = getDaysLeft(order.deliveryDate)
  const isUrgent = order.priority === 'URGENT' || days <= 1

  return (
    <Card
      className={cn(
        'shadow-sm hover:shadow-md transition-shadow',
        isUrgent && 'border-red-300 ring-1 ring-red-200',
      )}
      aria-label={`Order ${order.orderNumber} — ${garmentNames}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Order number + customer */}
        <div className="flex items-start justify-between gap-1">
          <Link
            href={`/orders/${order.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-blue-600 hover:underline truncate"
          >
            {order.orderNumber}
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            {isUrgent && (
              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            )}
            {order.priority === 'URGENT' && (
              <Badge className="text-[9px] py-0 px-1 bg-red-500 text-white">URGENT</Badge>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 truncate">{order.customer.name}</p>

        {/* Garment items */}
        <div className="flex flex-wrap gap-1" title={garmentNames}>
          {order.items.map(item => (
            <span
              key={item.id}
              className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
            >
              {item.garmentPattern.name}
              {item.bodyType ? ` · ${item.bodyType}` : ''}
            </span>
          ))}
        </div>

        {/* Fabric summary with colour swatch */}
        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
          {order.items[0]?.clothInventory.colorHex && (
            <span
              className="inline-block w-2.5 h-2.5 rounded-full border border-slate-200 shrink-0"
              style={{ backgroundColor: order.items[0].clothInventory.colorHex }}
            />
          )}
          {order.items[0]?.clothInventory.name}
          {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
        </p>

        {/* Delivery indicator */}
        <DeliveryBadge deliveryDate={order.deliveryDate} />

        {/* Assigned tailor chip */}
        {order.assignedTailor && (
          <p className="text-[10px] text-slate-500">
            👤 {order.assignedTailor.name}
          </p>
        )}
      </CardContent>

      {/* Advance button */}
      {canAdvance && nextStatus && nextLabel && (
        <div className="border-t px-3 py-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={advancing}
            onClick={() => onAdvance(order.id, nextStatus)}
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

export function TailorKanban({ orders, canAdvance = true }: TailorKanbanProps) {
  const router = useRouter()
  // Track which order IDs are currently being advanced
  const [advancing, setAdvancing] = useState<Set<string>>(new Set())
  // Local optimistic state — move cards immediately, roll back on error
  const [localOrders, setLocalOrders] = useState<KanbanOrder[]>(orders)

  // Keep local state in sync when parent re-renders (after router.refresh)
  React.useEffect(() => { setLocalOrders(orders) }, [orders])

  const handleAdvance = useCallback(async (orderId: string, newStatus: StatusKey) => {
    // Optimistic update — move card immediately
    const previousOrders = localOrders
    setLocalOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    )
    setAdvancing(prev => new Set(prev).add(orderId))

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Update failed')
      }

      const columnLabel = COLUMNS.find(c => c.status === newStatus)?.label ?? newStatus
      toast.success(`Order moved to ${columnLabel}`)
      router.refresh()
    } catch (err: any) {
      // Roll back on failure
      setLocalOrders(previousOrders)
      toast.error(err.message ?? 'Failed to update status')
    } finally {
      setAdvancing(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }, [localOrders, router])

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="grid grid-cols-5 gap-3 min-w-[900px]">
        {COLUMNS.map(col => {
          const Icon = col.icon
          const colOrders = localOrders.filter(o => o.status === col.status)
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
                  colOrders.length > 0 ? 'bg-white shadow-sm' : 'bg-transparent opacity-40',
                  col.color
                )}>
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[200px]">
                {colOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                    No orders
                  </div>
                ) : (
                  colOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      nextStatus={col.nextStatus}
                      nextLabel={col.nextLabel}
                      canAdvance={canAdvance}
                      advancing={advancing.has(order.id)}
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
