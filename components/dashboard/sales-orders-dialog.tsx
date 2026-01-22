'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Package,
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'

interface OrderItem {
  id: string
  quantity: number
  garmentPattern: {
    name: string
  }
}

interface Order {
  id: string
  orderNumber: string
  orderDate: string | Date
  deliveryDate: string | Date
  status: string
  totalAmount: number
  balanceAmount: number
  customer: {
    id: string
    name: string
    phone: string
    email: string | null
  }
  items: OrderItem[]
}

interface SalesOrdersDialogProps {
  title: string
  description: string
  orders: Order[]
  trigger: React.ReactNode
  emptyMessage?: string
}

export function SalesOrdersDialog({
  title,
  description,
  orders,
  trigger,
  emptyMessage = 'No orders found',
}: SalesOrdersDialogProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-800 border-blue-200',
      MATERIAL_SELECTED: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      CUTTING: 'bg-purple-100 text-purple-800 border-purple-200',
      STITCHING: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      FINISHING: 'bg-violet-100 text-violet-800 border-violet-200',
      READY: 'bg-green-100 text-green-800 border-green-200',
      DELIVERED: 'bg-slate-100 text-slate-800 border-slate-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[status] || 'bg-slate-100 text-slate-800 border-slate-200'
  }

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ')
  }

  const isOverdue = (deliveryDate: string | Date) => {
    return new Date(deliveryDate) < new Date()
  }

  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0)
  const totalBalance = orders.reduce((sum, order) => sum + order.balanceAmount, 0)
  const totalItems = orders.reduce((sum, order) => sum + order.items.length, 0)

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-900">{orders.length}</div>
            <div className="text-xs text-blue-600">Orders</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-900">
              {formatCurrency(totalRevenue)}
            </div>
            <div className="text-xs text-green-600">Total Value</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-900">
              {formatCurrency(totalBalance)}
            </div>
            <div className="text-xs text-amber-600">Balance Due</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-900">{totalItems}</div>
            <div className="text-xs text-purple-600">Total Items</div>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Package className="h-16 w-16 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`p-4 rounded-lg border-2 ${
                  isOverdue(order.deliveryDate) && order.status !== 'DELIVERED'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Section - Order Details */}
                  <div className="flex-1 space-y-2">
                    {/* Order Number and Status */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      {isOverdue(order.deliveryDate) &&
                        order.status !== 'DELIVERED' && (
                          <Badge variant="destructive" className="text-xs">
                            Overdue
                          </Badge>
                        )}
                      {order.balanceAmount > 0 && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          Balance: {formatCurrency(order.balanceAmount)}
                        </Badge>
                      )}
                    </div>

                    {/* Customer Info */}
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <Link
                          href={`/customers/${order.customer.id}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {order.customer.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <a href={`tel:${order.customer.phone}`} className="hover:text-blue-600">
                          {order.customer.phone}
                        </a>
                      </div>
                      {order.customer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <a
                            href={`mailto:${order.customer.email}`}
                            className="hover:text-blue-600"
                          >
                            {order.customer.email}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Dates and Items */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Ordered:</span>
                        <span className="font-medium">
                          {format(new Date(order.orderDate), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Delivery:</span>
                        <span
                          className={`font-medium ${
                            isOverdue(order.deliveryDate) &&
                            order.status !== 'DELIVERED'
                              ? 'text-red-600'
                              : ''
                          }`}
                        >
                          {format(new Date(order.deliveryDate), 'dd MMM yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span className="font-medium">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {order.items.map((item) => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className="text-xs bg-slate-50"
                        >
                          {item.quantity}× {item.garmentPattern.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Right Section - Amount and Action */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-slate-500 text-xs mb-1">
                      <DollarSign className="h-3 w-3" />
                      <span>Total</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 mb-3">
                      {formatCurrency(order.totalAmount)}
                    </div>
                    <Link href={`/orders/${order.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Footer */}
        {orders.length > 0 && (
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <div className="text-sm text-slate-600">
              Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
            </div>
            <Link href="/orders">
              <Button>
                View All Orders
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
