'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StockComparisonChart } from './stock-comparison-chart'
import { Package, AlertTriangle, ShoppingCart, TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface InventoryManagerDashboardProps {
  stats: {
    pendingPOs: number
    fastMovingFabrics: Array<{
      id: string
      name: string
      currentStock: number
      availableStock: number
      usageRate: number
      daysRemaining: number
      isLowStock: boolean
      needsReorder: boolean
    }>
    stockComparison: Array<{
      name: string
      type: string
      available: number
      committed: number
      total: number
    }>
  }
  generalStats: {
    inventory: {
      totalItems: number
      lowStock: number
      criticalStock: number
      totalValue: number
    }
  }
}

export function InventoryManagerDashboard({ stats, generalStats }: InventoryManagerDashboardProps) {
  const criticalFabrics = stats.fastMovingFabrics.filter((f) => f.daysRemaining < 15)
  const lowStockFabrics = stats.fastMovingFabrics.filter((f) => f.isLowStock)

  return (
    <div className="space-y-6">
      {/* Row 1: Critical Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{generalStats.inventory.lowStock}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Below minimum threshold
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{generalStats.inventory.criticalStock}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Urgent reorder needed
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending POs</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.pendingPOs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting delivery
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{generalStats.inventory.totalItems}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In inventory
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Fast Moving Fabrics - Priority List */}
      <Card>
        <CardHeader>
          <CardTitle>Fast-Moving Fabrics - Reorder Priority</CardTitle>
          <CardDescription>
            Fabrics with high usage and low stock, sorted by days remaining
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.fastMovingFabrics.slice(0, 10).map((fabric) => {
              const urgencyColor =
                fabric.daysRemaining < 7
                  ? 'bg-red-50 border-red-200'
                  : fabric.daysRemaining < 15
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-blue-50 border-blue-200'

              const textColor =
                fabric.daysRemaining < 7
                  ? 'text-red-900'
                  : fabric.daysRemaining < 15
                  ? 'text-amber-900'
                  : 'text-blue-900'

              return (
                <Link
                  key={fabric.id}
                  href={`/inventory?search=${fabric.name}`}
                  className={`block p-4 rounded-lg border-2 ${urgencyColor} ${textColor} hover:shadow-md transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1">{fabric.name}</div>
                      <div className="flex items-center gap-4 text-xs">
                        <span>
                          Available: <span className="font-medium">{fabric.availableStock.toFixed(2)}m</span>
                        </span>
                        <span>
                          Usage: <span className="font-medium">{fabric.usageRate.toFixed(2)}m/month</span>
                        </span>
                        {fabric.isLowStock && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-2xl font-bold">
                        {fabric.daysRemaining > 999 ? '∞' : fabric.daysRemaining}
                      </div>
                      <div className="text-xs opacity-75">
                        {fabric.daysRemaining > 999 ? 'No usage' : 'days left'}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}

            {stats.fastMovingFabrics.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No fabric usage data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Stock Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Available vs Committed Stock</CardTitle>
          <CardDescription>
            Top 10 fabrics showing available stock vs fabric reserved for orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.stockComparison.length > 0 ? (
            <StockComparisonChart data={stats.stockComparison} />
          ) : (
            <div className="h-[350px] flex items-center justify-center text-slate-500">
              <p>No stock data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical Alert Section */}
      {criticalFabrics.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Stock Alert - Less than 15 Days Remaining
            </CardTitle>
            <CardDescription className="text-red-700">
              Create purchase orders immediately for these fabrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {criticalFabrics.map((fabric) => (
                <div
                  key={fabric.id}
                  className="p-3 bg-white rounded-lg border border-red-200"
                >
                  <div className="font-semibold text-sm text-red-900">{fabric.name}</div>
                  <div className="text-xs text-red-700 mt-1">
                    Only <span className="font-bold">{fabric.daysRemaining} days</span> of stock remaining
                  </div>
                  <div className="text-xs text-red-600 mt-1">
                    Available: {fabric.availableStock.toFixed(2)}m | Usage: {fabric.usageRate.toFixed(2)}m/mo
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
