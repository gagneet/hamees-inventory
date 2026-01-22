'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { ShoppingCart, Plus, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface POItem {
  itemName: string
  itemType: 'CLOTH' | 'ACCESSORY'
  quantity: number
  unit: string
  pricePerUnit: number
}

interface CriticalFabric {
  id: string
  name: string
  availableStock: number
  usageRate: number
  daysRemaining: number
}

interface CreatePODialogProps {
  trigger: React.ReactNode
  criticalFabrics?: CriticalFabric[]
}

export function CreatePODialog({ trigger, criticalFabrics = [] }: CreatePODialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<POItem[]>([])

  useEffect(() => {
    if (open) {
      fetchSuppliers()
      // Pre-populate items with critical fabrics if provided
      if (criticalFabrics.length > 0 && items.length === 0) {
        const prefilledItems = criticalFabrics.map((fabric) => ({
          itemName: fabric.name,
          itemType: 'CLOTH' as const,
          quantity: Math.max(fabric.usageRate * 3, 50), // 3 months supply or 50m minimum
          unit: 'meters',
          pricePerUnit: 0,
        }))
        setItems(prefilledItems)
      }
    }
  }, [open])

  async function fetchSuppliers() {
    try {
      const response = await fetch('/api/suppliers')
      const data = await response.json()
      if (response.ok && data.suppliers) {
        setSuppliers(data.suppliers)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  function addItem() {
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

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof POItem, value: any) {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item')
      return
    }

    // Validate items
    const invalidItems = items.filter(
      (item) =>
        !item.itemName ||
        item.quantity <= 0 ||
        item.pricePerUnit < 0
    )

    if (invalidItems.length > 0) {
      toast.error('Please fill all item details correctly')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          expectedDate: expectedDate || null,
          items,
          notes: notes || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Purchase order created successfully')
        setOpen(false)
        // Reset form
        setSupplierId('')
        setExpectedDate('')
        setNotes('')
        setItems([])
        // Refresh page or navigate to PO detail
        router.push(`/purchase-orders/${data.purchaseOrder.id}`)
      } else {
        toast.error(data.error || 'Failed to create purchase order')
      }
    } catch (error) {
      console.error('Error creating PO:', error)
      toast.error('Failed to create purchase order')
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.pricePerUnit,
    0
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Create Purchase Order
          </DialogTitle>
          <DialogDescription>
            {criticalFabrics.length > 0 ? (
              <span className="text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Creating PO for {criticalFabrics.length} critical stock item(s)
              </span>
            ) : (
              'Create a new purchase order for restocking inventory'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.phone && ` • ${supplier.phone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expected Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedDate">Expected Delivery Date</Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border-2 border-dashed rounded-lg">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No items added yet</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={addItem}
                >
                  Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg bg-slate-50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">
                        Item {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs">Item Name *</Label>
                        <Input
                          value={item.itemName}
                          onChange={(e) =>
                            updateItem(index, 'itemName', e.target.value)
                          }
                          placeholder="e.g., Premium Cotton Blue"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Type *</Label>
                        <Select
                          value={item.itemType}
                          onValueChange={(value) =>
                            updateItem(index, 'itemType', value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CLOTH">Cloth</SelectItem>
                            <SelectItem value="ACCESSORY">Accessory</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Unit *</Label>
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          placeholder="e.g., meters, pieces"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) =>
                            updateItem(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Price per Unit *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.pricePerUnit || ''}
                          onChange={(e) =>
                            updateItem(
                              index,
                              'pricePerUnit',
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="text-right text-sm font-medium">
                      Total: ₹{(item.quantity * item.pricePerUnit).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes or instructions"
              rows={3}
            />
          </div>

          {/* Total Amount */}
          {items.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">
                  Total PO Amount:
                </span>
                <span className="text-2xl font-bold text-blue-900">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
