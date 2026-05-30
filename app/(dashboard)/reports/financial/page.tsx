'use client'

/**
 * @featuretrace Financial Report
 * @route GET /reports/financial
 * @permission view_financial_reports
 * @calls GET /api/reports/financial?months=N
 * @reads Order, Expense, PaymentInstallment (via API)
 * @renders P&L summary cards + financial trend line chart
 * @layout DashboardLayout (sidebar present — fixed from standalone header)
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
import { Download, Printer, TrendingUp, TrendingDown, Home, BarChart2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function FinancialReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [timeRange, setTimeRange] = useState(12)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorStatus(null)
    try {
      const response = await fetch(`/api/reports/financial?months=${timeRange}`)
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

  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-slate-600">Loading financial report…</span>
      </div>
    )
  }

  // ── Error / permission denied ──────────────────────────────────
  if (error) {
    const isAccessDenied = errorStatus === 403
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-lg mx-auto mt-12">
        <h2 className="text-xl font-bold text-red-900 mb-2">
          {isAccessDenied ? 'Access Denied' : 'Failed to Load Report'}
        </h2>
        <p className="text-red-700">{error}</p>
        {isAccessDenied && (
          <p className="text-sm text-red-600 mt-2">
            You need OWNER or ADMIN role to view financial reports.
          </p>
        )}
        <div className="flex justify-center gap-2 mt-4">
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
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

  const isProfitable = data.summary.thisMonthProfit >= 0

  return (
    <>
      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard"><Home className="h-4 w-4" /></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/reports">Reports</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Financial Report</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-green-600" />
            Financial Report
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Profit &amp; Loss Statement · Last {timeRange} months
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={6}>6 Months</option>
            <option value={12}>12 Months</option>
            <option value={24}>24 Months</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* ── This month P&L ───────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>This Month — Profit &amp; Loss</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">Revenue</p>
              <p className="text-2xl font-bold text-green-900">
                ₹{data.summary.thisMonthRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-800">Expenses</p>
              <p className="text-2xl font-bold text-red-900">
                ₹{data.summary.thisMonthExpenses.toLocaleString('en-IN')}
              </p>
            </div>
            <div className={`p-4 rounded-lg border ${isProfitable ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <p className={`text-sm font-medium ${isProfitable ? 'text-blue-800' : 'text-orange-800'}`}>
                Net Profit
              </p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${isProfitable ? 'text-blue-900' : 'text-orange-900'}`}>
                  ₹{Math.abs(data.summary.thisMonthProfit).toLocaleString('en-IN')}
                </p>
                {isProfitable
                  ? <TrendingUp className="h-5 w-5 text-blue-600" />
                  : <TrendingDown className="h-5 w-5 text-orange-600" />}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-600">Profit Margin</p>
              <p className="text-2xl font-bold text-slate-900">
                {data.summary.thisMonthMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Year to Date ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Year to Date Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-slate-600">Total Revenue</p>
              <p className="text-xl font-bold text-green-600">
                ₹{data.yearToDate.revenue.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Expenses</p>
              <p className="text-xl font-bold text-red-600">
                ₹{data.yearToDate.expenses.toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Net Profit</p>
              <p className={`text-xl font-bold ${data.yearToDate.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                ₹{data.yearToDate.profit.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Trend Chart ──────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Financial Trend Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Fixed-height wrapper prevents Recharts SSR hydration warning */}
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.financialData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : '—'} />
                <Legend />
                <Line type="monotone" dataKey="revenue"  stroke="#10B981" strokeWidth={2} name="Revenue (₹)" />
                <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="Expenses (₹)" />
                <Line type="monotone" dataKey="profit"   stroke="#3B82F6" strokeWidth={2} name="Profit (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Cash + Assets ────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Cash Position</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-sm font-medium">Cash Received (Month)</span>
              <span className="text-lg font-bold text-green-600">
                ₹{data.summary.cashReceived.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium">
                Outstanding Payments ({data.summary.outstandingCount})
              </span>
              <span className="text-lg font-bold text-orange-600">
                ₹{data.summary.outstandingPayments.toLocaleString('en-IN')}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">Inventory Value</span>
              <span className="text-lg font-bold text-blue-600">
                ₹{data.summary.inventoryValue.toLocaleString('en-IN')}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
