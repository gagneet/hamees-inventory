'use client'

/**
 * @featuretrace Dashboard Client
 * @component DashboardClient
 * @description Entry point for all role-specific dashboard views.
 *   Fetches enhanced stats from the API and routes to the correct dashboard
 *   component based on the user's role.
 *
 * @calls GET /api/dashboard/enhanced-stats — returns KPIs, charts, order lists
 * @renders RoleDashboardRouter → OwnerDashboard | TailorDashboard | SalesManagerDashboard |
 *          InventoryManagerDashboard (based on userRole prop from server)
 */

import { useEffect, useState } from 'react'
import { RoleDashboardRouter } from './role-dashboard-router'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'

interface DashboardClientProps {
  userRole: string
}

export function DashboardClient({ userRole }: DashboardClientProps) {
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard/enhanced-stats')

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }

        const data = await response.json()
        setDashboardData(data)
      } catch (err) {
        console.error('Error fetching dashboard:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Stats cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardHeader>
            </Card>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-48 w-full" /></CardHeader></Card>
          <Card><CardHeader><Skeleton className="h-48 w-full" /></CardHeader></Card>
        </div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Error Loading Dashboard</CardTitle>
          <CardDescription className="text-red-700">
            {error || 'Failed to load dashboard statistics'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <RoleDashboardRouter userRole={userRole} dashboardData={dashboardData} />
}
