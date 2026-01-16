'use client'

import { useEffect, useState } from 'react'
import { TailorDashboard } from './tailor-dashboard'
import { InventoryManagerDashboard } from './inventory-manager-dashboard'
import { SalesManagerDashboard } from './sales-manager-dashboard'
import { OwnerDashboard } from './owner-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface RoleDashboardRouterProps {
  userRole: string
  dateRange?: string
}

export function RoleDashboardRouter({ userRole, dateRange = 'month' }: RoleDashboardRouterProps) {
  const [enhancedStats, setEnhancedStats] = useState<any>(null)
  const [generalStats, setGeneralStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        setError(null)

        // Fetch both enhanced and general stats in parallel
        const [enhancedResponse, generalResponse] = await Promise.all([
          fetch(`/api/dashboard/enhanced-stats?range=${dateRange}`),
          fetch('/api/dashboard/stats'),
        ])

        if (!enhancedResponse.ok || !generalResponse.ok) {
          throw new Error('Failed to fetch dashboard stats')
        }

        const enhanced = await enhancedResponse.json()
        const general = await generalResponse.json()

        setEnhancedStats(enhanced)
        setGeneralStats(general)
      } catch (err) {
        console.error('Error fetching dashboard stats:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [dateRange])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !enhancedStats || !generalStats) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-900">Error Loading Dashboard</CardTitle>
          <CardDescription className="text-red-700">
            {error || 'Failed to load dashboard statistics'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Please refresh the page or contact support if the issue persists.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Route to appropriate dashboard based on role
  switch (userRole) {
    case 'TAILOR':
      return <TailorDashboard stats={enhancedStats.tailor} />

    case 'INVENTORY_MANAGER':
      return (
        <InventoryManagerDashboard
          stats={enhancedStats.inventory}
          generalStats={generalStats}
        />
      )

    case 'SALES_MANAGER':
      return (
        <SalesManagerDashboard
          stats={enhancedStats.sales}
          generalStats={generalStats}
        />
      )

    case 'OWNER':
    case 'ADMIN':
      return (
        <OwnerDashboard
          stats={enhancedStats.financial}
          generalStats={generalStats}
        />
      )

    case 'VIEWER':
      // Viewer gets a simplified version - we can show the Owner dashboard in read-only mode
      return (
        <OwnerDashboard
          stats={enhancedStats.financial}
          generalStats={generalStats}
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
