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

interface ClothEditFormProps {
  clothId: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function ClothEditForm({ clothId, onSuccess, onCancel }: ClothEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [cloth, setCloth] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    // Fetch current cloth data
    fetch(`/api/inventory/cloth/${clothId}`)
      .then((res) => res.json())
      .then((data) => {
        setCloth(data)
        setFormData({
          name: data.name || '',
          brand: data.brand || '',
          color: data.color || '',
          colorHex: data.colorHex || '#000000',
          pattern: data.pattern || '',
          quality: data.quality || '',
          type: data.type || '',
          pricePerMeter: data.pricePerMeter || 0,
          currentStock: data.currentStock || 0,
          minimum: data.minimum || 0,
          location: data.location || '',
          notes: data.notes || '',
          // Phase 1 fields
          fabricComposition: data.fabricComposition || '',
          gsm: data.gsm || '',
          threadCount: data.threadCount || '',
          weaveType: data.weaveType || '',
          fabricWidth: data.fabricWidth || '',
          shrinkagePercent: data.shrinkagePercent || '',
          colorFastness: data.colorFastness || '',
          seasonSuitability: data.seasonSuitability || [],
          occasionType: data.occasionType || [],
          careInstructions: data.careInstructions || '',
          swatchImage: data.swatchImage || '',
          textureImage: data.textureImage || '',
        })
        setFetching(false)
      })
      .catch((error) => {
        console.error('Error fetching cloth:', error)
        toast.error('Failed to load item details')
        setFetching(false)
      })
  }, [clothId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/inventory/cloth/${clothId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          gsm: formData.gsm ? parseInt(formData.gsm) : null,
          threadCount: formData.threadCount ? parseInt(formData.threadCount) : null,
          shrinkagePercent: formData.shrinkagePercent ? parseFloat(formData.shrinkagePercent) : null,
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
      console.error('Error updating cloth:', error)
      toast.error(error.message || 'Failed to update item')
    } finally {
      setLoading(false)
    }
  }

  const handleSeasonToggle = (season: string) => {
    const current = formData.seasonSuitability || []
    if (current.includes(season)) {
      setFormData({
        ...formData,
        seasonSuitability: current.filter((s: string) => s !== season),
      })
    } else {
      setFormData({
        ...formData,
        seasonSuitability: [...current, season],
      })
    }
  }

