'use client'

/**
 * @featuretrace Customer Report
 * @route GET /reports/customers
 * @permission view_customer_reports
 * @calls GET /api/reports/customers?months=N
 * @reads Customer, Order, Measurement (via API)
 * @renders Summary cards + top-customers table + segment breakdown
 * @layout DashboardLayout (sidebar present)
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, Users, TrendingUp, Star, AlertCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface CustomerSummary {
  totalCustomers: number
  activeCustomers: number
  repeatCustomers: number
  repeatRate: string
  avgLifetimeValue: string
  avgOrderValue: string
}

interface TopCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  city: string | null
  orderCount: number
  totalRevenue: number
  avgOrderValue: number
  lastOrderDate: string | null
  hasMeasurements: boolean
}

interface CustomerSegments {
  highValue: number
  mediumValue: number
  lowValue: number
}

interface CustomerReportData {
  summary: CustomerSummary
  topCustomers: TopCustomer[]
  customerSegments: CustomerSegments
}

// ── Helper ────────────────────────────────────────────────────────

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num ?? 0)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Page component ────────────────────────────────────────────────

export default function CustomerReportPage() {
  const [data, setData] = useState<CustomerReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [timeRange, setTimeRange] = useState(12)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorStatus(null)
    try {
      const response = await fetch(`/api/reports/customers?months=${timeRange}`)
      const responseData = await response.json()
      if (!response.ok || responseData.error) {
        setErrorStatus(response.status)
        setError(responseData.error || 'Failed to load report')
        setData(null)
      } else {
        setData(responseData)
      }
    } catch {
      setError('Failed to load report')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-slate-600">Loading customer report…</span>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────
  if (error) {
    const isAccessDenied = errorStatus === 403
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-lg mx-auto mt-12">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-red-900 mb-2">
          {isAccessDenied ? 'Access Denied' : 'Failed to Load Report'}
        </h2>
        <p className="text-red-700">{error}</p>
        {isAccessDenied && (
          <p className="text-sm text-red-600 mt-2">
            You need the <strong>view_customer_reports</strong> permission to access this page.
          </p>
        )}
        <div className="flex justify-center gap-2 mt-4">
          <Link href="/reports">
            <Button variant="outline">Back to Reports</Button>
          </Link>
          {!isAccessDenied && (
            <Button onClick={fetchReport}>Retry</Button>
          )}
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-8 text-slate-500">No data available.</div>
  }

  const { summary, topCustomers, customerSegments } = data

  return (
    <>
      <div className="p-6 space-y-6">

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard" className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/reports">Reports</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Customer Report</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              Customer Report
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Customer analytics for the last {timeRange} month{timeRange !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Time range selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Period:</span>
            {[3, 6, 12].map(months => (
              <Button
                key={months}
                variant={timeRange === months ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(months)}
              >
                {months}m
              </Button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{summary.totalCustomers}</p>
              <p className="text-xs text-slate-500 mt-1">{summary.activeCustomers} active this period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Repeat Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{summary.repeatRate}%</p>
              <p className="text-xs text-slate-500 mt-1">{summary.repeatCustomers} repeat customers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Star className="h-4 w-4" />
                Avg Lifetime Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.avgLifetimeValue)}</p>
              <p className="text-xs text-slate-500 mt-1">Avg order: {formatCurrency(summary.avgOrderValue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Customer segments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-2xl font-bold text-green-900">{customerSegments.highValue}</p>
                <p className="text-sm font-medium text-green-700 mt-1">High Value</p>
                <p className="text-xs text-green-600">Revenue &gt; ₹50,000</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-2xl font-bold text-amber-900">{customerSegments.mediumValue}</p>
                <p className="text-sm font-medium text-amber-700 mt-1">Medium Value</p>
                <p className="text-xs text-amber-600">₹20,000 – ₹50,000</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-2xl font-bold text-slate-900">{customerSegments.lowValue}</p>
                <p className="text-sm font-medium text-slate-700 mt-1">Low Value</p>
                <p className="text-xs text-slate-600">Revenue &lt; ₹20,000</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top customers table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Customer</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Orders</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total Revenue</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Avg Order</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Last Order</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Measurements</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No customer data for this period.
                      </td>
                    </tr>
                  ) : (
                    topCustomers.map((customer, index) => (
                      <tr key={customer.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{index + 1}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                          >
                            {customer.name}
                          </Link>
                          {customer.phone && (
                            <span className="block text-xs text-slate-500">{customer.phone}</span>
                          )}
                          {customer.city && (
                            <span className="block text-xs text-slate-400">{customer.city}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{customer.orderCount}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(customer.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCurrency(customer.avgOrderValue)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {formatDate(customer.lastOrderDate)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {customer.hasMeasurements ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              On file
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              None
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </>
  )
}
