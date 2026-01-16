'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductionPipelineChart } from './production-pipeline-chart'
import { ShoppingBag, Package, Users, TrendingUp, Mail, Phone } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface SalesManagerDashboardProps {
  stats: {
    newOrdersToday: number
    readyForPickup: number
    orderPipeline: Array<{ status: string; count: number }>
    topCustomers: Array<{
      id: string
      name: string
      email: string | null
      phone: string
      totalOrders: number
      totalSpent: number
      pendingOrders: number
      isReturning: boolean
    }>
  }
  generalStats: {
    orders: {
      total: number
      pending: number
      thisMonth: number
      growth: number
    }
  }
}

export function SalesManagerDashboard({ stats, generalStats }: SalesManagerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Sales Velocity */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Orders Today</CardTitle>
            <ShoppingBag className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.newOrdersToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Created in last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Pickup</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.readyForPickup}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Notify customers
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{generalStats.orders.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently in production
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <ShoppingBag className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{generalStats.orders.thisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {generalStats.orders.growth >= 0 ? '+' : ''}
              {generalStats.orders.growth.toFixed(2)}% vs last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Order Status Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Order Pipeline - Production Status</CardTitle>
          <CardDescription>
            Track order flow through production stages (Click to filter)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.orderPipeline.length > 0 ? (
            <ProductionPipelineChart data={stats.orderPipeline} />
          ) : (
            <div className="h-[350px] flex items-center justify-center text-slate-500">
              <p>No orders in pipeline</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Customers</CardTitle>
          <CardDescription>
            High-value and frequent customers for personalized service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topCustomers.map((customer, index) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="block p-4 rounded-lg border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                          {customer.name}
                          {customer.isReturning && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Returning
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                          {customer.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs mt-2">
                      <div>
                        <span className="text-slate-500">Total Spent: </span>
                        <span className="font-bold text-green-700">
                          {formatCurrency(customer.totalSpent)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Orders: </span>
                        <span className="font-medium">{customer.totalOrders}</span>
                      </div>
                      {customer.pendingOrders > 0 && (
                        <div>
                          <span className="text-slate-500">Pending: </span>
                          <span className="font-medium text-amber-700">
                            {customer.pendingOrders}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {stats.topCustomers.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No customer data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
