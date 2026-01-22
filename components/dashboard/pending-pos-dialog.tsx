'use client'

import { useState, useEffect } from 'react'
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
import { ExternalLink, ShoppingCart, Calendar, Package } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface POItem {
  id: string
  itemName: string
  itemType: string
  quantity: number
  unit: string
  pricePerUnit: number
  totalPrice: number
}

interface PurchaseOrder {
  id: string
  poNumber: string
  createdAt: string
  expectedDate: string | null
  totalAmount: number
  balanceAmount: number
  status: string
  supplier: {
    id: string
    name: string
    phone: string | null
    email: string | null
  }
  items: POItem[]
}

interface PendingPOsDialogProps {
  trigger: React.ReactNode
}

export function PendingPOsDialog({ trigger }: PendingPOsDialogProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPOs] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalPOs: 0,
    totalValue: 0,
    overdue: 0,
  })

  useEffect(() => {
    if (open) {
      fetchPendingPOs()
    }
  }, [open])

  async function fetchPendingPOs() {
    setLoading(true)
    try {
      const response = await fetch('/api/purchase-orders?status=PENDING')
      const data = await response.json()

      if (response.ok && data.purchaseOrders) {
        const pendingPOs = data.purchaseOrders

        // Calculate stats
        const totalValue = pendingPOs.reduce(
          (sum: number, po: PurchaseOrder) => sum + po.totalAmount,
          0
        )

        const overdue = pendingPOs.filter((po: PurchaseOrder) => {
          if (!po.expectedDate) return false
          return new Date(po.expectedDate) < new Date()
        }).length

        setPOs(pendingPOs)
        setStats({
          totalPOs: pendingPOs.length,
          totalValue,
          overdue,
        })
      }
    } catch (error) {
      console.error('Error fetching pending POs:', error)
    } finally {
      setLoading(false)
    }
  }

  const isOverdue = (expectedDate: string | null) => {
    if (!expectedDate) return false
    return new Date(expectedDate) < new Date()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Pending Purchase Orders
          </DialogTitle>
          <DialogDescription>
            Purchase orders awaiting delivery from suppliers
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-900">
              {stats.totalPOs}
            </div>
            <div className="text-xs text-blue-600">Pending Orders</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-slate-900">
              ₹{stats.totalValue.toFixed(2)}
            </div>
            <div className="text-xs text-slate-600">Total Value</div>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-900">
              {stats.overdue}
            </div>
            <div className="text-xs text-red-600">Overdue</div>
          </div>
        </div>

        {/* POs List */}
        {loading ? (
          <div className="py-8 text-center text-slate-500">
            Loading pending purchase orders...
          </div>
        ) : pos.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No pending purchase orders</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pos.map((po) => (
              <div
                key={po.id}
                className={`p-4 rounded-lg border-2 ${
                  isOverdue(po.expectedDate)
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{po.poNumber}</h3>
                      <Badge variant="outline" className="text-xs">
                        {po.status}
                      </Badge>
                      {isOverdue(po.expectedDate) && (
                        <Badge
                          variant="destructive"
                          className="text-xs bg-red-600"
                        >
                          Overdue
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mb-2">
                      Supplier: {po.supplier.name}
                      {po.supplier.phone && ` • ${po.supplier.phone}`}
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-slate-500">Expected:</span>
                        <span
                          className={
                            isOverdue(po.expectedDate)
                              ? 'font-semibold text-red-600'
                              : 'font-semibold'
                          }
                        >
                          {po.expectedDate
                            ? format(new Date(po.expectedDate), 'dd MMM yyyy')
                            : 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <span className="text-slate-500">Items:</span>
                        <span className="font-semibold">{po.items.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-slate-900">
                      ₹{po.totalAmount.toFixed(2)}
                    </div>
                    <Link href={`/purchase-orders/${po.id}`}>
                      <Button variant="outline" size="sm" className="mt-2">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* PO Items */}
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="text-xs font-medium text-slate-600 mb-2">
                    Items:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {po.items.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs p-2 bg-slate-50 rounded"
                      >
                        <div className="font-medium">{item.itemName}</div>
                        <div className="text-slate-600">
                          {item.quantity} {item.unit} × ₹
                          {item.pricePerUnit.toFixed(2)} = ₹
                          {item.totalPrice.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Footer */}
        {pos.length > 0 && (
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <div className="text-sm text-slate-600">
              {stats.overdue > 0 && (
                <span className="text-red-600 font-medium">
                  {stats.overdue} overdue orders
                </span>
              )}
            </div>
            <Link href="/purchase-orders">
              <Button>
                View All Purchase Orders
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
