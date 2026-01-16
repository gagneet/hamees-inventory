'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Edit } from 'lucide-react'

interface OrderItemEditProps {
  orderId: string
  itemId: string
  currentGarmentPatternId: string
  currentClothInventoryId: string
  currentGarmentName: string
  currentClothName: string
}

interface GarmentPattern {
  id: string
  name: string
  description: string | null
}

interface ClothInventory {
  id: string
  name: string
  color: string
  sku: string
  brand: string
}

export function OrderItemEdit({
  orderId,
  itemId,
  currentGarmentPatternId,
  currentClothInventoryId,
  currentGarmentName,
  currentClothName,
}: OrderItemEditProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [garmentPatterns, setGarmentPatterns] = useState<GarmentPattern[]>([])
  const [clothInventory, setClothInventory] = useState<ClothInventory[]>([])

  const [selectedGarmentId, setSelectedGarmentId] = useState(currentGarmentPatternId)
  const [selectedClothId, setSelectedClothId] = useState(currentClothInventoryId)

  // Load garment patterns and cloth inventory when dialog opens
  useEffect(() => {
    if (open) {
      loadGarmentPatterns()
      loadClothInventory()
    }
  }, [open])

  const loadGarmentPatterns = async () => {
    try {
      const response = await fetch('/api/garment-patterns')
      if (response.ok) {
        const data = await response.json()
        setGarmentPatterns(data)
      }
    } catch (error) {
      console.error('Error loading garment patterns:', error)
    }
  }

  const loadClothInventory = async () => {
    try {
      const response = await fetch('/api/inventory/cloth')
      if (response.ok) {
        const data = await response.json()
        setClothInventory(data.items || data)
      }
    } catch (error) {
      console.error('Error loading cloth inventory:', error)
    }
  }

  const handleSave = async () => {
    // Check if anything changed
    if (
      selectedGarmentId === currentGarmentPatternId &&
      selectedClothId === currentClothInventoryId
    ) {
      alert('No changes made')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentPatternId: selectedGarmentId,
          clothInventoryId: selectedClothId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update order item')
      }

      alert('Order item updated successfully!')
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating order item:', error)
      alert(error instanceof Error ? error.message : 'Failed to update order item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-3 w-3 mr-1" />
          Edit Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Order Item</DialogTitle>
          <DialogDescription>
            Change the garment type or fabric for this order item
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="garmentPattern">Garment Type</Label>
            <Select value={selectedGarmentId} onValueChange={setSelectedGarmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select garment type" />
              </SelectTrigger>
              <SelectContent>
                {garmentPatterns.map((pattern) => (
                  <SelectItem key={pattern.id} value={pattern.id}>
                    {pattern.name}
                    {pattern.description && ` - ${pattern.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Current: {currentGarmentName}
            </p>
          </div>

          <div>
            <Label htmlFor="clothInventory">Fabric</Label>
            <Select value={selectedClothId} onValueChange={setSelectedClothId}>
              <SelectTrigger>
                <SelectValue placeholder="Select fabric" />
              </SelectTrigger>
              <SelectContent>
                {clothInventory.map((cloth) => (
                  <SelectItem key={cloth.id} value={cloth.id}>
                    {cloth.name} - {cloth.color} ({cloth.brand})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Current: {currentClothName}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
