'use client'

/**
 * @featuretrace Inline tailor (re)assignment
 * Compact select that assigns one order item to a tailor / master tailor, or unassigns it.
 * Render only for roles with assign_tailors (the API enforces it too).
 * @calls POST /api/production/assign
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AssignableTailor } from '@/app/api/production/_lib/types'
import { assignItems } from './assign'

const UNASSIGNED = '__unassigned__'

export function ItemAssignSelect({
  itemId,
  currentTailorId,
  tailors,
  onAssigned,
  placeholder = 'Assign…',
}: {
  itemId: string
  currentTailorId: string | null
  tailors: AssignableTailor[]
  onAssigned?: () => void
  placeholder?: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const known = currentTailorId && tailors.some((t) => t.id === currentTailorId)

  const handleChange = async (value: string) => {
    const tailorId = value === UNASSIGNED ? null : value
    if (tailorId === currentTailorId) return
    setSaving(true)
    try {
      await assignItems([itemId], tailorId)
      const name = tailors.find((t) => t.id === tailorId)?.name
      toast.success(name ? `Assigned to ${name}` : 'Item unassigned')
      if (onAssigned) onAssigned()
      else router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign tailor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={known ? currentTailorId! : undefined} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Assign tailor">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {currentTailorId && (
            <SelectItem value={UNASSIGNED}>
              <span className="text-slate-500">Unassign</span>
            </SelectItem>
          )}
          {tailors.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
              {t.role === 'MASTER_TAILOR' ? ' (Master)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
    </div>
  )
}
