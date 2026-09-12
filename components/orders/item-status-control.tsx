'use client'

/**
 * @featuretrace Per-item production status (order detail)
 * @component ItemStatusControl
 * @description The garment's own stage badge, plus a one-click "next stage" button. Roles that
 *   see all orders also get a stage picker (to move an item back); a tailor can step back one
 *   stage on their own item to undo a mistake. Rules live in lib/item-status.ts and are enforced
 *   by the API.
 * @calls PATCH /api/orders/:id/items/:itemId/status
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { nextStage, PRODUCTION_STAGES, stageIndex, STAGE_LABELS } from '@/lib/item-status'

export const STAGE_BADGE_CLASSES: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  MATERIAL_SELECTED: 'bg-purple-50 text-purple-700 border-purple-200',
  CUTTING: 'bg-orange-50 text-orange-700 border-orange-200',
  STITCHING: 'bg-pink-50 text-pink-700 border-pink-200',
  FINISHING: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  READY: 'bg-green-50 text-green-700 border-green-200',
  DELIVERED: 'bg-gray-50 text-gray-700 border-gray-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
}

export function ItemStageBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge className={cn('border text-[11px] px-2 py-0', STAGE_BADGE_CLASSES[status], className)}>
      {STAGE_LABELS[status] ?? status}
    </Badge>
  )
}

export function ItemStatusControl({
  orderId,
  itemId,
  status,
  canMove,
  canMoveAnyStage,
}: {
  orderId: string
  itemId: string
  status: string
  /** update_order_status, the order is open, and the item is the viewer's or they see all orders */
  canMove: boolean
  /** Roles that see all orders may pick any stage, including moving back */
  canMoveAnyStage: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const next = nextStage(status)
  const index = stageIndex(status)
  const previous = index > 0 ? PRODUCTION_STAGES[index - 1] : null

  const move = async (to: string) => {
    if (to === status) return
    setSaving(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to update the item')
      toast.success(`Item moved to ${STAGE_LABELS[to] ?? to}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update the item')
    } finally {
      setSaving(false)
    }
  }

  if (!canMove || index < 0) return <ItemStageBadge status={status} />

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canMoveAnyStage ? (
        <Select value={status} onValueChange={move} disabled={saving}>
          <SelectTrigger className="h-7 w-[150px] text-xs" aria-label="Item stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCTION_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage} className="text-xs">
                {STAGE_LABELS[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <ItemStageBadge status={status} />
      )}
      {next && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          disabled={saving}
          onClick={() => move(next)}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
          {STAGE_LABELS[next]}
        </Button>
      )}
      {!canMoveAnyStage && previous && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 text-slate-500"
          disabled={saving}
          onClick={() => move(previous)}
          title={`Undo: back to ${STAGE_LABELS[previous]}`}
        >
          <Undo2 className="h-3 w-3" />
          Back
        </Button>
      )}
    </div>
  )
}
