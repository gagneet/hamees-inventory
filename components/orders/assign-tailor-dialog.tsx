'use client'

/**
 * @featuretrace Assign Tailor dialog
 * Assigns one order item to an active Tailor or Master Tailor (or unassigns it).
 * Render only for roles with assign_tailors — the API enforces the same permission.
 * @calls GET /api/users?role=TAILOR,MASTER_TAILOR — assignable staff ({ id, name, role })
 * @calls POST /api/production/assign — { orderItemIds: [itemId], tailorId }
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { assignItems } from '@/components/production/assign'
import type { AssignableTailor } from '@/app/api/production/_lib/types'

interface AssignTailorDialogProps {
  /** Kept for callers; assignment is addressed by item id. */
  orderId?: string
  itemId: string
  currentTailorId?: string | null
  currentTailorName?: string | null
  garmentName: string
  /** 'compact' renders a small text trigger for dense layouts (e.g. kanban cards). */
  variant?: 'default' | 'compact'
  onAssigned?: () => void
}

export function AssignTailorDialog({
  itemId,
  currentTailorId,
  currentTailorName,
  garmentName,
  variant = 'default',
  onAssigned,
}: AssignTailorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tailors, setTailors] = useState<AssignableTailor[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedTailorId, setSelectedTailorId] = useState<string>(currentTailorId || 'UNASSIGNED')

  // Fetch assignable staff when the dialog opens
  useEffect(() => {
    if (!open) return
    setSelectedTailorId(currentTailorId || 'UNASSIGNED')
    const fetchTailors = async () => {
      try {
        const response = await fetch('/api/users?role=TAILOR,MASTER_TAILOR')
        if (response.ok) {
          const data = await response.json()
          setTailors(data.users || [])
        }
      } catch (error) {
        console.error('Error fetching tailors:', error)
      } finally {
        setLoaded(true)
      }
    }
    fetchTailors()
  }, [open, currentTailorId])

  const handleAssign = async () => {
    setLoading(true)
    try {
      const tailorId = selectedTailorId === 'UNASSIGNED' ? null : selectedTailorId
      await assignItems([itemId], tailorId)
      const name = tailors.find((t) => t.id === tailorId)?.name
      toast.success(name ? `${garmentName} assigned to ${name}` : `${garmentName} unassigned`)
      setOpen(false)
      if (onAssigned) onAssigned()
      else router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign tailor')
    } finally {
      setLoading(false)
    }
  }

  const unchanged = selectedTailorId === (currentTailorId || 'UNASSIGNED')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === 'compact' ? (
          <button
            type="button"
            className={cn(
              'text-[10px] font-medium underline-offset-2 hover:underline',
              currentTailorName ? 'text-blue-600' : 'text-amber-700'
            )}
            aria-label={`${currentTailorName ? 'Change' : 'Assign'} tailor for ${garmentName}`}
          >
            {currentTailorName ? 'Change' : 'Assign'}
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-1" />
            {currentTailorName ? 'Change Tailor' : 'Assign Tailor'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Tailor</DialogTitle>
          <DialogDescription>
            Assign a tailor to work on {garmentName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {currentTailorName && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <p className="text-blue-900">
                <strong>Currently Assigned:</strong> {currentTailorName}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              Select Tailor
            </label>
            <Select
              value={selectedTailorId}
              onValueChange={setSelectedTailorId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a tailor..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNASSIGNED">
                  <span className="text-slate-500">Unassigned</span>
                </SelectItem>
                {tailors.map((tailor) => (
                  <SelectItem key={tailor.id} value={tailor.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{tailor.name}</span>
                      {tailor.role === 'MASTER_TAILOR' && (
                        <span className="text-xs text-slate-500">Master Tailor</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loaded && tailors.length === 0 && (
              <p className="text-xs text-slate-500">
                No active tailors found. Create a user with the Tailor or Master Tailor role first.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={loading || unchanged}
          >
            {loading ? 'Assigning...' : 'Assign Tailor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
