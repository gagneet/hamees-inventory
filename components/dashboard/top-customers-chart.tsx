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
  Cell,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface TopCustomer {
  id: string
  name: string
  email: string | null
  phone: string
  totalOrders: number
  totalSpent: number
  pendingOrders: number
  totalItems: number
  monthsActive: number
  valueScore: number
}

interface TopCustomersChartProps {
  data: TopCustomer[]
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EF4444', '#84CC16', '#F97316']

export function TopCustomersChart({ data }: TopCustomersChartProps) {
  const router = useRouter()

  // Data is already sorted by valueScore from API, take top 20
  const topCustomers = data
    .slice(0, 20)
    .map((customer, index) => ({
      ...customer,
      color: COLORS[index % COLORS.length],
      // Truncate long names for display
      displayName: customer.name.length > 15 ? customer.name.substring(0, 15) + '...' : customer.name,
    }))

  const handleClick = (data: any) => {
    if (data && data.id) {
      router.push(`/customers/${data.id}`)
    }
  }

  if (topCustomers.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center text-slate-500">
        <p>No customer data available</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={500}>
        <BarChart
          data={topCustomers}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="displayName"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fontSize: 10, fill: '#64748B' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748B' }}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
                    <p className="font-semibold text-slate-900 mb-2">{data.name}</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-700">
                        <span className="font-medium">Total Revenue:</span> {formatCurrency(data.totalSpent)}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Total Orders:</span> {data.totalOrders}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Total Items:</span> {data.totalItems}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Months Active:</span> {data.monthsActive}
                      </p>
                      {data.pendingOrders > 0 && (
                        <p className="text-amber-700">
                          <span className="font-medium">Pending:</span> {data.pendingOrders} orders
                        </p>
                      )}
                      <div className="pt-1 mt-1 border-t border-slate-200">
                        <p className="text-xs text-slate-600">
                          Avg per order: {formatCurrency(data.totalSpent / data.totalOrders)}
                        </p>
                      </div>
                      <p className="text-xs text-blue-600 mt-2">Click to view customer profile →</p>
                    </div>
                  </div>
                )
              }
              return null
            }}
            cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
          />
          <Bar
            dataKey="totalSpent"
            radius={[6, 6, 0, 0]}
            onClick={handleClick}
            cursor="pointer"
          >
            {topCustomers.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-center text-slate-500 mt-2">
        Top 20 customers by value (revenue + order frequency + items + activity) • Click any bar to view profile
      </p>
    </div>
  )
}
