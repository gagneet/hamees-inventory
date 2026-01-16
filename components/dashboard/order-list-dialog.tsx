'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'

interface Order {
  id: string
  orderNumber: string
  deliveryDate: string | Date
  status: string
  totalAmount: number
  customer: {
    name: string
  }
  items: Array<{
    garmentPattern: {
      name: string
    }
  }>
}

interface OrderListDialogProps {
  title: string
  description: string
  orders: Order[]
  trigger: React.ReactNode
  emptyMessage?: string
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  MATERIAL_SELECTED: 'bg-purple-100 text-purple-800',
  CUTTING: 'bg-yellow-100 text-yellow-800',
  STITCHING: 'bg-orange-100 text-orange-800',
  FINISHING: 'bg-pink-100 text-pink-800',
  READY: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  NEW: 'New',
  MATERIAL_SELECTED: 'Material Selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready for Pickup',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export function OrderListDialog({
  title,
  description,
  orders,
  trigger,
  emptyMessage = 'No orders found',
}: OrderListDialogProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleOrderClick = (orderId: string) => {
    setOpen(false)
    router.push(`/orders/${orderId}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const itemCount = order.items.length
              const garmentNames = order.items
                .map((item) => item.garmentPattern.name)
                .join(', ')

              return (
                <div
                  key={order.id}
                  onClick={() => handleOrderClick(order.id)}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="font-medium text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOrderClick(order.id)
                        }}
                      >
                        {order.orderNumber}
                      </span>
                      <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>

                    <div className="text-sm text-slate-600 space-y-1">
                      <p>
                        <span className="font-medium">Customer:</span> {order.customer.name}
                      </p>
                      <p>
                        <span className="font-medium">Items:</span> {itemCount} item
                        {itemCount > 1 ? 's' : ''} ({garmentNames})
                      </p>
                      <p>
                        <span className="font-medium">Delivery Date:</span>{' '}
                        {format(new Date(order.deliveryDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
