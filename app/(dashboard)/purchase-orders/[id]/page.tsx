'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Package, CheckCircle, Trash2, DollarSign, ShieldCheck } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import DashboardLayout from '@/components/DashboardLayout'
import { formatCurrency } from '@/lib/utils'
import { useFieldVisibility } from '@/hooks/use-field-visibility'

interface PurchaseOrder {
  id: string
  poNumber: string
  orderDate: string
  expectedDate: string | null
  receivedDate: string | null
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  status: string
  notes: string | null
  supplier: {
    id: string
    name: string
    phone: string
    email: string | null
    address: string | null
  }
  items: Array<{
    id: string
    itemName: string
    itemType: string
    orderedQuantity: number
    receivedQuantity: number
    unit: string
    pricePerUnit?: number
    totalPrice?: number
  }>
}

interface ClothInventory {
  id: string
  name: string
  type: string
}

interface AccessoryInventory {
  id: string
  name: string
  type: string
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { canView, isLoading, role } = useFieldVisibility()
  const canViewPOPrices = canView('purchase_order', 'totalAmount')
  const canApprovePurchaseOrder = role === 'OWNER' || role === 'INVENTORY_MANAGER'
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [clothInventory, setClothInventory] = useState<ClothInventory[]>([])
  const [accessoryInventory, setAccessoryInventory] = useState<AccessoryInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [approving, setApproving] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    paymentMode: 'CASH' as const,
    transactionRef: '',
    notes: '',
  })
  const [approveItems, setApproveItems] = useState<Array<{ id: string; pricePerUnit: number }>>([])
  const [approvalNotes, setApprovalNotes] = useState('')

  const [receiveData, setReceiveData] = useState<{
    items: Array<{
      id: string
      receivedQuantity: number
      clothInventoryId: string | null
      accessoryInventoryId: string | null
    }>
    paidAmount: number
    notes: string
  }>({
    items: [],
    paidAmount: 0,
    notes: '',
  })

  useEffect(() => {
    params.then((p) => setResolvedParams(p))
  }, [params])

  useEffect(() => {
    if (resolvedParams) {
      fetchPurchaseOrder()
      fetchClothInventory()
      fetchAccessoryInventory()
    }
  }, [resolvedParams])

  const fetchPurchaseOrder = async () => {
    if (!resolvedParams) return

    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${resolvedParams.id}`)
      const data = await response.json()
      setPurchaseOrder(data.purchaseOrder)

      setApproveItems(
        data.purchaseOrder.items.map((item: any) => ({
          id: item.id,
          pricePerUnit: item.pricePerUnit || 0,
        }))
      )

      // Initialize receive data
      setReceiveData({
        items: data.purchaseOrder.items.map((item: any) => ({
          id: item.id,
          receivedQuantity: item.receivedQuantity || 0,
          clothInventoryId: null,
          accessoryInventoryId: null,
        })),
        paidAmount: 0, // Start at 0 for additional payment
        notes: '',
      })
    } catch (error) {
      console.error('Error fetching purchase order:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClothInventory = async () => {
    try {
      const response = await fetch('/api/inventory/cloth')
      const data = await response.json()
      setClothInventory(data.items || data.clothInventory || [])
    } catch (error) {
      console.error('Error fetching cloth inventory:', error)
    }
  }

  const fetchAccessoryInventory = async () => {
    try {
      const response = await fetch('/api/inventory/accessories')
      const data = await response.json()
      setAccessoryInventory(data.items || data.accessories || [])
    } catch (error) {
      console.error('Error fetching accessory inventory:', error)
    }
  }

  const handleReceive = async () => {
    if (!resolvedParams || !purchaseOrder) return

    setReceiving(true)
    try {
      const response = await fetch(`/api/purchase-orders/${resolvedParams.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiveData),
      })

      if (!response.ok) {
        throw new Error('Failed to receive purchase order')
      }

      setShowReceiveDialog(false)
      await fetchPurchaseOrder()
      alert('Purchase order received successfully!')
    } catch (error) {
      console.error('Error receiving purchase order:', error)
      alert('Failed to receive purchase order')
    } finally {
      setReceiving(false)
    }
  }

  const openPaymentDialog = () => {
    if (!purchaseOrder) return
    setPaymentData({
      amount: purchaseOrder.balanceAmount,
      paymentMode: 'CASH',
      transactionRef: '',
      notes: '',
    })
    setShowPaymentDialog(true)
  }

  const handlePayment = async () => {
    if (!resolvedParams || !purchaseOrder) return

    setProcessingPayment(true)
    try {
      const response = await fetch(`/api/purchase-orders/${resolvedParams.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process payment')
      }

      setShowPaymentDialog(false)
      await fetchPurchaseOrder()
      alert(data.message || 'Payment recorded successfully!')
    } catch (error: any) {
      console.error('Error processing payment:', error)
      alert(error.message || 'Failed to process payment')
    } finally {
      setProcessingPayment(false)
    }
  }


  const updateApproveItemPrice = (itemId: string, pricePerUnit: number) => {
    setApproveItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, pricePerUnit } : item))
    )
  }

  const handleApprove = async () => {
    if (!resolvedParams || !purchaseOrder) return

    const invalidItem = approveItems.find((item) => item.pricePerUnit <= 0)
    if (invalidItem) {
      alert('Enter a price per unit greater than zero for every item before approval.')
      return
    }

    setApproving(true)
    try {
      const response = await fetch(`/api/purchase-orders/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'APPROVED',
          items: approveItems,
          notes: approvalNotes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve purchase order')
      }

      setShowApproveDialog(false)
      setApprovalNotes('')
      await fetchPurchaseOrder()
      alert('Purchase order approved successfully!')
    } catch (error: any) {
      console.error('Error approving purchase order:', error)
      alert(error.message || 'Failed to approve purchase order')
    } finally {
      setApproving(false)
    }
  }

  const handleDelete = async () => {
    if (!resolvedParams) return
    if (!confirm('Are you sure you want to cancel this purchase order?')) return

    try {
      const response = await fetch(`/api/purchase-orders/${resolvedParams.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel purchase order')
      }

      router.push('/purchase-orders')
    } catch (error) {
      console.error('Error cancelling purchase order:', error)
      alert('Failed to cancel purchase order')
    }
  }

  const updateReceiveItem = (
    itemId: string,
    field: 'receivedQuantity' | 'clothInventoryId' | 'accessoryInventoryId',
    value: any
  ) => {
    setReceiveData({
      ...receiveData,
      items: receiveData.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    })
  }

  if (loading || isLoading || !purchaseOrder) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Loading purchase order...</p>
        </div>
      </DashboardLayout>
    )
  }

  const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
    PENDING_APPROVAL: { label: 'Pending Approval', variant: 'secondary', color: 'text-amber-600' },
    APPROVED: { label: 'Approved', variant: 'default', color: 'text-blue-600' },
    PENDING: { label: 'Pending', variant: 'default', color: 'text-yellow-600' },
    PARTIAL: {
      label: 'Partially Received',
      variant: 'secondary',
      color: 'text-blue-600',
    },
    RECEIVED: { label: 'Received', variant: 'default', color: 'text-green-600' },
    CANCELLED: { label: 'Cancelled', variant: 'destructive', color: 'text-red-600' },
  }

  const config = statusConfig[purchaseOrder.status] || statusConfig.PENDING

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
            <BreadcrumbPage>{purchaseOrder.poNumber}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">{purchaseOrder.poNumber}</h1>
          <Badge variant={config.variant} className="mt-2">
            {config.label}
          </Badge>
        </div>
        <div className="flex gap-2">
          {['PENDING_APPROVAL', 'PENDING', 'APPROVED'].includes(purchaseOrder.status) && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel PO
            </Button>
          )}
          {canViewPOPrices && purchaseOrder.balanceAmount > 0 && ['APPROVED', 'PARTIAL'].includes(purchaseOrder.status) && (
            <Button variant="outline" onClick={openPaymentDialog}>
              <DollarSign className="mr-2 h-4 w-4" />
              Make Payment
            </Button>
          )}
          {purchaseOrder.status === 'PENDING_APPROVAL' && canApprovePurchaseOrder && canViewPOPrices && (
            <Button onClick={() => setShowApproveDialog(true)}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Approve PO
            </Button>
          )}
          {(['APPROVED', 'PARTIAL'].includes(purchaseOrder.status)) && (
            <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
              <DialogTrigger asChild>
                <Button>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Receive Items
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-slate-900">Receive Purchase Order</DialogTitle>
                  <DialogDescription>
                    Enter received quantities and link items to inventory
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {purchaseOrder.items.map((item, index) => {
                    const receiveItem = receiveData.items.find((i) => i.id === item.id)

                    return (
                      <div key={item.id} className="border border-slate-200 p-4 rounded-lg bg-slate-50">
                        <h4 className="font-semibold mb-2 text-slate-900">{item.itemName}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-700">Ordered Quantity</Label>
                            <p className="text-sm text-slate-900">
                              {item.orderedQuantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <Label className="text-slate-700">Already Received</Label>
                            <p className="text-sm text-slate-900">
                              {item.receivedQuantity} {item.unit}
                            </p>
                          </div>
                          <div>
                            <Label className="text-slate-700">Received Now *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={item.orderedQuantity - item.receivedQuantity}
                              value={receiveItem?.receivedQuantity || 0}
                              onChange={(e) =>
                                updateReceiveItem(
                                  item.id,
                                  'receivedQuantity',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                          {item.itemType === 'CLOTH' && (
                            <div>
                              <Label className="text-slate-700">Link to Inventory Item</Label>
                              <Select
                                value={receiveItem?.clothInventoryId || ''}
                                onValueChange={(value) =>
                                  updateReceiveItem(item.id, 'clothInventoryId', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select inventory item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {clothInventory.map((cloth) => (
                                    <SelectItem key={cloth.id} value={cloth.id}>
                                      {cloth.name} ({cloth.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {item.itemType === 'ACCESSORY' && (
                            <div>
                              <Label className="text-slate-700">Link to Inventory Item</Label>
                              <Select
                                value={receiveItem?.accessoryInventoryId || ''}
                                onValueChange={(value) =>
                                  updateReceiveItem(item.id, 'accessoryInventoryId', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select inventory item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accessoryInventory.map((accessory) => (
                                    <SelectItem key={accessory.id} value={accessory.id}>
                                      {accessory.name} ({accessory.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <div className="grid gap-4">
                    {canViewPOPrices && (
                      <div>
                        <Label className="text-slate-700">Additional Payment (Optional)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={purchaseOrder.balanceAmount}
                          value={receiveData.paidAmount}
                          onChange={(e) =>
                            setReceiveData({
                              ...receiveData,
                              paidAmount: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Balance due: {formatCurrency(purchaseOrder.balanceAmount)}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label className="text-slate-700">Notes</Label>
                      <Textarea
                        value={receiveData.notes}
                        onChange={(e) =>
                          setReceiveData({ ...receiveData, notes: e.target.value })
                        }
                        placeholder="Add any notes about this receipt..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowReceiveDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleReceive} disabled={receiving}>
                      {receiving ? 'Processing...' : 'Confirm Receipt'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" asChild>
            <Link href="/purchase-orders">Back to List</Link>
          </Button>
        </div>
      </div>

      {/* Supplier & Order Info */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="font-semibold">{purchaseOrder.supplier.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Phone</p>
              <p>{purchaseOrder.supplier.phone}</p>
            </div>
            {purchaseOrder.supplier.email && (
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p>{purchaseOrder.supplier.email}</p>
              </div>
            )}
            {purchaseOrder.supplier.address && (
              <div>
                <p className="text-sm text-slate-500">Address</p>
                <p>{purchaseOrder.supplier.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-slate-500">Order Date</p>
              <p className="font-semibold">
                {new Date(purchaseOrder.orderDate).toLocaleDateString('en-IN')}
              </p>
            </div>
            {purchaseOrder.expectedDate && (
              <div>
                <p className="text-sm text-slate-500">Expected Date</p>
                <p>{new Date(purchaseOrder.expectedDate).toLocaleDateString('en-IN')}</p>
              </div>
            )}
            {purchaseOrder.receivedDate && (
              <div>
                <p className="text-sm text-slate-500">Received Date</p>
                <p className="text-green-600 font-semibold">
                  {new Date(purchaseOrder.receivedDate).toLocaleDateString('en-IN')}
                </p>
              </div>
            )}
            {canViewPOPrices && (
              <>
                <div>
                  <p className="text-sm text-slate-500">Total Amount</p>
                  <p className="font-bold text-lg">{formatCurrency(purchaseOrder.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Paid Amount</p>
                  <p className="text-green-600">{formatCurrency(purchaseOrder.paidAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Balance Amount</p>
                  <p className={purchaseOrder.balanceAmount > 0 ? 'text-red-600 font-semibold' : ''}>
                    {formatCurrency(purchaseOrder.balanceAmount)}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
          <CardDescription>{purchaseOrder.items.length} item(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm text-slate-500">
                  <th className="pb-2">Item Name</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Quantity</th>
                  <th className="pb-2 text-right">Received</th>
                  <th className="pb-2">Unit</th>
                  {canViewPOPrices && (
                    <>
                      <th className="pb-2 text-right">Price/Unit</th>
                      <th className="pb-2 text-right">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {purchaseOrder.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 font-medium">{item.itemName}</td>
                    <td className="py-3">{item.itemType}</td>
                    <td className="py-3 text-right">{item.orderedQuantity}</td>
                    <td className="py-3 text-right">
                      <span
                        className={
                          item.receivedQuantity >= item.orderedQuantity
                            ? 'text-green-600 font-semibold'
                            : item.receivedQuantity > 0
                            ? 'text-blue-600'
                            : ''
                        }
                      >
                        {item.receivedQuantity}
                      </span>
                    </td>
                    <td className="py-3">{item.unit}</td>
                    {canViewPOPrices && (
                      <>
                        <td className="py-3 text-right">{formatCurrency(item.pricePerUnit ?? 0)}</td>
                        <td className="py-3 text-right font-semibold">
                          {formatCurrency(item.totalPrice ?? 0)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {purchaseOrder.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white whitespace-pre-wrap">{purchaseOrder.notes}</p>
          </CardContent>
        </Card>
      )}


      {/* Approval Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Approve Purchase Order</DialogTitle>
            <DialogDescription>
              Enter supplier pricing before this PO can be received or paid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {purchaseOrder.items.map((item) => {
              const approveItem = approveItems.find((i) => i.id === item.id)
              const pricePerUnit = approveItem?.pricePerUnit || 0

              return (
                <div key={item.id} className="grid gap-3 border rounded-lg p-4 bg-slate-50 md:grid-cols-[1fr_140px_160px] md:items-end">
                  <div>
                    <p className="font-medium text-slate-900">{item.itemName}</p>
                    <p className="text-sm text-slate-600">
                      {item.orderedQuantity} {item.unit} • {item.itemType}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-700">Price per Unit *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={pricePerUnit || ''}
                      onChange={(e) =>
                        updateApproveItemPrice(item.id, parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="text-right font-semibold text-slate-900">
                    {formatCurrency(item.orderedQuantity * pricePerUnit)}
                  </div>
                </div>
              )
            })}

            <div>
              <Label className="text-slate-700">Approval Notes</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add any approval notes..."
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setShowApproveDialog(false)} disabled={approving}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={approving}>
                {approving ? 'Approving...' : 'Approve Purchase Order'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Make Payment</DialogTitle>
            <DialogDescription>
              Record payment for {purchaseOrder.poNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Balance Summary */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-600">Total Amount</p>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(purchaseOrder.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Already Paid</p>
                  <p className="font-semibold text-green-600">
                    {formatCurrency(purchaseOrder.paidAmount)}
                  </p>
                </div>
                <div className="col-span-2 pt-2 border-t border-blue-300">
                  <p className="text-slate-600">Balance Due</p>
                  <p className="font-bold text-lg text-red-600">
                    {formatCurrency(purchaseOrder.balanceAmount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <Label className="text-slate-700">Payment Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={purchaseOrder.balanceAmount}
                value={paymentData.amount}
                onChange={(e) =>
                  setPaymentData({
                    ...paymentData,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                className="font-semibold text-lg"
              />
              <p className="text-xs text-slate-500 mt-1">
                Maximum: {formatCurrency(purchaseOrder.balanceAmount)}
              </p>
            </div>

            {/* Payment Mode */}
            <div>
              <Label className="text-slate-700">Payment Mode *</Label>
              <Select
                value={paymentData.paymentMode}
                onValueChange={(value: any) =>
                  setPaymentData({ ...paymentData, paymentMode: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="NET_BANKING">Net Banking</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transaction Reference */}
            <div>
              <Label className="text-slate-700">Transaction Reference</Label>
              <Input
                type="text"
                value={paymentData.transactionRef}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, transactionRef: e.target.value })
                }
                placeholder="Transaction ID, Cheque No., etc."
              />
            </div>

            {/* Notes */}
            <div>
              <Label className="text-slate-700">Notes</Label>
              <Textarea
                value={paymentData.notes}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, notes: e.target.value })
                }
                placeholder="Add any notes about this payment..."
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPaymentDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayment}
                disabled={processingPayment || paymentData.amount <= 0}
              >
                {processingPayment ? 'Processing...' : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
