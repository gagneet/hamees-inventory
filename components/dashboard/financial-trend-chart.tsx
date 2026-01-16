'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface FinancialTrendData {
  month: string
  revenue: number
  expenses: number
  profit: number
}

interface FinancialTrendChartProps {
  data: FinancialTrendData[]
}

export function FinancialTrendChart({ data }: FinancialTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickMargin={10}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
          }}
          formatter={(value: number | undefined) => formatCurrency(value || 0)}
        />
        <Legend
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="line"
        />

        {/* Profit area */}
        <Area
          type="monotone"
          dataKey="profit"
          fill="url(#profitGradient)"
          stroke="none"
          name="Net Profit"
        />

        {/* Revenue line */}
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#3B82F6"
          strokeWidth={3}
          dot={{ fill: '#3B82F6', r: 4 }}
          activeDot={{ r: 6 }}
          name="Revenue"
        />

        {/* Expenses line */}
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#EF4444"
          strokeWidth={3}
          dot={{ fill: '#EF4444', r: 4 }}
          activeDot={{ r: 6 }}
          name="Expenses"
          strokeDasharray="5 5"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
