'use client'

/**
 * @featuretrace Role dashboard router
 * Chooses the dashboard for the user's role. Financial dashboards are only rendered for roles
 * that receive financial data from the API (OWNER/ADMIN); VIEWER gets a read-only, amount-free
 * overview. MASTER_TAILOR gets the production supervisor dashboard.
 */

import dynamic from 'next/dynamic'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Dynamic imports for dashboard components (bundle size optimization)
const TailorDashboard = dynamic(() => import('./tailor-dashboard').then(mod => ({ default: mod.TailorDashboard })), {
  loading: () => <DashboardLoader />
})

const MasterTailorDashboard = dynamic(() => import('./master-tailor-dashboard').then(mod => ({ default: mod.MasterTailorDashboard })), {
  loading: () => <DashboardLoader />
})

const InventoryManagerDashboard = dynamic(() => import('./inventory-manager-dashboard').then(mod => ({ default: mod.InventoryManagerDashboard })), {
  loading: () => <DashboardLoader />
})

const SalesManagerDashboard = dynamic(() => import('./sales-manager-dashboard').then(mod => ({ default: mod.SalesManagerDashboard })), {
  loading: () => <DashboardLoader />
})

const OwnerDashboard = dynamic(() => import('./owner-dashboard').then(mod => ({ default: mod.OwnerDashboard })), {
  loading: () => <DashboardLoader />
})

const ViewerDashboard = dynamic(() => import('./viewer-dashboard').then(mod => ({ default: mod.ViewerDashboard })), {
  loading: () => <DashboardLoader />
})

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-slate-600">Loading dashboard components...</p>
      </div>
    </div>
  )
}

interface RoleDashboardRouterProps {
  userRole: string
  dashboardData: any // API response from /api/dashboard/enhanced-stats
  dateRange?: string
  onRefresh?: () => void
}

function MissingSection({ userRole }: { userRole: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard Not Available</CardTitle>
        <CardDescription>No dashboard data is available for role: {userRole}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function RoleDashboardRouter({ userRole, dashboardData, onRefresh }: RoleDashboardRouterProps) {
  if (!dashboardData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Error Loading Dashboard</CardTitle>
          <CardDescription className="text-red-700">
            Failed to load dashboard statistics
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Route to appropriate dashboard based on role
  switch (userRole) {
    case 'TAILOR':
      if (!dashboardData.tailor) return <MissingSection userRole={userRole} />
      return <TailorDashboard stats={dashboardData.tailor} />

    case 'MASTER_TAILOR':
      if (!dashboardData.production) return <MissingSection userRole={userRole} />
      return <MasterTailorDashboard production={dashboardData.production} onRefresh={onRefresh} />

    case 'INVENTORY_MANAGER':
      if (!dashboardData.inventory) return <MissingSection userRole={userRole} />
      return (
        <InventoryManagerDashboard
          stats={dashboardData.inventory}
          generalStats={dashboardData.generalStats}
        />
      )

    case 'SALES_MANAGER':
      if (!dashboardData.sales) return <MissingSection userRole={userRole} />
      return (
        <SalesManagerDashboard
          stats={dashboardData.sales}
          generalStats={dashboardData.generalStats}
        />
      )

    case 'OWNER':
    case 'ADMIN':
      if (!dashboardData.financial) return <MissingSection userRole={userRole} />
      return (
        <OwnerDashboard
          stats={dashboardData.financial}
          generalStats={dashboardData.generalStats}
          alerts={dashboardData.alerts}
          orderStatus={dashboardData.orderStatus}
          salesStats={dashboardData.sales}
        />
      )

    case 'VIEWER':
      // Read-only, amount-free overview (never the financial Owner dashboard)
      return (
        <ViewerDashboard
          generalStats={dashboardData.generalStats}
          sales={dashboardData.sales}
          orderStatus={dashboardData.orderStatus}
          alerts={dashboardData.alerts}
        />
      )

    default:
      return <MissingSection userRole={userRole} />
  }
}
