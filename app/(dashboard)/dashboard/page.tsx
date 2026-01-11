import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Package,
  Users,
  AlertCircle,
  ShoppingBag,
  Scissors,
  TrendingUp,
  IndianRupee,
  BoxIcon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/components/logout-button'
import { KPICard } from '@/components/dashboard/kpi-card'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { OrdersStatusChart } from '@/components/dashboard/orders-status-chart'
import { TopFabricsChart } from '@/components/dashboard/top-fabrics-chart'
import { prisma } from '@/lib/db'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

async function getDashboardStats() {
  try {
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const lastMonthStart = startOfMonth(subMonths(now, 1))
    const lastMonthEnd = endOfMonth(subMonths(now, 1))

    // Inventory Stats
    const clothInventory = await prisma.clothInventory.findMany({
      select: {
        currentStock: true,
        reserved: true,
        minimum: true,
        pricePerMeter: true,
      },
    })

    const lowStockItems = clothInventory.filter(
      (item) => item.currentStock - item.reserved < item.minimum
    ).length

    const criticalStockItems = clothInventory.filter(
      (item) => item.currentStock - item.reserved < item.minimum * 0.5
    ).length

    const totalInventoryWorth = clothInventory.reduce(
      (sum, item) => sum + item.currentStock * item.pricePerMeter,
      0
    )

    // Order Stats
    const pendingOrders = await prisma.order.count({
      where: {
        status: {
          in: ['NEW', 'MATERIAL_SELECTED', 'CUTTING', 'STITCHING', 'FINISHING'],
        },
      },
    })

    const ordersThisMonth = await prisma.order.count({
      where: {
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    })

    const ordersLastMonth = await prisma.order.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    })

    const ordersGrowth =
      ordersLastMonth > 0
        ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100
        : ordersThisMonth > 0
        ? 100
        : 0

    // Revenue Stats
    const revenueThisMonth = await prisma.order.aggregate({
      where: {
        status: 'DELIVERED',
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      _sum: {
        totalAmount: true,
      },
    })

    const revenueLastMonth = await prisma.order.aggregate({
      where: {
        status: 'DELIVERED',
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
      _sum: {
        totalAmount: true,
      },
    })

    const thisMonthRevenue = revenueThisMonth._sum.totalAmount || 0
    const lastMonthRevenue = revenueLastMonth._sum.totalAmount || 0
    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : thisMonthRevenue > 0
        ? 100
        : 0

    // Revenue by month for chart
    const monthlyRevenue = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(subMonths(now, i))

      const revenue = await prisma.order.aggregate({
        where: {
          status: 'DELIVERED',
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          totalAmount: true,
        },
      })

      monthlyRevenue.push({
        month: format(monthStart, 'MMM yyyy'),
        revenue: revenue._sum.totalAmount || 0,
      })
    }

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    const statusData = ordersByStatus.map((item) => ({
      status: item.status,
      count: item._count.status,
    }))

    // Top fabrics
    const topFabrics = await prisma.orderItem.groupBy({
      by: ['clothInventoryId'],
      _sum: {
        actualMetersUsed: true,
      },
      orderBy: {
        _sum: {
          actualMetersUsed: 'desc',
        },
      },
      take: 5,
    })

    const topFabricsWithDetails = await Promise.all(
      topFabrics
        .filter((item) => item.clothInventoryId)
        .map(async (item) => {
          const cloth = await prisma.clothInventory.findUnique({
            where: { id: item.clothInventoryId! },
            select: { name: true, type: true },
          })
          return {
            name: cloth?.name || 'Unknown',
            type: cloth?.type || 'Unknown',
            metersUsed: item._sum.actualMetersUsed || 0,
          }
        })
    )

    // Recent alerts
    const recentAlerts = await prisma.alert.findMany({
      where: {
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    })

    return {
      inventory: {
        totalItems: clothInventory.length,
        lowStock: lowStockItems,
        criticalStock: criticalStockItems,
        totalValue: totalInventoryWorth,
        totalMeters: clothInventory.reduce((sum, item) => sum + item.currentStock, 0),
      },
      orders: {
        pending: pendingOrders,
        thisMonth: ordersThisMonth,
        lastMonth: ordersLastMonth,
        growth: ordersGrowth,
      },
      revenue: {
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
        growth: revenueGrowth,
        byMonth: monthlyRevenue,
      },
      charts: {
        ordersByStatus: statusData,
        topFabrics: topFabricsWithDetails,
      },
      alerts: {
        unread: recentAlerts.length,
        recent: recentAlerts,
      },
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return null
  }
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const stats = await getDashboardStats()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scissors className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Hamees Inventory</h1>
                <p className="text-sm text-slate-600">Tailor Shop Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{session.user.name}</p>
                <p className="text-xs text-slate-500">{session.user.role}</p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h2>
          <p className="text-slate-600">Welcome back, {session.user.name}!</p>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <KPICard
              title="Total Revenue (This Month)"
              value={formatCurrency(stats.revenue.thisMonth)}
              change={stats.revenue.growth}
              icon={IndianRupee}
              iconColor="text-green-600"
              trend={stats.revenue.growth >= 0 ? 'up' : 'down'}
            />
            <KPICard
              title="Orders This Month"
              value={stats.orders.thisMonth}
              change={stats.orders.growth}
              icon={ShoppingBag}
              iconColor="text-blue-600"
              trend={stats.orders.growth >= 0 ? 'up' : 'down'}
            />
            <KPICard
              title="Pending Orders"
              value={stats.orders.pending}
              icon={Package}
              iconColor="text-orange-600"
            />
            <KPICard
              title="Low Stock Items"
              value={stats.inventory.lowStock}
              icon={AlertCircle}
              iconColor={stats.inventory.lowStock > 0 ? 'text-red-600' : 'text-green-600'}
            />
          </div>
        )}

        {!stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link href="/inventory">
                <Button className="w-full" variant="default">
                  <Package className="mr-2 h-4 w-4" />
                  Manage Inventory
                </Button>
              </Link>
              <Button className="w-full" variant="outline" disabled>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Create Order
              </Button>
              <Button className="w-full" variant="outline" disabled>
                <Users className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
              <Button className="w-full" variant="outline" disabled>
                <AlertCircle className="mr-2 h-4 w-4" />
                View Alerts
              </Button>
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
      </main>
    </div>
  )
}
