'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface MeasurementData {
  id?: string
  garmentType: string
  bodyType?: string | null
  neck?: number | null
  chest?: number | null
  waist?: number | null
  hip?: number | null
  shoulder?: number | null
  sleeveLength?: number | null
  shirtLength?: number | null
  inseam?: number | null
  outseam?: number | null
  thigh?: number | null
  knee?: number | null
  bottomOpening?: number | null
  jacketLength?: number | null
  lapelWidth?: number | null
  notes?: string | null
}

interface MeasurementEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  measurement?: MeasurementData | null
  mode: 'create' | 'edit'
}

export function MeasurementEditDialog({
  open,
  onOpenChange,
  customerId,
  measurement,
  mode,
}: MeasurementEditDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<MeasurementData>({
    garmentType: measurement?.garmentType || 'SHIRT',
    bodyType: measurement?.bodyType || 'REGULAR',
    neck: measurement?.neck || null,
    chest: measurement?.chest || null,
    waist: measurement?.waist || null,
    hip: measurement?.hip || null,
    shoulder: measurement?.shoulder || null,
    sleeveLength: measurement?.sleeveLength || null,
    shirtLength: measurement?.shirtLength || null,
    inseam: measurement?.inseam || null,
    outseam: measurement?.outseam || null,
    thigh: measurement?.thigh || null,
    knee: measurement?.knee || null,
    bottomOpening: measurement?.bottomOpening || null,
    jacketLength: measurement?.jacketLength || null,
    lapelWidth: measurement?.lapelWidth || null,
    notes: measurement?.notes || null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url =
        mode === 'create'
          ? `/api/customers/${customerId}/measurements`
          : `/api/customers/${customerId}/measurements/${measurement?.id}`

      const method = mode === 'create' ? 'POST' : 'PATCH'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save measurement')
      }

      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleNumberChange = (field: keyof MeasurementData, value: string) => {
    const numValue = value === '' ? null : parseFloat(value)
    setFormData((prev) => ({ ...prev, [field]: numValue }))
  }

  const garmentTypes = [
    { value: 'SHIRT', label: 'Shirt' },
    { value: 'TROUSER', label: 'Trouser' },
    { value: 'SUIT', label: 'Suit' },
    { value: 'SHERWANI', label: 'Sherwani' },
  ]

  const bodyTypes = [
    { value: 'SLIM', label: 'Slim' },
    { value: 'REGULAR', label: 'Regular' },
    { value: 'LARGE', label: 'Large' },
    { value: 'XL', label: 'XL' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add New Measurement' : 'Edit Measurement'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Enter customer measurements. All fields are optional except garment type.'
              : 'Update measurements. Previous values are auto-populated. This will create a new version and preserve the history.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Garment Type and Body Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="garmentType" className="text-slate-700 font-medium">
                  Garment Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.garmentType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, garmentType: value }))
                  }
                  disabled={mode === 'edit'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {garmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mode === 'edit' && (
                  <p className="text-xs text-slate-500">
                    Garment type cannot be changed when editing
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bodyType" className="text-slate-700 font-medium">Body Type</Label>
                <Select
                  value={formData.bodyType || ''}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, bodyType: value || null }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select body type" />
                  </SelectTrigger>
                  <SelectContent>
                    {bodyTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Common Measurements */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-slate-700">Common Measurements (cm)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="neck" className="text-xs text-slate-700">
                    Neck
                  </Label>
                  <Input
                    id="neck"
                    type="number"
                    step="0.1"
                    value={formData.neck ?? ''}
                    onChange={(e) => handleNumberChange('neck', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="chest" className="text-xs text-slate-700">
                    Chest
                  </Label>
                  <Input
                    id="chest"
                    type="number"
                    step="0.1"
                    value={formData.chest ?? ''}
                    onChange={(e) => handleNumberChange('chest', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="waist" className="text-xs text-slate-700">
                    Waist
                  </Label>
                  <Input
                    id="waist"
                    type="number"
                    step="0.1"
                    value={formData.waist ?? ''}
                    onChange={(e) => handleNumberChange('waist', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="hip" className="text-xs text-slate-700">
                    Hip
                  </Label>
                  <Input
                    id="hip"
                    type="number"
                    step="0.1"
                    value={formData.hip ?? ''}
                    onChange={(e) => handleNumberChange('hip', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="shoulder" className="text-xs text-slate-700">
                    Shoulder
                  </Label>
                  <Input
                    id="shoulder"
                    type="number"
                    step="0.1"
                    value={formData.shoulder ?? ''}
                    onChange={(e) => handleNumberChange('shoulder', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sleeveLength" className="text-xs text-slate-700">
                    Sleeve Length
                  </Label>
                  <Input
                    id="sleeveLength"
                    type="number"
                    step="0.1"
                    value={formData.sleeveLength ?? ''}
                    onChange={(e) => handleNumberChange('sleeveLength', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="shirtLength" className="text-xs text-slate-700">
                    Shirt Length
                  </Label>
                  <Input
                    id="shirtLength"
                    type="number"
                    step="0.1"
                    value={formData.shirtLength ?? ''}
                    onChange={(e) => handleNumberChange('shirtLength', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="inseam" className="text-xs text-slate-700">
                    Inseam
                  </Label>
                  <Input
                    id="inseam"
                    type="number"
                    step="0.1"
                    value={formData.inseam ?? ''}
                    onChange={(e) => handleNumberChange('inseam', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="outseam" className="text-xs text-slate-700">
                    Outseam
                  </Label>
                  <Input
                    id="outseam"
                    type="number"
                    step="0.1"
                    value={formData.outseam ?? ''}
                    onChange={(e) => handleNumberChange('outseam', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="thigh" className="text-xs text-slate-700">
                    Thigh
                  </Label>
                  <Input
                    id="thigh"
                    type="number"
                    step="0.1"
                    value={formData.thigh ?? ''}
                    onChange={(e) => handleNumberChange('thigh', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="knee" className="text-xs text-slate-700">
                    Knee
                  </Label>
                  <Input
                    id="knee"
                    type="number"
                    step="0.1"
                    value={formData.knee ?? ''}
                    onChange={(e) => handleNumberChange('knee', e.target.value)}
                    placeholder="cm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bottomOpening" className="text-xs text-slate-700">
                    Bottom Opening
                  </Label>
                  <Input
                    id="bottomOpening"
                    type="number"
                    step="0.1"
                    value={formData.bottomOpening ?? ''}
                    onChange={(e) => handleNumberChange('bottomOpening', e.target.value)}
                    placeholder="cm"
                  />
                </div>
              </div>
            </div>

            {/* Suit/Sherwani Specific */}
            {(formData.garmentType === 'SUIT' || formData.garmentType === 'SHERWANI') && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-700">Jacket Measurements (cm)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="jacketLength" className="text-xs text-slate-700">
                      Jacket Length
                    </Label>
                    <Input
                      id="jacketLength"
                      type="number"
                      step="0.1"
                      value={formData.jacketLength ?? ''}
                      onChange={(e) => handleNumberChange('jacketLength', e.target.value)}
                      placeholder="cm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="lapelWidth" className="text-xs text-slate-700">
                      Lapel Width
                    </Label>
                    <Input
                      id="lapelWidth"
                      type="number"
                      step="0.1"
                      value={formData.lapelWidth ?? ''}
                      onChange={(e) => handleNumberChange('lapelWidth', e.target.value)}
                      placeholder="cm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-700 font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value || null }))
                }
                placeholder="Any special notes or preferences..."
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Add Measurement' : 'Update Measurement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
