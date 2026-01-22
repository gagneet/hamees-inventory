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

// Role-based dashboard router
import { RoleDashboardRouter } from "@/components/dashboard/role-dashboard-router"

// Data fetching and session
import { auth } from "@/lib/auth"
import { getDashboardData } from "@/lib/dashboard-data"

export default async function Dashboard() {
  const session = await auth()
  if (!session?.user) {
    return <div>Not authenticated</div>
  }

  const userRole = session.user.role
  const dashboardData = await getDashboardData('month')

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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {userRole === 'TAILOR' && 'Your workbench - Track production and deadlines'}
            {userRole === 'INVENTORY_MANAGER' && 'Supply chain overview - Manage stock and suppliers'}
            {userRole === 'SALES_MANAGER' && 'Sales pipeline - Manage orders and customers'}
            {(userRole === 'OWNER' || userRole === 'ADMIN') && 'Business overview - Financial health and performance'}
            {userRole === 'VIEWER' && 'System overview - Read-only access to all data'}
          </p>
        </div>
      </div>

      {/* Role-based dashboard */}
      <RoleDashboardRouter userRole={userRole} dashboardData={dashboardData} />
    </DashboardLayout>
  )
}
