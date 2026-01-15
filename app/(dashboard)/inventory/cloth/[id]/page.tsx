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
import { Home, Package, ArrowLeft, ShoppingBag, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import DashboardLayout from '@/components/DashboardLayout'

async function getClothDetails(id: string) {
  try {
    const cloth = await prisma.clothInventory.findUnique({
      where: { id },
      include: {
        supplierRel: {
          select: {
            name: true,
            contactPerson: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            order: {
              include: {
                customer: {
                  select: {
                    name: true,
                    phone: true,
                  },
                },
              },
            },
            garmentPattern: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            order: {
              createdAt: 'desc',
            },
          },
        },
      },
    })

    return cloth
  } catch (error) {
    console.error('Error fetching cloth details:', error)
    return null
  }
}

export default async function ClothDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { id } = await params
  const cloth = await getClothDetails(id)

  if (!cloth) {
    redirect('/inventory')
  }

  const available = cloth.currentStock - cloth.reserved
  const totalValue = cloth.currentStock * cloth.pricePerMeter

  const getStockStatus = () => {
    if (available <= 0) return { label: 'Out of Stock', variant: 'destructive' as const }
    if (available < cloth.minimum * 0.5) return { label: 'Critical', variant: 'destructive' as const }
    if (available < cloth.minimum) return { label: 'Low Stock', variant: 'default' as const }
    return { label: 'In Stock', variant: 'default' as const }
  }

  const status = getStockStatus()

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
            <BreadcrumbLink href="/inventory">Inventory</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{cloth.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/inventory">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{cloth.name}</h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-mono">{cloth.sku}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Item Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Item Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Type</p>
                    <p className="font-semibold">{cloth.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Brand</p>
                    <p className="font-semibold">{cloth.brand}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Color</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded border border-slate-300"
                        style={{ backgroundColor: cloth.colorHex }}
                      />
                      <span className="font-semibold">{cloth.color}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Pattern</p>
                    <p className="font-semibold">{cloth.pattern}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Quality</p>
                    <p className="font-semibold">{cloth.quality}</p>
                  </div>
                  {cloth.location && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Location</p>
                      <p className="font-semibold">{cloth.location}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Related Orders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      Related Orders
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {cloth.orderItems.length} order{cloth.orderItems.length !== 1 ? 's' : ''} using this fabric
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {cloth.orderItems.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500">No orders using this fabric yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cloth.orderItems.map((item) => (
                      <Link key={item.id} href={`/orders/${item.order.id}`}>
                        <div className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {item.order.orderNumber}
                              </p>
                              <p className="text-sm text-slate-600">
                                {item.order.customer.name}
                              </p>
                            </div>
                            <Badge
                              variant={
                                item.order.status === 'DELIVERED'
                                  ? 'default'
                                  : item.order.status === 'CANCELLED'
                                  ? 'destructive'
                                  : 'outline'
                              }
                            >
                              {item.order.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4">
                              <span className="text-slate-600">
                                {item.garmentPattern.name}
                              </span>
                              <span className="text-slate-600">
                                Qty: {item.quantity}
                              </span>
                              <span className="text-slate-600">
                                {item.actualMetersUsed || item.estimatedMeters}m used
                              </span>
                            </div>
                            <span className="text-slate-500 text-xs">
                              {new Date(item.order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stock & Pricing */}
          <div className="space-y-6">
            {/* Stock Information */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-500">Status</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {available < cloth.minimum && (
                    <Link
                      href={`/purchase-orders/new?itemName=${encodeURIComponent(
                        cloth.name
                      )}&supplierId=${cloth.supplierId || ''}&itemType=CLOTH&quantity=${
                        Math.max(cloth.minimum * 2 - cloth.currentStock, cloth.minimum)
                      }&pricePerUnit=${cloth.pricePerMeter}&unit=meters&color=${encodeURIComponent(
                        cloth.color
                      )}&brand=${encodeURIComponent(cloth.brand)}&type=${encodeURIComponent(
                        cloth.type
                      )}`}
                    >
                      <Button variant="outline" size="sm" className="w-full mt-3 border-orange-500 text-orange-600 hover:bg-orange-50">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Create Purchase Order
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-600">Total Stock:</span>
                    <span className="font-semibold">{cloth.currentStock}m</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-600">Reserved:</span>
                    <span className="font-semibold text-orange-600">{cloth.reserved}m</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-600">Available:</span>
                    <span className="font-semibold text-green-600">{available}m</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-slate-600">Minimum:</span>
                    <span className="font-semibold">{cloth.minimum}m</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Information */}
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Price per Meter:</span>
                  <span className="font-semibold text-lg">{formatCurrency(cloth.pricePerMeter)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="text-slate-600">Total Value:</span>
                  <span className="font-semibold text-lg text-primary">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Supplier Information */}
            {cloth.supplierRel && (
              <Card>
                <CardHeader>
                  <CardTitle>Supplier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-semibold text-slate-900">{cloth.supplierRel.name}</p>
                  </div>
                  {cloth.supplierRel.contactPerson && (
                    <div>
                      <p className="text-sm text-slate-500">Contact Person</p>
                      <p className="text-sm">{cloth.supplierRel.contactPerson}</p>
                    </div>
                  )}
                  {cloth.supplierRel.phone && (
                    <div>
                      <p className="text-sm text-slate-500">Phone</p>
                      <p className="text-sm">{cloth.supplierRel.phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </DashboardLayout>
  )
}
