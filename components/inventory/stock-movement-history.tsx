'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, User, Package, ArrowUp, ArrowDown } from 'lucide-react'

interface StockMovement {
  id: string
  type: string
  quantity: number
  balanceAfter: number
  notes: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
  }
  order: {
    id: string
    orderNumber: string
  } | null
}

interface StockMovementHistoryProps {
  clothId: string
}

export function StockMovementHistory({ clothId }: StockMovementHistoryProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [clothName, setClothName] = useState('')

  useEffect(() => {
    fetch(`/api/inventory/cloth/${clothId}/history`)
      .then((res) => res.json())
      .then((data) => {
        setMovements(data.movements || [])
        setClothName(data.cloth?.name || 'Unknown Item')
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error fetching history:', error)
        setLoading(false)
      })
  }, [clothId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Loading history...</div>
      </div>
    )
  }

  if (movements.length === 0) {
    return (
      <div className="text-center p-8">
        <Package className="h-12 w-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500">No stock movement history yet</p>
      </div>
    )
  }

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'ORDER_RESERVED':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ORDER_USED':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'ORDER_CANCELLED':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'ADJUSTMENT':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200'
      case 'RETURN':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'WASTAGE':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Stock Movement History
        </h3>
        <Badge variant="outline" className="text-slate-600">
          {movements.length} movements
        </Badge>
      </div>

      <div className="space-y-3">
        {movements.map((movement) => (
          <Card key={movement.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-4">
              {/* Left section: Movement details */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${getMovementTypeColor(movement.type)} font-semibold`}
                  >
                    {movement.type.replace('_', ' ')}
                  </Badge>
                  {movement.order && (
                    <Badge variant="outline" className="text-xs">
                      Order: {movement.order.orderNumber}
                    </Badge>
                  )}
                </div>

                {movement.notes && (
                  <p className="text-sm text-slate-700">{movement.notes}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(movement.createdAt), 'PPpp')}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {movement.user.name}
                  </div>
                </div>
              </div>

              {/* Right section: Quantity and balance */}
              <div className="text-right space-y-1">
                <div
                  className={`flex items-center gap-1 text-lg font-bold ${
                    movement.quantity >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {movement.quantity >= 0 ? (
                    <ArrowUp className="h-5 w-5" />
                  ) : (
                    <ArrowDown className="h-5 w-5" />
                  )}
                  {movement.quantity >= 0 ? '+' : ''}
                  {movement.quantity.toFixed(2)}m
                </div>
                <div className="text-sm text-slate-500">
                  Balance: <span className="font-semibold">{movement.balanceAfter.toFixed(2)}m</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
