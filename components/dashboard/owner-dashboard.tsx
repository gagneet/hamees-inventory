'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FinancialTrendChart } from './financial-trend-chart'
import { GaugeChart } from './gauge-chart'
import { CustomerRetentionChart } from './customer-retention-chart'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Clock, Users, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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
      totalValue: number
    }
  }
}

const FABRIC_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#84CC16', '#F97316', '#A855F7']

export function OwnerDashboard({ stats, generalStats }: OwnerDashboardProps) {
  const currentMonthProfit = stats.financialTrend[stats.financialTrend.length - 1]?.profit || 0
  const netRevenue = generalStats.revenue.thisMonth - stats.expensesThisMonth

  const expenseGrowth =
    stats.expensesLastMonth > 0
      ? ((stats.expensesThisMonth - stats.expensesLastMonth) / stats.expensesLastMonth) * 100
      : 0

  return (
    <div className="space-y-6">
      {/* Row 1: Financial Pulse */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
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
              {generalStats.revenue.growth.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
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
              {expenseGrowth.toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
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
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
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
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Revenue vs Expenses Trend */}
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

      {/* Row 3: Key Metrics & Customer Retention */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Average Fulfillment Time */}
        <Card>
          <CardHeader>
            <CardTitle>Average Fulfillment Time</CardTitle>
            <CardDescription>
              Average days from order to delivery (last 100 orders)
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

      {/* Row 4: Revenue by Fabric & Stock Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue by Fabric */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Fabric Type</CardTitle>
            <CardDescription>
              Top 10 fabrics by revenue generated (delivered orders)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.revenueByFabric.length > 0 ? (
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
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
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

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
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
                {stats.stockTurnoverRatio.toFixed(1)}%
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
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

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
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
                  ? ((generalStats.orders.delivered / generalStats.orders.total) * 100).toFixed(1)
                  : 0}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
