import Link from "next/link"
import {
  AlertCircle,
  BoxIcon,
  DollarSign,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import DashboardLayout from "@/components/DashboardLayout"

// Dashboard specific components
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { OrdersStatusChart } from "@/components/dashboard/orders-status-chart"
import { TopFabricsChart } from "@/components/dashboard/top-fabrics-chart"

// Data fetching and session
import { getDashboardStats } from "@/lib/data"
import { auth } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { formatCurrency } from "@/lib/utils"
import type { UserRole } from "@/lib/types"

export default async function Dashboard() {
  const session = await auth()
  if (!session?.user) {
    return <div>Not authenticated</div>
  }

  const stats = await getDashboardStats()

  return (
    <DashboardLayout>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
      </div>

      {/* Loading State */}
      {!stats && (
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inventory</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend (Last 6 Months)</CardTitle>
              <CardDescription>Monthly revenue from delivered orders</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart data={stats.revenue.byMonth} />
            </CardContent>
          </Card>

          {/* Orders by Status */}
          <Card>
            <CardHeader>
              <CardTitle>Orders by Status</CardTitle>
              <CardDescription>Current distribution of order statuses</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.charts.ordersByStatus.length > 0 ? (
                <OrdersStatusChart data={stats.charts.ordersByStatus} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  <p>No orders yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Fabrics and Additional Stats */}
      {stats && stats.charts.topFabrics.length > 0 && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Most Used Fabrics</CardTitle>
              <CardDescription>Fabrics by total meters used in orders</CardDescription>
            </CardHeader>
            <CardContent>
              <TopFabricsChart data={stats.charts.topFabrics} />
            </CardContent>
          </Card>

          {/* Inventory Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Summary</CardTitle>
              <CardDescription>Overview of your inventory status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BoxIcon className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-600">Total Inventory Value</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(stats.inventory.totalValue)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-600">Total Items</p>
                    <p className="text-xl font-bold text-slate-900">{stats.inventory.totalItems}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-600">Total Meters</p>
                    <p className="text-xl font-bold text-slate-900">{stats.inventory.totalMeters}m</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm font-medium text-yellow-800">Low Stock</p>
                    <p className="text-xl font-bold text-yellow-900">{stats.inventory.lowStock}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-800">Critical Stock</p>
                    <p className="text-xl font-bold text-red-900">{stats.inventory.criticalStock}</p>
                  </div>
                </div>

                {(stats.inventory.lowStock > 0 || stats.inventory.criticalStock > 0) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-900">⚠️ Action Required</p>
                    <p className="text-xs text-amber-700 mt-1">
                      You have items that need reordering. Check your inventory to avoid stockouts.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {hasPermission(session.user.role as UserRole, 'view_inventory') && (
              <Link href="/inventory" className="w-full">
                <Button className="w-full" variant="default">
                  <Package className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Manage </span>Inventory
                </Button>
              </Link>
            )}
            {hasPermission(session.user.role as UserRole, 'view_orders') && (
              <Link href="/orders" className="w-full">
                <Button className="w-full" variant="outline">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">View </span>Orders
                </Button>
              </Link>
            )}
            {hasPermission(session.user.role as UserRole, 'view_customers') && (
              <Link href="/customers" className="w-full">
                <Button className="w-full" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">View </span>Customers
                </Button>
              </Link>
            )}
            {hasPermission(session.user.role as UserRole, 'view_alerts') && (
              <Link href="/alerts" className="w-full">
                <Button className="w-full" variant="outline">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">View </span>Alerts
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      {stats && stats.alerts.recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>Latest system notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.alerts.recent.map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{alert.type}</p>
                    <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  )
}