  const handleOccasionToggle = (occasion: string) => {
    const current = formData.occasionType || []
    if (current.includes(occasion)) {
      setFormData({
        ...formData,
        occasionType: current.filter((o: string) => o !== occasion),
      })
    } else {
      setFormData({
        ...formData,
        occasionType: [...current, occasion],
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

  if (!cloth) {
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
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="brand">Brand *</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="color">Color *</Label>
            <Input
              id="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="colorHex">Color Code</Label>
            <div className="flex gap-2">
              <Input
                id="colorHex"
                type="color"
                value={formData.colorHex}
                onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                className="w-20"
              />
              <Input
                value={formData.colorHex}
                onChange={(e) => setFormData({ ...formData, colorHex: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="type">Type *</Label>
            <Input
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="e.g., Cotton, Silk, Linen"
              required
            />
          </div>

          <div>
            <Label htmlFor="pattern">Pattern</Label>
            <Input
              id="pattern"
              value={formData.pattern}
              onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
              placeholder="e.g., Solid, Striped, Checked"
            />
          </div>

          <div>
            <Label htmlFor="quality">Quality</Label>
            <Input
              id="quality"
              value={formData.quality}
              onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
              placeholder="e.g., Premium, Standard"
            />
          </div>

          <div>
            <Label htmlFor="pricePerMeter">Price per Meter (₹) *</Label>
            <Input
              id="pricePerMeter"
              type="number"
              step="0.01"
              value={formData.pricePerMeter}
              onChange={(e) =>
                setFormData({ ...formData, pricePerMeter: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="currentStock">Current Stock (meters) *</Label>
            <Input
              id="currentStock"
              type="number"
              step="0.01"
              value={formData.currentStock}
              onChange={(e) =>
                setFormData({ ...formData, currentStock: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="minimum">Minimum Stock (meters) *</Label>
            <Input
              id="minimum"
              type="number"
              step="0.01"
              value={formData.minimum}
              onChange={(e) =>
                setFormData({ ...formData, minimum: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div>
            <Label htmlFor="location">Storage Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Rack A1, Shelf B3"
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

      {/* Phase 1 Fields - Fabric Specifications */}
      <div className="space-y-4 border-t pt-6">
        <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
          Fabric Specifications (Phase 1)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="fabricComposition">Fabric Composition</Label>
            <Input
              id="fabricComposition"
              value={formData.fabricComposition}
              onChange={(e) =>
                setFormData({ ...formData, fabricComposition: e.target.value })
              }
              placeholder="e.g., 100% Cotton, 70% Cotton 30% Polyester"
            />
          </div>

          <div>
            <Label htmlFor="gsm">GSM (Grams per Square Meter)</Label>
            <Input
              id="gsm"
              type="number"
              value={formData.gsm}
              onChange={(e) => setFormData({ ...formData, gsm: e.target.value })}
              placeholder="e.g., 180"
            />
          </div>

          <div>
            <Label htmlFor="threadCount">Thread Count (TPI)</Label>
            <Input
              id="threadCount"
              type="number"
              value={formData.threadCount}
              onChange={(e) => setFormData({ ...formData, threadCount: e.target.value })}
              placeholder="e.g., 100"
            />
          </div>

          <div>
            <Label htmlFor="weaveType">Weave Type</Label>
            <Select
              value={formData.weaveType}
              onValueChange={(value) => setFormData({ ...formData, weaveType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select weave type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Plain">Plain</SelectItem>
                <SelectItem value="Twill">Twill</SelectItem>
                <SelectItem value="Satin">Satin</SelectItem>
                <SelectItem value="Jacquard">Jacquard</SelectItem>
                <SelectItem value="Dobby">Dobby</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fabricWidth">Fabric Width</Label>
            <Input
              id="fabricWidth"
              value={formData.fabricWidth}
              onChange={(e) => setFormData({ ...formData, fabricWidth: e.target.value })}
              placeholder='e.g., 44", 58", 60"'
            />
          </div>

          <div>
            <Label htmlFor="shrinkagePercent">Shrinkage %</Label>
            <Input
              id="shrinkagePercent"
              type="number"
              step="0.1"
              value={formData.shrinkagePercent}
              onChange={(e) =>
                setFormData({ ...formData, shrinkagePercent: e.target.value })
              }
              placeholder="e.g., 2.5"
            />
          </div>

          <div>
            <Label htmlFor="colorFastness">Color Fastness</Label>
            <Select
              value={formData.colorFastness}
              onValueChange={(value) => setFormData({ ...formData, colorFastness: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Excellent">Excellent</SelectItem>
                <SelectItem value="Good">Good</SelectItem>
                <SelectItem value="Fair">Fair</SelectItem>
                <SelectItem value="Poor">Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Season Suitability</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Summer', 'Winter', 'Monsoon', 'All-season'].map((season) => (
                <Badge
                  key={season}
                  variant={
                    formData.seasonSuitability?.includes(season) ? 'default' : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => handleSeasonToggle(season)}
                >
                  {season}
                </Badge>
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Occasion Type</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Casual', 'Formal', 'Wedding', 'Business', 'Festival', 'Party'].map(
                (occasion) => (
                  <Badge
                    key={occasion}
                    variant={
                      formData.occasionType?.includes(occasion) ? 'default' : 'outline'
                    }
                    className="cursor-pointer"
                    onClick={() => handleOccasionToggle(occasion)}
                  >
                    {occasion}
                  </Badge>
                )
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="careInstructions">Care Instructions</Label>
            <Textarea
              id="careInstructions"
              value={formData.careInstructions}
              onChange={(e) =>
                setFormData({ ...formData, careInstructions: e.target.value })
              }
              placeholder="Machine wash warm. Iron while damp. Dry clean recommended."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="swatchImage">Swatch Image URL</Label>
            <Input
              id="swatchImage"
              type="url"
              value={formData.swatchImage}
              onChange={(e) => setFormData({ ...formData, swatchImage: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div>
            <Label htmlFor="textureImage">Texture Image URL</Label>
            <Input
              id="textureImage"
              type="url"
              value={formData.textureImage}
              onChange={(e) => setFormData({ ...formData, textureImage: e.target.value })}
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
