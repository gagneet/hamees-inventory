'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Split, Calendar, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'

interface OrderItem {
  id: string
  garmentPattern: {
    name: string
  }
  clothInventory: {
    name: string
    color: string
  }
  quantityOrdered: number
  estimatedMeters: number
  totalPrice: number
}

interface SplitOrderDialogProps {
  orderId: string
  orderNumber: string
  items: OrderItem[]
  currentDeliveryDate: Date
  orderTotalAmount: number
  orderSubTotal: number
}

export function SplitOrderDialog({
  orderId,
  orderNumber,
  items,
  currentDeliveryDate,
  orderTotalAmount,
  orderSubTotal,
}: SplitOrderDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [deliveryDate, setDeliveryDate] = useState(
    new Date(currentDeliveryDate).toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Validate items array - prevent .map error
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  const handleItemToggle = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
    setError('')
  }

  const selectedItems = items.filter(item => selectedItemIds.includes(item.id))
  const remainingItems = items.filter(item => !selectedItemIds.includes(item.id))

  // Calculate proportional split of complete order costs (not just item totals)
  const calculateTotal = (itemList: OrderItem[]) => {
    // Calculate item totals (fabric + accessories only)
    const itemsTotal = itemList.reduce((sum, item) => sum + item.totalPrice, 0)
    const allItemsTotal = items.reduce((sum, item) => sum + item.totalPrice, 0)

    // Calculate proportion based on fabric + accessories cost
    const proportion = allItemsTotal > 0 ? itemsTotal / allItemsTotal : 0

    // Proportionally distribute the complete order subtotal (includes stitching, premiums, etc.)
    const subTotal = orderSubTotal * proportion
    const gstAmount = subTotal * 0.12
    const total = subTotal + gstAmount

    return { subTotal, gstAmount, total }
  }

  const selectedTotals = calculateTotal(selectedItems)
  const remainingTotals = calculateTotal(remainingItems)

  const handleSplit = async () => {
    if (selectedItemIds.length === 0) {
      setError('Please select at least one item to split')
      return
    }

    if (selectedItemIds.length >= items.length) {
      setError('You must leave at least one item in the original order')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/orders/${orderId}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItemIds,
          deliveryDate,
          notes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to split order')
      }

      // Refresh the page to show updated order
      router.refresh()
      setOpen(false)

      // Optionally navigate to the new order
      if (confirm(`Order split successfully! New order: ${data.newOrder.orderNumber}\n\nWould you like to view the new order?`)) {
        router.push(`/orders/${data.newOrder.id}`)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Split className="h-4 w-4" />
          Split Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Order {orderNumber}</DialogTitle>
          <DialogDescription>
            Select items to move to a new order. Both orders will maintain the same status and customer.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Item Selection */}
          <div>
            <h3 className="font-semibold mb-3">Select Items to Split</h3>
            <div className="space-y-2 border rounded-lg p-4 bg-slate-50">
              {items.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-white rounded border hover:border-blue-300 transition-colors"
                  >
                    <Checkbox
                      id={item.id}
                      checked={selectedItemIds.includes(item.id)}
                      onCheckedChange={() => handleItemToggle(item.id)}
                    />
                    <label htmlFor={item.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{item.garmentPattern.name}</div>
                      <div className="text-sm text-slate-600">
                        {item.clothInventory.name} ({item.clothInventory.color}) • {item.estimatedMeters.toFixed(2)}m • Qty: {item.quantityOrdered}
                      </div>
                      <div className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Delivery Date */}
          <div>
            <Label htmlFor="deliveryDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Delivery Date for New Order
            </Label>
            <input
              type="date"
              id="deliveryDate"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for splitting order..."
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Preview */}
          {selectedItemIds.length > 0 && remainingItems.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
              {/* New Order Preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">New Order</h4>
                <div className="text-sm space-y-1 text-green-800">
                  <div className="flex justify-between">
                    <span>Items:</span>
                    <span className="font-medium">{selectedItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedTotals.subTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (12%):</span>
                    <span>{formatCurrency(selectedTotals.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-green-300 pt-1 mt-1">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedTotals.total)}</span>
                  </div>
                </div>
              </div>

              {/* Remaining Order Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Original Order (Remaining)</h4>
                <div className="text-sm space-y-1 text-blue-800">
                  <div className="flex justify-between">
                    <span>Items:</span>
                    <span className="font-medium">{remainingItems.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(remainingTotals.subTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (12%):</span>
                    <span>{formatCurrency(remainingTotals.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-blue-300 pt-1 mt-1">
                    <span>Total:</span>
                    <span>{formatCurrency(remainingTotals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSplit} disabled={loading || selectedItemIds.length === 0}>
            {loading ? 'Splitting...' : 'Split Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
