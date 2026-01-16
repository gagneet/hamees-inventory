'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface StockData {
  name: string
  type: string
  available: number
  committed: number
  total: number
}

interface StockComparisonChartProps {
  data: StockData[]
}

export function StockComparisonChart({ data }: StockComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          height={80}
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          label={{ value: 'Meters', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
          }}
          formatter={(value: number | undefined, name: string | undefined) => [
            `${(value || 0).toFixed(2)} meters`,
            name === 'available' ? 'Available Stock' : 'Committed/Reserved',
          ]}
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          formatter={(value) =>
            value === 'available' ? 'Available Stock' : 'Committed (Reserved for Orders)'
          }
        />
        <Bar dataKey="available" fill="#10B981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="committed" fill="#F59E0B" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
