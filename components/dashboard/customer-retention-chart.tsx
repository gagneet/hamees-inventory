'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface CustomerRetentionChartProps {
  newCustomers: number
  returningCustomers: number
}

const COLORS = {
  new: '#3B82F6',
  returning: '#10B981',
}

export function CustomerRetentionChart({ newCustomers, returningCustomers }: CustomerRetentionChartProps) {
  const total = newCustomers + returningCustomers
  const retentionRate = total > 0 ? Math.round((returningCustomers / total) * 100) : 0

  const data = [
    { name: 'New Customers', value: newCustomers, color: COLORS.new },
    { name: 'Returning Customers', value: returningCustomers, color: COLORS.returning },
  ]

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => (
              <span className="text-sm">
                {value}: <span className="font-medium">{entry.payload.value}</span>
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 text-center">
        <div className="text-2xl font-bold text-slate-900">{retentionRate}%</div>
        <div className="text-sm text-slate-500">Customer Retention Rate</div>
      </div>
    </div>
  )
}
