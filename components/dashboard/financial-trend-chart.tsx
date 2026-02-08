'use client'

import { useRouter } from 'next/navigation'
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
import { format, parse } from 'date-fns'

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
  const router = useRouter()

  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const monthStr = data.activePayload[0].payload.month

      // Parse month string (e.g., "Jul 2025") to get year and month
      try {
        const date = parse(monthStr, 'MMM yyyy', new Date())
        const year = format(date, 'yyyy')
        const month = format(date, 'MM')

        // Navigate to orders page with month filter
        router.push(`/orders?year=${year}&month=${month}`)
      } catch (error) {
        console.error('Error parsing month:', error)
      }
    }
  }

  return (
    <div className="w-full">
      <div className="w-full h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
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
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                  <p className="font-semibold text-slate-900 mb-2">{payload[0].payload.month}</p>
                  <div className="space-y-1">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Revenue:</span> {formatCurrency(payload[0].payload.revenue)}
                    </p>
                    <p className="text-sm text-red-700">
                      <span className="font-medium">Expenses:</span> {formatCurrency(payload[0].payload.expenses)}
                    </p>
                    <p className="text-sm text-green-700">
                      <span className="font-medium">Profit:</span> {formatCurrency(payload[0].payload.profit)}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">Click to view orders from this month →</p>
                  </div>
                </div>
              )
            }
            return null
          }}
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
      </div>
      <p className="text-xs text-center text-slate-500 mt-2">
      Click on any month point to view orders from that period
    </p>
  </div>
  )
}
