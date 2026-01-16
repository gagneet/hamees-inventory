'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Package, CheckCircle, Trash2 } from 'lucide-react'
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
    quantity: number
    receivedQuantity: number
    unit: string
    pricePerUnit: number
    totalPrice: number
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
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null)
  const [clothInventory, setClothInventory] = useState<ClothInventory[]>([])
  const [accessoryInventory, setAccessoryInventory] = useState<AccessoryInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [receiving, setReceiving] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)

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

      // Initialize receive data
      setReceiveData({
        items: data.purchaseOrder.items.map((item: any) => ({
          id: item.id,
          receivedQuantity: item.receivedQuantity || 0,
          clothInventoryId: null,
          accessoryInventoryId: null,
        })),
        paidAmount: data.purchaseOrder.paidAmount,
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

  if (loading || !purchaseOrder) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Loading purchase order...</p>
        </div>
      </DashboardLayout>
    )
  }

  const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
    PENDING: { label: 'Pending', variant: 'default', color: 'text-yellow-600' },
    PARTIAL: {
      label: 'Partially Received',
      variant: 'secondary',
      color: 'text-blue-600',
    },
    RECEIVED: { label: 'Received', variant: 'default', color: 'text-green-600' },
    CANCELLED: { label: 'Cancelled', variant: 'destructive', color: 'text-red-600' },
  }

  const config = statusConfig[purchaseOrder.status]

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
          {purchaseOrder.status === 'PENDING' && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel PO
            </Button>
          )}
          {(purchaseOrder.status === 'PENDING' || purchaseOrder.status === 'PARTIAL') && (
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
                              {item.quantity} {item.unit}
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
                              max={item.quantity - item.receivedQuantity}
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
                    <div>
                      <Label className="text-slate-700">Payment Amount</Label>
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
                    </div>
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
                  <th className="pb-2 text-right">Price/Unit</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrder.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 font-medium">{item.itemName}</td>
                    <td className="py-3">{item.itemType}</td>
                    <td className="py-3 text-right">{item.quantity}</td>
                    <td className="py-3 text-right">
                      <span
                        className={
                          item.receivedQuantity >= item.quantity
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
                    <td className="py-3 text-right">{formatCurrency(item.pricePerUnit)}</td>
                    <td className="py-3 text-right font-semibold">
                      {formatCurrency(item.totalPrice)}
                    </td>
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
    </DashboardLayout>
  )
}
