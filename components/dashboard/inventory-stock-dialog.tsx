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
import { ExternalLink, AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'

interface StockItem {
  id: string
  name: string
  type: string
  category: 'cloth' | 'accessory'
  brand: string
  color: string | null
  currentStock: number
  available: number
  reserved: number
  minimum: number
  unit: string
  pricePerUnit: number
  value: number
}

interface InventoryStockDialogProps {
  type: 'low' | 'critical'
  trigger: React.ReactNode
  title: string
  description: string
}

export function InventoryStockDialog({
  type,
  trigger,
  title,
  description,
}: InventoryStockDialogProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    totalItems: 0,
    clothItems: 0,
    accessoryItems: 0,
  })

  useEffect(() => {
    if (open) {
      fetchStockItems()
    }
  }, [open, type])

  async function fetchStockItems() {
    setLoading(true)
    try {
      const response = await fetch(`/api/inventory/low-stock?type=${type}`)
      const data = await response.json()

      if (response.ok) {
        setItems(data.items || [])
        setStats({
          totalItems: data.totalItems || 0,
          clothItems: data.clothItems || 0,
          accessoryItems: data.accessoryItems || 0,
        })
      }
    } catch (error) {
      console.error('Error fetching stock items:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStockPercentage = (available: number, minimum: number) => {
    return ((available / minimum) * 100).toFixed(0)
  }

  const getStockColor = (available: number, minimum: number) => {
    const percentage = (available / minimum) * 100
    if (percentage <= 50) return 'text-red-600 bg-red-50 border-red-200'
    if (percentage <= 100) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-blue-600 bg-blue-50 border-blue-200'
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'critical' ? (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            ) : (
              <Package className="h-5 w-5 text-amber-600" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-slate-900">
              {stats.totalItems}
            </div>
            <div className="text-xs text-slate-600">Total Items</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-900">
              {stats.clothItems}
            </div>
            <div className="text-xs text-blue-600">Cloth Items</div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-900">
              {stats.accessoryItems}
            </div>
            <div className="text-xs text-green-600">Accessories</div>
          </div>
        </div>

        {/* Items List */}
        {loading ? (
          <div className="py-8 text-center text-slate-500">
            Loading {type} stock items...
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No {type} stock items found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border-2 ${getStockColor(
                  item.available,
                  item.minimum
                )}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm">
                        {item.name}
                        {item.color && (
                          <span className="text-xs ml-1 opacity-75">
                            ({item.color})
                          </span>
                        )}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {item.category === 'cloth' ? 'Cloth' : 'Accessory'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500">Available</div>
                        <div className="font-semibold">
                          {item.available.toFixed(2)} {item.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Minimum</div>
                        <div className="font-semibold">
                          {item.minimum.toFixed(2)} {item.unit}
                        </div>
                      </div>
                      {item.category === 'cloth' && item.reserved > 0 && (
                        <div>
                          <div className="text-slate-500">Reserved</div>
                          <div className="font-semibold">
                            {item.reserved.toFixed(2)} {item.unit}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-slate-500">Stock %</div>
                        <div className="font-semibold">
                          {getStockPercentage(item.available, item.minimum)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-600">
                      {item.brand} • ₹{item.pricePerUnit.toFixed(2)}/{item.unit}{' '}
                      • Value: ₹{item.value.toFixed(2)}
                    </div>
                  </div>

                  <Link
                    href={`/inventory?search=${item.name}`}
                    className="shrink-0"
                  >
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Footer */}
        {items.length > 0 && (
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <div className="text-sm text-slate-600">
              {type === 'critical'
                ? 'Urgent reorder needed for these items'
                : 'Monitor these items closely'}
            </div>
            <Link href="/inventory">
              <Button>
                View All Inventory
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
