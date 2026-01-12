'use client'

import { useRouter } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface FabricData {
  name: string
  type: string
  metersUsed: number
}

interface TopFabricsChartProps {
  data: FabricData[]
}

export function TopFabricsChart({ data }: TopFabricsChartProps) {
  const router = useRouter()

  const handleClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const fabricData = data.activePayload[0].payload
      // Navigate to inventory page with search filter
      router.push(`/inventory?search=${encodeURIComponent(fabricData.name)}`)
    }
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          onClick={handleClick}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 12 }}
            stroke="#9CA3AF"
            label={{ value: 'Meters Used', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6B7280' } }}
          />
          <Tooltip
            formatter={(value: number | undefined) => [`${value || 0}m`, 'Meters Used']}
            contentStyle={{
              backgroundColor: '#FFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
            cursor={{ fill: 'rgba(30, 58, 138, 0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="metersUsed"
            fill="#1E3A8A"
            radius={[8, 8, 0, 0]}
            name="Meters Used"
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-center text-slate-500 mt-2">
        Click on any bar to view fabric details in inventory
      </p>
    </div>
  )
}
