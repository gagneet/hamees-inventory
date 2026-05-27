'use client'

/**
 * @featuretrace Edit Measurement Dialog
 * @component EditMeasurementDialog
 * @description Modal dialog for updating a Measurement record linked to an order item.
 *   Fields are displayed in garment-type-aware groups so tailors see only relevant fields.
 *   Submits PATCH /api/customers/:id/measurements/:measurementId — creates a new versioned record.
 *
 * @props customerId       — for the API URL
 * @props measurement      — current Measurement values (pre-fills the form)
 * @props triggerButton    — optional custom trigger (defaults to "Edit Measurements" ghost button)
 *
 * @calls PATCH /api/customers/:customerId/measurements/:id
 * @calls router.refresh() — re-renders server data after save
 */

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

// ── Field definitions ─────────────────────────────────────────────

/**
 * garmentGroups: which garment types show each field group.
 * 'all' = always shown.
 * Array of substrings matched against garmentType.toLowerCase().
 */
type FieldDef = {
  key: string
  label: string
  garments: 'all' | string[]
}

const FIELD_SECTIONS: { section: string; fields: FieldDef[] }[] = [
  {
    section: 'Upper Body',
    fields: [
      { key: 'neck',             label: 'Neck',              garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'chest',            label: 'Chest',             garments: 'all' },
      { key: 'crossChest',       label: 'Cross Chest',       garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'shoulder',         label: 'Shoulder',          garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'waist',            label: 'Waist',             garments: 'all' },
      { key: 'hip',              label: 'Hip',               garments: 'all' },
    ],
  },
  {
    section: 'Arms',
    fields: [
      { key: 'sleeveLength',     label: 'Sleeve Length',     garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'bicep',            label: 'Bicep',             garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'elbow',            label: 'Elbow',             garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'armCircumference', label: 'Arm Circumference', garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'cuff',             label: 'Cuff',              garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
    ],
  },
  {
    section: 'Lengths',
    fields: [
      { key: 'shirtLength',      label: 'Shirt / Kurta Length', garments: ['shirt', 'kurta', 'sherwani'] },
      { key: 'backLength',       label: 'Back Length',           garments: ['shirt', 'kurta', 'jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'jacketLength',     label: 'Jacket Length',         garments: ['jacket', 'blazer', 'suit', 'sherwani'] },
      { key: 'lapelWidth',       label: 'Lapel Width',           garments: ['jacket', 'blazer', 'suit'] },
    ],
  },
  {
    section: 'Lower Body',
    fields: [
      { key: 'inseam',           label: 'Inseam',            garments: ['trouser', 'pant', 'sherwani'] },
      { key: 'outseam',          label: 'Outseam',           garments: ['trouser', 'pant', 'sherwani'] },
      { key: 'rise',             label: 'Rise',              garments: ['trouser', 'pant', 'sherwani'] },
      { key: 'seat',             label: 'Seat',              garments: ['trouser', 'pant', 'sherwani'] },
      { key: 'thigh',            label: 'Thigh',             garments: ['trouser', 'pant', 'sherwani'] },
      { key: 'knee',             label: 'Knee',              garments: ['trouser', 'pant', 'sherwani'] },
      { key: 'bottomOpening',    label: 'Bottom Opening',    garments: ['trouser', 'pant', 'sherwani'] },
    ],
  },
]

// All numeric field keys in a flat list (for PATCH payload construction)
const ALL_NUMERIC_FIELDS = FIELD_SECTIONS.flatMap(s => s.fields.map(f => f.key))

// ── Types ─────────────────────────────────────────────────────────

interface Measurement {
  id: string
  garmentType: string
  bodyType: string | null
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
  // Extended fields
  bicep?: number | null
  cuff?: number | null
  armCircumference?: number | null
  crossChest?: number | null
  backLength?: number | null
  seat?: number | null
  rise?: number | null
  elbow?: number | null
  notes?: string | null
}

interface EditMeasurementDialogProps {
  customerId: string
  measurement: Measurement
  triggerButton?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────

export function EditMeasurementDialog({
  customerId,
  measurement,
  triggerButton,
}: EditMeasurementDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Build initial form state from measurement (convert numbers to strings for inputs)
  const initialFormData = (): Record<string, string> => {
    const base: Record<string, string> = {
      bodyType: measurement.bodyType || 'REGULAR',
      notes: measurement.notes || '',
    }
    ALL_NUMERIC_FIELDS.forEach(key => {
      const v = (measurement as any)[key]
      base[key] = v != null ? String(v) : ''
    })
    return base
  }

  const [formData, setFormData] = useState<Record<string, string>>(initialFormData)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: Record<string, string | number | null> = {
        bodyType: formData.bodyType,
        notes: formData.notes || null,
      }

      ALL_NUMERIC_FIELDS.forEach(field => {
        const raw = formData[field]
        payload[field] = raw && raw !== '' ? parseFloat(raw) : null
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
        const err = await response.json()
        throw new Error(err.error || 'Failed to update measurement')
      }

      toast({ title: 'Measurements saved', description: 'Changes saved and history preserved.' })
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update measurement',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine which fields are relevant for this garment type
  const gt = measurement.garmentType.toLowerCase()
  function isVisible(field: FieldDef): boolean {
    if (field.garments === 'all') return true
    return (field.garments as string[]).some(g => gt.includes(g))
  }

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
          <DialogTitle className="text-slate-900">
            Edit Measurements: {measurement.garmentType}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Update measurements. A new versioned record will be created, preserving history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 py-4">
            {/* Body Type */}
            <div className="space-y-2">
              <Label className="text-slate-900">Body Type</Label>
              <Select
                value={formData.bodyType}
                onValueChange={v => handleChange('bodyType', v)}
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

            {/* Field sections — only render sections that have at least one visible field */}
            {FIELD_SECTIONS.map(section => {
              const visibleFields = section.fields.filter(isVisible)
              if (visibleFields.length === 0) return null
              return (
                <div key={section.section}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {section.section}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {visibleFields.map(field => (
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
                          onChange={e => handleChange(field.key, e.target.value)}
                          className="bg-white text-slate-900 border-slate-300 h-9"
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-slate-900">Notes <span className="text-slate-400 text-xs">(optional)</span></Label>
              <Textarea
                value={formData.notes}
                onChange={e => handleChange('notes', e.target.value)}
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
              {isSubmitting ? 'Saving…' : 'Save Measurements'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
