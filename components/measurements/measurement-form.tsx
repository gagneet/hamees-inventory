'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Ruler } from 'lucide-react'

interface MeasurementFormProps {
  customerId: string
  garmentType: string
  initialData?: any
  onSuccess?: () => void
}

const GARMENT_FIELDS: Record<string, Array<{ name: string; label: string; required: boolean }>> = {
  "Men's Shirt": [
    { name: 'neck', label: 'Neck (cm)', required: true },
    { name: 'chest', label: 'Chest (cm)', required: true },
    { name: 'waist', label: 'Waist (cm)', required: true },
    { name: 'hip', label: 'Hip (cm)', required: false },
    { name: 'shoulder', label: 'Shoulder (cm)', required: true },
    { name: 'sleeveLength', label: 'Sleeve Length (cm)', required: true },
    { name: 'shirtLength', label: 'Shirt Length (cm)', required: true },
  ],
  "Men's Trouser": [
    { name: 'waist', label: 'Waist (cm)', required: true },
    { name: 'hip', label: 'Hip (cm)', required: true },
    { name: 'inseam', label: 'Inseam (cm)', required: true },
    { name: 'outseam', label: 'Outseam (cm)', required: true },
    { name: 'thigh', label: 'Thigh (cm)', required: false },
    { name: 'knee', label: 'Knee (cm)', required: false },
    { name: 'bottomOpening', label: 'Bottom Opening (cm)', required: false },
  ],
  "Men's Suit": [
    { name: 'neck', label: 'Neck (cm)', required: true },
    { name: 'chest', label: 'Chest (cm)', required: true },
    { name: 'waist', label: 'Waist (cm)', required: true },
    { name: 'hip', label: 'Hip (cm)', required: true },
    { name: 'shoulder', label: 'Shoulder (cm)', required: true },
    { name: 'sleeveLength', label: 'Sleeve Length (cm)', required: true },
    { name: 'jacketLength', label: 'Jacket Length (cm)', required: true },
    { name: 'inseam', label: 'Trouser Inseam (cm)', required: true },
    { name: 'outseam', label: 'Trouser Outseam (cm)', required: true },
  ],
  "Men's Sherwani": [
    { name: 'neck', label: 'Neck (cm)', required: true },
    { name: 'chest', label: 'Chest (cm)', required: true },
    { name: 'waist', label: 'Waist (cm)', required: true },
    { name: 'hip', label: 'Hip (cm)', required: true },
    { name: 'shoulder', label: 'Shoulder (cm)', required: true },
    { name: 'sleeveLength', label: 'Sleeve Length (cm)', required: true },
    { name: 'shirtLength', label: 'Sherwani Length (cm)', required: true },
  ],
}

export function MeasurementForm({ customerId, garmentType, initialData, onSuccess }: MeasurementFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>(initialData || {})

  const fields = GARMENT_FIELDS[garmentType] || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const endpoint = initialData?.id
        ? `/api/measurements/${initialData.id}`
        : `/api/customers/${customerId}/measurements`

      const method = initialData?.id ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentType,
          ...formData,
        }),
      })

      if (!response.ok) throw new Error('Failed to save measurement')

      if (onSuccess) {
        onSuccess()
      } else {
        // Default behavior: navigate back to customer page
        router.push(`/customers/${customerId}`)
        router.refresh()
      }
    } catch (error) {
      console.error('Error saving measurement:', error)
      alert('Failed to save measurement')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value ? parseFloat(value) : null,
    }))
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            <CardTitle>{garmentType} Measurements</CardTitle>
          </div>
          <CardDescription>
            All measurements in centimeters (cm)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map(field => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>
                  {field.label} {field.required && <span className="text-error">*</span>}
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  step="0.1"
                  value={formData[field.name] || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="w-full min-h-[80px] px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions or preferences..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Measurements'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
