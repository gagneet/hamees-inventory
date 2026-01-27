'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Edit, RefreshCw, Percent } from 'lucide-react'

interface OrderActionsProps {
  orderId: string
  currentStatus: string
  deliveryDate: string
  advancePaid: number
  discount: number
  discountReason: string | null
  notes: string | null
  priority: string
  totalAmount: number
  balanceAmount: number
  userRole: string
  isDelivered?: boolean
}

const statusOptions = [
  { value: 'NEW', label: 'New' },
  { value: 'MATERIAL_SELECTED', label: 'Material Selected' },
  { value: 'CUTTING', label: 'Cutting' },
  { value: 'STITCHING', label: 'Stitching' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'READY', label: 'Ready' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export function OrderActions({
  orderId,
  currentStatus,
  deliveryDate,
  advancePaid,
  discount,
  discountReason,
  notes,
  priority,
  totalAmount,
  balanceAmount,
  userRole,
  isDelivered = false,
}: OrderActionsProps) {
  const router = useRouter()
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Status update form
  const [newStatus, setNewStatus] = useState(currentStatus)

  // Edit order form
  const [editData, setEditData] = useState({
    deliveryDate: new Date(deliveryDate).toISOString().split('T')[0],
    advancePaid: advancePaid.toString(),
    notes: notes || '',
    priority,
  })

  // Discount form - auto-populate with current balance amount
  const [discountData, setDiscountData] = useState({
    discount: balanceAmount.toFixed(2),
    discountReason: discountReason || '',
  })
  const [discountMode, setDiscountMode] = useState<'amount' | 'percentage'>('amount')
  const [discountPercentage, setDiscountPercentage] = useState(
    totalAmount > 0 ? ((balanceAmount / totalAmount) * 100).toFixed(2) : '0.00'
  )

  // Handle discount amount change (updates percentage)
  const handleDiscountAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0
    setDiscountData({ ...discountData, discount: value })

    // Calculate and update percentage
    if (totalAmount > 0) {
      const percentage = (amount / totalAmount) * 100
      setDiscountPercentage(percentage.toFixed(2))
    }
  }

  // Handle discount percentage change (updates amount)
  const handleDiscountPercentageChange = (value: string) => {
    const percentage = parseFloat(value) || 0
    setDiscountPercentage(value)

    // Calculate and update amount
    const amount = (percentage / 100) * totalAmount
    setDiscountData({ ...discountData, discount: amount.toFixed(2) })
  }

  const handleStatusUpdate = async () => {
    if (newStatus === currentStatus) {
      alert('Please select a different status')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update status')
      }

      alert('Status updated successfully!')
      setStatusDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating status:', error)
      alert(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleOrderEdit = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryDate: new Date(editData.deliveryDate).toISOString(),
          advancePaid: parseFloat(editData.advancePaid),
          notes: editData.notes || null,
          priority: editData.priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update order')
      }

      alert('Order updated successfully!')
      setEditDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error updating order:', error)
      alert(error instanceof Error ? error.message : 'Failed to update order')
    } finally {
      setLoading(false)
    }
  }

  const handleDiscountApply = async () => {
    const discountValue = parseFloat(discountData.discount || '0')
    if (discountValue < 0 || discountValue > totalAmount) {
      alert('Discount must be between 0 and total amount')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discount: discountValue,
          discountReason: discountData.discountReason || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to apply discount')
      }

      alert('Discount applied successfully!')
      setDiscountDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error applying discount:', error)
      alert(error instanceof Error ? error.message : 'Failed to apply discount')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" disabled={isDelivered}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update Status
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Change the current status of this order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="status">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate} disabled={loading}>
                {loading ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={isDelivered}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Order
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order Details</DialogTitle>
            <DialogDescription>
              Update order information and payment details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="deliveryDate">Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={editData.deliveryDate}
                onChange={(e) =>
                  setEditData({ ...editData, deliveryDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={editData.priority}
                onValueChange={(value) =>
                  setEditData({ ...editData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="advancePaid">Advance Paid (₹)</Label>
              <Input
                id="advancePaid"
                type="number"
                step="0.01"
                min="0"
                max={totalAmount}
                value={editData.advancePaid}
                onChange={(e) =>
                  setEditData({ ...editData, advancePaid: e.target.value })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                Total: ₹{totalAmount.toFixed(2)} | Balance: ₹
                {(totalAmount - parseFloat(editData.advancePaid || '0')).toFixed(2)}
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editData.notes}
                onChange={(e) =>
                  setEditData({ ...editData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleOrderEdit} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply Discount Dialog (OWNER only) */}
      {userRole === 'OWNER' && (
        <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="bg-yellow-50 hover:bg-yellow-100" disabled={isDelivered}>
              <Percent className="mr-2 h-4 w-4" />
              Apply Discount
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Apply Discount</DialogTitle>
              <DialogDescription>
                Reduce or clear the outstanding balance for this order
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <p className="text-blue-900">
                  <strong>Current Balance:</strong> ₹{balanceAmount.toFixed(2)}
                </p>
                <p className="text-blue-700 text-xs mt-1">
                  Total: ₹{totalAmount.toFixed(2)} | Advance: ₹{advancePaid.toFixed(2)} | Current Discount: ₹{discount.toFixed(2)}
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={discountMode === 'amount' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscountMode('amount')}
                  className="flex-1"
                >
                  Amount (₹)
                </Button>
                <Button
                  type="button"
                  variant={discountMode === 'percentage' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscountMode('percentage')}
                  className="flex-1"
                >
                  Percentage (%)
                </Button>
              </div>

              {/* Amount Mode */}
              {discountMode === 'amount' && (
                <div>
                  <Label htmlFor="discount">Discount Amount (₹)</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalAmount}
                    value={discountData.discount}
                    onChange={(e) => handleDiscountAmountChange(e.target.value)}
                    className="text-red-600 font-bold text-lg"
                  />
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    = {discountPercentage}% of Total Amount
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    New Balance: ₹{(balanceAmount - (parseFloat(discountData.discount || '0') - discount)).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Percentage Mode */}
              {discountMode === 'percentage' && (
                <div>
                  <Label htmlFor="discountPercent">Discount Percentage (%)</Label>
                  <Input
                    id="discountPercent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={discountPercentage}
                    onChange={(e) => handleDiscountPercentageChange(e.target.value)}
                    className="text-red-600 font-bold text-lg"
                  />
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    = ₹{parseFloat(discountData.discount || '0').toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    New Balance: ₹{(balanceAmount - (parseFloat(discountData.discount || '0') - discount)).toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="discountReason">Reason for Discount</Label>
                <Textarea
                  id="discountReason"
                  value={discountData.discountReason}
                  onChange={(e) =>
                    setDiscountData({ ...discountData, discountReason: e.target.value })
                  }
                  placeholder="e.g., Cash payment settled, Customer loyalty discount, etc."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDiscountDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleDiscountApply} disabled={loading}>
                  {loading ? 'Applying...' : 'Apply Discount'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
