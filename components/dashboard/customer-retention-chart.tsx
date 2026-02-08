'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface CustomerRetentionChartProps {
  newCustomers: number
  returningCustomers: number
}

interface ReturningCustomer {
  id: string
  name: string
  email: string
  phone: string
  totalOrders: number
  monthsActive: string[]
  firstOrderDate: string
  lastOrderDate: string
}

const COLORS = {
  new: '#3B82F6',
  returning: '#10B981',
}

export function CustomerRetentionChart({ newCustomers, returningCustomers }: CustomerRetentionChartProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<ReturningCustomer[]>([])

  const total = newCustomers + returningCustomers
  const retentionRate = total > 0 ? Math.round((returningCustomers / total) * 100) : 0

  const data = [
    { name: 'New or Existing Customers', value: newCustomers, color: COLORS.new },
    { name: 'Returning Customers', value: returningCustomers, color: COLORS.returning },
  ]

  const fetchReturningCustomers = async () => {
    setLoading(true)
    setDialogOpen(true)
    try {
      const response = await fetch('/api/customers/returning')
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching returning customers:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            onClick={(entry: any) => {
              if (entry && entry.name === 'Returning Customers') {
                fetchReturningCustomers()
              }
            }}
            style={{ cursor: 'pointer' }}
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
      </div>
      <p className="text-xs text-center text-slate-500 mt-2">
        Click on "Returning Customers" to view details
      </p>

      <div className="mt-4 text-center">
        <div className="text-2xl font-bold text-slate-900">{retentionRate}%</div>
        <div className="text-sm text-slate-500">Customer Retention Rate</div>

        {returningCustomers > 0 && (
          <Button
            variant="link"
            size="sm"
            onClick={fetchReturningCustomers}
            className="mt-2 text-blue-600 hover:text-blue-800"
          >
            View returning customers <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Returning Customers</DialogTitle>
            <DialogDescription>
              Customers with 3+ delivered orders across at least 2 different months, with at least 2 orders at least 2 weeks apart
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-slate-500">Loading...</div>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No returning customers found
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => (
                <div key={customer.id} className="border rounded-lg p-4 hover:bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-900">{customer.name}</h3>
                      <p className="text-sm text-slate-600">{customer.email}</p>
                      <p className="text-sm text-slate-600">{customer.phone}</p>
                    </div>
                    <Link href={`/customers/${customer.id}`}>
                      <Button variant="outline" size="sm">
                        View Profile <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                    <div>
                      <p className="text-xs text-slate-500">Total Orders</p>
                      <p className="text-lg font-semibold text-slate-900">{customer.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Months Active</p>
                      <p className="text-sm font-medium text-slate-700">
                        {customer.monthsActive.join(', ')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">First Order</p>
                      <p className="text-sm text-slate-700">
                        {new Date(customer.firstOrderDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Last Order</p>
                      <p className="text-sm text-slate-700">
                        {new Date(customer.lastOrderDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
