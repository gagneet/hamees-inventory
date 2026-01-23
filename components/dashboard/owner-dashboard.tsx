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
import { TopCustomersChart } from './top-customers-chart'
import { GarmentTypeRevenueChart } from './garment-type-revenue-chart'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Clock, Users, Package, AlertCircle, Activity } from 'lucide-react'
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
      id: string
      name: string
      type: string
      revenue: number
    }>
    revenueByGarmentType: Array<{
      id: string
      name: string
      revenue: number
      orderCount: number
    }>
    avgFulfillmentTime: number
    customerRetention: {
      new: number
      returning: number
      retentionRate: number
    }
    stockTurnoverRatio: number
    efficiencyMetrics: {
      totalEstimated: number
      totalActualUsed: number
      totalWastage: number
      totalVarianceAmount: number
      efficiencyPercentage: number
      orderItemsAnalyzed: number
      totalEstimatedAllTime: number
      totalActualUsedAllTime: number
      totalWastageAllTime: number
      totalVarianceAmountAllTime: number
      efficiencyPercentageAllTime: number
      orderItemsAnalyzedAllTime: number
      wastageByFabric: Array<{
        fabricName: string
        fabricType: string
        estimated: number
        actualUsed: number
        wastage: number
        varianceAmount: number
        orderCount: number
      }>
      detailedItems: Array<{
        orderNumber: string
        orderDate: string
        garmentType: string
        fabric: string
        estimated: number
        actualUsed: number
        wastage: number
        varianceAmount: number
      }>
    }
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
  salesStats?: {
    topCustomers: Array<{
      id: string
      name: string
      email: string | null
      phone: string
      totalOrders: number
      totalSpent: number
      pendingOrders: number
      totalItems: number
      monthsActive: number
      valueScore: number
    }>
  }
}

