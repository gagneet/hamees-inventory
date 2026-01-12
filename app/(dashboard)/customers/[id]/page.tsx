import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
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
import { Home, ArrowLeft, User, Phone, Mail, MapPin, Calendar, ShoppingBag, Ruler, Edit } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import DashboardLayout from '@/components/DashboardLayout'
import { PermissionGuard } from '@/components/auth/permission-guard'

async function getCustomerDetails(id: string) {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/customers/${id}`, {
      cache: 'no-store',
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    return data.customer
  } catch (error) {
    console.error('Error fetching customer details:', error)
    return null
  }
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { id } = await params
  const customer = await getCustomerDetails(id)

  if (!customer) {
    redirect('/customers')
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

  const garmentTypeLabels: Record<string, string> = {
    SHIRT: 'Shirt',
    TROUSER: 'Trouser',
    SUIT: 'Suit',
    SHERWANI: 'Sherwani',
  }

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
            <BreadcrumbLink href="/customers">Customers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{customer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{customer.name}</h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300">
              Customer since {new Date(customer.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>
        </div>
        <PermissionGuard permission="manage_customers">
          <Button size="sm" variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </PermissionGuard>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Contact Info & Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-medium text-slate-900">{customer.phone}</p>
                  </div>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="font-medium text-slate-900">{customer.email}</p>
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-slate-500 mt-1" />
                    <div>
                      <p className="text-sm text-slate-500">Address</p>
                      <p className="font-medium text-slate-900">{customer.address}</p>
                      {customer.city && <p className="text-slate-700">{customer.city}</p>}
                      {customer.state && <p className="text-slate-700">{customer.state}</p>}
                      {customer.pincode && <p className="text-slate-700">{customer.pincode}</p>}
                    </div>
                  </div>
                )}
                {customer.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-slate-500 mb-1">Notes</p>
                    <p className="text-slate-700">{customer.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Orders */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Orders ({customer.orders?.length || 0})
                </CardTitle>
                <PermissionGuard permission="create_order">
                  <Link href={`/orders/new?customerId=${customer.id}`}>
                    <Button size="sm" variant="outline">
                      New Order
                    </Button>
                  </Link>
                </PermissionGuard>
              </div>
            </CardHeader>
            <CardContent>
              {!customer.orders || customer.orders.length === 0 ? (
                <div className="py-8 text-center">
                  <ShoppingBag className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.orders.map((order: any) => {
                    const statusStyle = statusColors[order.status as keyof typeof statusColors]
                    const deliveryDate = new Date(order.deliveryDate)
                    const isOverdue = deliveryDate < new Date() && order.status !== 'DELIVERED' && order.status !== 'CANCELLED'

                    return (
                      <Link key={order.id} href={`/orders/${order.id}`}>
                        <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                              <p className="text-sm text-slate-600">
                                {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                              </p>
                            </div>
                            <Badge
                              className={`${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}
                            >
                              {statusLabels[order.status]}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Total</p>
                              <p className="font-medium text-slate-900">
                                {formatCurrency(order.totalAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Balance</p>
                              <p className="font-medium text-slate-900">
                                {formatCurrency(order.balanceAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Delivery</p>
                              <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                                {deliveryDate.toLocaleDateString('en-IN')}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                            {order.items.slice(0, 3).map((item: any, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-700"
                              >
                                {item.garmentPattern.name}
                              </span>
                            ))}
                            {order.items.length > 3 && (
                              <span className="text-xs px-2 py-1 text-slate-500">
                                +{order.items.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Measurements */}
        <div className="space-y-6">
          {/* Measurements */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="h-5 w-5" />
                  Measurements
                </CardTitle>
                <PermissionGuard permission="manage_customers">
                  <Button size="sm" variant="outline">
                    Add
                  </Button>
                </PermissionGuard>
              </div>
              <CardDescription>
                {customer.measurements?.length || 0} measurement records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!customer.measurements || customer.measurements.length === 0 ? (
                <div className="py-8 text-center">
                  <Ruler className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 mb-4">No measurements yet</p>
                  <PermissionGuard permission="manage_customers">
                    <Button size="sm" variant="outline">
                      Add Measurements
                    </Button>
                  </PermissionGuard>
                </div>
              ) : (
                <div className="space-y-4">
                  {customer.measurements.map((measurement: any) => (
                    <div key={measurement.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {garmentTypeLabels[measurement.garmentType]}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(measurement.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {measurement.bodyType}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {measurement.length && (
                          <div>
                            <span className="text-slate-500">Length:</span>{' '}
                            <span className="font-medium">{measurement.length} cm</span>
                          </div>
                        )}
                        {measurement.chest && (
                          <div>
                            <span className="text-slate-500">Chest:</span>{' '}
                            <span className="font-medium">{measurement.chest} cm</span>
                          </div>
                        )}
                        {measurement.waist && (
                          <div>
                            <span className="text-slate-500">Waist:</span>{' '}
                            <span className="font-medium">{measurement.waist} cm</span>
                          </div>
                        )}
                        {measurement.shoulder && (
                          <div>
                            <span className="text-slate-500">Shoulder:</span>{' '}
                            <span className="font-medium">{measurement.shoulder} cm</span>
                          </div>
                        )}
                        {measurement.sleeve && (
                          <div>
                            <span className="text-slate-500">Sleeve:</span>{' '}
                            <span className="font-medium">{measurement.sleeve} cm</span>
                          </div>
                        )}
                        {measurement.neck && (
                          <div>
                            <span className="text-slate-500">Neck:</span>{' '}
                            <span className="font-medium">{measurement.neck} cm</span>
                          </div>
                        )}
                        {measurement.hip && (
                          <div>
                            <span className="text-slate-500">Hip:</span>{' '}
                            <span className="font-medium">{measurement.hip} cm</span>
                          </div>
                        )}
                        {measurement.inseam && (
                          <div>
                            <span className="text-slate-500">Inseam:</span>{' '}
                            <span className="font-medium">{measurement.inseam} cm</span>
                          </div>
                        )}
                      </div>
                      {measurement.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-slate-600">{measurement.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{customer.orders?.length || 0}</p>
              </div>
              {customer.orders && customer.orders.length > 0 && (
                <>
                  <div>
                    <p className="text-sm text-slate-500">Total Spent</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(
                        customer.orders.reduce((sum: number, order: any) => sum + order.totalAmount, 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(
                        customer.orders.reduce((sum: number, order: any) => sum + order.balanceAmount, 0)
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Last Order</p>
                    <p className="font-medium text-slate-900">
                      {new Date(customer.orders[0].createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
