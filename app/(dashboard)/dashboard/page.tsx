import {
  Home,
} from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import DashboardLayout from "@/components/DashboardLayout"

// Client-side dashboard component
import { DashboardClient } from "@/components/dashboard/dashboard-client"

// Data fetching and session
import { auth } from "@/lib/auth"

export default async function Dashboard() {
  const session = await auth()
  if (!session?.user) {
    return <div>Not authenticated</div>
  }

  const userRole = session.user.role

  return (
    <DashboardLayout>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>
              <Home className="h-4 w-4" />
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6">
        <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {userRole === 'TAILOR' && 'Your workbench - Track your assigned work and deadlines'}
          {userRole === 'MASTER_TAILOR' && 'Production floor - Tailor workload, assignments and deadlines'}
          {userRole === 'INVENTORY_MANAGER' && 'Supply chain overview - Manage stock and suppliers'}
          {userRole === 'SALES_MANAGER' && 'Sales pipeline - Manage orders and customers'}
          {(userRole === 'OWNER' || userRole === 'ADMIN') && 'Business overview - Financial health and performance'}
          {userRole === 'VIEWER' && 'System overview - Read-only view of orders, production and stock'}
        </p>
      </div>

      {/* Role-based dashboard */}
      <DashboardClient userRole={userRole} />
    </DashboardLayout>
  )
}