export function OwnerDashboard({ stats, generalStats, alerts, orderStatus, salesStats }: OwnerDashboardProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'revenue' | 'cash' | 'expenses' | 'profit' | 'outstanding' | 'stockTurnover' | 'fulfillmentRate' | 'inventoryValue' | 'totalOrders' | 'efficiency' | null>(null)

  // Calculate total revenue for percentage calculation
  const totalFabricRevenue = stats.revenueByFabric.reduce((sum, item) => sum + (item.revenue || 0), 0)

  // Custom label renderer with white translucent background and black text
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
          fill="rgba(255, 255, 255, 0.95)"
          stroke="rgba(0, 0, 0, 0.1)"
          strokeWidth={1}
          rx={4}
          ry={4}
        />
        <text
          x={x}
          y={y - 4}
          fill="#000"
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
          fill="#000"
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

  const openDialog = (type: 'revenue' | 'cash' | 'expenses' | 'profit' | 'outstanding' | 'stockTurnover' | 'fulfillmentRate' | 'inventoryValue' | 'totalOrders' | 'efficiency') => {
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

      {/* Row 3: Financial Trend - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses Trend</CardTitle>
          <CardDescription>
            6-month financial performance comparison with profit margin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialTrendChart data={stats.financialTrend} />
        </CardContent>
      </Card>

      {/* Row 4: Revenue Distribution Charts */}
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
                      wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: '#000' }}
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

        {/* Revenue by Garment Type */}
        {stats.revenueByGarmentType && stats.revenueByGarmentType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Garment Type</CardTitle>
              <CardDescription>
                Revenue distribution across different garment categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GarmentTypeRevenueChart data={stats.revenueByGarmentType} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 5: Inventory Summary, Order Status & Stock Health (3 columns) */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Column 1: Inventory Summary */}
        <InventorySummary stats={generalStats.inventory} />

        {/* Column 2: Orders by Status Chart */}
        {orderStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Orders by Status</CardTitle>
              <CardDescription>
                Distribution of orders across different stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrdersStatusChart data={orderStatus} />
            </CardContent>
          </Card>
        )}

        {/* Column 3: Stock Health Overview Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Health Overview</CardTitle>
            <CardDescription>
              Distribution of inventory by stock status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generalStats.inventory.totalItems > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Click on a segment to view details</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: 'In Stock',
                          value: generalStats.inventory.totalItems - generalStats.inventory.lowStock - generalStats.inventory.criticalStock,
                          color: '#10b981'
                        },
                        { name: 'Low Stock', value: generalStats.inventory.lowStock, color: '#f59e0b' },
                        { name: 'Critical Stock', value: generalStats.inventory.criticalStock, color: '#ef4444' },
                      ].filter(item => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      onClick={(data) => {
                        if (data.name === 'Low Stock' && generalStats.inventory.lowStock > 0) {
                          router.push('/inventory?status=low')
                        } else if (data.name === 'Critical Stock' && generalStats.inventory.criticalStock > 0) {
                          router.push('/inventory?status=critical')
                        }
                      }}
                      cursor="pointer"
                    >
                      {[
                        {
                          name: 'In Stock',
                          value: generalStats.inventory.totalItems - generalStats.inventory.lowStock - generalStats.inventory.criticalStock,
                          color: '#10b981'
                        },
                        { name: 'Low Stock', value: generalStats.inventory.lowStock, color: '#f59e0b' },
                        { name: 'Critical Stock', value: generalStats.inventory.criticalStock, color: '#ef4444' },
                      ].filter(item => item.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0]
                          return (
                            <div className="bg-white p-2 border border-slate-200 rounded shadow-lg">
                              <p className="text-sm font-medium" style={{ color: data.payload.color }}>
                                {data.name}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {data.value} items ({((data.value as number / generalStats.inventory.totalItems) * 100).toFixed(1)}%)
                                </p>
                                {(data.name === 'Low Stock' || data.name === 'Critical Stock') && data.value > 0 && (
                                  <p className="text-xs text-blue-600 mt-1">Click to view details</p>
                                )}
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry: any) => (
                          <span style={{ color: entry.color, fontSize: '12px', fontWeight: '500' }}>
                            {value}: {entry.payload.value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500">
                  <p>No inventory data available</p>
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Row 6: Customer Analytics */}
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

      {/* Row 7: Top Customers by Value */}
      {salesStats && salesStats.topCustomers && salesStats.topCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 20 Customers by Value</CardTitle>
            <CardDescription>
              Most valuable customers ranked by revenue, order frequency, items ordered, and activity across months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TopCustomersChart data={salesStats.topCustomers} />
          </CardContent>
        </Card>
      )}

      {/* Row 8: Business Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Business Metrics</CardTitle>
          <CardDescription>
            Key performance indicators
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => openDialog('inventoryValue')}
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
              onClick={() => openDialog('totalOrders')}
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

            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => openDialog('efficiency')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Activity className="h-5 w-5 text-cyan-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Fabric Efficiency</p>
                  <p className="text-xs text-slate-500">Estimate vs actual</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className={`text-xl font-bold ${stats.efficiencyMetrics.efficiencyPercentage >= 95 ? 'text-green-700' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? 'text-amber-700' : 'text-red-700'}`}>
                  {stats.efficiencyMetrics.efficiencyPercentage.toFixed(2)}%
                </div>
                <div className={`text-xs ${stats.efficiencyMetrics.totalWastage >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {stats.efficiencyMetrics.totalWastage >= 0 ? '+' : ''}{stats.efficiencyMetrics.totalWastage.toFixed(2)}m variance
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Financial Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'revenue' && 'Revenue Details (This Month)'}
              {dialogType === 'cash' && 'Cash Collected (This Month)'}
              {dialogType === 'expenses' && 'Expenses Breakdown (This Month)'}
              {dialogType === 'profit' && 'Net Profit Analysis (This Month)'}
              {dialogType === 'outstanding' && 'Outstanding Payments Details'}
              {dialogType === 'stockTurnover' && 'Stock Turnover Analysis'}
              {dialogType === 'fulfillmentRate' && 'Fulfillment Rate Breakdown'}
              {dialogType === 'inventoryValue' && 'Inventory Value Breakdown'}
              {dialogType === 'totalOrders' && 'Total Orders Analysis'}
              {dialogType === 'efficiency' && 'Fabric Efficiency & Wastage Analysis'}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'revenue' && 'Revenue from delivered orders (accrual basis)'}
              {dialogType === 'cash' && 'Actual cash received from customer payments (cash basis)'}
              {dialogType === 'expenses' && 'All expenses including purchase orders and operational costs'}
              {dialogType === 'profit' && 'Revenue minus all expenses'}
              {dialogType === 'outstanding' && 'Pending payments from customers'}
              {dialogType === 'stockTurnover' && 'Fabric usage efficiency over last 30 days'}
              {dialogType === 'fulfillmentRate' && 'Order completion and delivery performance'}
              {dialogType === 'inventoryValue' && 'Total value of current inventory stock'}
              {dialogType === 'totalOrders' && 'Complete order history and status breakdown'}
              {dialogType === 'efficiency' && 'Detailed fabric usage, wastage patterns, and efficiency metrics for this month'}
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

            {dialogType === 'inventoryValue' && (
              <div>
                <div className="p-4 bg-green-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(generalStats.inventory.totalValue)}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Total Inventory Value (Current Stock)</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">What is Inventory Value?</h4>
                    <p className="text-sm text-slate-600">
                      Inventory value represents the total worth of all fabric and accessories currently in stock.
                      This is calculated by multiplying the current stock quantity by the price per unit for each item.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded border">
                    <p className="text-xs font-medium text-slate-700 mb-2">Calculation Formula:</p>
                    <p className="text-sm text-slate-900 font-mono">
                      Σ (Current Stock × Price per Unit) for all items
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Inventory Breakdown:</h4>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-50 rounded border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-slate-700">Total Items</span>
                          <span className="text-lg font-bold text-slate-900">{generalStats.inventory.totalItems}</span>
                        </div>
                        <p className="text-xs text-slate-600">Cloth fabrics + Accessories</p>
                      </div>

                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-700">Total Fabric Stock</span>
                          <span className="text-lg font-bold text-blue-700">{generalStats.inventory.totalMeters.toFixed(2)}m</span>
                        </div>
                        <p className="text-xs text-blue-600">Total meters available across all fabrics</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-amber-50 rounded border border-amber-200">
                          <p className="text-xs text-amber-700 mb-1">Low Stock Items</p>
                          <p className="text-2xl font-bold text-amber-700">{generalStats.inventory.lowStock}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded border border-red-200">
                          <p className="text-xs text-red-700 mb-1">Critical Stock</p>
                          <p className="text-2xl font-bold text-red-700">{generalStats.inventory.criticalStock}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm font-medium text-green-900">💡 Inventory Health</p>
                    <p className="text-xs text-green-700 mt-1">
                      {generalStats.inventory.lowStock + generalStats.inventory.criticalStock === 0
                        ? '✅ Excellent! All inventory items are well-stocked.'
                        : generalStats.inventory.criticalStock > 0
                        ? `⚠️ Action needed: ${generalStats.inventory.criticalStock} items at critical stock level. Consider reordering immediately.`
                        : `⚡ ${generalStats.inventory.lowStock} items running low. Plan restocking soon.`}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Link href="/inventory">
                    <Button variant="default">
                      View Inventory Details
                    </Button>
                  </Link>
                  {(generalStats.inventory.lowStock > 0 || generalStats.inventory.criticalStock > 0) && (
                    <Link href="/purchase-orders/new">
                      <Button variant="outline">
                        Create Purchase Order
                      </Button>
                    </Link>
                  )}
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {dialogType === 'totalOrders' && (
              <div>
                <div className="p-4 bg-purple-50 rounded-lg mb-4">
                  <p className="text-2xl font-bold text-purple-600">
                    {generalStats.orders.total}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Total Orders (All Time)</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Order History Overview</h4>
                    <p className="text-sm text-slate-600">
                      This represents all orders created in the system since inception, including completed,
                      in-progress, and cancelled orders. Track your business growth and order trends.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-green-700 mb-1">Delivered</p>
                      <p className="text-2xl font-bold text-green-700">{generalStats.orders.delivered}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {generalStats.orders.total > 0
                          ? ((generalStats.orders.delivered / generalStats.orders.total) * 100).toFixed(1)
                          : 0}% of total
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">In Progress</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {generalStats.orders.total - generalStats.orders.delivered}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {generalStats.orders.total > 0
                          ? (((generalStats.orders.total - generalStats.orders.delivered) / generalStats.orders.total) * 100).toFixed(1)
                          : 0}% of total
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2">Business Insights:</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Average Fulfillment Time</p>
                          <p className="text-xs text-slate-500">Time to complete orders</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">{stats.avgFulfillmentTime.toFixed(1)} days</p>
                          <p className={`text-xs ${stats.avgFulfillmentTime <= 15 ? 'text-green-600' : stats.avgFulfillmentTime <= 22 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {stats.avgFulfillmentTime <= 15 ? '✅ Excellent' : stats.avgFulfillmentTime <= 22 ? '⚠️ Good' : '🔴 Slow'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Fulfillment Rate</p>
                          <p className="text-xs text-slate-500">Orders successfully completed</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">
                            {generalStats.orders.total > 0
                              ? ((generalStats.orders.delivered / generalStats.orders.total) * 100).toFixed(1)
                              : 0}%
                          </p>
                          <p className={`text-xs ${
                            generalStats.orders.total > 0 && ((generalStats.orders.delivered / generalStats.orders.total) * 100) >= 80
                              ? 'text-green-600'
                              : generalStats.orders.total > 0 && ((generalStats.orders.delivered / generalStats.orders.total) * 100) >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}>
                            {generalStats.orders.total > 0 && ((generalStats.orders.delivered / generalStats.orders.total) * 100) >= 80
                              ? '✅ Excellent'
                              : generalStats.orders.total > 0 && ((generalStats.orders.delivered / generalStats.orders.total) * 100) >= 60
                              ? '⚠️ Good'
                              : '🔴 Needs attention'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                    <p className="text-sm font-medium text-purple-900">💡 Growth Indicator</p>
                    <p className="text-xs text-purple-700 mt-1">
                      {generalStats.orders.total >= 200
                        ? '🎉 Excellent! You have a strong order history with 200+ orders.'
                        : generalStats.orders.total >= 100
                        ? '✓ Great progress! You\'re building a solid customer base with 100+ orders.'
                        : generalStats.orders.total >= 50
                        ? '📈 Growing steadily! Keep up the good work with your order pipeline.'
                        : '🌱 Just getting started! Focus on marketing and customer acquisition.'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Link href="/orders">
                    <Button variant="default">
                      View All Orders
                    </Button>
                  </Link>
                  <Link href="/orders/new">
                    <Button variant="outline">
                      Create New Order
                    </Button>
                  </Link>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {dialogType === 'efficiency' && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">📅 Current Month Performance</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 mb-1">Estimated Required</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.efficiencyMetrics.totalEstimated.toFixed(2)}m</p>
                    <p className="text-xs text-blue-600 mt-1">Based on patterns</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-700 mb-1">Total Consumed</p>
                    <p className="text-2xl font-bold text-purple-700">{stats.efficiencyMetrics.totalActualUsed.toFixed(2)}m</p>
                    <p className="text-xs text-purple-600 mt-1">From inventory</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${stats.efficiencyMetrics.totalWastage >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-xs mb-1 ${stats.efficiencyMetrics.totalWastage >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                      Variance
                    </p>
                    <p className={`text-2xl font-bold ${stats.efficiencyMetrics.totalWastage >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                      {stats.efficiencyMetrics.totalWastage >= 0 ? '+' : ''}{stats.efficiencyMetrics.totalWastage.toFixed(2)}m
                    </p>
                    <p className={`text-lg font-bold mt-1 ${stats.efficiencyMetrics.totalWastage >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                      {stats.efficiencyMetrics.totalVarianceAmount >= 0 ? '+' : ''}{formatCurrency(stats.efficiencyMetrics.totalVarianceAmount)}
                    </p>
                    <p className={`text-xs mt-1 ${stats.efficiencyMetrics.totalWastage >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {stats.efficiencyMetrics.totalWastage >= 0 ? 'Over estimate' : 'Under estimate'}
                    </p>
                  </div>
                </div>

                {/* Explanation box */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 text-xs text-slate-700">
                  <p className="font-medium mb-1">📖 Understanding the Metrics:</p>
                  <ul className="space-y-1 ml-4 list-disc">
                    <li><strong>Estimated Required:</strong> Fabric calculated from garment patterns and measurements</li>
                    <li><strong>Total Consumed:</strong> Actual fabric taken from inventory (includes garment + cutting waste)</li>
                    <li><strong>Variance:</strong> Difference between consumed and estimated (positive = over, negative = under)</li>
                  </ul>
                  <p className="mt-2 text-amber-700 font-medium">
                    ⚠️ High variance may indicate: estimation errors, cutting inefficiency, or measurement inaccuracies
                  </p>
                </div>

                <div className={`p-4 rounded-lg mb-4 ${stats.efficiencyMetrics.efficiencyPercentage >= 95 ? 'bg-green-50 border border-green-200' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${stats.efficiencyMetrics.efficiencyPercentage >= 95 ? 'text-green-900' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? 'text-amber-900' : 'text-red-900'}`}>
                        Overall Efficiency Rating
                      </p>
                      <p className={`text-xs mt-1 ${stats.efficiencyMetrics.efficiencyPercentage >= 95 ? 'text-green-700' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? 'text-amber-700' : 'text-red-700'}`}>
                        Based on {stats.efficiencyMetrics.orderItemsAnalyzed} order items this month
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${stats.efficiencyMetrics.efficiencyPercentage >= 95 ? 'text-green-700' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? 'text-amber-700' : 'text-red-700'}`}>
                        {stats.efficiencyMetrics.efficiencyPercentage.toFixed(2)}%
                      </p>
                      <p className={`text-xs font-medium mt-1 ${stats.efficiencyMetrics.efficiencyPercentage >= 95 ? 'text-green-600' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                        {stats.efficiencyMetrics.efficiencyPercentage >= 95 ? '✅ Excellent' : stats.efficiencyMetrics.efficiencyPercentage >= 85 ? '⚠️ Good' : '🔴 Needs Improvement'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* All-Time Metrics Section */}
                <div className="border-t-2 border-slate-200 pt-4 mt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">📊 All-Time Historical Performance</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className={`p-4 rounded-lg border ${stats.efficiencyMetrics.efficiencyPercentageAllTime >= 95 ? 'bg-green-50 border-green-200' : stats.efficiencyMetrics.efficiencyPercentageAllTime >= 85 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-medium ${stats.efficiencyMetrics.efficiencyPercentageAllTime >= 95 ? 'text-green-900' : stats.efficiencyMetrics.efficiencyPercentageAllTime >= 85 ? 'text-amber-900' : 'text-red-900'}`}>
                          Overall Efficiency (All Time)
                        </p>
                        <p className={`text-3xl font-bold ${stats.efficiencyMetrics.efficiencyPercentageAllTime >= 95 ? 'text-green-700' : stats.efficiencyMetrics.efficiencyPercentageAllTime >= 85 ? 'text-amber-700' : 'text-red-700'}`}>
                          {stats.efficiencyMetrics.efficiencyPercentageAllTime.toFixed(2)}%
                        </p>
                      </div>
                      <p className={`text-xs ${stats.efficiencyMetrics.efficiencyPercentageAllTime >= 95 ? 'text-green-700' : stats.efficiencyMetrics.efficiencyPercentageAllTime >= 85 ? 'text-amber-700' : 'text-red-700'}`}>
                        Based on {stats.efficiencyMetrics.orderItemsAnalyzedAllTime} total order items
                      </p>
                    </div>

                    <div className={`p-4 rounded-lg border ${stats.efficiencyMetrics.totalWastageAllTime >= 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-medium ${stats.efficiencyMetrics.totalWastageAllTime >= 0 ? 'text-orange-900' : 'text-green-900'}`}>
                          Total Variance (All Time)
                        </p>
                        <div className="text-right">
                          <p className={`text-3xl font-bold ${stats.efficiencyMetrics.totalWastageAllTime >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                            {stats.efficiencyMetrics.totalWastageAllTime >= 0 ? '+' : ''}{stats.efficiencyMetrics.totalWastageAllTime.toFixed(2)}m
                          </p>
                          <p className={`text-lg font-bold ${stats.efficiencyMetrics.totalWastageAllTime >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                            {stats.efficiencyMetrics.totalVarianceAmountAllTime >= 0 ? '+' : ''}{formatCurrency(stats.efficiencyMetrics.totalVarianceAmountAllTime)}
                          </p>
                        </div>
                      </div>
                      <p className={`text-xs ${stats.efficiencyMetrics.totalWastageAllTime >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                        Out of {stats.efficiencyMetrics.totalEstimatedAllTime.toFixed(2)}m estimated total
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-slate-50 rounded border">
                      <p className="text-slate-600 mb-1">Estimated (All Time)</p>
                      <p className="text-xl font-bold text-slate-900">{stats.efficiencyMetrics.totalEstimatedAllTime.toFixed(2)}m</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded border">
                      <p className="text-slate-600 mb-1">Actual Used (All Time)</p>
                      <p className="text-xl font-bold text-slate-900">{stats.efficiencyMetrics.totalActualUsedAllTime.toFixed(2)}m</p>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded mt-3">
                    <p className="text-sm font-medium text-blue-900">💡 Performance Comparison</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {stats.efficiencyMetrics.efficiencyPercentage > stats.efficiencyMetrics.efficiencyPercentageAllTime
                        ? `✅ Current month (${stats.efficiencyMetrics.efficiencyPercentage.toFixed(2)}%) is better than all-time average (${stats.efficiencyMetrics.efficiencyPercentageAllTime.toFixed(2)}%). Great improvement!`
                        : stats.efficiencyMetrics.efficiencyPercentage < stats.efficiencyMetrics.efficiencyPercentageAllTime
                        ? `⚠️ Current month (${stats.efficiencyMetrics.efficiencyPercentage.toFixed(2)}%) is lower than all-time average (${stats.efficiencyMetrics.efficiencyPercentageAllTime.toFixed(2)}%). Review recent changes.`
                        : `Current month performance matches all-time average (${stats.efficiencyMetrics.efficiencyPercentage.toFixed(2)}%). Consistent performance.`}
                    </p>
                  </div>
                </div>

                <div className="border-t-2 border-slate-200 pt-4 mt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">🔍 Detailed Analysis (Current Month)</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Variance by Fabric Type (Top 10)</h4>
                    <p className="text-xs text-slate-600 mb-2">
                      Shows fabric consumption vs estimates. High variance = estimation issues or cutting inefficiency.
                    </p>
                    {stats.efficiencyMetrics.wastageByFabric.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {stats.efficiencyMetrics.wastageByFabric.map((fabric, index) => (
                          <div key={index} className="p-3 bg-slate-50 rounded-lg border">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{fabric.fabricName}</p>
                                <p className="text-xs text-slate-600">{fabric.fabricType} • {fabric.orderCount} orders</p>
                              </div>
                              <div className={`text-right ${fabric.wastage >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                <p className="text-sm font-bold">
                                  {fabric.wastage >= 0 ? '+' : ''}{fabric.wastage.toFixed(2)}m
                                </p>
                                <p className="text-xs">
                                  {((fabric.wastage / fabric.estimated) * 100).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-slate-600">Est:</span>
                                <span className="font-medium text-slate-900 ml-1">{fabric.estimated.toFixed(2)}m</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Consumed:</span>
                                <span className="font-medium text-slate-900 ml-1">{fabric.actualUsed.toFixed(2)}m</span>
                              </div>
                              <div>
                                <span className="text-slate-600">Variance:</span>
                                <span className={`font-medium ml-1 ${fabric.wastage >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                  {fabric.wastage >= 0 ? '+' : ''}{fabric.wastage.toFixed(2)}m
                                </span>
                              </div>
                            </div>
                            <div className="mt-1">
                              <span className={`text-xs font-semibold ${fabric.varianceAmount >= 0 ? 'text-orange-700' : 'text-green-700'}`}>
                                {fabric.varianceAmount >= 0 ? '+' : ''}{formatCurrency(fabric.varianceAmount)}
                              </span>
                              <span className="text-xs text-slate-500 ml-1">financial impact</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 text-center py-4">No data available for this month</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Recent Order Items (Top 20)</h4>
                    <p className="text-xs text-slate-600 mb-2">
                      Individual order variance. Consistent patterns may indicate estimation formula issues.
                    </p>
                    {stats.efficiencyMetrics.detailedItems.length > 0 ? (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {stats.efficiencyMetrics.detailedItems.map((item, index) => (
                          <div key={index} className="p-2 bg-white rounded border text-xs">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{item.orderNumber}</p>
                                <p className="text-slate-600">
                                  {item.garmentType} • {item.fabric}
                                </p>
                              </div>
                              <div className={`text-right ${item.wastage >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                <p className="font-bold">
                                  {item.wastage >= 0 ? '+' : ''}{item.wastage.toFixed(2)}m
                                </p>
                                <p className="text-xs font-semibold">
                                  {item.varianceAmount >= 0 ? '+' : ''}{formatCurrency(item.varianceAmount)}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-3 text-slate-600">
                              <span>Est: {item.estimated.toFixed(2)}m</span>
                              <span>Consumed: {item.actualUsed.toFixed(2)}m</span>
                              <span className="text-slate-400">
                                {new Date(item.orderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 text-center py-4">No detailed items available</p>
                    )}
                  </div>

                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded">
                    <p className="text-sm font-medium text-cyan-900">💡 What This Data Tells You</p>
                    <div className="text-xs text-cyan-700 mt-2 space-y-2">
                      <p>
                        <strong>High Positive Variance (+):</strong> Either estimation formulas are too low, cutting process is inefficient, or both.
                        Action: {stats.efficiencyMetrics.efficiencyPercentage >= 95
                          ? 'Continue current practices - variance is minimal.'
                          : stats.efficiencyMetrics.efficiencyPercentage >= 85
                          ? 'Review garment patterns with highest variance. Update estimation formulas or improve cutting techniques.'
                          : 'URGENT: Audit measurement accuracy, review all garment formulas, and assess cutting process efficiency.'}
                      </p>
                      <p>
                        <strong>Negative Variance (-):</strong> Consuming less than estimated. Either formulas are conservative or cutting is very efficient. Consider reducing estimates.
                      </p>
                      {stats.efficiencyMetrics.totalWastage > 0 && (
                        <p className="mt-2 font-medium">
                          💰 Financial Impact: {stats.efficiencyMetrics.totalWastage.toFixed(2)}m excess consumption this month. At average fabric cost, this could represent ₹{(stats.efficiencyMetrics.totalWastage * 500).toFixed(0)}+ in additional inventory cost (assuming ₹500/m average).
                        </p>
                      )}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
