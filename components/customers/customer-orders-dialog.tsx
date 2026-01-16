'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, ShoppingBag, Calendar, DollarSign } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  deliveryDate: Date
  createdAt: Date
  _count: {
    items: number
  }
}

interface CustomerOrdersDialogProps {
  customerName: string
  orders: Order[]
  type: 'delivered' | 'inprogress'
  trigger: React.ReactNode
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  MATERIAL_SELECTED: 'bg-purple-100 text-purple-800',
  CUTTING: 'bg-yellow-100 text-yellow-800',
  STITCHING: 'bg-orange-100 text-orange-800',
  FINISHING: 'bg-indigo-100 text-indigo-800',
  READY: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-slate-100 text-slate-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  MATERIAL_SELECTED: 'Material Selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function CustomerOrdersDialog({
  customerName,
  orders,
  type,
  trigger,
}: CustomerOrdersDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Filter orders based on type
  const filteredOrders = orders.filter(order => {
    if (type === 'delivered') {
      return order.status === 'DELIVERED'
    } else {
      return order.status !== 'DELIVERED' && order.status !== 'CANCELLED'
    }
  })

  const handleOrderClick = (orderId: string) => {
    setOpen(false)
    router.push(`/orders/${orderId}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === 'delivered' ? 'Delivered Orders' : 'Orders In Progress'}
          </DialogTitle>
          <DialogDescription>
            {type === 'delivered'
              ? `Showing all delivered orders for ${customerName}`
              : `Showing all active orders for ${customerName}`
            }
          </DialogDescription>
        </DialogHeader>

        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">
              {type === 'delivered'
                ? 'No delivered orders yet'
                : 'No orders in progress'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleOrderClick(order.id)}
                className="border rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{order.orderNumber}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={STATUS_COLORS[order.status] || 'bg-slate-100'}>
                          {STATUS_LABELS[order.status] || order.status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {order._count.items} {order._count.items === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(order.totalAmount)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="h-4 w-4" />
                    <div>
                      <div className="text-xs text-slate-500">Delivery Date</div>
                      <div className="font-medium">
                        {new Date(order.deliveryDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Package className="h-4 w-4" />
                    <div>
                      <div className="text-xs text-slate-500">Order Date</div>
                      <div className="font-medium">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
