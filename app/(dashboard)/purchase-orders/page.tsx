'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Home,
  Plus,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
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
  }
  items: Array<{
    id: string
    itemName: string
    quantity: number
    receivedQuantity: number
    unit: string
    pricePerUnit: number
  }>
}

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')

  useEffect(() => {
    fetchPurchaseOrders()
  }, [filter])

  const fetchPurchaseOrders = async () => {
    setLoading(true)
    try {
      const url =
        filter === 'ALL'
          ? '/api/purchase-orders'
          : `/api/purchase-orders?status=${filter}`
      const response = await fetch(url)
      const data = await response.json()
      setPurchaseOrders(data.purchaseOrders || [])
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
    PENDING: {
      label: 'Pending',
      variant: 'default',
      icon: Clock,
    },
    PARTIAL: {
      label: 'Partially Received',
      variant: 'secondary',
      icon: AlertCircle,
    },
    RECEIVED: {
      label: 'Received',
      variant: 'default',
      icon: CheckCircle,
    },
    CANCELLED: {
      label: 'Cancelled',
      variant: 'destructive',
      icon: XCircle,
    },
  }

  const stats = {
    total: purchaseOrders.length,
    pending: purchaseOrders.filter((po) => po.status === 'PENDING').length,
    received: purchaseOrders.filter((po) => po.status === 'RECEIVED').length,
    totalValue: purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0),
    totalBalance: purchaseOrders.reduce((sum, po) => sum + po.balanceAmount, 0),
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
            <BreadcrumbPage>Purchase Orders</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Purchase Orders</h1>
          <p className="text-sm text-slate-600">Manage inventory purchase orders</p>
        </div>
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Balance Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['ALL', 'PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === 'ALL' ? 'All' : statusConfig[status]?.label || status}
          </Button>
        ))}
      </div>

      {/* Purchase Orders List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">Loading purchase orders...</p>
          </CardContent>
        </Card>
      ) : purchaseOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-slate-500 mb-4">No purchase orders found</p>
            <Button asChild>
              <Link href="/purchase-orders/new">Create your first purchase order</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {purchaseOrders.map((po) => {
            const config = statusConfig[po.status]
            const StatusIcon = config?.icon || Package

            return (
              <Card key={po.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-lg">
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="hover:text-blue-600"
                          >
                            {po.poNumber}
                          </Link>
                        </CardTitle>
                        <Badge
                          variant={config?.variant || 'default'}
                          className="flex items-center gap-1"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {config?.label || po.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        Supplier: {po.supplier.name} • {po.items.length} item(s)
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(po.totalAmount)}</p>
                      {po.balanceAmount > 0 && (
                        <p className="text-sm text-red-600">
                          Balance: {formatCurrency(po.balanceAmount)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Order Date</p>
                      <p className="font-medium">
                        {new Date(po.orderDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    {po.expectedDate && (
                      <div>
                        <p className="text-slate-500">Expected Date</p>
                        <p className="font-medium">
                          {new Date(po.expectedDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                    {po.receivedDate && (
                      <div>
                        <p className="text-slate-500">Received Date</p>
                        <p className="font-medium text-green-600">
                          {new Date(po.receivedDate).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-500">Contact</p>
                      <p className="font-medium">{po.supplier.phone}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/purchase-orders/${po.id}`}>View Details</Link>
                    </Button>
                    {po.status === 'PENDING' || po.status === 'PARTIAL' ? (
                      <Button size="sm" asChild>
                        <Link href={`/purchase-orders/${po.id}`}>Receive Items</Link>
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
