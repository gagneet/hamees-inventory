'use client'

/**
 * @featuretrace Unassigned production queue
 * Active items without an (active) tailor. With assign_tailors, items can be selected and
 * assigned in bulk; tailors at or over capacity are flagged in the picker.
 * @calls POST /api/production/assign
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Inbox, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TailorWorkload, WorkloadItem } from '@/app/api/production/_lib/types'
import { assignItems } from './assign'
import { WorkloadItemRow } from './workload-item-row'

export function UnassignedQueue({
  items,
  tailors,
  canAssign,
  onAssigned,
  limit,
}: {
  items: WorkloadItem[]
  tailors: TailorWorkload[]
  canAssign: boolean
  onAssigned?: () => void
  limit?: number
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tailorId, setTailorId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const visible = limit ? items.slice(0, limit) : items
  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.id))
  const sortedTailors = useMemo(() => [...tailors].sort((a, b) => a.activeCount - b.activeCount), [tailors])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleAssign = async () => {
    if (!tailorId || selected.size === 0) return
    setSaving(true)
    try {
      const { updated } = await assignItems([...selected], tailorId)
      const name = tailors.find((t) => t.id === tailorId)?.name ?? 'tailor'
      toast.success(`${updated} item${updated === 1 ? '' : 's'} assigned to ${name}`)
      setSelected(new Set())
      if (onAssigned) onAssigned()
      else router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign items')
    } finally {
      setSaving(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <Inbox className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">Every active item has a tailor</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {canAssign && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 pl-1">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked ? new Set(visible.map((i) => i.id)) : new Set())}
              aria-label="Select all unassigned items"
            />
            {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select value={tailorId} onValueChange={setTailorId}>
              <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Tailor to assign">
                <SelectValue placeholder="Choose tailor…" />
              </SelectTrigger>
              <SelectContent>
                {sortedTailors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.activeCount}/{t.capacity}
                    {t.overCapacity ? ' (over)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" disabled={saving || !tailorId || selected.size === 0} onClick={handleAssign}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
              Assign
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((item) => (
          <WorkloadItemRow
            key={item.id}
            item={item}
            showAssignee
            leading={
              canAssign ? (
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={`Select ${item.orderNumber} ${item.garmentName}`}
                />
              ) : undefined
            }
          />
        ))}
      </div>
      {limit && items.length > limit && (
        <p className="text-xs text-slate-500">+{items.length - limit} more in the queue</p>
      )}
    </div>
  )
}
