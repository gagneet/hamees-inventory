'use client'

import { useRouter } from 'next/navigation'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface GarmentTypeRevenue {
  id: string
  name: string
  revenue: number
  orderCount: number
}

interface GarmentTypeRevenueChartProps {
  data: GarmentTypeRevenue[]
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#F97316']

export function GarmentTypeRevenueChart({ data }: GarmentTypeRevenueChartProps) {
  const router = useRouter()

  if (data.length === 0) {
    return (
      <div className="h-[350px] flex items-center justify-center text-slate-500">
        <p>No garment revenue data available</p>
      </div>
    )
  }

  // Calculate total revenue for percentage calculation
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)

  // Add colors to data
  const chartData = data.map((item, index) => ({
    ...item,
    color: COLORS[index % COLORS.length],
  }))

  const handleClick = (data: any) => {
    if (data && data.id) {
      // Navigate to orders page filtered by garment pattern
      router.push(`/orders?garmentPatternId=${data.id}`)
    }
  }

  const renderCustomLabel = (props: any) => {
    const { cx, cy, midAngle, outerRadius, payload } = props
    const RADIAN = Math.PI / 180
    const radius = outerRadius + 25
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    const percentage = ((payload.revenue / totalRevenue) * 100).toFixed(1)
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

  return (
    <div className="w-full">
      <div className="w-full h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={renderCustomLabel}
            outerRadius={110}
            fill="#8884d8"
            dataKey="revenue"
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="#fff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                const percentage = ((data.revenue / totalRevenue) * 100).toFixed(1)
                return (
                  <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                    <p className="font-semibold text-slate-900 mb-2">{data.name}</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-700">
                        <span className="font-medium">Revenue:</span> {formatCurrency(data.revenue)} ({percentage}%)
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Orders:</span> {data.orderCount}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Avg per Order:</span> {formatCurrency(data.revenue / data.orderCount)}
                      </p>
                      <p className="text-xs text-blue-600 mt-2">Click to view orders for this garment →</p>
                    </div>
                  </div>
                )
              }
              return null
            }}
            cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: '#000' }}
            formatter={(value, entry: any) => {
              const payload = entry.payload as any
              return `${payload.name} (${payload.orderCount} orders)`
            }}
          />
        </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-center text-slate-500 mt-2">
        Click on any segment to view orders for that garment type
      </p>
    </div>
  )
}
