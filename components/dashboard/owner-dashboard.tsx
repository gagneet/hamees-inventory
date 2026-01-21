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
    cashCollectedThisMonth: number
    cashCollectedLastMonth: number
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

export function OwnerDashboard({ stats, generalStats, alerts, orderStatus }: OwnerDashboardProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'revenue' | 'cash' | 'expenses' | 'profit' | 'outstanding' | 'stockTurnover' | 'fulfillmentRate' | null>(null)

  // Calculate total revenue for percentage calculation
  const totalFabricRevenue = stats.revenueByFabric.reduce((sum, item) => sum + (item.revenue || 0), 0)

  // Custom label renderer with dark background for visibility on light colors
  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, fill, payload } = props
    const RADIAN = Math.PI / 180
    const radius = outerRadius + 25
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    const percentage = ((payload.revenue / totalFabricRevenue) * 100).toFixed(1)
    const amount = formatCurrency(payload.revenue)

    return (
      <g>
        <rect
          x={x - 50}
          y={y - 18}
          width={100}
          height={36}
          fill="rgba(0, 0, 0, 0.75)"
          rx={4}
          ry={4}
        />
        <text
          x={x}
          y={y - 4}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight="600"
        >
          {amount}
        </text>
        <text
          x={x}
          y={y + 10}
          fill="#fff"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight="500"
        >
          ({percentage}%)
        </text>
      </g>
    )
  }

  const currentMonthProfit = stats.financialTrend[stats.financialTrend.length - 1]?.profit || 0
  const netRevenue = generalStats.revenue.thisMonth - stats.expensesThisMonth

  const expenseGrowth =
    stats.expensesLastMonth > 0
      ? ((stats.expensesThisMonth - stats.expensesLastMonth) / stats.expensesLastMonth) * 100
      : 0

  const cashGrowth =
    stats.cashCollectedLastMonth > 0
      ? ((stats.cashCollectedThisMonth - stats.cashCollectedLastMonth) / stats.cashCollectedLastMonth) * 100
      : stats.cashCollectedThisMonth > 0 ? 100 : 0

  const openDialog = (type: 'revenue' | 'cash' | 'expenses' | 'profit' | 'outstanding' | 'stockTurnover' | 'fulfillmentRate') => {
    setDialogType(type)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Financial Pulse */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
          className="border-l-4 border-l-cyan-500 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => openDialog('cash')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {formatCurrency(stats.cashCollectedThisMonth)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {cashGrowth >= 0 ? '+' : ''}
              {cashGrowth.toFixed(2)}% from last month
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
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={stats.revenueByFabric}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={renderCustomLabel}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="revenue"
                      onClick={(data: any) => {
                        if (data && data.id) {
                          router.push(`/orders?fabricId=${data.id}`)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {stats.revenueByFabric.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.colorHex || '#94a3b8'}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined, name: string | undefined, props: any) => {
                        const percentage = ((value || 0) / totalFabricRevenue * 100).toFixed(1)
                        return [`${formatCurrency(value || 0)} (${percentage}%)`, props.payload.name]
                      }}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '12px',
                      }}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }}
                      formatter={(value: string, entry: any) => {
                        const payload = entry.payload as any
                        return `${payload.name} (${payload.color})`
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-center text-slate-500 mt-2">
                  Click on any fabric slice to view orders using that fabric
                </p>
              </>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-slate-500">
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
              onClick={() => openDialog('stockTurnover')}
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
              onClick={() => openDialog('fulfillmentRate')}
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
              {dialogType === 'cash' && 'Cash Collected (This Month)'}
              {dialogType === 'expenses' && 'Expenses Breakdown (This Month)'}
              {dialogType === 'profit' && 'Net Profit Analysis (This Month)'}
              {dialogType === 'outstanding' && 'Outstanding Payments Details'}
              {dialogType === 'stockTurnover' && 'Stock Turnover Analysis'}
              {dialogType === 'fulfillmentRate' && 'Fulfillment Rate Breakdown'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'revenue' && 'Revenue from delivered orders (accrual basis)'}
              {dialogType === 'cash' && 'Actual cash received from customer payments (cash basis)'}
              {dialogType === 'expenses' && 'All expenses including purchase orders and operational costs'}
              {dialogType === 'profit' && 'Revenue minus all expenses'}
              {dialogType === 'outstanding' && 'Pending payments from customers'}
              {dialogType === 'stockTurnover' && 'Fabric usage efficiency over last 30 days'}
              {dialogType === 'fulfillmentRate' && 'Order completion and delivery performance'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogType === 'revenue' && (
              <div>
                <div className="p-4 bg-green-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(generalStats.revenue.thisMonth)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Total Revenue from Delivered Orders (Accrual Basis)</p>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  This includes the full order value for all orders that were completed and delivered this month,
                  regardless of whether payment was received.
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

            {dialogType === 'cash' && (
              <div>
                <div className="p-4 bg-cyan-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-cyan-600">
                    {formatCurrency(stats.cashCollectedThisMonth)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Actual Cash Received from Payments (Cash Basis)</p>
                </div>
                <div className="space-y-3 mb-4">
                  <p className="text-sm text-slate-600">
                    This shows the actual cash received this month from customer payments, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                    <li>Advance payments on new orders</li>
                    <li>Balance payments on completed orders</li>
                    <li>Installment payments received this month</li>
                  </ul>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm font-medium text-blue-900">💡 Difference from Revenue</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Revenue ({formatCurrency(generalStats.revenue.thisMonth)}) shows order value when delivered.
                      Cash Collected ({formatCurrency(stats.cashCollectedThisMonth)}) shows actual money received.
                      {stats.outstandingPayments > 0 && ` Outstanding balance: ${formatCurrency(stats.outstandingPayments)}`}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Link href="/orders?balanceAmount=gt:0">
                    <Button variant="outline">
                      View Orders with Balance
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

            {dialogType === 'stockTurnover' && (
              <div>
                <div className="p-4 bg-blue-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.stockTurnoverRatio.toFixed(2)}%
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Stock Turnover Ratio (Last 30 Days)</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">What is Stock Turnover?</h4>
                    <p className="text-sm text-slate-600">
                      Stock turnover ratio measures how efficiently you're using your fabric inventory.
                      It shows the percentage of your total stock that was used in orders over the last 30 days.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border">
                    <p className="text-xs font-medium text-slate-700 mb-2">Calculation Formula:</p>
                    <p className="text-sm text-slate-900 font-mono">
                      (Fabric Used in Last 30 Days ÷ Total Current Stock) × 100
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Performance Indicators:</h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 mt-1"></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">High (≥15%)</p>
                          <p className="text-xs text-slate-600">Excellent - Inventory is moving quickly, minimal waste</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mt-1"></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Moderate (8-15%)</p>
                          <p className="text-xs text-slate-600">Good - Healthy turnover rate</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 mt-1"></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Low (&lt;8%)</p>
                          <p className="text-xs text-slate-600">Review inventory - Consider reducing stock or increasing sales</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm font-medium text-blue-900">💡 Your Status</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {stats.stockTurnoverRatio >= 15
                        ? '✅ Excellent turnover! Your inventory is moving efficiently.'
                        : stats.stockTurnoverRatio >= 8
                        ? '✓ Good turnover rate. Inventory management is healthy.'
                        : '⚠️ Low turnover detected. Consider reviewing slow-moving fabrics or boosting orders.'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Link href="/inventory">
                    <Button variant="default">
                      View Inventory Details
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {dialogType === 'fulfillmentRate' && (
              <div>
                <div className="p-4 bg-amber-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-amber-600">
                    {generalStats.orders.total > 0
                      ? ((generalStats.orders.delivered / generalStats.orders.total) * 100).toFixed(2)
                      : 0}%
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Order Fulfillment Rate (All Time)</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">What is Fulfillment Rate?</h4>
                    <p className="text-sm text-slate-600">
                      Fulfillment rate shows the percentage of all orders that have been successfully completed
                      and delivered to customers. Higher rates indicate better operational efficiency.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded border">
                      <p className="text-xs text-slate-600 mb-1">Total Orders</p>
                      <p className="text-2xl font-bold text-slate-900">{generalStats.orders.total}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-700 mb-1">Delivered</p>
                      <p className="text-2xl font-bold text-green-700">{generalStats.orders.delivered}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Order Status Breakdown:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-700">Delivered Orders</span>
                        <span className="text-sm font-bold text-green-600">{generalStats.orders.delivered}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-sm text-slate-700">In Progress</span>
                        <span className="text-sm font-bold text-blue-600">
                          {generalStats.orders.total - generalStats.orders.delivered}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Average Fulfillment Time:</h4>
                    <div className="p-3 bg-purple-50 rounded border border-purple-200">
                      <p className="text-2xl font-bold text-purple-700">
                        {stats.avgFulfillmentTime.toFixed(1)} days
                      </p>
                      <p className="text-xs text-purple-600 mt-1">
                        Average time from order creation to delivery (last 100 orders)
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-sm font-medium text-amber-900">💡 Performance Insight</p>
                    <p className="text-xs text-amber-700 mt-1">
                      {generalStats.orders.total > 0 && ((generalStats.orders.delivered / generalStats.orders.total) * 100) >= 80
                        ? '✅ Excellent fulfillment rate! You\'re completing most of your orders successfully.'
                        : generalStats.orders.total > 0 && ((generalStats.orders.delivered / generalStats.orders.total) * 100) >= 60
                        ? '✓ Good fulfillment rate. Focus on completing pending orders to improve further.'
                        : '⚠️ Many orders are still pending. Review workflow to improve completion rates.'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Link href="/orders?status=DELIVERED">
                    <Button variant="default">
                      View Delivered Orders
                    </Button>
                  </Link>
                  <Link href="/orders">
                    <Button variant="outline">
                      View All Orders
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
