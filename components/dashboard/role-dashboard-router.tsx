'use client'

import dynamic from 'next/dynamic'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Dynamic imports for dashboard components (bundle size optimization)
const TailorDashboard = dynamic(() => import('./tailor-dashboard').then(mod => ({ default: mod.TailorDashboard })), {
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
}

export function RoleDashboardRouter({ userRole, dashboardData, dateRange = 'month' }: RoleDashboardRouterProps) {
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
      return <TailorDashboard stats={dashboardData.tailor} />

    case 'INVENTORY_MANAGER':
      return (
        <InventoryManagerDashboard
          stats={dashboardData.inventory}
          generalStats={dashboardData.generalStats}
        />
      )

    case 'SALES_MANAGER':
      return (
        <SalesManagerDashboard
          stats={dashboardData.sales}
          generalStats={dashboardData.generalStats}
        />
      )

    case 'OWNER':
    case 'ADMIN':
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
      // Viewer gets a simplified version - we can show the Owner dashboard in read-only mode
      return (
        <OwnerDashboard
          stats={dashboardData.financial}
          generalStats={dashboardData.generalStats}
          alerts={dashboardData.alerts}
          orderStatus={dashboardData.orderStatus}
          salesStats={dashboardData.sales}
        />
      )

    default:
      return (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Not Available</CardTitle>
            <CardDescription>
              No dashboard configured for role: {userRole}
            </CardDescription>
          </CardHeader>
        </Card>
      )
  }
}
