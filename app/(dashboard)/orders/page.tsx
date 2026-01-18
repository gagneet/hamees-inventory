'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ShoppingBag, Plus, Filter, Calendar, User, Home, X, DollarSign } from 'lucide-react'
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
import { PermissionGuard } from '@/components/auth/permission-guard'
import { OrderStatus } from '@/lib/types'
import DashboardLayout from '@/components/DashboardLayout'
import { Pagination } from '@/components/ui/pagination'

const statusColors: Record<OrderStatus, { bg: string; text: string; border: string }> = {
  NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  MATERIAL_SELECTED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CUTTING: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  STITCHING: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  FINISHING: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  READY: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  DELIVERED: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const statusLabels: Record<OrderStatus, string> = {
  NEW: 'New',
  MATERIAL_SELECTED: 'Material Selected',
  CUTTING: 'Cutting',
  STITCHING: 'Stitching',
  FINISHING: 'Finishing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

function OrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [orders, setOrders] = useState<any[]>([])
  const [fabrics, setFabrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Check if user is a Tailor (hide pricing information)
  const isTailor = session?.user?.role === 'TAILOR'

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Filter states
  const [status, setStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fabricId, setFabricId] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [deliveryDateFrom, setDeliveryDateFrom] = useState('')
  const [deliveryDateTo, setDeliveryDateTo] = useState('')
  const [isOverdue, setIsOverdue] = useState(false)
  const [balanceOutstanding, setBalanceOutstanding] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Initialize filter states from URL params and respond to URL changes
  useEffect(() => {
    const urlStatus = searchParams.get('status') || ''
    const urlSearch = searchParams.get('search') || ''
    const urlFabricId = searchParams.get('fabricId') || ''
    const urlMinAmount = searchParams.get('minAmount') || ''
    const urlMaxAmount = searchParams.get('maxAmount') || ''
    const urlDeliveryDateFrom = searchParams.get('deliveryDateFrom') || ''
    const urlDeliveryDateTo = searchParams.get('deliveryDateTo') || ''
    const urlIsOverdue = searchParams.get('isOverdue') === 'true'
    const urlBalanceOutstanding = searchParams.get('balanceAmount') === 'gt:0'

    setStatus(urlStatus)
    setSearchTerm(urlSearch)
    setDebouncedSearch(urlSearch)
    setFabricId(urlFabricId)
    setMinAmount(urlMinAmount)
    setMaxAmount(urlMaxAmount)
    setDeliveryDateFrom(urlDeliveryDateFrom)
    setDeliveryDateTo(urlDeliveryDateTo)
    setIsOverdue(urlIsOverdue)
    setBalanceOutstanding(urlBalanceOutstanding)
    setCurrentPage(1) // Reset to first page when URL params change
  }, [
    searchParams.get('status'),
    searchParams.get('search'),
    searchParams.get('fabricId'),
    searchParams.get('minAmount'),
    searchParams.get('maxAmount'),
    searchParams.get('deliveryDateFrom'),
    searchParams.get('deliveryDateTo'),
    searchParams.get('isOverdue'),
    searchParams.get('balanceAmount'),
  ])

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch fabrics for filter
  useEffect(() => {
    async function fetchFabrics() {
      try {
        const response = await fetch('/api/inventory/cloth')
        const data = await response.json()
        if (data.items) {
          setFabrics(data.items)
        }
      } catch (error) {
        console.error('Error fetching fabrics:', error)
      }
    }
    fetchFabrics()
  }, [])

  // Fetch orders
  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (status) params.append('status', status)
        if (debouncedSearch) params.append('search', debouncedSearch)
        if (fabricId) params.append('fabricId', fabricId)
        if (minAmount) params.append('minAmount', minAmount)
        if (maxAmount) params.append('maxAmount', maxAmount)
        if (deliveryDateFrom) params.append('deliveryDateFrom', deliveryDateFrom)
        if (deliveryDateTo) params.append('deliveryDateTo', deliveryDateTo)
        if (isOverdue) params.append('isOverdue', 'true')
        if (balanceOutstanding) params.append('balanceAmount', 'gt:0')

        // Add pagination params
        params.append('page', currentPage.toString())
        params.append('limit', pageSize.toString())

        const response = await fetch(`/api/orders?${params.toString()}`)
        const data = await response.json()

        if (data.orders) {
          setOrders(data.orders)
        }
        if (data.pagination) {
          setTotalItems(data.pagination.totalItems)
          setTotalPages(data.pagination.totalPages)
        }
      } catch (error) {
        console.error('Error fetching orders:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [status, debouncedSearch, fabricId, minAmount, maxAmount, deliveryDateFrom, deliveryDateTo, isOverdue, balanceOutstanding, currentPage, pageSize])

  const clearFilters = () => {
    setStatus('')
    setSearchTerm('')
    setFabricId('')
    setMinAmount('')
    setMaxAmount('')
    setDeliveryDateFrom('')
    setDeliveryDateTo('')
    setIsOverdue(false)
    setBalanceOutstanding(false)
    setCurrentPage(1) // Reset to first page when clearing filters
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1) // Reset to first page when changing page size
  }

  const hasActiveFilters = status || searchTerm || fabricId || minAmount || maxAmount || deliveryDateFrom || deliveryDateTo || isOverdue || balanceOutstanding

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
            <BreadcrumbPage>Orders</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">Orders</h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">{orders.length} total orders</p>
        </div>
        <div className="flex gap-2">
          {!isTailor && (
            <Button
              size="sm"
              variant={balanceOutstanding ? "default" : "outline"}
              className={`gap-2 ${balanceOutstanding ? 'bg-red-600 hover:bg-red-700' : 'border-red-300 text-red-600 hover:bg-red-50'}`}
              onClick={() => setBalanceOutstanding(!balanceOutstanding)}
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">{balanceOutstanding ? 'Show All' : 'View Arrears'}</span>
              <span className="sm:hidden">{balanceOutstanding ? 'All' : 'Arrears'}</span>
            </Button>
          )}
          <PermissionGuard permission="create_order">
            <Link href="/orders/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Order</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          </PermissionGuard>
        </div>
      </div>

      {/* Main Content */}
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {/* Basic Filters */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                  <select
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search by order number or customer..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Advanced Filters Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Filter className="h-4 w-4" />
                  {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                    Clear All Filters
                  </button>
                )}
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="pt-4 space-y-4 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Fabric Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Fabric</label>
                      <select
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={fabricId}
                        onChange={(e) => setFabricId(e.target.value)}
                      >
                        <option value="">All Fabrics</option>
                        {fabrics.map((fabric) => (
                          <option key={fabric.id} value={fabric.id}>
                            {fabric.name} ({fabric.color})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Min Amount - Hidden for Tailor */}
                    {!isTailor && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Min Amount (₹)</label>
                        <input
                          type="number"
                          placeholder="0"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Max Amount - Hidden for Tailor */}
                    {!isTailor && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Max Amount (₹)</label>
                        <input
                          type="number"
                          placeholder="999999"
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                        />
                      </div>
                    )}

                    {/* Delivery Date From */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Delivery From</label>
                      <input
                        type="date"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={deliveryDateFrom}
                        onChange={(e) => setDeliveryDateFrom(e.target.value)}
                      />
                    </div>

                    {/* Delivery Date To */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Delivery To</label>
                      <input
                        type="date"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={deliveryDateTo}
                        onChange={(e) => setDeliveryDateTo(e.target.value)}
                      />
                    </div>

                    {/* Overdue Checkbox */}
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                          checked={isOverdue}
                          onChange={(e) => setIsOverdue(e.target.checked)}
                        />
                        <span className="text-sm font-medium text-slate-700">Show Overdue Only</span>
                      </label>
                    </div>

                    {/* Balance Outstanding Checkbox - Hidden for Tailor */}
                    {!isTailor && (
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
                            checked={balanceOutstanding}
                            onChange={(e) => setBalanceOutstanding(e.target.checked)}
                          />
                          <span className="text-sm font-medium text-slate-700">Balance Outstanding</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order List */}
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-slate-600">Loading orders...</span>
              </div>
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {hasActiveFilters ? 'No orders found' : 'No orders yet'}
              </h3>
              <p className="text-slate-600 mb-4">
                {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first order to get started'}
              </p>
              {!hasActiveFilters && (
                <PermissionGuard permission="create_order">
                  <Link href="/orders/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Order
                    </Button>
                  </Link>
                </PermissionGuard>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const statusStyle = statusColors[order.status as OrderStatus]
              const deliveryDate = new Date(order.deliveryDate)
              const today = new Date()
              today.setHours(0, 0, 0, 0) // Normalize to start of day
              const deliveryDateNormalized = new Date(deliveryDate)
              deliveryDateNormalized.setHours(0, 0, 0, 0) // Normalize to start of day
              const isOverdue = deliveryDateNormalized < today && order.status !== 'DELIVERED' && order.status !== 'CANCELLED'
              // Use 0.01 threshold (1 paisa) to avoid floating-point precision errors
              const isArrears = order.status === 'DELIVERED' && order.balanceAmount > 0.01

              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base md:text-lg">{order.orderNumber}</CardTitle>
                          <p className="text-sm text-slate-600 mt-1">{order.customer.name}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                          >
                            {statusLabels[order.status as OrderStatus]}
                          </span>
                          {isArrears && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-300">
                              ARREARS
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className={`grid ${isTailor ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} gap-4 text-sm`}>
                        {!isTailor && (
                          <>
                            <div>
                              <p className="text-slate-500 mb-1">Total Amount</p>
                              <p className="font-semibold text-slate-900">
                                ₹{order.totalAmount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500 mb-1">Balance</p>
                              <p className={`font-semibold ${isArrears ? 'text-red-600' : order.balanceAmount > 0.01 ? 'text-orange-600' : 'text-green-600'}`}>
                                ₹{Math.max(0, order.balanceAmount).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                              </p>
                            </div>
                          </>
                        )}
                        <div>
                          <p className="text-slate-500 mb-1">Delivery Date</p>
                          <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                            {deliveryDate.toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                            {isOverdue && ' (Overdue)'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Items</p>
                          <p className="font-semibold text-slate-900">{order.items.length}</p>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex flex-wrap gap-2">
                          {order.items.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg text-xs"
                            >
                              <div
                                className="h-3 w-3 rounded"
                                style={{ backgroundColor: item.clothInventory.colorHex }}
                              ></div>
                              <span className="text-slate-700">
                                {item.garmentPattern.name} - {item.clothInventory.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}

            {/* Pagination */}
            {!loading && orders.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </div>
        )}
    </DashboardLayout>
  )
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-600">Loading orders...</span>
        </div>
      </DashboardLayout>
    }>
      <OrdersContent />
    </Suspense>
  )
}
