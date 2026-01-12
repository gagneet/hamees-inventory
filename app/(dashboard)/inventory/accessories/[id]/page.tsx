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
import { Home, Package, ArrowLeft, ShoppingBag } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import DashboardLayout from '@/components/DashboardLayout'

async function getAccessoryDetails(id: string) {
  try {
    const accessory = await prisma.accessoryInventory.findUnique({
      where: { id },
    })

    return accessory
  } catch (error) {
    console.error('Error fetching accessory details:', error)
    return null
  }
}

export default async function AccessoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/')

  const { id } = await params
  const accessory = await getAccessoryDetails(id)

  if (!accessory) {
    redirect('/inventory')
  }

  const totalValue = accessory.currentStock * accessory.pricePerUnit

  const getStockStatus = () => {
    if (accessory.currentStock <= 0) return { label: 'Out of Stock', variant: 'destructive' as const }
    if (accessory.currentStock < accessory.minimum * 0.5) return { label: 'Critical', variant: 'destructive' as const }
    if (accessory.currentStock < accessory.minimum) return { label: 'Low Stock', variant: 'default' as const }
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
            <BreadcrumbPage>{accessory.name}</BreadcrumbPage>
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
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{accessory.name}</h1>
            <Badge variant="outline" className="mt-1">{accessory.type}</Badge>
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
                    <p className="font-semibold">{accessory.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Name</p>
                    <p className="font-semibold">{accessory.name}</p>
                  </div>
                  {accessory.color && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Color</p>
                      <p className="font-semibold">{accessory.color}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Usage Note */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Usage Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600">
                    Accessory usage tracking in orders is coming soon!
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    Currently, only cloth inventory is linked to orders.
                  </p>
                </div>
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
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-600">Current Stock:</span>
                    <span className="font-semibold">{accessory.currentStock} units</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-slate-600">Minimum:</span>
                    <span className="font-semibold">{accessory.minimum} units</span>
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
                  <span className="text-slate-600">Price per Unit:</span>
                  <span className="font-semibold text-lg">{formatCurrency(accessory.pricePerUnit)}</span>
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
            {accessory.supplier && (
              <Card>
                <CardHeader>
                  <CardTitle>Supplier</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{accessory.supplier}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </DashboardLayout>
  )
}
