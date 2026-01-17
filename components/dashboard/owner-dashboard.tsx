'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FinancialTrendChart } from './financial-trend-chart'
import { GaugeChart } from './gauge-chart'
import { CustomerRetentionChart } from './customer-retention-chart'
import { OrdersStatusChart } from './orders-status-chart'
import { InventorySummary } from './inventory-summary'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Clock, Users, Package, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface OwnerDashboardProps {
  stats: {
    expensesThisMonth: number
    expensesLastMonth: number
    financialTrend: Array<{
      month: string
      revenue: number
      expenses: number
      profit: number
    }>
    outstandingPayments: number
    revenueByFabric: Array<{
      name: string
      type: string
      revenue: number
    }>
    avgFulfillmentTime: number
    customerRetention: {
      new: number
      returning: number
      retentionRate: number
    }
    stockTurnoverRatio: number
  }
  generalStats: {
    revenue: {
      thisMonth: number
      lastMonth: number
      growth: number
    }
    orders: {
      total: number
      delivered: number
    }
    inventory: {
      totalItems: number
      lowStock: number
      criticalStock: number
      totalValue: number
      totalMeters: number
    }
  }
  alerts?: {
    unread: number
    recent: Array<{
      id: string
      type: string
      severity: string
      title: string
      message: string
      createdAt: string
    }>
  }
  orderStatus?: Array<{
    status: string
    count: number
  }>
}

const FABRIC_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#84CC16', '#F97316', '#A855F7']

