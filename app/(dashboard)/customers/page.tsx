import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Users, Plus, Search, Phone, Mail, MapPin, Home } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

async function getCustomers() {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/customers`, {
      cache: 'no-store',
    })

    if (!res.ok) {
      return { customers: [] }
    }

    return await res.json()
  } catch (error) {
    console.error('Error fetching customers:', error)
    return { customers: [] }
  }
}

export default async function CustomersPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const { customers } = await getCustomers()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumb className="mb-3">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">
                  <Home className="h-4 w-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Customers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Customers</h1>
              <p className="text-xs md:text-sm text-slate-600">{customers.length} total customers</p>
            </div>
            <PermissionGuard permission="manage_customers">
              <Link href="/customers/new">
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Customer</span>
                </Button>
              </Link>
            </PermissionGuard>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customer List */}
        {customers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No customers yet</h3>
              <p className="text-slate-600 mb-4">Get started by adding your first customer</p>
              <PermissionGuard permission="manage_customers">
                <Link href="/customers/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Customer
                  </Button>
                </Link>
              </PermissionGuard>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customers.map((customer: any) => (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{customer.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {customer.orders?.length || 0} orders
                        </CardDescription>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="h-4 w-4" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {customer.city && (
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="h-4 w-4" />
                          <span>{customer.city}</span>
                        </div>
                      )}
                    </div>

                    {customer.measurements && customer.measurements.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          Last measured: {new Date(customer.measurements[0].createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {customer.orders && customer.orders.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Latest order:</span>
                          <span className="font-medium text-slate-700">
                            {customer.orders[0].orderNumber}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
