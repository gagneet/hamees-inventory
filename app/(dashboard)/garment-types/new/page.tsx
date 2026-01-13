'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Plus, Trash2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
import DashboardLayout from '@/components/DashboardLayout'

interface Accessory {
  id: string
  name: string
  type: string
}

interface AccessorySelection {
  accessoryId: string
  quantity: number
}

export default function NewGarmentTypePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accessories, setAccessories] = useState<Accessory[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    baseMeters: '',
    slimAdjustment: '0',
    regularAdjustment: '0',
    largeAdjustment: '0.3',
    xlAdjustment: '0.5',
  })

  const [selectedAccessories, setSelectedAccessories] = useState<AccessorySelection[]>(
    []
  )

  useEffect(() => {
    fetchAccessories()
  }, [])

  const fetchAccessories = async () => {
    try {
      const response = await fetch('/api/inventory/accessories')
      const data = await response.json()
      setAccessories(data.accessories || [])
    } catch (error) {
      console.error('Error fetching accessories:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/garment-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          baseMeters: parseFloat(formData.baseMeters),
          slimAdjustment: parseFloat(formData.slimAdjustment),
          regularAdjustment: parseFloat(formData.regularAdjustment),
          largeAdjustment: parseFloat(formData.largeAdjustment),
          xlAdjustment: parseFloat(formData.xlAdjustment),
          accessories: selectedAccessories.filter((a) => a.accessoryId && a.quantity > 0),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create garment type')
      }

      alert('Garment type created successfully!')
      router.push('/garment-types')
    } catch (error) {
      console.error('Error creating garment type:', error)
      alert(error instanceof Error ? error.message : 'Failed to create garment type')
    } finally {
      setLoading(false)
    }
  }

  const addAccessory = () => {
    setSelectedAccessories([
      ...selectedAccessories,
      { accessoryId: '', quantity: 1 },
    ])
  }

  const removeAccessory = (index: number) => {
    setSelectedAccessories(selectedAccessories.filter((_, i) => i !== index))
  }

  const updateAccessory = (
    index: number,
    field: 'accessoryId' | 'quantity',
    value: string | number
  ) => {
    const updated = [...selectedAccessories]
    updated[index] = { ...updated[index], [field]: value }
    setSelectedAccessories(updated)
  }

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/garment-types">Garment Types</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Garment Type</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-lg font-semibold md:text-2xl">New Garment Type</h1>
          <p className="text-sm text-slate-600">
            Create a new garment pattern with fabric requirements and accessories
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Enter the garment name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Garment Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Men's Shirt, Ladies Kurta"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description of the garment type"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fabric Requirements */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Fabric Requirements</CardTitle>
              <CardDescription>
                Define base fabric requirement and adjustments for different body
                types (in meters)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="baseMeters">Base Fabric Required (meters) *</Label>
                <Input
                  id="baseMeters"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.baseMeters}
                  onChange={(e) =>
                    setFormData({ ...formData, baseMeters: e.target.value })
                  }
                  placeholder="e.g., 2.5"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Base amount of fabric needed for this garment
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="slimAdjustment">Slim Adjustment</Label>
                  <Input
                    id="slimAdjustment"
                    type="number"
                    step="0.1"
                    value={formData.slimAdjustment}
                    onChange={(e) =>
                      setFormData({ ...formData, slimAdjustment: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="regularAdjustment">Regular Adjustment</Label>
                  <Input
                    id="regularAdjustment"
                    type="number"
                    step="0.1"
                    value={formData.regularAdjustment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        regularAdjustment: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="largeAdjustment">Large Adjustment</Label>
                  <Input
                    id="largeAdjustment"
                    type="number"
                    step="0.1"
                    value={formData.largeAdjustment}
                    onChange={(e) =>
                      setFormData({ ...formData, largeAdjustment: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="xlAdjustment">XL Adjustment</Label>
                  <Input
                    id="xlAdjustment"
                    type="number"
                    step="0.1"
                    value={formData.xlAdjustment}
                    onChange={(e) =>
                      setFormData({ ...formData, xlAdjustment: e.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Additional meters needed for each body type (e.g., Large might need
                +0.3m, XL +0.5m)
              </p>
            </CardContent>
          </Card>

          {/* Default Accessories */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Default Accessories</CardTitle>
              <CardDescription>
                Add accessories that are typically used with this garment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedAccessories.map((acc, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label>Accessory</Label>
                      <Select
                        value={acc.accessoryId}
                        onValueChange={(value) =>
                          updateAccessory(index, 'accessoryId', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select accessory" />
                        </SelectTrigger>
                        <SelectContent>
                          {accessories.map((accessory) => (
                            <SelectItem key={accessory.id} value={accessory.id}>
                              {accessory.name} ({accessory.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={acc.quantity}
                        onChange={(e) =>
                          updateAccessory(
                            index,
                            'quantity',
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAccessory(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAccessory}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Accessory
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href="/garment-types">Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Garment Type'}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
