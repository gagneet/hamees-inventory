'use client'

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

interface AssignTailorDialogProps {
  orderId: string
  itemId: string
  currentTailorId?: string
  currentTailorName?: string
  garmentName: string
}

interface Tailor {
  id: string
  name: string
  email: string
}

export function AssignTailorDialog({
  orderId,
  itemId,
  currentTailorId,
  currentTailorName,
  garmentName,
}: AssignTailorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tailors, setTailors] = useState<Tailor[]>([])
  const [selectedTailorId, setSelectedTailorId] = useState<string>(currentTailorId || 'UNASSIGNED')

  // Fetch list of tailors
  useEffect(() => {
    const fetchTailors = async () => {
      try {
        const response = await fetch('/api/users?role=TAILOR')
        if (response.ok) {
          const data = await response.json()
          setTailors(data.users || [])
        }
      } catch (error) {
        console.error('Error fetching tailors:', error)
      }
    }

    if (open) {
      fetchTailors()
    }
  }, [open])

  const handleAssign = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignedTailorId: selectedTailorId === 'UNASSIGNED' ? null : selectedTailorId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign tailor')
      }

      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error assigning tailor:', error)
      alert(error instanceof Error ? error.message : 'Failed to assign tailor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-1" />
          {currentTailorName ? 'Change Tailor' : 'Assign Tailor'}
        </Button>
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
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tailors.length === 0 && (
              <p className="text-xs text-slate-500">
                No tailors found. Create a user with TAILOR role first.
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
            disabled={loading || (selectedTailorId === currentTailorId || (!currentTailorId && selectedTailorId === 'UNASSIGNED'))}
          >
            {loading ? 'Assigning...' : 'Assign Tailor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
