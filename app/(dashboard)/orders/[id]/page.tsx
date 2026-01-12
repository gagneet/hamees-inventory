import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, ArrowLeft, ShoppingBag, User, Calendar, Package, DollarSign, Phone, Mail } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import DashboardLayout from '@/components/DashboardLayout'

async function getOrderDetails(id: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            city: true,
            address: true,
          },
        },
        items: {
          include: {
            clothInventory: {
              select: {
                id: true,
                name: true,
                sku: true,
                color: true,
                colorHex: true,
                type: true,
                brand: true,
                pricePerMeter: true,
              },
            },
            garmentPattern: {
              select: {
                name: true,
                description: true,
              },
            },
          },
        },
      },
    })

    return order
  } catch (error) {
    console.error('Error fetching order details:', error)
    return null
  }
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { id } = await params
  const order = await getOrderDetails(id)

  if (!order) {
    redirect('/orders')
  }

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    NEW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    MATERIAL_SELECTED: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    CUTTING: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    STITCHING: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
    FINISHING: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    READY: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    DELIVERED: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
    CANCELLED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  }

  const statusLabels: Record<string, string> = {
    NEW: 'New',
    MATERIAL_SELECTED: 'Material Selected',
    CUTTING: 'Cutting',
    STITCHING: 'Stitching',
    FINISHING: 'Finishing',
    READY: 'Ready',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  }

  const statusStyle = statusColors[order.status as keyof typeof statusColors]
  const deliveryDate = new Date(order.deliveryDate)
  const isOverdue = deliveryDate < new Date() && order.status !== 'DELIVERED' && order.status !== 'CANCELLED'

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
            <BreadcrumbLink href="/orders">Orders</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{order.orderNumber}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{order.orderNumber}</h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
              Ordered on {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>
        </div>
        <Badge
          className={`px-3 py-1 text-sm ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}
        >
          {statusLabels[order.status]}
        </Badge>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Order Items ({order.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <Link key={item.id} href={`/inventory/cloth/${item.clothInventory.id}`}>
                    <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded border border-slate-300"
                            style={{ backgroundColor: item.clothInventory.colorHex }}
                          />
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.garmentPattern.name}
                            </p>
                            <p className="text-sm text-slate-600">
                              {item.clothInventory.name} ({item.clothInventory.color})
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-1">
                              SKU: {item.clothInventory.sku}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(item.totalPrice)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(item.pricePerUnit)}/unit
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Quantity</p>
                          <p className="font-medium text-slate-900">{item.quantity}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Estimated Fabric</p>
                          <p className="font-medium text-slate-900">{item.estimatedMeters}m</p>
                        </div>
                        {item.actualMetersUsed && (
                          <div>
                            <p className="text-slate-500">Actual Used</p>
                            <p className="font-medium text-slate-900">{item.actualMetersUsed}m</p>
                          </div>
                        )}
                      </div>
                      {item.notes && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                          <p className="text-sm text-slate-600">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Name</p>
                  <p className="font-semibold text-slate-900">{order.customer.name}</p>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4" />
                  <span>{order.customer.phone}</span>
                </div>
                {order.customer.email && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="h-4 w-4" />
                    <span>{order.customer.email}</span>
                  </div>
                )}
                {order.customer.address && (
                  <div>
                    <p className="text-sm text-slate-500">Address</p>
                    <p className="text-slate-700">{order.customer.address}</p>
                    {order.customer.city && (
                      <p className="text-slate-700">{order.customer.city}</p>
                    )}
                  </div>
                )}
                <div className="pt-3 border-t">
                  <Link href={`/customers/${order.customer.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Customer Profile
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Dates */}
        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Amount:</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(order.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Advance Paid:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(order.advancePaid)}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="text-slate-600">Balance Due:</span>
                <span className={`font-semibold text-lg ${
                  order.balanceAmount > 0 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {formatCurrency(order.balanceAmount)}
                </span>
              </div>
              {order.balanceAmount > 0 && (
                <div className="mt-3">
                  <Button className="w-full" size="sm">
                    Record Payment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Important Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Important Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Order Date</p>
                <p className="font-medium text-slate-900">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    dateStyle: 'medium',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Delivery Date</p>
                <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                  {deliveryDate.toLocaleDateString('en-IN', {
                    dateStyle: 'medium',
                  })}
                  {isOverdue && ' (Overdue)'}
                </p>
              </div>
              {order.completedDate && (
                <div>
                  <p className="text-sm text-slate-500">Completed On</p>
                  <p className="font-medium text-green-600">
                    {new Date(order.completedDate).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <>
                  <Button className="w-full" variant="outline" size="sm">
                    Update Status
                  </Button>
                  <Button className="w-full" variant="outline" size="sm">
                    Edit Order
                  </Button>
                </>
              )}
              <Button className="w-full" variant="outline" size="sm">
                Print Invoice
              </Button>
              <Button className="w-full" variant="outline" size="sm">
                Send WhatsApp Update
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
