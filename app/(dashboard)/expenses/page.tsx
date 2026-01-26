'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import {
  Home,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Receipt,
  Wallet,
} from 'lucide-react'
import { DateRangePicker, type DateRangeWithLabel } from '@/components/date-range-picker'
import { ExpensesFilter, type ExpenseFilters } from '@/components/expenses-filter'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import DashboardLayout from '@/components/DashboardLayout'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'

interface ExpensesData {
  dateRange: {
    from: string
    to: string
    label: string
  }
  summary: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    orderCount: number
    purchaseCount: number
    expenseCount: number
    gstCollected: number
    gstPaid: number
    netGST: number
  }
  orders: Array<{
    id: string
    orderNumber: string
    customerName: string
    totalAmount: number
    completedDate: string
    gstAmount: number
    cgst: number
    sgst: number
    igst: number
    items: Array<{
      garmentName: string
      fabricName: string
      metersUsed: number
    }>
  }>
  purchases: Array<{
    id: string
    fabricName: string
    fabricType: string
    quantity: number
    pricePerMeter: number
    totalCost: number
    createdAt: string
    purchasedBy: string
  }>
  expenses: Array<{
    id: string
    category: string
    description: string
    amount: number
    gstAmount: number
    totalAmount: number
    expenseDate: string
    vendorName: string | null
    paymentMode: string
    paidBy: string
    notes: string | null
  }>
}

