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
  const router = useRouter()

  const chartData = data.map((item) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    originalStatus: item.status,
  }))

  const handleClick = (data: any) => {
    if (data && data.originalStatus) {
      // Navigate to orders page with status filter
      router.push(`/orders?status=${data.originalStatus}`)
    }
  }

  return (
    <div className="w-full h-[300px] bg-white rounded-lg">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percent }: { percent?: number }) =>
              `${((percent || 0) * 100).toFixed(0)}%`
            }
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
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
            cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
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
      <p className="text-xs text-center text-slate-500 mt-2">
        Click on any segment to view orders by status
      </p>
    </div>
  )
}
