'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AccessoryEditFormProps {
  accessoryId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function AccessoryEditForm({
  accessoryId,
  onSuccess,
  onCancel,
}: AccessoryEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [accessory, setAccessory] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    // Fetch current accessory data
    fetch(`/api/inventory/accessories/${accessoryId}`)
      .then((res) => res.json())
      .then((data) => {
        setAccessory(data)
        setFormData({
          type: data.type || '',
          name: data.name || '',
          color: data.color || '',
          currentStock: data.currentStock || 0,
          pricePerUnit: data.pricePerUnit || 0,
          minimum: data.minimum || 0,
          notes: data.notes || '',
          // Phase 1 fields
          colorCode: data.colorCode || '',
          threadWeight: data.threadWeight || '',
          buttonSize: data.buttonSize || '',
          holePunchSize: data.holePunchSize || '',
          material: data.material || '',
          finish: data.finish || '',
          recommendedFor: data.recommendedFor || [],
          styleCategory: data.styleCategory || '',
          productImage: data.productImage || '',
          closeUpImage: data.closeUpImage || '',
        })
        setFetching(false)
      })
      .catch((error) => {
        console.error('Error fetching accessory:', error)
        toast.error('Failed to load item details')
        setFetching(false)
      })
  }, [accessoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/inventory/accessories/${accessoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          _auditNote: 'Updated via inventory edit form',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Update failed')
      }

      toast.success('Item updated successfully')
      onSuccess?.()
    } catch (error: any) {
      console.error('Error updating accessory:', error)
      toast.error(error.message || 'Failed to update item')
    } finally {
      setLoading(false)
    }
  }

  const handleRecommendedToggle = (garmentType: string) => {
    const current = formData.recommendedFor || []
    if (current.includes(garmentType)) {
      setFormData({
        ...formData,
        recommendedFor: current.filter((g: string) => g !== garmentType),
      })
    } else {
      setFormData({
        ...formData,
        recommendedFor: [...current, garmentType],
      })
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500">Loading item details...</span>
      </div>
    )
  }

  if (!accessory) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Item not found</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
          Basic Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">Type *</Label>
            <Input
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="e.g., Button, Thread, Zipper"
              required
            />
          </div>

          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="e.g., White, Black, Navy"
            />
          </div>

          <div>
            <Label htmlFor="pricePerUnit">Price per Unit (₹) *</Label>
            <Input
              id="pricePerUnit"
              type="number"
              step="0.01"
              value={formData.pricePerUnit}
              onChange={(e) =>
                setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="currentStock">Current Stock (units) *</Label>
            <Input
              id="currentStock"
              type="number"
              value={formData.currentStock}
              onChange={(e) =>
                setFormData({ ...formData, currentStock: parseInt(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="minimum">Minimum Stock (units) *</Label>
            <Input
              id="minimum"
              type="number"
              value={formData.minimum}
              onChange={(e) =>
                setFormData({ ...formData, minimum: parseInt(e.target.value) || 0 })
              }
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes about this item"
            rows={2}
          />
        </div>
      </div>

      {/* Phase 1 Fields - Accessory Specifications */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
          Accessory Specifications (Phase 1)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="colorCode">Color Code (Pantone/DMC)</Label>
            <Input
              id="colorCode"
              value={formData.colorCode}
              onChange={(e) => setFormData({ ...formData, colorCode: e.target.value })}
              placeholder="e.g., PANTONE 19-4028, DMC 310"
            />
          </div>

          <div>
            <Label htmlFor="threadWeight">Thread Weight</Label>
            <Select
              value={formData.threadWeight}
              onValueChange={(value) => setFormData({ ...formData, threadWeight: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select thread weight" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30wt">30wt</SelectItem>
                <SelectItem value="40wt">40wt</SelectItem>
                <SelectItem value="50wt">50wt</SelectItem>
                <SelectItem value="60wt">60wt</SelectItem>
                <SelectItem value="80wt">80wt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="buttonSize">Button Size (Ligne)</Label>
            <Select
              value={formData.buttonSize}
              onValueChange={(value) => setFormData({ ...formData, buttonSize: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select button size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14L">14L (9mm)</SelectItem>
                <SelectItem value="16L">16L (10mm)</SelectItem>
                <SelectItem value="18L">18L (11.5mm)</SelectItem>
                <SelectItem value="20L">20L (12.5mm)</SelectItem>
                <SelectItem value="24L">24L (15mm)</SelectItem>
                <SelectItem value="28L">28L (18mm)</SelectItem>
                <SelectItem value="32L">32L (20mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="holePunchSize">Hole Punch Size</Label>
            <Select
              value={formData.holePunchSize}
              onValueChange={(value) => setFormData({ ...formData, holePunchSize: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select hole punch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2-hole">2-hole</SelectItem>
                <SelectItem value="4-hole">4-hole</SelectItem>
                <SelectItem value="Shank">Shank (no holes)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="material">Material</Label>
            <Select
              value={formData.material}
              onValueChange={(value) => setFormData({ ...formData, material: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Shell">Shell</SelectItem>
                <SelectItem value="Brass">Brass</SelectItem>
                <SelectItem value="Resin">Resin</SelectItem>
                <SelectItem value="Horn">Horn</SelectItem>
                <SelectItem value="Plastic">Plastic</SelectItem>
                <SelectItem value="Wood">Wood</SelectItem>
                <SelectItem value="Metal">Metal</SelectItem>
                <SelectItem value="Polyester">Polyester</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="finish">Finish</Label>
            <Select
              value={formData.finish}
              onValueChange={(value) => setFormData({ ...formData, finish: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select finish" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Matte">Matte</SelectItem>
                <SelectItem value="Polished">Polished</SelectItem>
                <SelectItem value="Antique">Antique</SelectItem>
                <SelectItem value="Brushed">Brushed</SelectItem>
                <SelectItem value="Glossy">Glossy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Recommended For (Garment Types)</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Suit', 'Shirt', 'Trouser', 'Blazer', 'Sherwani', 'Waistcoat'].map(
                (garment) => (
                  <Badge
                    key={garment}
                    variant={
                      formData.recommendedFor?.includes(garment) ? 'default' : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => handleRecommendedToggle(garment)}
                  >
                    {garment}
                  </Badge>
                )
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="styleCategory">Style Category</Label>
            <Select
              value={formData.styleCategory}
              onValueChange={(value) => setFormData({ ...formData, styleCategory: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Formal">Formal</SelectItem>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Designer">Designer</SelectItem>
                <SelectItem value="Traditional">Traditional</SelectItem>
                <SelectItem value="Modern">Modern</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="productImage">Product Image URL</Label>
            <Input
              id="productImage"
              type="url"
              value={formData.productImage}
              onChange={(e) => setFormData({ ...formData, productImage: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="closeUpImage">Close-Up Image URL</Label>
            <Input
              id="closeUpImage"
              type="url"
              value={formData.closeUpImage}
              onChange={(e) => setFormData({ ...formData, closeUpImage: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  )
}