function ExpensesContent() {
  const [dateRange, setDateRange] = useState<DateRangeWithLabel | undefined>(undefined)
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [data, setData] = useState<ExpensesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData(dateRange, filters)
  }, [dateRange, filters])

  const fetchData = async (range: DateRangeWithLabel | undefined, filters: ExpenseFilters) => {
    setLoading(true)
    setError(null)
    try {
      let url = '/api/expenses'
      const params = new URLSearchParams()

      if (range?.from && range?.to) {
        params.append('from', range.from.toISOString())
        params.append('to', range.to.toISOString())
      }

      // Add filters
      if (filters.customerName) params.append('customerName', filters.customerName)
      if (filters.category) params.append('category', filters.category)
      if (filters.minAmount) params.append('minAmount', filters.minAmount)
      if (filters.maxAmount) params.append('maxAmount', filters.maxAmount)
      if (filters.paymentMode) params.append('paymentMode', filters.paymentMode)

      const queryString = params.toString()
      if (queryString) {
        url = `${url}?${queryString}`
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch expenses data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDateRangeChange = (range: DateRangeWithLabel) => {
    setDateRange(range)
  }

  const handleFiltersChange = (newFilters: ExpenseFilters) => {
    setFilters(newFilters)
  }

  const handleResetFilters = () => {
    setFilters({})
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Loading expenses data...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-red-500">Error: {error}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!data) return null

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Expenses</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h1 className="text-lg font-semibold md:text-2xl">Expenses & Revenue</h1>
        <div className="flex gap-2">
          <ExpensesFilter
            filters={filters}
            onChange={handleFiltersChange}
            onReset={handleResetFilters}
          />
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
        </div>
      </div>

      {/* Summary Cards - All Clickable */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Total Revenue Card */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.summary.totalRevenue)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {data.summary.orderCount} orders delivered • Click for details
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Revenue Breakdown</DialogTitle>
              <DialogDescription>
                Detailed view of {data.summary.orderCount} delivered orders
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(data.summary.totalRevenue)}
                </p>
              </div>
              {data.orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{order.customerName}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {format(new Date(order.completedDate), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(order.totalAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-slate-500">No revenue this period</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Total Expenses Card */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.summary.totalExpenses)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {data.summary.purchaseCount} purchases • Click for details
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Expenses Breakdown</DialogTitle>
              <DialogDescription>
                Inventory purchases and operational expenses
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(data.summary.totalExpenses)}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Breakdown</p>
                  <p className="text-sm font-medium text-slate-900">
                    Purchases: {data.summary.purchaseCount}
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    Expenses: {data.summary.expenseCount}
                  </p>
                </div>
              </div>
              {data.purchases.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">Inventory Purchases</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fabric</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.purchases.slice(0, 10).map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">{purchase.fabricName}</TableCell>
                          <TableCell>{purchase.quantity.toFixed(2)}m</TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(purchase.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Net Profit Card */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                <DollarSign className={`h-4 w-4 ${data.summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(data.summary.netProfit)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {data.summary.netProfit >= 0 ? 'Profit' : 'Loss'} • Click for details
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900">Profit & Loss Statement</DialogTitle>
              <DialogDescription>
                Financial summary for {data.dateRange.label}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-slate-600">Total Revenue</span>
                  <span className="text-lg font-semibold text-green-600">
                    + {formatCurrency(data.summary.totalRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-slate-600">Total Expenses</span>
                  <span className="text-lg font-semibold text-red-600">
                    - {formatCurrency(data.summary.totalExpenses)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-4 bg-slate-50 px-4 rounded-lg">
                  <span className="font-bold text-slate-900">Net Profit/Loss</span>
                  <span className={`text-2xl font-bold ${data.summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {data.summary.netProfit >= 0 ? '+' : ''} {formatCurrency(data.summary.netProfit)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">Profit Margin</p>
                  <p className="text-xl font-bold text-blue-600">
                    {data.summary.totalRevenue > 0
                      ? ((data.summary.netProfit / data.summary.totalRevenue) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-xs text-slate-600 mb-1">Orders Delivered</p>
                  <p className="text-xl font-bold text-green-600">
                    {data.summary.orderCount}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Net GST Card */}
        <Dialog>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net GST</CardTitle>
                <Receipt className={`h-4 w-4 ${data.summary.netGST >= 0 ? 'text-purple-600' : 'text-green-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.summary.netGST >= 0 ? 'text-purple-600' : 'text-green-600'}`}>
                  {formatCurrency(data.summary.netGST)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {data.summary.netGST >= 0 ? 'Payable' : 'Refund'} • Click for details
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-slate-900">GST Liability Breakdown</DialogTitle>
              <DialogDescription>
                Input Tax Credit and Output GST for {data.dateRange.label}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <p className="font-medium text-slate-900">Output GST (Collected)</p>
                    <p className="text-xs text-slate-500">From {data.summary.orderCount} orders</p>
                  </div>
                  <span className="text-lg font-semibold text-green-600">
                    + {formatCurrency(data.summary.gstCollected)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b">
                  <div>
                    <p className="font-medium text-slate-900">Input Tax Credit (Paid)</p>
                    <p className="text-xs text-slate-500">On purchases & expenses</p>
                  </div>
                  <span className="text-lg font-semibold text-orange-600">
                    - {formatCurrency(data.summary.gstPaid)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-4 bg-slate-50 px-4 rounded-lg">
                  <div>
                    <p className="font-bold text-slate-900">Net GST Liability</p>
                    <p className="text-xs text-slate-500">
                      {data.summary.netGST >= 0 ? 'To be paid to government' : 'Refundable from government'}
                    </p>
                  </div>
                  <span className={`text-2xl font-bold ${data.summary.netGST >= 0 ? 'text-purple-600' : 'text-blue-600'}`}>
                    {formatCurrency(Math.abs(data.summary.netGST))}
                  </span>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This is a calculated estimate. Please verify with your accountant before filing GST returns.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* GST Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            GST Summary
          </CardTitle>
          <CardDescription>GST collected and paid for {data.dateRange.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Output GST (Collected)</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.gstCollected)}</p>
              <p className="text-xs text-slate-500 mt-1">From {data.summary.orderCount} orders</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Input Tax Credit (Paid)</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.summary.gstPaid)}</p>
              <p className="text-xs text-slate-500 mt-1">On purchases & expenses</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Net GST Liability</p>
              <p className={`text-2xl font-bold ${data.summary.netGST >= 0 ? 'text-purple-600' : 'text-blue-600'}`}>
                {formatCurrency(Math.abs(data.summary.netGST))}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {data.summary.netGST >= 0 ? 'To be paid to government' : 'Refundable from government'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivered Orders */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Delivered Orders ({data.orders.length})
          </CardTitle>
          <CardDescription>Orders completed in {data.dateRange.label}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.orders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link href={`/orders?search=${order.orderNumber}`} className="text-blue-600 hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-slate-600">
                              {item.garmentName} ({item.metersUsed.toFixed(2)}m)
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-xs text-slate-400">+{order.items.length - 2} more</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {format(new Date(order.completedDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No orders delivered this month</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Purchases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Purchases ({data.purchases.length})
          </CardTitle>
          <CardDescription>Fabric purchases in {data.dateRange.label}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.purchases.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fabric</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price/Meter</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead>Purchased By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{purchase.fabricName}</TableCell>
                      <TableCell className="text-slate-600">{purchase.fabricType}</TableCell>
                      <TableCell className="text-right">{purchase.quantity.toFixed(2)}m</TableCell>
                      <TableCell className="text-right">{formatCurrency(purchase.pricePerMeter)}</TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(purchase.totalCost)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{purchase.purchasedBy}</TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {format(new Date(purchase.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No inventory purchases this month</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Expenses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Business Expenses ({data.expenses.length})
          </CardTitle>
          <CardDescription>Operating expenses in {data.dateRange.label}</CardDescription>
        </CardHeader>
        <CardContent>
          {data.expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-sm text-slate-600">
                        {format(new Date(expense.expenseDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {expense.category.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium max-w-xs truncate">
                        {expense.description}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {expense.vendorName || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {expense.paymentMode.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {expense.gstAmount > 0 ? formatCurrency(expense.gstAmount) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(expense.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Wallet className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No expenses recorded for this period</p>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500">Loading...</p>
        </div>
      </DashboardLayout>
    }>
      <ExpensesContent />
    </Suspense>
  )
}
