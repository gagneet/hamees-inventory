'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import DashboardLayout from '@/components/DashboardLayout'
import { formatCurrency } from '@/lib/utils'
import { format, parse, addMonths, subMonths } from 'date-fns'

interface ExpensesData {
  month: string
  monthStart: string
  monthEnd: string
  summary: {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    orderCount: number
    purchaseCount: number
  }
  orders: Array<{
    id: string
    orderNumber: string
    customerName: string
    totalAmount: number
    completedDate: string
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
}

function ExpensesContent() {
  const searchParams = useSearchParams()
  const monthParam = searchParams.get('month')

  const [currentMonth, setCurrentMonth] = useState<string>(
    monthParam || format(new Date(), 'MMM yyyy')
  )
  const [data, setData] = useState<ExpensesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData(currentMonth)
  }, [currentMonth])

  const fetchData = async (month: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/expenses?month=${encodeURIComponent(month)}`)
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

  const handlePreviousMonth = () => {
    const parsedDate = parse(currentMonth, 'MMM yyyy', new Date())
    const prevMonth = subMonths(parsedDate, 1)
    setCurrentMonth(format(prevMonth, 'MMM yyyy'))
  }

  const handleNextMonth = () => {
    const parsedDate = parse(currentMonth, 'MMM yyyy', new Date())
    const nextMonth = addMonths(parsedDate, 1)
    setCurrentMonth(format(nextMonth, 'MMM yyyy'))
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

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Monthly Expenses & Revenue</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-md">
            <Calendar className="h-4 w-4 text-slate-600" />
            <span className="font-medium">{currentMonth}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.summary.totalRevenue)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.orderCount} orders delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.summary.totalExpenses)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.purchaseCount} inventory purchases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className={`h-4 w-4 ${data.summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(data.summary.netProfit)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {data.summary.netProfit >= 0 ? 'Profit' : 'Loss'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Delivered Orders */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Delivered Orders ({data.orders.length})
          </CardTitle>
          <CardDescription>Orders completed in {currentMonth}</CardDescription>
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
                              {item.garmentName} ({item.metersUsed.toFixed(1)}m)
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
          <CardDescription>Fabric purchases in {currentMonth}</CardDescription>
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
                      <TableCell className="text-right">{purchase.quantity.toFixed(1)}m</TableCell>
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
