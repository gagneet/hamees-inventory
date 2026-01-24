'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import { Package, Save, X, ExternalLink } from 'lucide-react'

interface ClothItem {
  id: string
  sku: string
  name: string
  type: string
  brand: string
  color: string
  colorHex: string
  pattern: string
  quality: string
  pricePerMeter: number
  currentStock: number
  reserved: number
  minimumStockMeters: number
  supplier: string
  location?: string
  supplierRel?: { name: string; id: string }
}

interface AccessoryItem {
  id: string
  sku: string
  type: string
  name: string
  color?: string
  currentStock: number
  pricePerUnit: number
  minimumStockUnits: number
  supplier: string
  supplierRel?: { name: string; id: string }
}

interface ItemEditDialogProps {
  isOpen: boolean
  onClose: () => void
  itemType: 'cloth' | 'accessory'
  item: ClothItem | AccessoryItem
  userRole?: string
}

export function ItemEditDialog({ isOpen, onClose, itemType, item, userRole }: ItemEditDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState(item)

  const isTailor = userRole === 'TAILOR'

  const getStockStatus = (current: number, reserved: number, minimum: number) => {
    const available = current - (reserved || 0)
    if (available <= 0) return { label: "Out of Stock", variant: "destructive" as const, color: "text-red-600" }
    if (available < minimum * 0.5) return { label: "Critical", variant: "destructive" as const, color: "text-red-600" }
    if (available < minimum) return { label: "Low Stock", variant: "default" as const, color: "text-amber-600" }
    return { label: "In Stock", variant: "default" as const, color: "text-green-600" }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const endpoint = itemType === 'cloth'
        ? `/api/inventory/cloth/${item.id}`
        : `/api/inventory/accessories/${item.id}`

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to update item')
      }

      toast({
        title: "Success",
        description: `${itemType === 'cloth' ? 'Cloth' : 'Accessory'} item updated successfully`,
      })

      onClose()
      router.refresh()
    } catch (error) {
      console.error(error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update item. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleViewDetails = () => {
    const detailPath = itemType === 'cloth'
      ? `/inventory/cloth/${item.id}`
      : `/inventory/accessories/${item.id}`
    router.push(detailPath)
    onClose()
  }

  if (itemType === 'cloth') {
    const clothItem = item as ClothItem
    const available = clothItem.currentStock - clothItem.reserved
    const status = getStockStatus(clothItem.currentStock, clothItem.reserved, clothItem.minimumStockMeters)

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                <DialogTitle>Edit Cloth Inventory Item</DialogTitle>
              </div>
              <Button variant="outline" size="sm" onClick={handleViewDetails}>
                <ExternalLink className="h-4 w-4 mr-1" />
                View Full Details
              </Button>
            </div>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{clothItem.sku}</span>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm mt-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-slate-600">Current Stock</p>
                  <p className="font-semibold">{clothItem.currentStock.toFixed(2)}m</p>
                </div>
                <div>
                  <p className="text-slate-600">Reserved</p>
                  <p className="font-semibold text-amber-600">{clothItem.reserved.toFixed(2)}m</p>
                </div>
                <div>
                  <p className="text-slate-600">Available</p>
                  <p className={`font-semibold ${status.color}`}>{available.toFixed(2)}m</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Name and Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Type *</Label>
                <Input
                  id="edit-type"
                  value={(formData as ClothItem).type}
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Brand and Pattern */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-brand">Brand *</Label>
                <Input
                  id="edit-brand"
                  value={(formData as ClothItem).brand}
                  onChange={(e) => handleFieldChange('brand', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pattern">Pattern *</Label>
                <Input
                  id="edit-pattern"
                  value={(formData as ClothItem).pattern}
                  onChange={(e) => handleFieldChange('pattern', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Color and Color Hex */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color *</Label>
                <div className="flex gap-2">
                  <div
                    className="w-10 h-10 rounded border border-slate-300 flex-shrink-0"
                    style={{ backgroundColor: (formData as ClothItem).colorHex }}
                  />
                  <Input
                    id="edit-color"
                    value={(formData as ClothItem).color}
                    onChange={(e) => handleFieldChange('color', e.target.value)}
                    required
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-colorHex">Color Code *</Label>
                <Input
                  id="edit-colorHex"
                  type="color"
                  value={(formData as ClothItem).colorHex}
                  onChange={(e) => handleFieldChange('colorHex', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Quality */}
            <div className="space-y-2">
              <Label htmlFor="edit-quality">Quality *</Label>
              <select
                id="edit-quality"
                value={(formData as ClothItem).quality}
                onChange={(e) => handleFieldChange('quality', e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="Premium">Premium</option>
                <option value="Standard">Standard</option>
                <option value="Economy">Economy</option>
              </select>
            </div>

            {/* Stock and Minimum */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-currentStock">Current Stock (meters) *</Label>
                <Input
                  id="edit-currentStock"
                  type="number"
                  step="0.01"
                  value={formData.currentStock}
                  onChange={(e) => handleFieldChange('currentStock', parseFloat(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-minimum">Minimum Stock (meters) *</Label>
                <Input
                  id="edit-minimum"
                  type="number"
                  step="0.01"
                  value={(formData as ClothItem).minimumStockMeters}
                  onChange={(e) => handleFieldChange('minimumStockMeters', parseFloat(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Price and Location */}
            {!isTailor && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-pricePerMeter">Price per Meter (₹) *</Label>
                  <Input
                    id="edit-pricePerMeter"
                    type="number"
                    step="0.01"
                    value={(formData as ClothItem).pricePerMeter}
                    onChange={(e) => handleFieldChange('pricePerMeter', parseFloat(e.target.value))}
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Current: {formatCurrency((formData as ClothItem).pricePerMeter)}/m
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Storage Location</Label>
                  <Input
                    id="edit-location"
                    value={(formData as ClothItem).location || ''}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    placeholder="e.g., Rack A1"
                  />
                </div>
              </div>
            )}

            {/* Supplier Info (Read-only) */}
            {clothItem.supplierRel && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-slate-600">Supplier</p>
                <p className="font-semibold">{clothItem.supplierRel.name}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // Accessory Edit Form
  const accessoryItem = item as AccessoryItem
  const accStatus = getStockStatus(accessoryItem.currentStock, 0, accessoryItem.minimumStockUnits)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              <DialogTitle>Edit Accessory Item</DialogTitle>
            </div>
            <Button variant="outline" size="sm" onClick={handleViewDetails}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View Full Details
            </Button>
          </div>
          <DialogDescription className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{accessoryItem.sku}</span>
              <Badge variant="outline">{accessoryItem.type}</Badge>
              <Badge variant={accStatus.variant}>{accStatus.label}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mt-3 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-slate-600">Current Stock</p>
                <p className="font-semibold">{accessoryItem.currentStock} units</p>
              </div>
              <div>
                <p className="text-slate-600">Minimum Stock</p>
                <p className="font-semibold">{accessoryItem.minimumStockUnits} units</p>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Type and Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-acc-type">Type *</Label>
              <select
                id="edit-acc-type"
                value={(formData as AccessoryItem).type}
                onChange={(e) => handleFieldChange('type', e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="Button">Button</option>
                <option value="Thread">Thread</option>
                <option value="Zipper">Zipper</option>
                <option value="Lining">Lining</option>
                <option value="Elastic">Elastic</option>
                <option value="Hook">Hook</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-acc-name">Name *</Label>
              <Input
                id="edit-acc-name"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="edit-acc-color">Color</Label>
            <Input
              id="edit-acc-color"
              value={(formData as AccessoryItem).color || ''}
              onChange={(e) => handleFieldChange('color', e.target.value)}
            />
          </div>

          {/* Stock and Minimum */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-acc-currentStock">Current Stock (units) *</Label>
              <Input
                id="edit-acc-currentStock"
                type="number"
                step="1"
                value={formData.currentStock}
                onChange={(e) => handleFieldChange('currentStock', parseInt(e.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-acc-minimum">Minimum Stock (units) *</Label>
              <Input
                id="edit-acc-minimum"
                type="number"
                step="1"
                value={(formData as AccessoryItem).minimumStockUnits}
                onChange={(e) => handleFieldChange('minimumStockUnits', parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Price */}
          {!isTailor && (
            <div className="space-y-2">
              <Label htmlFor="edit-acc-pricePerUnit">Price per Unit (₹) *</Label>
              <Input
                id="edit-acc-pricePerUnit"
                type="number"
                step="0.01"
                value={(formData as AccessoryItem).pricePerUnit}
                onChange={(e) => handleFieldChange('pricePerUnit', parseFloat(e.target.value))}
                required
              />
              <p className="text-xs text-slate-500">
                Current: {formatCurrency((formData as AccessoryItem).pricePerUnit)}/unit
              </p>
            </div>
          )}

          {/* Supplier Info (Read-only) */}
          {accessoryItem.supplierRel && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-slate-600">Supplier</p>
              <p className="font-semibold">{accessoryItem.supplierRel.name}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
