'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface RevenueData {
  month: string
  revenue: number
}

interface RevenueChartProps {
  data: RevenueData[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return `₹${(value / 1000).toFixed(0)}k`
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            stroke="#9CA3AF"
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 12 }}
            stroke="#9CA3AF"
            tickFormatter={formatCurrency}
          />
          <Tooltip
            formatter={(value: number | undefined) => `₹${(value || 0).toLocaleString('en-IN')}`}
            contentStyle={{
              backgroundColor: '#FFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#1E3A8A"
            strokeWidth={3}
            dot={{ fill: '#1E3A8A', r: 4 }}
            activeDot={{ r: 6 }}
            name="Revenue"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
