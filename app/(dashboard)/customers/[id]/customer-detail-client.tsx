'use client'

import { useState } from 'react'
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
import { Home, ArrowLeft, User, Phone, Mail, MapPin, Calendar, ShoppingBag, Edit } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import DashboardLayout from '@/components/DashboardLayout'
import { CustomerMeasurementsSection } from '@/components/customer-measurements-section'
import { CustomerEditDialog } from '@/components/customer-edit-dialog'

interface CustomerDetailClientProps {
  customer: any
  canManageMeasurements: boolean
  highlight?: string
}

export function CustomerDetailClient({
  customer,
  canManageMeasurements,
  highlight,
}: CustomerDetailClientProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)

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
        {canManageMeasurements && (
          <Button size="sm" variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        )}
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
                {canManageMeasurements && (
                  <Link href={`/orders/new?customerId=${customer.id}`}>
                    <Button size="sm" variant="outline">
                      New Order
                    </Button>
                  </Link>
                )}
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
          <CustomerMeasurementsSection
            customerId={customer.id}
            measurements={customer.measurements as any}
            canManage={canManageMeasurements}
            highlight={highlight}
          />

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

      {/* Customer Edit Dialog */}
      <CustomerEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customer={customer}
      />
    </DashboardLayout>
  )
}
