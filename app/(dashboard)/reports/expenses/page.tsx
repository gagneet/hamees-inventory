'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, Printer } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const CATEGORY_COLORS: Record<string, string> = {
  RENT: '#3B82F6',
  UTILITIES: '#10B981',
  SALARIES: '#F59E0B',
  MATERIALS: '#8B5CF6',
  MARKETING: '#EC4899',
  MAINTENANCE: '#06B6D4',
  TRANSPORT: '#EF4444',
  OFFICE_SUPPLIES: '#84CC16',
  PROFESSIONAL_FEES: '#F97316',
  INSURANCE: '#A855F7',
  BANK_CHARGES: '#6366F1',
  MISCELLANEOUS: '#6B7280',
}

export default function ExpenseReportPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(6)

  useEffect(() => {
    fetchReport()
  }, [timeRange])

  const fetchReport = async () => {
    setLoading(true)
    const response = await fetch(`/api/reports/expenses?months=${timeRange}`)
    const data = await response.json()
    setData(data)
    setLoading(false)
  }

  if (loading || !data) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Expense Report</h1>
              <p className="text-sm text-slate-600">
                Last {timeRange} months • Generated {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
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
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{data.summary.totalExpenses.toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹{data.summary.thisMonth.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-slate-600">
                {data.summary.growth >= 0 ? '+' : ''}
                {data.summary.growth}% vs last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.summary.transactionCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Avg/Month</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ₹
                {(
                  data.summary.totalExpenses / data.expensesByMonth.length
                ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Expense Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.expensesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="amount" fill="#EF4444" name="Expenses (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.expensesByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {data.expensesByCategory.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.category] || '#6B7280'}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Category</th>
                  <th className="text-right p-2">Transactions</th>
                  <th className="text-right p-2">Total Amount</th>
                  <th className="text-right p-2">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {data.expensesByCategory.map((cat: any) => (
                  <tr key={cat.category} className="border-b">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: CATEGORY_COLORS[cat.category] }}
                        />
                        {cat.category.replace(/_/g, ' ')}
                      </div>
                    </td>
                    <td className="text-right p-2">{cat.count}</td>
                    <td className="text-right p-2">
                      ₹{cat.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="text-right p-2">
                      {((cat.amount / data.summary.totalExpenses) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Top Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topExpenses.map((expense: any) => (
                <div
                  key={expense.id}
                  className="flex justify-between items-center p-3 border border-slate-200 rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{expense.title}</p>
                    <p className="text-sm text-slate-600">
                      {expense.category.replace(/_/g, ' ')} • {expense.user.name} •{' '}
                      {new Date(expense.date).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-red-600">
                    ₹{expense.amount.toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
