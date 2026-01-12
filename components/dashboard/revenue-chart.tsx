'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  const formatCurrency = (value: number) => {
    return `₹${(value / 1000).toFixed(0)}k`
  }

  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const monthData = data.activePayload[0].payload
      // Navigate to expenses page with month filter
      router.push(`/expenses?month=${encodeURIComponent(monthData.month)}`)
    }
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
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
            cursor={{ stroke: '#1E3A8A', strokeWidth: 2, strokeDasharray: '5 5' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#1E3A8A"
            strokeWidth={3}
            dot={{ fill: '#1E3A8A', r: 4 }}
            activeDot={{ r: 8, cursor: 'pointer' }}
            name="Revenue"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-center text-slate-500 mt-2">
        Click on any data point to view monthly breakdown
      </p>
    </div>
  )
}
