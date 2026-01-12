import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, Plus, Filter, Calendar, User, Home } from 'lucide-react'
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
import { prisma } from '@/lib/db'

async function getOrders() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: {
          include: {
            garmentPattern: true,
            clothInventory: {
              select: {
                id: true,
                name: true,
                color: true,
                colorHex: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return orders
  } catch (error) {
    console.error('Error fetching orders:', error)
    return []
  }
}

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

export default async function OrdersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const orders = await getOrders()

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
        <PermissionGuard permission="create_order">
          <Link href="/orders/new">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Order</span>
            </Button>
          </Link>
        </PermissionGuard>
      </div>

      {/* Main Content */}
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Statuses</option>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by order number or customer..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order List */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders yet</h3>
              <p className="text-slate-600 mb-4">Create your first order to get started</p>
              <PermissionGuard permission="create_order">
                <Link href="/orders/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Order
                  </Button>
                </Link>
              </PermissionGuard>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => {
              const statusStyle = statusColors[order.status as OrderStatus]
              const deliveryDate = new Date(order.deliveryDate)
              const isOverdue = deliveryDate < new Date() && order.status !== 'DELIVERED' && order.status !== 'CANCELLED'

              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base md:text-lg">{order.orderNumber}</CardTitle>
                          <p className="text-sm text-slate-600 mt-1">{order.customer.name}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          {statusLabels[order.status as OrderStatus]}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 mb-1">Total Amount</p>
                          <p className="font-semibold text-slate-900">
                            ₹{order.totalAmount.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Balance</p>
                          <p className="font-semibold text-slate-900">
                            ₹{order.balanceAmount.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Delivery Date</p>
                          <p className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                            {deliveryDate.toLocaleDateString()}
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
          </div>
        )}
    </DashboardLayout>
  )
}
