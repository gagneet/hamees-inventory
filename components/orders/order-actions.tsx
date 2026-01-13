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
import { Edit, RefreshCw } from 'lucide-react'

interface OrderActionsProps {
  orderId: string
  currentStatus: string
  deliveryDate: string
  advancePaid: number
  notes: string | null
  priority: string
  totalAmount: number
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
  notes,
  priority,
  totalAmount,
}: OrderActionsProps) {
  const router = useRouter()
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
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

  return (
    <div className="flex gap-2">
      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default">
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
          <Button variant="outline">
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
                Total: ₹{totalAmount} | Balance: ₹
                {totalAmount - parseFloat(editData.advancePaid || '0')}
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
    </div>
  )
}