export function OwnerDashboard({ stats, generalStats, alerts, orderStatus }: OwnerDashboardProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'revenue' | 'expenses' | 'profit' | 'outstanding' | null>(null)

  const currentMonthProfit = stats.financialTrend[stats.financialTrend.length - 1]?.profit || 0
  const netRevenue = generalStats.revenue.thisMonth - stats.expensesThisMonth

  const expenseGrowth =
    stats.expensesLastMonth > 0
      ? ((stats.expensesThisMonth - stats.expensesLastMonth) / stats.expensesLastMonth) * 100
      : 0

  const openDialog = (type: 'revenue' | 'expenses' | 'profit' | 'outstanding') => {
    setDialogType(type)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Financial Pulse */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openDialog('revenue')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue (This Month)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(generalStats.revenue.thisMonth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {generalStats.revenue.growth >= 0 ? '+' : ''}
              {generalStats.revenue.growth.toFixed(2)}% from last month
            </p>
            <p className="text-xs text-blue-600 font-medium mt-2">Click for details →</p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openDialog('expenses')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses (This Month)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.expensesThisMonth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenseGrowth >= 0 ? '+' : ''}
              {expenseGrowth.toFixed(2)}% from last month
            </p>
            <p className="text-xs text-blue-600 font-medium mt-2">Click for breakdown →</p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openDialog('profit')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit (This Month)</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netRevenue >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(netRevenue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue minus expenses
            </p>
            <p className="text-xs text-blue-600 font-medium mt-2">Click for analysis →</p>
          </CardContent>
        </Card>

        <Card
          className="border-l-4 border-l-amber-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openDialog('outstanding')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(stats.outstandingPayments)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Balance due from customers
            </p>
            <p className="text-xs text-blue-600 font-medium mt-2">Click for details →</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      {alerts && alerts.unread > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <CardTitle>Recent Alerts</CardTitle>
              </div>
              <Link
                href="/alerts"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All ({alerts.unread})
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.recent.slice(0, 3).map((alert) => (
                <Link
                  key={alert.id}
                  href={`/alerts/${alert.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <AlertCircle
                    className={`h-5 w-5 mt-0.5 ${
                      alert.severity === 'CRITICAL'
                        ? 'text-red-600'
                        : alert.severity === 'HIGH'
                        ? 'text-orange-600'
                        : alert.severity === 'MEDIUM'
                        ? 'text-amber-600'
                        : 'text-blue-600'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900">{alert.title}</p>
                    <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(alert.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 2: Inventory Summary & Order Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <InventorySummary stats={generalStats.inventory} />
        {orderStatus && <OrdersStatusChart data={orderStatus} />}
      </div>

      {/* Row 3: Revenue vs Expenses Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses Trend (Last 6 Months)</CardTitle>
          <CardDescription>
            Track financial health and profitability over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.financialTrend.length > 0 ? (
            <FinancialTrendChart data={stats.financialTrend} />
          ) : (
            <div className="h-[350px] flex items-center justify-center text-slate-500">
              <p>No financial data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 4: Key Metrics & Customer Retention */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Average Fulfillment Time */}
        <Card>
          <CardHeader>
            <CardTitle>Average Fulfillment Time</CardTitle>
            <CardDescription>
              Days from order creation to delivery completion (last 100 delivered orders).
              <br />
              <span className="text-green-600 font-semibold">Green (&lt;15 days)</span>: Excellent performance |{' '}
              <span className="text-yellow-600 font-semibold">Yellow (15-22 days)</span>: Needs improvement |{' '}
              <span className="text-red-600 font-semibold">Red (&gt;22 days)</span>: Critical delay
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-4">
            <GaugeChart
              value={stats.avgFulfillmentTime}
              max={30}
              label="Fulfillment Time"
              unit="days"
              goodThreshold={0.5}
              warningThreshold={0.75}
            />
          </CardContent>
        </Card>

        {/* Customer Retention */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Retention</CardTitle>
            <CardDescription>
              New vs returning customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerRetentionChart
              newCustomers={stats.customerRetention.new}
              returningCustomers={stats.customerRetention.returning}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Revenue by Fabric & Stock Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue by Fabric */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue by Fabric Type</CardTitle>
                <CardDescription>
                  Top 10 fabrics by revenue generated (delivered orders)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats.revenueByFabric.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.revenueByFabric}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${(entry.name || '').substring(0, 15)}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="revenue"
                      onClick={(data: any) => {
                        if (data && data.id) {
                          router.push(`/orders?fabricId=${data.id}`)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {stats.revenueByFabric.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={FABRIC_COLORS[index % FABRIC_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => formatCurrency(value || 0)}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-center text-slate-500 mt-2">
                  Click on any fabric to view orders using that fabric
                </p>
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                <p>No revenue data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock & Business Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Business Metrics</CardTitle>
            <CardDescription>
              Key performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => router.push('/inventory')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Package className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Inventory Value</p>
                  <p className="text-xs text-slate-500">Total stock worth</p>
                </div>
              </div>
              <div className="text-xl font-bold text-green-700">
                {formatCurrency(generalStats.inventory.totalValue)}
              </div>
            </div>

            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => router.push('/inventory')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Stock Turnover</p>
                  <p className="text-xs text-slate-500">Last 30 days</p>
                </div>
              </div>
              <div className="text-xl font-bold text-blue-700">
                {stats.stockTurnoverRatio.toFixed(2)}%
              </div>
            </div>

            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => router.push('/orders')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Total Orders</p>
                  <p className="text-xs text-slate-500">All time</p>
                </div>
              </div>
              <div className="text-xl font-bold text-purple-700">
                {generalStats.orders.total}
              </div>
            </div>

            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => router.push('/orders?status=DELIVERED')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Fulfillment Rate</p>
                  <p className="text-xs text-slate-500">Completed orders</p>
                </div>
              </div>
              <div className="text-xl font-bold text-amber-700">
                {generalStats.orders.total > 0
                  ? ((generalStats.orders.delivered / generalStats.orders.total) * 100).toFixed(2)
                  : 0}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'revenue' && 'Revenue Details (This Month)'}
              {dialogType === 'expenses' && 'Expenses Breakdown (This Month)'}
              {dialogType === 'profit' && 'Net Profit Analysis (This Month)'}
              {dialogType === 'outstanding' && 'Outstanding Payments Details'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'revenue' && 'Revenue from delivered orders'}
              {dialogType === 'expenses' && 'All expenses including purchase orders and operational costs'}
              {dialogType === 'profit' && 'Revenue minus all expenses'}
              {dialogType === 'outstanding' && 'Pending payments from customers'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogType === 'revenue' && (
              <div>
                <div className="p-4 bg-green-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(generalStats.revenue.thisMonth)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Total Revenue from Delivered Orders</p>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  This includes all orders that were completed and delivered this month.
                </p>
                <div className="flex justify-end gap-2">
                  <Link href="/orders?status=DELIVERED">
                    <Button variant="default">
                      View Delivered Orders
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {dialogType === 'expenses' && (
              <div>
                <div className="p-4 bg-red-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(stats.expensesThisMonth)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Total Expenses (Operational + Purchase Orders)</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Expenses include:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Operational expenses (rent, utilities, salaries, etc.)</li>
                    <li>Purchase order payments for inventory</li>
                    <li>Transport, marketing, and maintenance costs</li>
                    <li>Professional fees and insurance</li>
                  </ul>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Link href="/expenses">
                    <Button variant="default">
                      View Expenses Details
                    </Button>
                  </Link>
                  <Link href="/purchase-orders">
                    <Button variant="outline">
                      View Purchase Orders
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {dialogType === 'profit' && (
              <div>
                <div className={`p-4 rounded-lg mb-4 ${netRevenue >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                  <p className={`text-2xl font-bold ${netRevenue >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(netRevenue)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Net Profit = Revenue - Expenses</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                    <span className="text-sm font-medium text-slate-700">Revenue</span>
                    <span className="text-sm font-bold text-green-600">
                      {formatCurrency(generalStats.revenue.thisMonth)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                    <span className="text-sm font-medium text-slate-700">Expenses</span>
                    <span className="text-sm font-bold text-red-600">
                      - {formatCurrency(stats.expensesThisMonth)}
                    </span>
                  </div>
                  <div className="border-t-2 border-slate-300 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-slate-900">Net Profit</span>
                      <span className={`text-lg font-bold ${netRevenue >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(netRevenue)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {dialogType === 'outstanding' && (
              <div>
                <div className="p-4 bg-amber-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-amber-600">
                    {formatCurrency(stats.outstandingPayments)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Total Outstanding from Customers</p>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  This represents the balance due from customers for orders that have not been fully paid.
                </p>
                <div className="flex justify-end gap-2">
                  <Link href="/orders?balanceAmount=gt:0">
                    <Button variant="default">
                      View Orders with Balance
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
