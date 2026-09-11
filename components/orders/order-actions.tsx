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
import { DatePicker } from '@/components/ui/date-picker'
import { RefreshCw, Edit, Percent } from 'lucide-react'
import { hasPermission, type UserRole } from '@/lib/permissions'
import { hasFinancialAccess } from '@/lib/field-acl'
import { currencySymbol, formatCurrency } from '@/lib/utils'

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
  /** Explicit capability flags (preferred). When omitted they are derived from userRole. */
  canUpdateStatus?: boolean
  /** Garments READY vs in production — the order's stage is derived from its items */
  itemProgress?: { ready: number; total: number }
  /** May move every item to one production stage (roles that see all orders, or a tailor holding every item) */
  canBulkMove?: boolean
  canEditOrder?: boolean
  /** Advance and discount edits (record_payment) */
  canRecordPayment?: boolean
  showFinancials?: boolean
  /** @deprecated pass the capability flags instead */
  userRole?: string
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

// Moving an order into these statuses needs update_order (mirrors lib/authz checkStatusTransition)
const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED']

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
  canUpdateStatus,
  itemProgress,
  canBulkMove = true,
  canEditOrder,
  canRecordPayment,
  showFinancials,
  userRole,
  isDelivered = false,
}: OrderActionsProps) {
  const role = userRole as UserRole | undefined
  const allowStatus = canUpdateStatus ?? (role ? hasPermission(role, 'update_order_status') : false)
  const allowEdit = canEditOrder ?? (role ? hasPermission(role, 'update_order') : false)
  const allowFinancials = showFinancials ?? (role ? hasFinancialAccess(role, 'order') : false)
  const allowPayments = (canRecordPayment ?? (role ? hasPermission(role, 'record_payment') : false)) && allowFinancials
  const isClosed = isDelivered || TERMINAL_STATUSES.includes(currentStatus)
  // Delivery / cancellation are order-level (update_order); a production stage here moves every item
  const availableStatuses = statusOptions.filter((option) => {
    if (option.value === currentStatus) return true
    if (TERMINAL_STATUSES.includes(option.value)) return allowEdit
    return canBulkMove
  })
  const canChangeStatus = availableStatuses.some((option) => option.value !== currentStatus)
  const notAllReady = !!itemProgress && itemProgress.total > 0 && itemProgress.ready < itemProgress.total

  const formatLocalDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const router = useRouter()
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Status update form
  const [newStatus, setNewStatus] = useState(currentStatus)

  // Edit order form
  const [editData, setEditData] = useState({
    deliveryDate: formatLocalDate(new Date(deliveryDate)),
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

  const symbol = currencySymbol()

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
    if (
      newStatus === 'DELIVERED' &&
      notAllReady &&
      !confirm(`Only ${itemProgress!.ready} of ${itemProgress!.total} items are ready. Deliver the whole order anyway?`)
    ) {
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
          // Advance is a payment field — only sent by roles allowed to record payments
          ...(allowPayments && { advancePaid: parseFloat(editData.advancePaid) }),
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

  const newBalance = balanceAmount - (parseFloat(discountData.discount || '0') - discount)

  return (
    <div className="flex flex-wrap gap-2">
      {/* Update Status Dialog */}
      {allowStatus && canChangeStatus && (
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" disabled={isClosed}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Update Status
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Deliver or cancel the order, or move every item to one stage. Single garments are moved
              from the item list or the production board.
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
                  {availableStatuses.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!allowEdit && (
                <p className="text-xs text-slate-500 mt-1">
                  Delivery and cancellation are handled by the front office.
                </p>
              )}
              {newStatus === 'DELIVERED' && newStatus !== currentStatus && notAllReady && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  Only {itemProgress!.ready} of {itemProgress!.total} items are ready. Delivering now marks every
                  item as delivered.
                </p>
              )}
              {newStatus !== currentStatus && !TERMINAL_STATUSES.includes(newStatus) && (itemProgress?.total ?? 0) > 1 && (
                <p className="text-xs text-slate-600 mt-2">
                  This moves all {itemProgress!.total} items to{' '}
                  {statusOptions.find((option) => option.value === newStatus)?.label ?? newStatus}.
                </p>
              )}
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
      )}

      {/* Edit Order Dialog */}
      {allowEdit && (
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={isClosed}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Order
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Order Details</DialogTitle>
            <DialogDescription>
              Update order information{allowPayments ? ' and payment details' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
              <div>
              <Label htmlFor="deliveryDate">Delivery Date</Label>
              <DatePicker
                value={editData.deliveryDate ? new Date(editData.deliveryDate + 'T00:00:00') : undefined}
                onChange={(d) => setEditData({ ...editData, deliveryDate: d ? formatLocalDate(d) : '' })}
                placeholder="Select delivery date"
                fromDate={new Date()}
                className="mt-1"
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
            {allowPayments && (
            <div>
              <Label htmlFor="advancePaid">Advance Paid ({symbol})</Label>
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
                Total: {formatCurrency(totalAmount)} | Balance:{' '}
                {formatCurrency(totalAmount - parseFloat(editData.advancePaid || '0'))}
              </p>
            </div>
            )}
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
      )}

      {/* Apply Discount Dialog (record_payment holders only) */}
      {allowPayments && (
        <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="bg-yellow-50 hover:bg-yellow-100" disabled={isClosed}>
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
                  <strong>Current Balance:</strong> {formatCurrency(balanceAmount)}
                </p>
                <p className="text-blue-700 text-xs mt-1">
                  Total: {formatCurrency(totalAmount)} | Advance: {formatCurrency(advancePaid)} | Current Discount: {formatCurrency(discount)}
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
                  Amount ({symbol})
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
                  <Label htmlFor="discount">Discount Amount ({symbol})</Label>
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
                    New Balance: {formatCurrency(newBalance)}
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
                    = {formatCurrency(parseFloat(discountData.discount || '0'))}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    New Balance: {formatCurrency(newBalance)}
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
