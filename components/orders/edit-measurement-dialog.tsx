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
  DialogTrigger,
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
import { useToast } from '@/hooks/use-toast'
import { Ruler } from 'lucide-react'

interface Measurement {
  id: string
  garmentType: string
  bodyType: string | null
  neck: number | null
  chest: number | null
  waist: number | null
  hip: number | null
  shoulder: number | null
  sleeveLength: number | null
  shirtLength: number | null
  inseam: number | null
  outseam: number | null
  thigh: number | null
  knee: number | null
  bottomOpening: number | null
  jacketLength: number | null
  lapelWidth: number | null
  notes: string | null
}

interface EditMeasurementDialogProps {
  customerId: string
  measurement: Measurement
  triggerButton?: React.ReactNode
}

export function EditMeasurementDialog({
  customerId,
  measurement,
  triggerButton,
}: EditMeasurementDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    bodyType: measurement.bodyType || 'REGULAR',
    neck: measurement.neck?.toString() || '',
    chest: measurement.chest?.toString() || '',
    waist: measurement.waist?.toString() || '',
    hip: measurement.hip?.toString() || '',
    shoulder: measurement.shoulder?.toString() || '',
    sleeveLength: measurement.sleeveLength?.toString() || '',
    shirtLength: measurement.shirtLength?.toString() || '',
    inseam: measurement.inseam?.toString() || '',
    outseam: measurement.outseam?.toString() || '',
    thigh: measurement.thigh?.toString() || '',
    knee: measurement.knee?.toString() || '',
    bottomOpening: measurement.bottomOpening?.toString() || '',
    jacketLength: measurement.jacketLength?.toString() || '',
    lapelWidth: measurement.lapelWidth?.toString() || '',
    notes: measurement.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: any = {
        bodyType: formData.bodyType,
        notes: formData.notes || null,
      }

      // Only include numeric fields if they have values
      const numericFields = [
        'neck', 'chest', 'waist', 'hip', 'shoulder', 'sleeveLength',
        'shirtLength', 'inseam', 'outseam', 'thigh', 'knee',
        'bottomOpening', 'jacketLength', 'lapelWidth'
      ]

      numericFields.forEach(field => {
        const value = formData[field as keyof typeof formData]
        if (value && value !== '') {
          payload[field] = parseFloat(value as string)
        } else {
          payload[field] = null
        }
      })

      const response = await fetch(
        `/api/customers/${customerId}/measurements/${measurement.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update measurement')
      }

      toast({
        title: 'Success',
        description: 'Measurement updated successfully',
      })

      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating measurement:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update measurement',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Determine which fields to show based on garment type
  const garmentType = measurement.garmentType.toLowerCase()
  const isShirt = garmentType.includes('shirt') || garmentType.includes('kurta')
  const isTrouser = garmentType.includes('trouser') || garmentType.includes('pant')
  const isJacket = garmentType.includes('jacket') || garmentType.includes('blazer') || garmentType.includes('suit')
  const isSherwani = garmentType.includes('sherwani')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="ghost" size="sm">
            <Ruler className="h-4 w-4 mr-2" />
            Edit Measurements
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-white text-slate-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Edit Measurements: {measurement.garmentType}</DialogTitle>
          <DialogDescription className="text-slate-600">
            Update measurements for this garment. Changes create a new version while preserving history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Body Type */}
            <div className="space-y-2">
              <Label htmlFor="bodyType" className="text-slate-900">Body Type</Label>
              <Select
                value={formData.bodyType}
                onValueChange={(value) => handleChange('bodyType', value)}
              >
                <SelectTrigger className="bg-white text-slate-900 border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900">
                  <SelectItem value="SLIM">Slim</SelectItem>
                  <SelectItem value="REGULAR">Regular</SelectItem>
                  <SelectItem value="LARGE">Large</SelectItem>
                  <SelectItem value="XL">XL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Common measurements */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chest" className="text-slate-900">Chest (cm)</Label>
                <Input
                  id="chest"
                  type="number"
                  step="0.1"
                  value={formData.chest}
                  onChange={(e) => handleChange('chest', e.target.value)}
                  className="bg-white text-slate-900 border-slate-300"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="waist" className="text-slate-900">Waist (cm)</Label>
                <Input
                  id="waist"
                  type="number"
                  step="0.1"
                  value={formData.waist}
                  onChange={(e) => handleChange('waist', e.target.value)}
                  className="bg-white text-slate-900 border-slate-300"
                />
              </div>

              {(isShirt || isJacket || isSherwani) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="shoulder" className="text-slate-900">Shoulder (cm)</Label>
                    <Input
                      id="shoulder"
                      type="number"
                      step="0.1"
                      value={formData.shoulder}
                      onChange={(e) => handleChange('shoulder', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sleeveLength" className="text-slate-900">Sleeve Length (cm)</Label>
                    <Input
                      id="sleeveLength"
                      type="number"
                      step="0.1"
                      value={formData.sleeveLength}
                      onChange={(e) => handleChange('sleeveLength', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neck" className="text-slate-900">Neck (cm)</Label>
                    <Input
                      id="neck"
                      type="number"
                      step="0.1"
                      value={formData.neck}
                      onChange={(e) => handleChange('neck', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>
                </>
              )}

              {(isShirt || isSherwani) && (
                <div className="space-y-2">
                  <Label htmlFor="shirtLength" className="text-slate-900">Shirt Length (cm)</Label>
                  <Input
                    id="shirtLength"
                    type="number"
                    step="0.1"
                    value={formData.shirtLength}
                    onChange={(e) => handleChange('shirtLength', e.target.value)}
                    className="bg-white text-slate-900 border-slate-300"
                  />
                </div>
              )}

              {(isTrouser || isSherwani) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="hip" className="text-slate-900">Hip (cm)</Label>
                    <Input
                      id="hip"
                      type="number"
                      step="0.1"
                      value={formData.hip}
                      onChange={(e) => handleChange('hip', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inseam" className="text-slate-900">Inseam (cm)</Label>
                    <Input
                      id="inseam"
                      type="number"
                      step="0.1"
                      value={formData.inseam}
                      onChange={(e) => handleChange('inseam', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="outseam" className="text-slate-900">Outseam (cm)</Label>
                    <Input
                      id="outseam"
                      type="number"
                      step="0.1"
                      value={formData.outseam}
                      onChange={(e) => handleChange('outseam', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thigh" className="text-slate-900">Thigh (cm)</Label>
                    <Input
                      id="thigh"
                      type="number"
                      step="0.1"
                      value={formData.thigh}
                      onChange={(e) => handleChange('thigh', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="knee" className="text-slate-900">Knee (cm)</Label>
                    <Input
                      id="knee"
                      type="number"
                      step="0.1"
                      value={formData.knee}
                      onChange={(e) => handleChange('knee', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bottomOpening" className="text-slate-900">Bottom Opening (cm)</Label>
                    <Input
                      id="bottomOpening"
                      type="number"
                      step="0.1"
                      value={formData.bottomOpening}
                      onChange={(e) => handleChange('bottomOpening', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>
                </>
              )}

              {isJacket && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="jacketLength" className="text-slate-900">Jacket Length (cm)</Label>
                    <Input
                      id="jacketLength"
                      type="number"
                      step="0.1"
                      value={formData.jacketLength}
                      onChange={(e) => handleChange('jacketLength', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lapelWidth" className="text-slate-900">Lapel Width (cm)</Label>
                    <Input
                      id="lapelWidth"
                      type="number"
                      step="0.1"
                      value={formData.lapelWidth}
                      onChange={(e) => handleChange('lapelWidth', e.target.value)}
                      className="bg-white text-slate-900 border-slate-300"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-900">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Any special instructions or notes..."
                className="bg-white text-slate-900 border-slate-300"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
