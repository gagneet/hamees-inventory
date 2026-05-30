'use client'

/**
 * @featuretrace Order Item Measurement Add/Link
 * @component AddOrderItemMeasurementDialog
 * @description Creates a new measurement or links an existing active measurement to a specific order item.
 * @calls GET /api/customers/:id/measurements
 * @calls POST /api/orders/:orderId/items/:itemId/measurement
 *
 * FEATURETRACE:
 *   feature: order_item_measurement_linking
 *   owner_area: order detail UX
 *   entry_points:
 *     - /orders/:id (missing-measurement state action)
 *   upstream_callers:
 *     - app/(dashboard)/orders/[id]/page.tsx
 *   downstream_dependencies:
 *     - app/api/customers/[id]/measurements/route.ts
 *     - app/api/orders/[id]/items/[itemId]/measurement/route.ts
 *     - sonner toast + next/navigation router.refresh
 *   related_tests:
 *     - tests/unit/api/customers.test.ts
 *   change_risk:
 *     - medium: affects tailoring readiness workflow when measurements are missing
 *   maintainer_notes:
 *     - Supports both link-existing and create-new to avoid duplicate re-entry for repeat customers.
 */

import { useEffect, useMemo, useState } from 'react'
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
import { toast } from 'sonner'
import { Loader2, Ruler } from 'lucide-react'

type FieldDef = {
  key: string
  label: string
  garments: 'all' | string[]
}

