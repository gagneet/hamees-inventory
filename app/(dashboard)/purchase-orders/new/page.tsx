'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import DashboardLayout from '@/components/DashboardLayout'
import { formatCurrency } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  phone: string
  email: string | null
}

interface POItem {
  itemName: string
  itemType: 'CLOTH' | 'ACCESSORY'
  quantity: number
  unit: string
  pricePerUnit: number
}

function NewPurchaseOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    supplierId: searchParams.get('supplierId') || '',
    expectedDate: '',
    notes: '',
  })

  const [items, setItems] = useState<POItem[]>([
    {
      itemName: searchParams.get('itemName') || '',
      itemType: 'CLOTH' as const,
      quantity: 0,
      unit: 'meters',
      pricePerUnit: 0,
    },
  ])

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      setSuppliers(data.suppliers || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const addItem = () => {
    setItems([
      ...items,
      {
        itemName: '',
        itemType: 'CLOTH',
        quantity: 0,
        unit: 'meters',
        pricePerUnit: 0,
      },
    ])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.filter((item) => item.itemName && item.quantity > 0),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create purchase order')
      }

      const data = await response.json()
      router.push(`/purchase-orders/${data.purchaseOrder.id}`)
    } catch (error) {
      console.error('Error creating purchase order:', error)
      alert('Failed to create purchase order')
    } finally {
      setLoading(false)
    }
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
            <BreadcrumbLink href="/purchase-orders">Purchase Orders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Purchase Order</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Create Purchase Order</h1>
        <Button variant="outline" asChild>
          <Link href="/purchase-orders">Cancel</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Supplier Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
            <CardDescription>Select the supplier for this purchase order</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) =>
                  setFormData({ ...formData, supplierId: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} - {supplier.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expectedDate">Expected Delivery Date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={formData.expectedDate}
                onChange={(e) =>
                  setFormData({ ...formData, expectedDate: e.target.value })
                }
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>Add items to this purchase order</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-4 p-4 border rounded-lg relative bg-slate-50"
              >
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Item Name *</Label>
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateItem(index, 'itemName', e.target.value)}
                      placeholder="e.g., Premium Cotton Fabric"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Item Type *</Label>
                    <Select
                      value={item.itemType}
                      onValueChange={(value) => updateItem(index, 'itemType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLOTH">Cloth/Fabric</SelectItem>
                        <SelectItem value="ACCESSORY">Accessory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      value={item.quantity || ''}
                      onChange={(e) =>
                        updateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Unit *</Label>
                    <Select
                      value={item.unit}
                      onValueChange={(value) => updateItem(index, 'unit', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="meters">Meters</SelectItem>
                        <SelectItem value="pieces">Pieces</SelectItem>
                        <SelectItem value="kg">Kilograms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Price per Unit *</Label>
                    <Input
                      type="number"
                      value={item.pricePerUnit || ''}
                      onChange={(e) =>
                        updateItem(index, 'pricePerUnit', parseFloat(e.target.value) || 0)
                      }
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Total Price</Label>
                    <div className="p-2 bg-slate-100 rounded-md font-semibold">
                      {formatCurrency(item.quantity * item.pricePerUnit)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Additional Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes or instructions..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Items:</span>
                <span className="font-semibold">{items.length}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total Amount:</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" asChild>
            <Link href="/purchase-orders">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading || !formData.supplierId}>
            {loading ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  )
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex items-center justify-center h-96">
            <p className="text-slate-500">Loading...</p>
          </div>
        </DashboardLayout>
      }
    >
      <NewPurchaseOrderContent />
    </Suspense>
  )
}
