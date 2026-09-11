'use client'

/**
 * @featuretrace Viewer Dashboard
 * @component ViewerDashboard
 * @description Read-only overview for VIEWER: order counts, pipeline, stock health and alerts.
 *   Deliberately contains no revenue, payment, expense or stock-value figures (the API does not
 *   send them to this role either).
 * @reads generalStats.orders | generalStats.inventory | sales.orderPipeline | sales.readyForPickupList
 *        | orderStatus | alerts — GET /api/dashboard/enhanced-stats
 */

import { AlertTriangle, Bell, CheckCircle2, Package, ShoppingBag } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrdersStatusChart } from './orders-status-chart'
import { ProductionPipelineChart } from './production-pipeline-chart'
import { DeadlineList } from './deadline-list'

interface ViewerDashboardProps {
  generalStats?: {
    orders?: { total: number; pending: number; delivered: number; thisMonth: number; growth: number }
    inventory?: { totalItems: number; lowStock: number; criticalStock: number }
  }
  sales?: {
    orderPipeline?: Array<{ status: string; count: number }>
    readyForPickup?: number
    readyForPickupList?: any[]
  }
  orderStatus?: Array<{ status: string; count: number }>
  alerts?: { unread: number; recent: Array<{ id: string; title?: string; message: string; severity?: string }> }
}

function Stat({ title, value, hint, icon: Icon, tone }: { title: string; value: number | string; hint: string; icon: React.ElementType; tone: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${tone}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function ViewerDashboard({ generalStats, sales, orderStatus, alerts }: ViewerDashboardProps) {
  const orders = generalStats?.orders
  const inventory = generalStats?.inventory

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat
          title="Open orders"
          value={orders?.pending ?? 0}
          hint={`${orders?.total ?? 0} orders in total`}
          icon={ShoppingBag}
          tone="text-blue-600"
        />
        <Stat
          title="Ready for pickup"
          value={sales?.readyForPickup ?? 0}
          hint="Finished garments awaiting delivery"
          icon={CheckCircle2}
          tone="text-green-600"
        />
        <Stat
          title="Orders this month"
          value={orders?.thisMonth ?? 0}
          hint={
            orders && Number.isFinite(orders.growth)
              ? `${orders.growth >= 0 ? '+' : ''}${orders.growth.toFixed(1)}% vs last month`
              : 'Compared with last month'
          }
          icon={ShoppingBag}
          tone="text-slate-700"
        />
        <Stat
          title="Stock alerts"
          value={(inventory?.lowStock ?? 0) + (inventory?.criticalStock ?? 0)}
          hint={`${inventory?.criticalStock ?? 0} critical · ${inventory?.lowStock ?? 0} low of ${inventory?.totalItems ?? 0} fabrics`}
          icon={Package}
          tone={(inventory?.criticalStock ?? 0) > 0 ? 'text-red-600' : 'text-amber-600'}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Production pipeline</CardTitle>
            <CardDescription>Open orders by stage</CardDescription>
          </CardHeader>
          <CardContent>
            {sales?.orderPipeline && sales.orderPipeline.some((p) => p.count > 0) ? (
              <ProductionPipelineChart data={sales.orderPipeline} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">No orders in production</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Orders by status</CardTitle>
            <CardDescription>All orders, including delivered</CardDescription>
          </CardHeader>
          <CardContent>
            {orderStatus && orderStatus.length > 0 ? (
              <OrdersStatusChart data={orderStatus} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">No orders yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ready for pickup</CardTitle>
            <CardDescription>Orders finished and awaiting the customer</CardDescription>
          </CardHeader>
          <CardContent>
            {sales?.readyForPickupList && sales.readyForPickupList.length > 0 ? (
              <DeadlineList orders={sales.readyForPickupList.slice(0, 8)} />
            ) : (
              <p className="text-sm text-slate-500 py-6 text-center">Nothing waiting for pickup</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Alerts
            </CardTitle>
            <CardDescription>{alerts?.unread ?? 0} unread</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(alerts?.recent ?? []).length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No unread alerts</p>}
            {(alerts?.recent ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'}`} />
                <div>
                  {a.title && <p className="font-medium text-slate-900">{a.title}</p>}
                  <p className="text-slate-600">{a.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
