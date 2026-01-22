'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface RevenueForecastData {
  deliveredRevenue: number
  pendingRevenue: number
  forecastedRevenue: number
  lastMonthRevenue: number
  growthRate: number
}

interface RevenueForecastChartProps {
  data: RevenueForecastData
}

export function RevenueForecastChart({ data }: RevenueForecastChartProps) {
  const chartData = [
    {
      name: 'Last Month',
      value: data.lastMonthRevenue,
      label: 'Actual',
      color: '#94a3b8', // slate-400
    },
    {
      name: 'This Month',
      value: data.deliveredRevenue,
      label: 'Delivered',
      color: '#10b981', // green-500
    },
    {
      name: 'Pending Orders',
      value: data.pendingRevenue,
      label: 'In Pipeline',
      color: '#f59e0b', // amber-500
    },
    {
      name: 'Forecasted',
      value: data.forecastedRevenue,
      label: 'Projected Total',
      color: '#3b82f6', // blue-500
    },
  ]

  const isGrowthPositive = data.growthRate >= 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Revenue Forecast - This Month</CardTitle>
            <CardDescription>
              Actual delivered + pending pipeline + projected completion
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-slate-600 mb-1">
              {isGrowthPositive ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span className={isGrowthPositive ? 'text-green-600' : 'text-red-600'}>
                {isGrowthPositive ? '+' : ''}
                {data.growthRate.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-slate-500">vs last month</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px',
                }}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-600 mb-1">Last Month</div>
            <div className="text-lg font-bold text-slate-700">
              {formatCurrency(data.lastMonthRevenue)}
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-green-600 mb-1">Delivered</div>
            <div className="text-lg font-bold text-green-700">
              {formatCurrency(data.deliveredRevenue)}
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg">
            <div className="text-xs text-amber-600 mb-1">Pipeline</div>
            <div className="text-lg font-bold text-amber-700">
              {formatCurrency(data.pendingRevenue)}
            </div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600 mb-1">Forecast</div>
            <div className="text-lg font-bold text-blue-700">
              {formatCurrency(data.forecastedRevenue)}
            </div>
          </div>
        </div>

        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-900">
            <strong>Forecast Calculation:</strong> Delivered orders ({formatCurrency(data.deliveredRevenue)})
            + Pending pipeline ({formatCurrency(data.pendingRevenue)}) =
            Projected total ({formatCurrency(data.forecastedRevenue)})
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
