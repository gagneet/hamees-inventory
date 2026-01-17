'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Printer, TrendingUp, TrendingDown } from 'lucide-react'
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
  const [timeRange, setTimeRange] = useState(12)

  useEffect(() => {
    fetchReport()
  }, [timeRange])

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/reports/financial?months=${timeRange}`)
      const data = await response.json()

      if (!response.ok || data.error) {
        setError(data.error || 'Failed to load report')
        setData(null)
      } else {
        setData(data)
      }
    } catch (err) {
      setError('Failed to load report')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-900 mb-2">Access Denied</h2>
            <p className="text-red-700">{error}</p>
            <p className="text-sm text-red-600 mt-2">
              You need OWNER or ADMIN role to view financial reports.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="p-8">No data available</div>
  }

  const isProfitable = data.summary.thisMonthProfit >= 0

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Financial Summary</h1>
              <p className="text-sm text-slate-600">
                Profit & Loss Statement • Last {timeRange} months
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
                <option value={24}>24 Months</option>
              </select>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Current Month P&L */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>This Month - Profit & Loss</CardTitle>
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

              <div
                className={`p-4 rounded-lg border ${
                  isProfitable
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    isProfitable ? 'text-blue-800' : 'text-orange-800'
                  }`}
                >
                  Net Profit
                </p>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-2xl font-bold ${
                      isProfitable ? 'text-blue-900' : 'text-orange-900'
                    }`}
                  >
                    ₹{Math.abs(data.summary.thisMonthProfit).toLocaleString('en-IN')}
                  </p>
                  {isProfitable ? (
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                  )}
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

        {/* Year to Date Summary */}
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
                <p
                  className={`text-xl font-bold ${
                    data.yearToDate.profit >= 0 ? 'text-blue-600' : 'text-orange-600'
                  }`}
                >
                  ₹{data.yearToDate.profit.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Financial Trend Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.financialData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Revenue (₹)"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Expenses (₹)"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Profit (₹)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Additional Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Cash Position</CardTitle>
            </CardHeader>
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
            <CardHeader>
              <CardTitle>Assets</CardTitle>
            </CardHeader>
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
      </main>
    </div>
  )
}
