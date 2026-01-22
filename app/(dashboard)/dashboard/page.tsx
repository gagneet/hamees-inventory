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
import { DateRangeSelector } from "@/components/dashboard/date-range-selector"

// Data fetching and session
import { auth } from "@/lib/auth"
import { getDashboardData, type DateRangePreset } from "@/lib/dashboard-data"

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Dashboard({ searchParams }: DashboardPageProps) {
  const session = await auth()
  if (!session?.user) {
    return <div>Not authenticated</div>
  }

  const userRole = session.user.role
  
  // Get date range from URL search params (defaults to 'month')
  const params = await searchParams
  const dateRangeParam = params.range as string | undefined
  const validDateRanges: DateRangePreset[] = ['today', 'week', 'month', '3months', '6months', 'year']
  const dateRange: DateRangePreset = validDateRanges.includes(dateRangeParam as DateRangePreset) 
    ? (dateRangeParam as DateRangePreset) 
    : 'month'
  
  const dashboardData = await getDashboardData(dateRange)

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

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
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
        
        {/* Date Range Selector */}
        <DateRangeSelector currentRange={dateRange} />
      </div>

      {/* Role-based dashboard */}
      <RoleDashboardRouter userRole={userRole} dashboardData={dashboardData} dateRange={dateRange} />
    </DashboardLayout>
  )
}
