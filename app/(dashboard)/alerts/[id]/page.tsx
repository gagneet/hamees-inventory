'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { AlertTriangle, Home, Package, ShoppingCart, X } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { formatCurrency } from '@/lib/utils'

export default function AlertDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [alertId, setAlertId] = useState<string | null>(null)
  const [alert, setAlert] = useState<any>(null)
  const [relatedItem, setRelatedItem] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    params.then((p) => {
      setAlertId(p.id)
    })
  }, [params])

  useEffect(() => {
    if (alertId) {
      fetchAlertData()
    }
  }, [alertId])

  const fetchAlertData = async () => {
    if (!alertId) return

    try {
      const response = await fetch(`/api/alerts/${alertId}`)
      if (!response.ok) {
        router.push('/alerts')
        return
      }
      const data = await response.json()
      setAlert(data.alert)
      setRelatedItem(data.relatedItem)
    } catch (error) {
      console.error('Error fetching alert:', error)
      router.push('/alerts')
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = async () => {
    if (!alertId) return

    setDismissing(true)
    try {
      const response = await fetch(`/api/alerts/${alertId}/dismiss`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss alert')
      }

      router.push('/alerts')
    } catch (error) {
      console.error('Error dismissing alert:', error)
      alert('Failed to dismiss alert')
    } finally {
      setDismissing(false)
    }
  }

  if (loading || !alert) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Loading alert...</p>
        </div>
      </DashboardLayout>
    )
  }

  const severityConfig = {
    LOW: {
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    MEDIUM: {
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
    },
    HIGH: {
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
    },
    CRITICAL: {
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
  }

  const config = severityConfig[alert.severity as keyof typeof severityConfig]

  const isLowStock = alert.type === 'LOW_STOCK' || alert.type === 'CRITICAL_STOCK'

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
            <BreadcrumbLink href="/alerts">Alerts</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Alert Details</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Alert Details</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={dismissing}
          >
            <X className="mr-2 h-4 w-4" />
            {dismissing ? 'Dismissing...' : 'Dismiss for 24h'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/alerts">Back to Alerts</Link>
          </Button>
        </div>
      </div>

      {/* Alert Card */}
      <Card className={`mb-6 border-l-4 ${config.border}`}>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className={`p-3 rounded-full ${config.bg}`}>
              <AlertTriangle className={`h-6 w-6 ${config.color}`} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{alert.title}</CardTitle>
              <CardDescription className="mt-1">
                {alert.type.replace(/_/g, ' ')} - {alert.severity} severity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-slate-700 mb-4">{alert.message}</p>
          <p className="text-sm text-slate-500">
            Created: {new Date(alert.createdAt).toLocaleString('en-IN')}
          </p>
        </CardContent>
      </Card>

      {/* Related Inventory Item */}
      {isLowStock && relatedItem && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Inventory Item Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-slate-500">Item Name</p>
                <p className="text-lg font-semibold">{relatedItem.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Type</p>
                <p className="text-lg">{relatedItem.type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Current Stock</p>
                <p className={`text-lg font-semibold ${
                  relatedItem.currentStock - relatedItem.reserved < relatedItem.minimum
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {relatedItem.currentStock.toFixed(2)}m
                  {relatedItem.reserved > 0 && (
                    <span className="text-sm text-slate-500 ml-2">
                      ({relatedItem.reserved.toFixed(2)}m reserved)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Minimum Required</p>
                <p className="text-lg">{relatedItem.minimum.toFixed(2)}m</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Available Stock</p>
                <p className="text-lg font-semibold">
                  {(relatedItem.currentStock - relatedItem.reserved).toFixed(2)}m
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Price per Meter</p>
                <p className="text-lg">{formatCurrency(relatedItem.pricePerMeter)}</p>
              </div>
              {relatedItem.supplierRel && (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Supplier</p>
                    <p className="text-lg">{relatedItem.supplierRel.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Supplier Contact</p>
                    <p className="text-lg">{relatedItem.supplierRel.phone}</p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {relatedItem.supplierRel && (
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold"
                  asChild
                >
                  <Link
                    href={`/purchase-orders/new?supplierId=${relatedItem.supplierRel.id}&itemId=${relatedItem.id}&itemName=${encodeURIComponent(relatedItem.name)}`}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Create Purchase Order
                  </Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href={`/inventory/cloth/${relatedItem.id}`}>
                  <Package className="mr-2 h-4 w-4" />
                  View Full Details
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLowStock ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Create a Purchase Order</p>
                  <p className="text-sm text-slate-600">
                    Contact your supplier and create a purchase order to restock this item
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Monitor Stock Levels</p>
                  <p className="text-sm text-slate-600">
                    Keep an eye on available stock to avoid running out completely
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">Consider Increasing Minimum Stock</p>
                  <p className="text-sm text-slate-600">
                    If this happens frequently, you may want to increase the minimum stock level
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-600">
              Review the alert details above and take appropriate action.
            </p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
