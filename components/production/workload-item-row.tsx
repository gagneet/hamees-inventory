'use client'

/**
 * One production item: order link, garment, order status, due date, customer and notes.
 * Used by the unassigned queue, overdue list and per-tailor tables. No prices.
 */

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import type { WorkloadItem } from '@/app/api/production/_lib/types'

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  MATERIAL_SELECTED: 'Material selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready',
}

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  MATERIAL_SELECTED: 'bg-purple-100 text-purple-700',
  CUTTING: 'bg-blue-100 text-blue-700',
  STITCHING: 'bg-violet-100 text-violet-700',
  FINISHING: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700')}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function DueBadge({ daysLeft, active = true }: { daysLeft: number; active?: boolean }) {
  const label =
    daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d left`
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
        !active
          ? 'bg-slate-100 text-slate-500'
          : daysLeft < 0
            ? 'bg-red-100 text-red-700'
            : daysLeft <= 1
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
      )}
    >
      {label}
    </span>
  )
}

export function WorkloadItemRow({
  item,
  showAssignee = false,
  leading,
  action,
}: {
  item: WorkloadItem
  showAssignee?: boolean
  leading?: React.ReactNode
  action?: React.ReactNode
}) {
  // The garment's own stage (orders with several items move item by item)
  const active = item.status !== 'READY'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/orders/${item.orderId}`} className="text-sm font-semibold text-slate-900 hover:text-blue-600 hover:underline">
            {item.orderNumber}
          </Link>
          <span className="text-sm text-slate-700">
            {item.garmentName}
            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
          </span>
          {item.priority === 'URGENT' && <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">URGENT</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>{item.customerName}</span>
          <span aria-hidden>·</span>
          <span>Due {formatDate(item.deliveryDate)}</span>
          {showAssignee && (
            <>
              <span aria-hidden>·</span>
              <span className={item.assignedTailorName ? '' : 'text-amber-700'}>
                {item.assignedTailorName ? `Assigned: ${item.assignedTailorName} (inactive)` : 'Unassigned'}
              </span>
            </>
          )}
        </div>
        {item.notes && <p className="mt-1 text-xs text-slate-600 line-clamp-2">📝 {item.notes}</p>}
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={item.status} />
        <DueBadge daysLeft={item.daysLeft} active={active} />
        {action}
      </div>
    </div>
  )
}