const FIELD_SECTIONS: { section: string; fields: FieldDef[] }[] = [
  {
    section: 'Upper Body',
    fields: [
      { key: 'neck', label: 'Neck', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'chest', label: 'Chest', garments: 'all' },
      { key: 'crossChest', label: 'Cross Chest', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'shoulder', label: 'Shoulder', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'waist', label: 'Waist', garments: 'all' },
      { key: 'hip', label: 'Hip', garments: 'all' },
    ],
  },
  {
    section: 'Arms',
    fields: [
      { key: 'sleeveLength', label: 'Sleeve Length', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'bicep', label: 'Bicep', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'elbow', label: 'Elbow', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'armCircumference', label: 'Arm Circumference', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'cuff', label: 'Cuff', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
    ],
  },
  {
    section: 'Lengths',
    fields: [
      { key: 'shirtLength', label: 'Shirt / Kurta Length', garments: ['shirt', 'kurta', 'sherwani'] },
      { key: 'backLength', label: 'Back Length', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'jacketLength', label: 'Jacket Length', garments: ['jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'lapelWidth', label: 'Lapel Width', garments: ['jacket', 'blazer', 'suit'] },
    ],
  },
  {
    section: 'Lower Body',
    fields: [
      { key: 'inseam', label: 'Inseam', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
      { key: 'outseam', label: 'Outseam', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
      { key: 'rise', label: 'Rise', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
      { key: 'seat', label: 'Seat', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
      { key: 'thigh', label: 'Thigh', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
      { key: 'knee', label: 'Knee', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
      { key: 'bottomOpening', label: 'Bottom Opening', garments: ['trouser', 'pant', 'pajama', 'pyjama', 'sherwani'] },
    ],
  },
]

const ALL_NUMERIC_FIELDS = FIELD_SECTIONS.flatMap((section) => section.fields.map((field) => field.key))

type ExistingMeasurement = {
  id: string
  garmentType: string
  createdAt: string
}

interface AddOrderItemMeasurementDialogProps {
  orderId: string
  orderItemId: string
  customerId: string
  garmentType: string
  triggerButton?: React.ReactNode
}

export function AddOrderItemMeasurementDialog({
  orderId,
  orderItemId,
  customerId,
  garmentType,
  triggerButton,
}: AddOrderItemMeasurementDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [measurements, setMeasurements] = useState<ExistingMeasurement[]>([])
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, string>>({
    bodyType: 'REGULAR',
    notes: '',
  })

  const normalizedGarmentType = garmentType.toLowerCase()

  const matchingMeasurements = useMemo(() => {
    return measurements.filter((measurement) => {
      const measurementType = measurement.garmentType.toLowerCase()
      return (
        measurementType.includes(normalizedGarmentType) ||
        normalizedGarmentType.includes(measurementType) ||
        (measurementType.includes('shirt') && normalizedGarmentType.includes('kurta')) ||
        (measurementType.includes('kurta') && normalizedGarmentType.includes('shirt')) ||
        (measurementType.includes('trouser') && (normalizedGarmentType.includes('pant') || normalizedGarmentType.includes('pajama') || normalizedGarmentType.includes('pyjama'))) ||
        ((measurementType.includes('pant') || measurementType.includes('pajama') || measurementType.includes('pyjama')) && normalizedGarmentType.includes('trouser'))
      )
    })
  }, [measurements, normalizedGarmentType])

  const currentMeasurementOptions = matchingMeasurements.length > 0 ? matchingMeasurements : measurements

  useEffect(() => {
    if (!open) return

    let mounted = true
    const loadMeasurements = async () => {
      setIsLoadingMeasurements(true)
      try {
        const response = await fetch(`/api/customers/${customerId}/measurements`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load measurements')

        if (!mounted) return
        const activeMeasurements = (data.measurements || []).filter(
          (measurement: { isActive: boolean }) => measurement.isActive
        )
        setMeasurements(activeMeasurements)
        const firstMeasurement = activeMeasurements[0]
        if (firstMeasurement) {
          setSelectedMeasurementId(firstMeasurement.id)
        } else {
          setMode('new')
          setSelectedMeasurementId('')
        }
      } catch (error) {
        if (mounted) {
          toast.error(error instanceof Error ? error.message : 'Failed to load measurements')
        }
      } finally {
        if (mounted) setIsLoadingMeasurements(false)
      }
    }

    loadMeasurements()
    return () => {
      mounted = false
    }
  }, [open, customerId])

  useEffect(() => {
    if (currentMeasurementOptions.length > 0 && !selectedMeasurementId) {
      setSelectedMeasurementId(currentMeasurementOptions[0].id)
    }
  }, [currentMeasurementOptions, selectedMeasurementId])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleLinkExisting = async () => {
    if (!selectedMeasurementId) {
      toast.error('Select a measurement to continue')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/items/${orderItemId}/measurement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurementId: selectedMeasurementId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to link measurement')
      }

      toast.success('Measurement linked to this order item.')
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to link measurement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: Record<string, string | number | null> = {
        garmentType,
        bodyType: formData.bodyType || 'REGULAR',
        notes: formData.notes || null,
      }

      ALL_NUMERIC_FIELDS.forEach((field) => {
        const raw = formData[field]
        payload[field] = raw && raw !== '' ? parseFloat(raw) : null
      })

      const response = await fetch(`/api/orders/${orderId}/items/${orderItemId}/measurement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create measurement')
      }

      toast.success('Measurement added and linked to this order item.')
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create measurement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isVisible = (field: FieldDef) => {
    if (field.garments === 'all') return true
    return field.garments.some((g) => normalizedGarmentType.includes(g))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="ghost" size="sm">
            <Ruler className="h-4 w-4 mr-2" />
            Add Measurements
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-white text-slate-900 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Manage Measurements: {garmentType}</DialogTitle>
          <DialogDescription className="text-slate-600">
            Link an existing measurement or create a new one for this order item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === 'existing' ? 'default' : 'outline'}
            onClick={() => setMode('existing')}
            disabled={isLoadingMeasurements || measurements.length === 0}
          >
            Use Existing
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'new' ? 'default' : 'outline'}
            onClick={() => setMode('new')}
          >
            Create New
          </Button>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-4 py-2">
            {isLoadingMeasurements ? (
              <div className="text-sm text-slate-500">Loading measurements…</div>
            ) : currentMeasurementOptions.length === 0 ? (
              <div className="text-sm text-slate-500">
                No active customer measurements found. Create a new measurement.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-slate-900">Select Measurement</Label>
                  <Select value={selectedMeasurementId} onValueChange={setSelectedMeasurementId}>
                    <SelectTrigger className="bg-white text-slate-900 border-slate-300">
                      <SelectValue placeholder="Choose a measurement" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-slate-900">
                      {currentMeasurementOptions.map((measurement) => (
                        <SelectItem key={measurement.id} value={measurement.id}>
                          {measurement.garmentType} · {new Date(measurement.createdAt).toLocaleDateString('en-IN')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleLinkExisting} disabled={isSubmitting || !selectedMeasurementId}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Link Measurement
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateNew}>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-slate-900">Body Type</Label>
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

              {FIELD_SECTIONS.map((section) => {
                const visibleFields = section.fields.filter(isVisible)
                if (visibleFields.length === 0) return null
                return (
                  <div key={section.section}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {section.section}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {visibleFields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <Label htmlFor={field.key} className="text-sm text-slate-700">
                            {field.label} <span className="text-slate-400 text-xs">(cm)</span>
                          </Label>
                          <Input
                            id={field.key}
                            type="number"
                            step="0.1"
                            min="0"
                            value={formData[field.key] ?? ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            className="bg-white text-slate-900 border-slate-300 h-9"
                            placeholder="—"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              <div className="space-y-2">
                <Label className="text-slate-900">
                  Notes <span className="text-slate-400 text-xs">(optional)</span>
                </Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Special instructions, fitting notes…"
                  className="bg-white text-slate-900 border-slate-300"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save & Link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
