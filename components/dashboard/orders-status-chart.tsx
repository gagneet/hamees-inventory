'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

interface OrderStatusData {
  status: string
  count: number
}

interface OrdersStatusChartProps {
  data: OrderStatusData[]
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3B82F6', // Blue
  MATERIAL_SELECTED: '#8B5CF6', // Purple
  CUTTING: '#F59E0B', // Amber
  STITCHING: '#EC4899', // Pink
  FINISHING: '#06B6D4', // Cyan
  READY: '#10B981', // Green
  DELIVERED: '#6B7280', // Gray
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  MATERIAL_SELECTED: 'Material Selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready for Pickup',
  DELIVERED: 'Delivered',
}

export function OrdersStatusChart({ data }: OrdersStatusChartProps) {
  const chartData = data.map((item) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    originalStatus: item.status,
  }))

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name} (${((percent || 0) * 100).toFixed(0)}%)`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={STATUS_COLORS[entry.originalStatus] || '#6B7280'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            layout="vertical"
            align="right"
            verticalAlign="middle"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
