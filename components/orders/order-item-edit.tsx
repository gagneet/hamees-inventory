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
import { Input } from '@/components/ui/input'
import { Edit, AlertTriangle } from 'lucide-react'

interface OrderItemEditProps {
  orderId: string
  itemId: string
  currentGarmentPatternId: string
  currentClothInventoryId: string
  currentGarmentName: string
  currentClothName: string
  currentPrice: number
  currentPricePerUnit: number
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
  pricePerMeter: number
  currentStock: number
  reserved: number
}

export function OrderItemEdit({
  orderId,
  itemId,
  currentGarmentPatternId,
  currentClothInventoryId,
  currentGarmentName,
  currentClothName,
  currentPrice,
  currentPricePerUnit,
}: OrderItemEditProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clothInventory, setClothInventory] = useState<ClothInventory[]>([])
  const [selectedClothId, setSelectedClothId] = useState(currentClothInventoryId)
  const [estimatedNewPrice, setEstimatedNewPrice] = useState<number | null>(null)

  // Load cloth inventory when dialog opens
  useEffect(() => {
    if (open) {
      loadClothInventory()
    }
  }, [open])

  const loadClothInventory = async () => {
    try {
      const response = await fetch('/api/inventory/cloth')
      if (response.ok) {
        const data = await response.json()
        // Handle both paginated and non-paginated responses
        const items = data.items || data
        setClothInventory(Array.isArray(items) ? items : [])
      }
    } catch (error) {
      console.error('Error loading cloth inventory:', error)
    }
  }

  // Calculate estimated new price when fabric changes
  useEffect(() => {
    if (selectedClothId !== currentClothInventoryId) {
      const selectedCloth = clothInventory.find(c => c.id === selectedClothId)
      if (selectedCloth) {
        // Estimated price will be calculated on server side with accurate accessories
        // This is just a preview based on fabric cost difference
        const currentCloth = clothInventory.find(c => c.id === currentClothInventoryId)
        if (currentCloth) {
          const priceDifference = selectedCloth.pricePerMeter - currentCloth.pricePerMeter
          const estimatedMeters = currentPricePerUnit / currentCloth.pricePerMeter // rough estimate
          setEstimatedNewPrice(currentPrice + (priceDifference * estimatedMeters))
        }
      }
    } else {
      setEstimatedNewPrice(null)
    }
  }, [selectedClothId, currentClothInventoryId, clothInventory, currentPrice, currentPricePerUnit])

  const handleSave = async () => {
    // Check if anything changed (only cloth can change now)
    if (selectedClothId === currentClothInventoryId) {
      alert('No changes made')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clothInventoryId: selectedClothId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update order item')
      }

      const result = await response.json()
      alert(`Order item updated successfully!\n\nOld Price: ₹${currentPrice.toFixed(2)}\nNew Price: ₹${result.updatedOrderItem.totalPrice.toFixed(2)}\n\nOrder total has been recalculated.`)
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
            Change the fabric for this order item. Garment type cannot be changed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Alert about garment type being locked */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800">
              <strong>Note:</strong> Garment type cannot be changed as it affects measurements, accessories, and customer records. Only fabric can be updated.
            </div>
          </div>

          <div>
            <Label htmlFor="garmentPattern">Garment Type (Read-only)</Label>
            <Input
              value={currentGarmentName}
              disabled
              className="bg-slate-100 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">
              Garment type is locked to prevent data inconsistencies
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
                    {cloth.name} - {cloth.color} ({cloth.brand}) - ₹{cloth.pricePerMeter.toFixed(2)}/m
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Current: {currentClothName}
            </p>
          </div>

          {/* Price preview */}
          {estimatedNewPrice !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-sm font-medium text-blue-900 mb-1">Price Estimate</div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>Current Item Price: <span className="font-semibold">₹{currentPrice.toFixed(2)}</span></div>
                <div>Estimated New Price: <span className="font-semibold">₹{estimatedNewPrice.toFixed(2)}</span></div>
                <div className="text-blue-600 italic mt-2">
                  Note: Actual price will be calculated server-side including accessories and updated order total.
                </div>
              </div>
            </div>
          )}

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
