'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BoxIcon, AlertCircle, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface InventoryStats {
  totalItems: number
  lowStock: number
  criticalStock: number
  totalValue: number
  totalMeters: number
}

interface LowStockItem {
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

interface InventorySummaryProps {
  stats: InventoryStats
}

export function InventorySummary({ stats }: InventorySummaryProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [stockType, setStockType] = useState<'low' | 'critical'>('low')
  const [items, setItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStockDetails = async (type: 'low' | 'critical') => {
    setStockType(type)
    setLoading(true)
    setDialogOpen(true)

    try {
      const response = await fetch(`/api/inventory/low-stock?type=${type}`)
      const data = await response.json()
      setItems(data.items || [])
    } catch (error) {
      console.error('Error fetching stock details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStockStatusColor = (item: LowStockItem) => {
    const availableRatio = item.available / item.minimum
    if (availableRatio < 0.5) return 'text-red-600'
    if (availableRatio < 1) return 'text-yellow-600'
    return 'text-slate-600'
  }

  const getStockStatusBg = (item: LowStockItem) => {
    const availableRatio = item.available / item.minimum
    if (availableRatio < 0.5) return 'bg-red-50 border-red-200'
    if (availableRatio < 1) return 'bg-yellow-50 border-yellow-200'
    return 'bg-slate-50 border-slate-200'
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-3">
            <BoxIcon className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-slate-600">Total Inventory Value</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(stats.totalValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm font-medium text-slate-600">Total Items</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalItems}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm font-medium text-slate-600">Total Meters</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalMeters.toFixed(2)}m</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => fetchStockDetails('low')}
            className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer text-left"
            disabled={stats.lowStock === 0}
          >
            <p className="text-sm font-medium text-yellow-800">Low Stock</p>
            <p className="text-xl font-bold text-yellow-900">{stats.lowStock}</p>
            {stats.lowStock > 0 && (
              <p className="text-xs text-yellow-700 mt-1">Click to view details</p>
            )}
          </button>
          <button
            onClick={() => fetchStockDetails('critical')}
            className="p-4 bg-red-50 rounded-lg border border-red-200 hover:bg-red-100 transition-colors cursor-pointer text-left"
            disabled={stats.criticalStock === 0}
          >
            <p className="text-sm font-medium text-red-800">Critical Stock</p>
            <p className="text-xl font-bold text-red-900">{stats.criticalStock}</p>
            {stats.criticalStock > 0 && (
              <p className="text-xs text-red-700 mt-1">Click to view details</p>
            )}
          </button>
        </div>

        {(stats.lowStock > 0 || stats.criticalStock > 0) && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-900">⚠️ Action Required</p>
            <p className="text-xs text-amber-700 mt-1">
              You have items that need reordering. Check your inventory to avoid stockouts.
            </p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {stockType === 'low' ? 'Low Stock Items' : 'Critical Stock Items'}
            </DialogTitle>
            <DialogDescription>
              {stockType === 'low'
                ? 'Items in warning zone (between minimum and 1.1× minimum). Click any row to view details.'
                : 'Items critically low (below minimum threshold). Click any row to view details.'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">No items found</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 mb-2 px-3 text-xs font-medium text-slate-600">
                <div>Item Details</div>
                <div>Stock Status</div>
                <div>Value</div>
              </div>
              {items.map((item) => (
                <Link
                  key={`${item.category}-${item.id}`}
                  href={`/inventory/${item.category === 'cloth' ? 'cloth' : 'accessories'}/${item.id}`}
                  className={`block p-3 rounded-lg border ${getStockStatusBg(item)} hover:shadow-md transition-all cursor-pointer`}
                >
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <ExternalLink className="h-3 w-3 text-blue-600" />
                      </div>
                      <p className="text-xs text-slate-600">
                        {item.type} • {item.brand}
                        {item.category === 'cloth' && item.color && ` • ${item.color}`}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {item.category === 'cloth' ? 'Cloth' : 'Accessory'}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className={`text-sm font-medium ${getStockStatusColor(item)}`}>
                        Available: {item.available.toFixed(2)} {item.unit}
                      </p>
                      {item.category === 'cloth' && item.reserved > 0 && (
                        <p className="text-xs text-slate-600">
                          Total: {item.currentStock.toFixed(2)} (Reserved: {item.reserved.toFixed(2)})
                        </p>
                      )}
                      {item.category === 'accessory' && (
                        <p className="text-xs text-slate-600">
                          Current: {item.currentStock.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        Minimum: {item.minimum.toFixed(2)} {item.unit}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(item.value)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatCurrency(item.pricePerUnit)}/{item.unit}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Link href="/inventory">
              <Button variant="default">
                Go to Inventory
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
