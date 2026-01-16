'use client'

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useRouter } from 'next/navigation'

interface PipelineData {
  status: string
  count: number
}

interface ProductionPipelineChartProps {
  data: PipelineData[]
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3B82F6', // Blue
  MATERIAL_SELECTED: '#8B5CF6', // Purple
  CUTTING: '#F59E0B', // Amber
  STITCHING: '#EF4444', // Red
  FINISHING: '#EC4899', // Pink
  READY: '#10B981', // Green
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New Orders',
  MATERIAL_SELECTED: 'Material Selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready for Pickup',
}

export function ProductionPipelineChart({ data }: ProductionPipelineChartProps) {
  const router = useRouter()

  const handleBarClick = (status: string) => {
    router.push(`/orders?status=${status}`)
  }

  const chartData = data.map((item) => ({
    ...item,
    label: STATUS_LABELS[item.status] || item.status,
    fill: STATUS_COLORS[item.status] || '#64748B',
  }))

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
          }}
          formatter={(value) => [value, 'Orders']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              onClick={() => handleBarClick(entry.status)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
