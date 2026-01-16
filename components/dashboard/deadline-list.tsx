'use client'

import { differenceInDays, format } from 'date-fns'
import { Calendar, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'

interface Order {
  id: string
  orderNumber: string
  deliveryDate: string | Date
  status: string
  customer: {
    name: string
  }
  items?: Array<{
    garmentPattern: {
      name: string
    }
  }>
}

interface DeadlineListProps {
  orders: Order[]
}

export function DeadlineList({ orders }: DeadlineListProps) {
  const getUrgencyColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return 'bg-red-50 border-red-200 text-red-900'
    if (daysRemaining === 0) return 'bg-orange-50 border-orange-200 text-orange-900'
    if (daysRemaining <= 2) return 'bg-amber-50 border-amber-200 text-amber-900'
    return 'bg-blue-50 border-blue-200 text-blue-900'
  }

  const getIconColor = (daysRemaining: number) => {
    if (daysRemaining < 0) return 'text-red-600'
    if (daysRemaining === 0) return 'text-orange-600'
    if (daysRemaining <= 2) return 'text-amber-600'
    return 'text-blue-600'
  }

  const getUrgencyLabel = (daysRemaining: number) => {
    if (daysRemaining < 0) return `${Math.abs(daysRemaining)} days overdue`
    if (daysRemaining === 0) return 'Due today!'
    if (daysRemaining === 1) return 'Due tomorrow'
    return `${daysRemaining} days remaining`
  }

  return (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No upcoming deadlines</p>
        </div>
      ) : (
        orders.map((order) => {
          const daysRemaining = differenceInDays(new Date(order.deliveryDate), new Date())
          const garments = order.items?.map((item) => item.garmentPattern.name).join(', ') || 'N/A'

          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className={`block p-4 rounded-lg border-2 transition-all hover:shadow-md ${getUrgencyColor(
                daysRemaining
              )}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {daysRemaining < 0 ? (
                      <AlertCircle className={`h-4 w-4 ${getIconColor(daysRemaining)}`} />
                    ) : (
                      <Calendar className={`h-4 w-4 ${getIconColor(daysRemaining)}`} />
                    )}
                    <span className="font-semibold text-sm">{order.orderNumber}</span>
                  </div>

                  <p className="text-sm font-medium mb-1">{order.customer.name}</p>
                  <p className="text-xs opacity-75 mb-2 line-clamp-1">{garments}</p>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(order.deliveryDate), 'MMM dd, yyyy')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full bg-white/50 font-medium`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="ml-4 text-right">
                  <div className="text-xs font-bold">{getUrgencyLabel(daysRemaining)}</div>
                </div>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
